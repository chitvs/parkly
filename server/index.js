const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
require('dotenv').config({
  path: require('path').resolve(__dirname, '.env')
});

const db = require('./database/db');
const authRoutes = require('./routes/auth');
const garagesRoutes = require('./routes/garage');
const prenotazioniRoutes = require('./routes/prenotazioni');
const messaggiRoutes = require('./routes/messaggi');

const app = express();
const port = process.env.PORT || 3000;

// MIDDLEWARE DI BASE 
const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());

// CONFIGURAZIONE DELLA SESSIONE 
// Estratta in variabile per poterla condividere con Socket.io
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET, // sicurezza, firma digitale per i cookie
  resave: false,  // non salvare la sessione se non ci sono modifiche
  saveUninitialized: false, // non creare la sessione finchè non viene salvato qualcosa
  cookie: { maxAge: 1000 * 60 * 60 * 24, secure: false, sameSite: 'lax' } // 24 ore
});
app.use(sessionMiddleware);

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

//  FRONTEND STATICO 
app.use('/client', express.static(path.join(__dirname, '../client')));

//  ROUTE API 
app.use('/api/auth', authRoutes);
app.use('/api/garage', garagesRoutes);
app.use('/api/prenotazioni', prenotazioniRoutes);
app.use('/api/messaggi', messaggiRoutes);  

//  TEST DB 
app.get('/test-db', (req, res) => {
    db.any('SELECT NOW()')
        .then(data => {
            console.log('Risultati della query:', data);
            res.json({ 
                success: true, 
                orario: data[0].now 
            });
        })
    .catch(error => {
        console.error('Errore nella query:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Connessione fallita' 
        });
    });
});

//  ROUTE DASHBOARD GESTORE 
// recupera i garage del gestore loggato
app.get('/api/garages-gestore', async (req, res) => {
  try {
    const utenteLoggato = req.session?.utente;
    if (!utenteLoggato || utenteLoggato.ruolo !== 'GESTORE'){
      return res.status(401).json({ error: 'Accesso negato' });
    }
    const idGestore = utenteLoggato.id;
    const result = await db.any('SELECT * FROM Garage WHERE ID_Gestore = $1', [idGestore]);
    res.json(result);
  } catch (error) {
    console.error('Errore recupero garage:', error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

//crea un nuovo garage per il gestore loggato
app.post('/api/garages-gestore', async (req, res) => {
  try {
    const utenteLoggato = req.session?.utente;
    if (!utenteLoggato || utenteLoggato.ruolo !== 'GESTORE')
      return res.status(401).json({ error: 'Accesso negato' });
    const idGestore = utenteLoggato.id;
    const { 
      nome,
      descrizione, 
      indirizzo, 
      tariffabase, 
      altezzamassima,
      orarioapertura, 
      orariochiusura, 
      is24h, 
      mappatestuale 
    } = req.body;

    // Validazione campi obbligatori
    if (!nome || !indirizzo || !tariffabase){
      return res.status(400).json({ error: 'Nome, indirizzo e tariffa base sono obbligatori.' });
    }

    // Se is24h, usiamo orari di default (vengono ignorati dalla logica ma la colonna è NOT NULL)
    const apertura = is24h ? '00:00' : (orarioapertura || '08:00');
    const chiusura = is24h ? '23:59' : (orariochiusura || '20:00');
    // Il testo della planimetria arriva già come stringa dal FileReader del frontend
    const mappa = mappatestuale || null;

    const result = await db.one(
      `INSERT INTO Garage
        (ID_Gestore, Nome, Descrizione, Indirizzo, AltezzaMassima, TariffaBase, OrarioApertura, OrarioChiusura, Is24h, MappaTestuale, IsAttivo)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
       RETURNING *`,
      [
        idGestore,
        nome,
        descrizione || null,
        indirizzo,
        altezzamassima || null,
        tariffabase,
        apertura,
        chiusura,
        is24h || false,
        mappa
      ]
    );

    res.status(201).json({ success: true, garage: result });

  } catch (error) {
    console.error('Errore creazione garage:', error);
    res.status(500).json({ error: 'Errore interno del server.' });
  }
});

//Recupera lo storico delle prenotazioni del gestore loggato
app.get('/api/prenotazioni-gestore', async (req, res) => {
  try {
    const utenteLoggato = req.session?.utente;
    if (!utenteLoggato || utenteLoggato.ruolo !== 'GESTORE')
      return res.status(401).json({ error: 'Accesso negato' });
    const idGestore = utenteLoggato.id;
    const query = `
      SELECT
        p.*,
        pa.ID_Garage              AS id_garage,
        g.Nome                    AS nome_garage,
        u_cliente.Nome            AS nomecliente,
        u_cliente.Cognome         AS cognomecliente
      FROM Prenotazione p
      JOIN PostoAuto pa         ON pa.ID_Posto    = p.ID_Posto
      JOIN Garage g             ON g.ID_Garage    = pa.ID_Garage
      JOIN Utente u_cliente     ON u_cliente.ID_Utente = p.ID_Utente
      WHERE g.ID_Gestore = $1
      ORDER BY p.DataCreazione DESC
    `;
    const result = await db.any(query, [idGestore]);
    res.json(result);
  } catch (error) {
    console.error('Errore recupero prenotazioni:', error);
    res.status(500).json({ error: 'Errore interno' });
  }
});

// recupera le allerte/stato
app.get('/api/stato-garages-gestore', async (req, res) => {
  res.json([]);
});

// ─── HTTP SERVER + SOCKET.IO ──────────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Condividi il sessionMiddleware con Socket.io:
// così socket.request.session contiene la sessione dell'utente loggato
io.engine.use(sessionMiddleware);

//  AUTENTICAZIONE SOCKET TRAMITE SESSIONE 
io.use((socket, next) => {
  const utente = socket.request.session?.utente;
  if (!utente) {
    return next(new Error('Non autenticato: sessione mancante o scaduta.'));
  }
  socket.utente = utente; // { id, ruolo, nome, cognome, ... }
  next();
});

//  HELPER: verifica relazione prenotazione fra mittente e destinatario 
async function verificaRelazione(idMittente, idDestinatario, idGarage) {
  const rows = await db.any(
    `SELECT 1
     FROM Prenotazione p
     JOIN PostoAuto pa ON pa.ID_Posto = p.ID_Posto
     JOIN Garage g ON g.ID_Garage = pa.ID_Garage
     WHERE g.ID_Garage = $3
       AND (
         (p.ID_Utente = $1 AND g.ID_Gestore = $2)
         OR
         (g.ID_Gestore = $1 AND p.ID_Utente = $2)
       )
     LIMIT 1`,
    [idMittente, idDestinatario, idGarage]
  );
  return rows.length > 0;
}

//  LOGICA SOCKET.IO 
io.on('connection', (socket) => {
  const utente = socket.utente;
  console.log(`[Socket] Connesso: ${utente.nome} ${utente.cognome} (ID: ${utente.id})`);

  // Room privata per questo utente
  socket.join(`user:${utente.id}`);

  //  Invio messaggio 
  socket.on('invia_messaggio', async ({ idDestinatario, idGarage, testo }) => {
    if (!idDestinatario || !idGarage || !testo?.trim()) {
      return socket.emit('errore', { msg: 'Dati messaggio incompleti.' });
    }

    try {
      const autorizzato = await verificaRelazione(utente.id, idDestinatario, idGarage);
      if (!autorizzato) {
        return socket.emit('errore', {
          msg: 'Non sei autorizzato a contattare questo utente per questo garage.'
        });
      }

      const messaggio = await db.one(
        `INSERT INTO Messaggio (ID_Mittente, ID_Destinatario, ID_Garage, Testo)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [utente.id, idDestinatario, idGarage, testo.trim()]
      );

      const payload = {
        ...messaggio,
        nomemittente: utente.nome,
        cognomemittente: utente.cognome,
      };

      // Recapita al destinatario (se online)
      io.to(`user:${idDestinatario}`).emit('nuovo_messaggio', payload);

      // Conferma al mittente
      socket.emit('messaggio_inviato', payload);

    } catch (err) {
      console.error('[Socket] Errore invio messaggio:', err);
      socket.emit('errore', { msg: "Errore interno durante l'invio." });
    }
  });

  //  "Sta scrivendo..." 
  socket.on('sta_scrivendo', ({ idDestinatario, idGarage }) => {
    io.to(`user:${idDestinatario}`).emit('utente_sta_scrivendo', {
      idMittente: utente.id,
      idGarage,
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnesso: ${utente.nome} (ID: ${utente.id})`);
  });
});

//  AVVIO 
httpServer.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}...`);
});