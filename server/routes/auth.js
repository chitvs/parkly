const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database/db');
const { isLoggato } = require('../middleware/authMiddleware');

// Registrazione
router.post('/register', async (req, res) => {
    const { 
        nome, 
        cognome, 
        email, 
        password, 
        ruolo,
        telefono,
        codiceFiscale
    } = req.body;

    try {
        // l'email esiste?
        const utenteEsistente = await db.oneOrNone('SELECT * FROM Utente WHERE Email = $1', [email]);
    
        // se l'email esiste, lancio un errore
        if (utenteEsistente) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email già registrata' 
            });
        }

        // crypt usando la libreria bcrypt
        const passwordHash = await bcrypt.hash(password, 10);

        // salvataggio nel db
        const nuovoUtente = await db.one(
            'INSERT INTO Utente (Nome, Cognome, Email, PasswordHash, Ruolo, Telefono, codiceFiscale) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_utente, nome, email, ruolo    ',
            [nome, cognome, email, passwordHash, ruolo || 'CLIENTE', telefono || null, codiceFiscale || null] // default CLIENTE se ruolo non specificato
        );

        req.session.utente = {
            id: nuovoUtente.id_utente,
            nome: nuovoUtente.nome,
            email: nuovoUtente.email,
            ruolo: nuovoUtente.ruolo
        };

        res.json({ 
            success: true, 
            messaggio: 'Registrazione completata',
            utente: req.session.utente 
        });

    } catch (err) {
        console.error('Errore registrazione:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Errore' 
        });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { 
        email, 
        password 
    } = req.body;

    try {
        const utente = await db.oneOrNone('SELECT * FROM Utente WHERE Email = $1', [email]);
        
        if (!utente) {
            return res.status(401).json({ 
                success: false, 
                error: 'Email non valida' 
            });
        }

        // confronto le pw usando bcrypt
        const passwordOk = await bcrypt.compare(password, utente.passwordhash);

        if (!passwordOk) {
            return res.status(401).json({ 
                success: false, 
                error: 'Password errata' 
            });
        }

        // salvo utente nella sessione
        req.session.utente = {
            id: utente.id_utente,
            nome: utente.nome,
            email: utente.email,
            ruolo: utente.ruolo
        };

        res.json({ 
            success: true, 
            utente: req.session.utente 
        });

    } catch (err) {
        console.error('Errore login:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Errore interno'     
        });
    }
});

// Logout
router.post('/logout', (req, res) => {
    if (!req.session) {
        return res.status(400).json({ success: false, message: "Nessuna sessione attiva" });
    }
    req.session.destroy((err) => {
        if (err) {
            console.error("Errore durante la distruzione della sessione:", err);
            return res.status(500).json({ success: false, message: "Impossibile chiudere la sessione" });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: "Logout effettuato con successo" });
    });
});

// Sincronizzazione del frontend con sessione reale sul server
router.get('/me', isLoggato, (req, res) => {
    res.json({ 
        success: true, 
        utente: req.session.utente 
    });
});

module.exports = router;
