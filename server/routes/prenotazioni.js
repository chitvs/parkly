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

            // controllo che il garage sia aperto
            const checkOrari = await t.one(`
                SELECT 
                    g.Is24h,
                    g.OrarioApertura,
                    g.OrarioChiusura,
                    ($2::timestamp::time >= g.OrarioApertura AND $2::timestamp::time <= g.OrarioChiusura) AS inizio_valido,
                    ($3::timestamp::time >= g.OrarioApertura AND $3::timestamp::time <= g.OrarioChiusura) AS fine_valida
                FROM Garage g
                JOIN PostoAuto p ON g.ID_Garage = p.ID_Garage
                WHERE p.ID_Posto = $1
            `, [id_posto, inizio, fine]);

            // Se il garage non è h24 inizio e fine devono stare negli orari di apertura/chiusura
            if (!checkOrari.is24h) {
                if (!checkOrari.inizio_valido || !checkOrari.fine_valida) {
                    throw {
                        isCustom: true,
                        status: 400,
                        message: 'Gli orari selezionati non rientrano nell\'orario di apertura del garage.'
                    };
                }
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

// Recupero le prenotazioni dell'utente loggato
router.get('/', async (req, res) => {
    // Controllo sicurezza: l'utente è loggato?
    if (!req.session.utente || !req.session.utente.id) {
        return res.status(401).json({ success: false, error: 'Non autorizzato' });
    }

    try {
        // Faccio una JOIN per recuperare anche il nome del Garage e il Codice del Posto
        const query = `
            SELECT 
                p.CodicePrenotazione, p.Targa, p.InizioSosta, p.FineSosta, 
                p.PrezzoTotale, p.Stato, p.DataCreazione,
                pa.CodicePosto, 
                g.Nome AS NomeGarage, g.Indirizzo
            FROM Prenotazione p
            JOIN PostoAuto pa ON p.ID_Posto = pa.ID_Posto
            JOIN Garage g ON pa.ID_Garage = g.ID_Garage
            WHERE p.ID_Utente = $1
            ORDER BY p.InizioSosta DESC
        `;

        const prenotazioni = await db.any(query, [req.session.utente.id]);
        res.json({ success: true, data: prenotazioni });

    } catch (err) {
        console.error('Errore recupero prenotazioni:', err);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

// Annullamento di una prenotazione
router.put('/:codice/annulla', async (req, res) => {
    if (!req.session.utente || !req.session.utente.id) {
        return res.status(401).json({ success: false, error: 'Non autorizzato' });
    }

    try {
        const codicePrenotazione = req.params.codice;
        const utenteId = req.session.utente.id;
        
        // Eseguiamo l'UPDATE solo se lo stato è ancora 'ATTIVA' e se è del nostro utente
        const result = await db.result(
            `UPDATE Prenotazione 
             SET Stato = 'ANNULLATA' 
             WHERE CodicePrenotazione = $1 AND ID_Utente = $2 AND Stato = 'ATTIVA'`,
            [codicePrenotazione, utenteId]
        );

        // db.result ci dice quante righe sono state modificate
        if (result.rowCount === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Prenotazione non trovata o già annullata.' 
            });
        }

        res.json({ success: true, messaggio: 'Prenotazione annullata con successo' });

    } catch (err) {
        console.error('Errore annullamento prenotazione:', err);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

// recupera lo storico delle prenotazioni del gestore loggato
router.get('/prenotazioni-gestore', async (req, res) => {
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
            ORDER BY p.InizioSosta DESC
        `;
        
        const result = await db.any(query, [idGestore]);
        res.json(result);

    } catch (error) {
        console.error("Errore storico gestore:", error);
        res.status(500).json({ error: 'Errore interno' });
    }
});

module.exports = router;