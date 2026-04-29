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


// rotte per la dashboard gestore

// recupera i garage del gestore loggato
app.get('/api/garages-gestore', async (req, res) => {
  try {
    const utenteLoggato = req.session?.utente;
    if (!utenteLoggato || utenteLoggato.ruolo !== 'GESTORE') {
      return res.status(401).json({ error: 'Accesso negato' });
    }
    const idGestore = utenteLoggato.id;
    const result = await db.any('SELECT * FROM Garage WHERE ID_Gestore = $1', [idGestore]);
    res.json(result);
  } catch (error) {
    console.error("Errore recupero garage:", error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// crea un nuovo garage per il gestore loggato
app.post('/api/garages-gestore', async (req, res) => {
  try {
    const utenteLoggato = req.session?.utente;
    if (!utenteLoggato || utenteLoggato.ruolo !== 'GESTORE') {
      return res.status(401).json({ error: 'Accesso negato' });
    }

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
    if (!nome || !indirizzo || !tariffabase) {
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
    console.error("Errore creazione garage:", error);
    res.status(500).json({ error: 'Errore interno del server.' });
  }
});

app.get('/api/prenotazioni-gestore', async (req, res) => {
  try {
    const utenteLoggato = req.session?.utente;
    if (!utenteLoggato || utenteLoggato.ruolo !== 'GESTORE') {
      return res.status(401).json({ error: 'Accesso negato' });
    }
    const idGestore = utenteLoggato.id;
    const query = `
      SELECT p.*, g.Nome as nome_garage 
      FROM Prenotazione p
      JOIN PostoAuto pa ON p.ID_Posto = pa.ID_Posto
      JOIN Garage g ON pa.ID_Garage = g.ID_Garage
      WHERE g.ID_Gestore = $1
    `;
    const result = await db.any(query, [idGestore]);
    res.json(result);
  } catch (error) {
    console.error("Errore recupero prenotazioni:", error);
    res.status(500).json({ error: 'Errore interno' });
  }
});

// recupera lo storico delle prenotazioni del gestore loggato
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

// recupera le allerte/stato
app.get('/api/stato-garages-gestore', async (req, res) => {
  res.json([]); 
});

app.listen(port, () => {
    console.log(`Server in ascolto sulla porta ${port}...`);
});