const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { isLoggato } = require('../middleware/authMiddleware');

router.post('/', isLoggato, async (req, res) => {
    const { 
        id_posto, 
        targa, 
        inizio, 
        fine, 
        prezzo_totale 
    } = req.body;

    const id_utente = req.session.utente.id;

    try {
        // controllo disponibilità
        const occupato = await db.oneOrNone(`
            SELECT ID_Prenotazione FROM Prenotazione 
            WHERE ID_Posto = $1 
            AND Stato = 'ATTIVA'
            AND (InizioSosta, FineSosta) OVERLAPS ($2::timestamp, $3::timestamp)
        `, [id_posto, inizio, fine]);

        if (occupato) {
            return res.status(409).json({ success: false, error: 'Posto non più disponibile' });
        }

        // genero il codice prenotazione
        // Math.random().toString(36) converte un numero casuale in una stringa alfanumerica
        // substring(2, 10) prende 8 caratteri, saltando la parte inizale
        const codice = 'PR-' + Math.random().toString(36).substring(2, 10).toUpperCase();

        const nuova = await db.one(`
            INSERT INTO Prenotazione (ID_Utente, ID_Posto, CodicePrenotazione, Targa, InizioSosta, FineSosta, PrezzoTotale)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING ID_Prenotazione, CodicePrenotazione
        `, [id_utente, id_posto, codice, targa, inizio, fine, prezzo_totale]);

        res.json({ 
            success: true, 
            messaggio: 'Prenotazione confermata', 
            prenotazione: nuova 
        });
    } catch (err) {
        console.error('Errore salvataggio prenotazione:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Errore interno' 
        });
    }
});

module.exports = router;