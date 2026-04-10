const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { isLoggato } = require('../middleware/authMiddleware');

router.post('/', isLoggato, async (req, res) => {
    const { 
        id_posto, 
        targa, 
        note,
        inizio, 
        fine, 
        prezzo_totale 
    } = req.body;

    const id_utente = req.session.utente.id;

    try {
        const nuova = await db.tx(async t => {
            
            // controllo saldo utente
            const utente = await t.one(`SELECT Saldo FROM Utente WHERE ID_Utente = $1`, [id_utente]);
            
            const saldoCorrente = parseFloat(utente.saldo !== undefined ? utente.saldo : utente.Saldo || 0);
            const costoSosta = parseFloat(prezzo_totale);
            
            if (saldoCorrente < costoSosta) {
                throw { 
                    isCustom: true, 
                    status: 402, 
                    message: 'Credito insufficiente per completare la prenotazione.' 
                };
            }

            // controllo disponibilità
            const occupato = await t.oneOrNone(`
                SELECT ID_Prenotazione FROM Prenotazione 
                WHERE ID_Posto = $1 
                AND Stato = 'ATTIVA'
                AND (InizioSosta, FineSosta) OVERLAPS ($2::timestamp, $3::timestamp)
            `, [id_posto, inizio, fine]);

            if (occupato) {
                throw { 
                    isCustom: true, 
                    status: 409, 
                    message: 'Posto non più disponibile per gli orari selezionati.' 
                };
            }

            // genero il codice prenotazione
            // Math.random().toString(36) converte un numero casuale in una stringa alfanumerica
            // substring(2, 10) prende 8 caratteri, saltando la parte inizale
            let codiceLibero = false;
            let codice = '';

            while (!codiceLibero) {
                codice = 'PR-' + Math.random().toString(36).substring(2, 10).toUpperCase();
                const esisteGia = await t.oneOrNone(`
                    SELECT ID_Prenotazione FROM Prenotazione 
                    WHERE CodicePrenotazione = $1
                `, [codice]);

                if (!esisteGia) {
                    codiceLibero = true;
                }
            }

            // scalo i soldi dal saldo
            await t.none(`
                UPDATE Utente 
                SET Saldo = Saldo - $1 
                WHERE ID_Utente = $2
            `, [prezzo_totale, id_utente]);

            // inserimento nel db
            return await t.one(`
                INSERT INTO Prenotazione (ID_Utente, ID_Posto, CodicePrenotazione, Targa, Note, InizioSosta, FineSosta, PrezzoTotale)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING ID_Prenotazione, CodicePrenotazione
            `, [id_utente, id_posto, codice, targa, note, inizio, fine, prezzo_totale]);
        });

        res.json({ 
            success: true, 
            messaggio: 'Prenotazione confermata', 
            prenotazione: nuova 
        });

    } catch (err) {
        console.error('Errore salvataggio prenotazione:', err);
        
        if (err.isCustom) {
            return res.status(err.status).json({ 
                success: false, 
                error: err.message 
            });
        }

        res.status(500).json({ 
            success: false, 
            error: 'Errore interno' 
        });
    }
});

module.exports = router;