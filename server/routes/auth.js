const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database/db'); // Questo file usa in automatico DB_USER, DB_PASSWORD, ecc.
const { isLoggato } = require('../middleware/authMiddleware');

// --- NUOVE IMPORTAZIONI PER L'UPLOAD FOTO ---
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

// Configura il client Supabase usando le nuove variabili del .env
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Configura Multer (handler per le foto prima di mandarle a Supabase)
const upload = multer({ storage: multer.memoryStorage() });




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
            ruolo: utente.ruolo,
            fotoProfilo_URL: utente.fotoprofilo_url 
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

// Recupero dati profilo utente loggato
router.get('/profile', async (req, res) => {
    // Controllo se l'utente ha una sessione attiva
    if (!req.session.utente || !req.session.utente.id) {
        return res.status(401).json({ 
            success: false, 
            error: 'Non autorizzato. Effettua il login.' 
        });
    }

    try {
        // Cerco l'utente nel DB tramite il suo ID (salvato nella sessione)
        // N.B: NON selezioniamo la password (PasswordHash) per sicurezza!
        
        const utente = await db.oneOrNone(
            `SELECT id_utente, nome, cognome, email, telefono, codiceFiscale, fotoprofilo_url, ruolo 
            FROM Utente WHERE id_utente = $1`, 
            [req.session.utente.id]
        );

        if (!utente) {
            return res.status(404).json({ success: false, error: 'Utente non trovato' });
        }

        // Restituisco i dati al frontend
        res.json({ 
            success: true, 
            data: utente 
        });

    } catch (err) {
        console.error('Errore recupero profilo:', err);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});


// Aggiornamento dati profilo utente loggato
router.put('/profile', async (req, res) => {
    //  Controllo sicurezza: l'utente è loggato?
    if (!req.session.utente || !req.session.utente.id) {
        return res.status(401).json({ 
            success: false, 
            error: 'Non autorizzato. Effettua il login.' 
        });
    }

    const { nome, cognome, email, telefono, codiceFiscale } = req.body;

    try {
        // Controllo se l'utente sta cercando di usare un'email già presa da qualcun altro
        const emailEsistente = await db.oneOrNone(
            'SELECT id_utente FROM Utente WHERE Email = $1 AND id_utente != $2', 
            [email, req.session.utente.id]
        );

        if (emailEsistente) {
            return res.status(400).json({ 
                success: false, 
                error: 'Questa email è già in uso da un altro account' 
            });
        }

        // Eseguo l'UPDATE nel database
        const utenteAggiornato = await db.one(
            `UPDATE Utente 
             SET Nome = $1, Cognome = $2, Email = $3, Telefono = $4, codiceFiscale = $5 
             WHERE id_utente = $6 
             RETURNING id_utente, nome, email, ruolo`,
            [nome, cognome, email, telefono || null, codiceFiscale || null, req.session.utente.id]
        );

        // Aggiorno i dati salvati nella sessione (nel caso abbia cambiato nome o email)
        req.session.utente.nome = utenteAggiornato.nome;
        req.session.utente.email = utenteAggiornato.email;

        res.json({ 
            success: true, 
            messaggio: 'Profilo aggiornato con successo',
            utente: req.session.utente // Rimandiamo indietro l'utente aggiornato
        });

    } catch (err) {
        console.error('Errore aggiornamento profilo:', err);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
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

// Nuova API per l'upload della foto
router.post('/upload-avatar', upload.single('avatar'), async (req, res) => {
    // Controllo sicurezza
    if (!req.session.utente) return res.status(401).json({ error: 'Non autorizzato' });
    if (!req.file) return res.status(400).json({ error: 'Nessun file caricato' });

    try {
        const file = req.file;
        const utenteId = req.session.utente.id;
        
        // Creo un nome unico per il file usando l'ID Utente(es. 12_avatar.jpg)
        const estensione = file.originalname.split('.').pop();
        const nomeFile = `${utenteId}_avatar.${estensione}`;

        // Carico il file su Supabase Storage nel bucket 'avatars'
        const { data, error } = await supabase
            .storage
            .from('avatars')
            .upload(nomeFile, file.buffer, {
                contentType: file.mimetype,
                upsert: true // Se l'utente cambia foto, sovrascrive la vecchia!
            });

        if (error) throw error;

        // Ottengo l'URL pubblico della foto appena caricata
        const { data: publicUrlData } = supabase
            .storage
            .from('avatars')
            .getPublicUrl(nomeFile);

        const urlFoto = publicUrlData.publicUrl;

        // Salvo l'URL nel database PostgreSQL aggiornando l'utente
        await db.none('UPDATE Utente SET FotoProfilo_URL = $1 WHERE id_utente = $2', [urlFoto, utenteId]);

        //Aggiorna la sessione attuale con la nuova foto
        req.session.utente.fotoProfilo_URL = urlFoto;

        res.json({ success: true, url: urlFoto });

    } catch (error) {
        console.error('Errore upload:', error);
        res.status(500).json({ success: false, error: 'Errore durante il caricamento' });
    }
});

module.exports = router;
