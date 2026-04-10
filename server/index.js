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
app.use(cors());
app.use(express.json());

// CONFIGURAZIONE DELLA SESSIONE
app.use(session({
    secret: process.env.SESSION_SECRET , // sicurezza, firma digitale per i cookie
    resave: false, // non salvare la sessione se non ci sono modifiche
    saveUninitialized: false, // non creare la sessione finchè non viene salvato qualcosa
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 ore
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

app.listen(port, () => {
    console.log(`Server in ascolto sulla porta ${port}...`);
});
