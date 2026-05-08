const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../database/db');
const { isLoggato } = require('../middleware/authMiddleware');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

// configura il client Supabase usando le variabili dell'environment
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// configura Multer (handler per le foto prima di mandarle a Supabase)
const upload = multer({ storage: multer.memoryStorage() });

// Registrazione
router.post('/register', async (req, res) => {
    const {
        nome,
        cognome,
        nomeUtente,
        email,
        password,
        ruolo,
        telefono,
        codiceFiscale
    } = req.body;

    try {
        // l'email o il nome utente esistono?
        const utenteEsistente = await db.oneOrNone(
            'SELECT * FROM Utente WHERE Email = $1 OR NomeUtente = $2',
            [email, nomeUtente]
        );

        // se l'email esiste, lancio un errore
        if (utenteEsistente) {
            return res.status(400).json({
                success: false,
                error: 'Email o Nome Utente già in uso'
            });
        }

        // crypt usando la libreria bcrypt
        const passwordHash = await bcrypt.hash(password, 10);

        // salvataggio nel db
        const nuovoUtente = await db.one(
            'INSERT INTO Utente (Nome, Cognome, NomeUtente, Email, PasswordHash, Ruolo, Telefono, codiceFiscale) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_utente, nome, cognome, nomeutente, email, ruolo',
            [nome, cognome, nomeUtente, email, passwordHash, ruolo || 'CLIENTE', telefono || null, codiceFiscale || null] // default CLIENTE se ruolo non specificato
        );

        req.session.utente = {
            id: nuovoUtente.id_utente,
            nome: nuovoUtente.nome,
            cognome: nuovoUtente.cognome,
            nomeUtente: nuovoUtente.nomeUtente,
            saldo: 0.00,
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
        identificatore, // email o nomeutente 
        password
    } = req.body;

    try {
        const utente = await db.oneOrNone(
            'SELECT * FROM Utente WHERE (Email = $1 OR NomeUtente = $1) AND IsAttivo = TRUE',
            [identificatore]
        );

        if (!utente) {
            return res.status(401).json({
                success: false,
                error: 'Credenziali non valide'
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
            cognome: utente.cognome,
            nomeUtente: utente.nomeutente,
            saldo: utente.saldo,
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

// Cambio Password
router.put('/change-password', async (req, res) => {
    // Sicurezza: l'utente deve essere loggato
    if (!req.session.utente || !req.session.utente.id) {
        return res.status(401).json({ success: false, error: 'Non autorizzato' });
    }

    const { currentPassword, newPassword } = req.body;

    try {
        // Recupero l'hash della password attuale dal database
        const utente = await db.oneOrNone('SELECT PasswordHash FROM Utente WHERE id_utente = $1', [req.session.utente.id]);

        if (!utente) {
            return res.status(404).json({ success: false, error: 'Utente non trovato' });
        }

        // Confronto la password inserita con l'hash nel DB
        const passwordOk = await bcrypt.compare(currentPassword, utente.passwordhash);

        if (!passwordOk) {
            return res.status(401).json({ success: false, error: 'La password attuale è errata' });
        }

        // Se è corretta, cripto la nuova password
        const nuovoHash = await bcrypt.hash(newPassword, 10);

        // Salvo la nuova password nel database
        await db.none('UPDATE Utente SET PasswordHash = $1 WHERE id_utente = $2', [nuovoHash, req.session.utente.id]);

        res.json({ success: true, messaggio: 'Password aggiornata con successo' });

    } catch (err) {
        console.error('Errore cambio password:', err);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
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
            `SELECT id_utente, nome, cognome, nomeutente, email, telefono, codiceFiscale, fotoprofilo_url, ruolo, saldo 
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

    const { nome, cognome, nomeUtente, email, telefono, codiceFiscale } = req.body;

    try {
        // Controllo se l'utente sta cercando di usare un'email già presa da qualcun altro, controllo anche il nome utente
        const datiEsistenti = await db.oneOrNone(
            'SELECT id_utente FROM Utente WHERE (Email = $1 OR NomeUtente = $2) AND id_utente != $3',
            [email, nomeUtente, req.session.utente.id]
        );

        if (datiEsistenti) {
            return res.status(400).json({
                success: false,
                error: 'Questa email o nome utente è già in uso da un altro account'
            });
        }

        // Eseguo l'UPDATE nel database
        const utenteAggiornato = await db.one(
            `UPDATE Utente 
             SET Nome = $1, Cognome = $2, NomeUtente = $3, Email = $4, Telefono = $5, codiceFiscale = $6 
             WHERE id_utente = $7 
             RETURNING id_utente, nome, nomeutente, email, ruolo`,
            [nome, cognome, nomeUtente, email, telefono || null, codiceFiscale || null, req.session.utente.id]
        );

        // Aggiorno i dati salvati nella sessione (nel caso abbia cambiato nome o email)
        req.session.utente.nome = utenteAggiornato.nome;
        req.session.utente.nomeUtente = utenteAggiornato.nomeutente;
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

// eliminazione account (soft-delete)
router.delete('/delete-account', async (req, res) => {
    // l'utente è loggato?
    if (!req.session.utente || !req.session.utente.id) {
        return res.status(401).json({ success: false, error: 'Non autorizzato' });
    }

    try {
        const utenteId = req.session.utente.id;

        // spengo l'utente nel db (soft-delete)
        await db.none('UPDATE Utente SET IsAttivo = FALSE WHERE id_utente = $1', [utenteId]);

        // distruggo la sessione corrente in modo che venga buttato fuori dall'app
        req.session.destroy((err) => {
            if (err) {
                console.error("Errore distruzione sessione dopo eliminazione:", err);
                return res.status(500).json({ success: false, error: "Impossibile disconnettere l'account" });
            }
            res.clearCookie('connect.sid');
            res.json({ success: true, message: "Account eliminato con successo" });
        });

    } catch (err) {
        console.error('Errore durante eliminazione account:', err);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
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

        // RECUPERO E CANCELLO LA FOTO VECCHIA (se esiste)
        const vecchiaUrl = req.session.utente.fotoProfilo_URL;

        if (vecchiaUrl) {
            // Estrapolo solo il nome del file finale dall'URL (es: 12_avatar_1690000.jpg)
            const vecchioNomeFile = vecchiaUrl.split('/').pop();

            // Dico a Supabase di cancellarlo dal bucket
            await supabase.storage.from('avatars').remove([vecchioNomeFile]);
        }

        //CREO LA NUOVA FOTO
        const estensione = file.originalname.split('.').pop();
        const nomeFile = `${utenteId}_avatar_${Date.now()}.${estensione}`;

        // Carico il file su Supabase Storage nel bucket 'avatars'
        const { data, error } = await supabase
            .storage
            .from('avatars')
            .upload(nomeFile, file.buffer, {
                contentType: file.mimetype,
                upsert: false // Messo a false: avendo Date.now() il nome è sempre unico, non c'è niente da sovrascrivere
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

        // Aggiorna la sessione attuale con la nuova foto
        req.session.utente.fotoProfilo_URL = urlFoto;

        res.json({ success: true, url: urlFoto });

    } catch (error) {
        console.error('Errore upload:', error);
        res.status(500).json({ success: false, error: 'Errore durante il caricamento' });
    }
});

// Endpoint per promuovere un utente a GESTORE
router.put('/upgrade-role', isLoggato, async (req, res) => {
    try {
        const utenteId = req.session.utente.id;

        // 1. Aggiornamento sul database: impostiamo il ruolo a 'GESTORE'
        const utenteAggiornato = await db.one(
            'UPDATE Utente SET Ruolo = $1 WHERE id_utente = $2 RETURNING ruolo',
            ['GESTORE', utenteId]
        );

        // 2. Sincronizzazione della sessione: 
        req.session.utente.ruolo = utenteAggiornato.ruolo;

        res.json({
            success: true,
            messaggio: 'Congratulazioni! Ora sei un Gestore su Parkly.',
            utente: req.session.utente
        });

    } catch (err) {
        console.error('Errore durante l\'upgrade del ruolo:', err);
        res.status(500).json({
            success: false,
            error: 'Errore interno durante l\'aggiornamento del profilo.'
        });
    }
});

module.exports = router;