const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path')
require('dotenv').config();
const db = require('./database/db'); 
const authRoutes = require('./routes/auth'); 
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(session({
    secret: 'parkly_s3cur1ty', // sicurezza, firma digitale per i cookie
    resave: false, // non salvare la sessione se non ci sono modifiche
    saveUninitialized: false, // non creare la sessione finchè non viene salvato qualcosa
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 ore
}));

// COLLEGAMENTO FRONTEND

app.use('/client', express.static(path.join(__dirname, '../client')));

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/pages/register.html'))});

// -----------------------

app.use('/api/auth', authRoutes); // collegamento con auth.js

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

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

// api per ritornare i garage
app.get('/api/garage', (req, res) => {
    db.any('SELECT * FROM Garage')
        .then(data => {
            res.json({ 
                success: true, 
                risultati: data.length, 
                garage: data 
            });
        })
        .catch(error => {
            console.error('Errore nel recupero dei garage:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Errore interno' 
            });
        });
});

app.listen(port, () => {
    console.log(`Server in ascolto sulla porta ${port}...`);
});
