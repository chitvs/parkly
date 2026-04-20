const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path')
require('dotenv').config({
  path: require('path').resolve(__dirname, '.env')
});
const db = require('./database/db'); 
const authRoutes = require('./routes/auth'); 
const garagesRoutes = require('./routes/garage');
const prenotazioniRoutes = require('./routes/prenotazioni');
const app = express();
const port = process.env.PORT || 3000;


// MIDDLEWARE DI BASE
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// CONFIGURAZIONE DELLA SESSIONE
app.use(session({
    secret: process.env.SESSION_SECRET, // sicurezza, firma digitale per i cookie
    resave: false, // non salvare la sessione se non ci sono modifiche
    saveUninitialized: false, // non creare la sessione finchè non viene salvato qualcosa
    cookie: { maxAge: 1000 * 60 * 60 * 24, secure: false, sameSite: 'lax' } // 24 ore
}));

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// COLLEGAMENTO FRONTEND
app.use('/client', express.static(path.join(__dirname, '../client')));

// COLLEGAMENTI API
app.use('/api/auth', authRoutes);
app.use('/api/garage', garagesRoutes);
app.use('/api/prenotazioni', prenotazioniRoutes);

// test 
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

// ==========================================
// ROTTE PER LA DASHBOARD GESTORE (Dinamiche)
// ==========================================

// 1. Recupera i garage del gestore loggato
app.get('/api/garages-gestore', async (req, res) => {
  try {
    const utenteLoggato = req.session?.utente;
    if (!utenteLoggato || utenteLoggato.ruolo !== 'GESTORE') {
      return res.status(401).json({ error: 'Accesso negato' });
    }
    const idGestore = utenteLoggato.id; // ← fix
    const result = await db.any('SELECT * FROM Garage WHERE ID_Gestore = $1', [idGestore]);
    res.json(result);
  } catch (error) {
    console.error("Errore recupero garage:", error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

app.get('/api/prenotazioni-gestore', async (req, res) => {
  try {
    const utenteLoggato = req.session?.utente;
    if (!utenteLoggato || utenteLoggato.ruolo !== 'GESTORE') {
      return res.status(401).json({ error: 'Accesso negato' });
    }
    const idGestore = utenteLoggato.id; // ← fix
    const query = `
      SELECT p.*, g.Nome as nome_garage 
      FROM Prenotazione p
      JOIN PostoAuto pa ON p.ID_Posto = pa.ID_Posto
      JOIN Garage g ON pa.ID_Garage = g.ID_Garage
      WHERE g.ID_Gestore = $1
    `; // ← fix colonna
    const result = await db.any(query, [idGestore]);
    res.json(result);
  } catch (error) {
    console.error("Errore recupero prenotazioni:", error);
    res.status(500).json({ error: 'Errore interno' });
  }
});

// 2. Recupera lo storico delle prenotazioni del gestore loggato
app.get('/api/prenotazioni-gestore', async (req, res) => {
  try {
    const utenteLoggato = req.session?.utente || req.user; 

    if (!utenteLoggato || utenteLoggato.ruolo !== 'GESTORE') {
      return res.status(401).json({ error: 'Accesso negato' });
    }

    const idGestore = utenteLoggato.id_utente;

    const query = `
      SELECT p.*, g.Nome as nome_garage 
      FROM Prenotazione p
      JOIN PostoAuto pa ON p.ID_PostoAuto = pa.ID_PostoAuto
      JOIN Garage g ON pa.ID_Garage = g.ID_Garage
      WHERE g.ID_Gestore = $1
    `;
    
    const result = await db.any(query, [idGestore]);
    
    res.json(result);
  } catch (error) {
    console.error("Errore recupero prenotazioni:", error);
    res.json([]); 
  }
});

// 3. Recupera le allerte/stato
app.get('/api/stato-garages-gestore', async (req, res) => {
  res.json([]); 
});

// ==========================================
// AVVIO SERVER (Sempre alla fine!)
// ==========================================
app.listen(port, () => {
    console.log(`Server in ascolto sulla porta ${port}...`);
});