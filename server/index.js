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
const recensioniRoutes = require('./routes/recensioni');
const walletRoutes = require('./routes/wallet');
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
app.use('/api/recensioni', recensioniRoutes);
app.use('/api/wallet', walletRoutes);

// TEST DB
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


  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnesso: ${utente.nome} (ID: ${utente.id})`);
  });
});

//  AVVIO 
httpServer.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}...`);
});