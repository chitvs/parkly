const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

// Carica le variabili d'ambiente dal file .env nella stessa directory
require('dotenv').config({
  path: require('path').resolve(__dirname, '.env')
});

const db = require('./database/db');
// Importazione delle rotte dell'applicazione
const authRoutes = require('./routes/auth');
const garagesRoutes = require('./routes/garage');
const prenotazioniRoutes = require('./routes/prenotazioni');
const recensioniRoutes = require('./routes/recensioni');
const walletRoutes = require('./routes/wallet');
const messaggiRoutes = require('./routes/messaggi');

const app = express();
const port = process.env.PORT || 3000;

// ─── MIDDLEWARE DI BASE ────────────────────────────────────────────────────────
// Configura le policy CORS per permettere le richieste dal frontend Vue (porta 5173)
const corsOptions = {
  origin: 'http://localhost:5173',
  credentials: true, // Necessario per inviare e ricevere cookie di sessione
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
// Middleware per parsare il corpo delle richieste in formato JSON
app.use(express.json());

// ─── CONFIGURAZIONE DELLA SESSIONE ─────────────────────────────────────────────
// La sessione viene creata come middleware separato così da poter essere riutilizzata 
// sia da Express (API HTTP) che da Socket.io (WebSocket).
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET, // Chiave usata per firmare il cookie
  resave: false,  // Evita di salvare la sessione nel server se non è stata modificata
  saveUninitialized: false, // Non crea una sessione finchè non viene salvato qualcosa
  cookie: { maxAge: 1000 * 60 * 60 * 24, secure: false, sameSite: 'lax' } // Scadenza 24 ore.
   });

app.use(sessionMiddleware);

// Middleware per disabilitare il caching, utile per evitare dati vecchi dopo il logout o cambi di stato
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// ─── FRONTEND STATICO ────────────────────────────────────────────────────────
app.use('/client', express.static(path.join(__dirname, '../client')));

// ─── ROUTE API ───────────────────────────────────────────────────────────────
// Associazione dei moduli di rotte ai rispettivi percorsi base
app.use('/api/auth', authRoutes);
app.use('/api/garage', garagesRoutes);
app.use('/api/prenotazioni', prenotazioniRoutes);
app.use('/api/messaggi', messaggiRoutes);  
app.use('/api/recensioni', recensioniRoutes);
app.use('/api/wallet', walletRoutes);

// ─── TEST DB ─────────────────────────────────────────────────────────────────
// Endpoint per verificare che il database risponda
app.get('/test-db', (req, res) => {
    db.any('SELECT NOW()')
        .then(data => {
            console.log('Risultati della query:', data);
            res.json({ success: true, orario: data[0].now });
        })
    .catch(error => {
        console.error('Errore nella query:', error);
        res.status(500).json({ success: false, error: 'Connessione fallita' });
    });
});

// ─── HTTP SERVER + SOCKET.IO ──────────────────────────────────────────────────
// Creazione del server HTTP partendo dall'app Express, necessario per agganciare Socket.io
const httpServer = http.createServer(app);

// Inizializzazione di Socket.io con configurazione CORS dedicata
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Condividiamo il middleware della sessione con Socket.io
// In questo modo, l'oggetto socket.request.session conterrà i dati di login creati dalle API REST
io.engine.use(sessionMiddleware);

// ─── AUTENTICAZIONE SOCKET TRAMITE SESSIONE ──────────────────────────────────
// Middleware eseguito ogni volta che un client tenta di connettersi via Socket
io.use((socket, next) => {
  const utente = socket.request.session?.utente;
  if (!utente) {
    return next(new Error('Non autenticato: sessione mancante o scaduta.'));
  }
  socket.utente = utente; // Salva l'utente sul socket per usi futuri
  next();
});

// HELPER: Verifica che il mittente sia effettivamente il cliente della prenotazione o il gestore del garage
async function verificaRelazione(idUtente, idPrenotazione) {
  const rows = await db.any(
    `SELECT 1
     FROM Prenotazione p
     JOIN PostoAuto pa ON pa.ID_Posto = p.ID_Posto
     JOIN Garage g ON g.ID_Garage = pa.ID_Garage
     WHERE p.ID_Prenotazione = $2
       AND (p.ID_Utente = $1 OR g.ID_Gestore = $1)
     LIMIT 1`,
    [idUtente, idPrenotazione]
  );
  return rows.length > 0;
}

// ─── LOGICA SOCKET.IO ────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const utente = socket.utente;
  console.log(`[Socket] Connesso: ${utente.nome} ${utente.cognome} (ID: ${utente.id})`);

  // Unisce l'utente a una stanza privata che ha come nome il suo ID (es: user:5)
  // Questo permette di inviare messaggi a uno specifico utente sapendo solo il suo ID
  socket.join(`user:${utente.id}`);

  // Listener per l'evento di invio messaggio da parte del client
  socket.on('invia_messaggio', async ({ idDestinatario, idPrenotazione, testo }) => {
    // Validazione base dell'input
    if (!idDestinatario || !idPrenotazione || !testo?.trim()) {
      return socket.emit('errore', { msg: 'Dati messaggio incompleti.' });
    }

    try {

      const autorizzato = await verificaRelazione(utente.id, idPrenotazione);
      if (!autorizzato) {
        return socket.emit('errore', { msg: 'Non autorizzato per questa prenotazione.' });
      }

      // Salvataggio permanente nel database con ID_Prenotazione
      const messaggio = await db.one(
        `INSERT INTO Messaggio (ID_Mittente, ID_Destinatario, ID_Prenotazione, Testo)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [utente.id, idDestinatario, idPrenotazione, testo.trim()]
      );

      const payload = {
        ...messaggio,
        nomemittente: utente.nome,
        cognomemittente: utente.cognome,
      };

      // Recapito in tempo reale alla stanza privata del destinatario
      io.to(`user:${idDestinatario}`).emit('nuovo_messaggio', payload);
      
      
      socket.emit('messaggio_inviato', payload);

    } catch (err) {
      console.error('[Socket] Errore invio messaggio:', err);
      socket.emit('errore', { msg: "Errore interno durante l'invio." });
    }
  });

  // Listener per la disconnessione
  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnesso: ${utente.nome} ${utente.cognome} (ID: ${utente.id})`);
  });
});

//  AVVIO 
httpServer.listen(port, () => {
  console.log(`Server in ascolto sulla porta ${port}...`);
});