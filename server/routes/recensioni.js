const express = require('express');
const router = express.Router();
const db = require('../database/db');

// POST /api/recensioni - Crea una nuova recensione
router.post('/', async (req, res) => {
    // 1. Estrai i dati dal corpo della richiesta
    const { 
        id_prenotazione, 
        id_utente, 
        id_garage, 
        voto_generale, 
        voto_posizione, 
        voto_prezzo, 
        voto_pulizia, 
        voto_spazio, 
        voto_sicurezza, 
        commento 
    } = req.body;

    // 2. Validazione di base
    if (!id_prenotazione || !id_utente || !id_garage || !voto_generale) {
        return res.status(400).json({ success: false, error: 'Dati mancanti' });
    }

    try {
        await db.tx(async t => {
            
            // 3. Verifica: la prenotazione esiste, appartiene all'utente ed è CONCLUSA?
            const prenotazione = await t.oneOrNone(
                `SELECT Stato FROM Prenotazione WHERE ID_Prenotazione = $1 AND ID_Utente = $2`,
                [id_prenotazione, id_utente]
            );

            if (!prenotazione) {
                throw new Error("Prenotazione non trovata o non autorizzata");
            }
            if (prenotazione.stato !== 'CONCLUSA') {
                 throw new Error("Puoi recensire solo soste concluse");
            }

            // 4. Inserimento della Recensione
            await t.none(`
                INSERT INTO Recensione (
                    ID_Prenotazione, ID_Utente, ID_Garage, 
                    VotoGenerale, VotoPosizione, VotoPrezzo, VotoPulizia, VotoSpazio, VotoSicurezza, Commento
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                id_prenotazione, id_utente, id_garage, 
                voto_generale, voto_posizione, voto_prezzo, voto_pulizia, voto_spazio, voto_sicurezza, commento
            ]);

            // 5. Ricalcolo delle medie e aggiornamento della tabella Garage
            await t.none(`
                UPDATE Garage
                SET 
                    MediaGenerale = COALESCE((SELECT ROUND(AVG(VotoGenerale), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    MediaPosizione = COALESCE((SELECT ROUND(AVG(VotoPosizione), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    MediaPrezzo = COALESCE((SELECT ROUND(AVG(VotoPrezzo), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    MediaPulizia = COALESCE((SELECT ROUND(AVG(VotoPulizia), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    MediaSpazio = COALESCE((SELECT ROUND(AVG(VotoSpazio), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    MediaSicurezza = COALESCE((SELECT ROUND(AVG(VotoSicurezza), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    NumeroRecensioni = (SELECT COUNT(*) FROM Recensione WHERE ID_Garage = $1)
                WHERE ID_Garage = $1;
            `, [id_garage]);

        });

        res.json({ success: true, message: 'Recensione salvata con successo' });

    } catch (err) {
        console.error("Errore salvataggio recensione:", err);
        if (err.code === '23505') { 
            return res.status(400).json({ success: false, error: 'Hai già recensito questa sosta' });
        }
        res.status(500).json({ success: false, error: err.message || 'Errore interno' });
    }
});

// PUT /api/recensioni/:id_prenotazione - Modifica una recensione
router.put('/:id_prenotazione', async (req, res) => {
    const { id_prenotazione } = req.params;
    const { 
        id_utente, 
        id_garage, 
        voto_generale, 
        voto_posizione, 
        voto_prezzo, 
        voto_pulizia, 
        voto_spazio, 
        voto_sicurezza, 
        commento 
    } = req.body;

    if (!id_prenotazione || !id_utente || !id_garage || !voto_generale) {
        return res.status(400).json({ success: false, error: 'Dati mancanti' });
    }

    try {
        await db.tx(async t => {
            // 1. Aggiornamento della Recensione
            const result = await t.result(`
                UPDATE Recensione
                SET VotoGenerale = $1, VotoPosizione = $2, VotoPrezzo = $3, VotoPulizia = $4, VotoSpazio = $5, VotoSicurezza = $6, Commento = $7
                WHERE ID_Prenotazione = $8 AND ID_Utente = $9
            `, [
                voto_generale, voto_posizione, voto_prezzo, voto_pulizia, voto_spazio, voto_sicurezza, commento, 
                id_prenotazione, id_utente
            ]);

            if (result.rowCount === 0) {
                throw new Error("Recensione non trovata o non autorizzata");
            }

            // 2. Ricalcolo delle medie del Garage
            await t.none(`
                UPDATE Garage
                SET 
                    MediaGenerale = COALESCE((SELECT ROUND(AVG(VotoGenerale), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    MediaPosizione = COALESCE((SELECT ROUND(AVG(VotoPosizione), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    MediaPrezzo = COALESCE((SELECT ROUND(AVG(VotoPrezzo), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    MediaPulizia = COALESCE((SELECT ROUND(AVG(VotoPulizia), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    MediaSpazio = COALESCE((SELECT ROUND(AVG(VotoSpazio), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    MediaSicurezza = COALESCE((SELECT ROUND(AVG(VotoSicurezza), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    NumeroRecensioni = (SELECT COUNT(*) FROM Recensione WHERE ID_Garage = $1)
                WHERE ID_Garage = $1;
            `, [id_garage]);
        });

        res.json({ success: true, message: 'Recensione aggiornata con successo' });

    } catch (err) {
        console.error("Errore modifica recensione:", err);
        res.status(500).json({ success: false, error: err.message || 'Errore interno' });
    }
});

// DELETE /api/recensioni/:id_prenotazione - Elimina una recensione
router.delete('/:id_prenotazione', async (req, res) => {
    const { id_prenotazione } = req.params;
    // Passiamo id_utente e id_garage tramite query string per la delete
    const { id_utente, id_garage } = req.query; 

    if (!id_prenotazione || !id_utente || !id_garage) {
        return res.status(400).json({ success: false, error: 'Dati mancanti' });
    }

    try {
        await db.tx(async t => {
            // 1. Eliminazione della Recensione
            const result = await t.result(`
                DELETE FROM Recensione
                WHERE ID_Prenotazione = $1 AND ID_Utente = $2
            `, [id_prenotazione, id_utente]);

            if (result.rowCount === 0) {
                throw new Error("Recensione non trovata o non autorizzata");
            }

            // 2. Ricalcolo delle medie del Garage
            await t.none(`
                UPDATE Garage
                SET 
                    MediaGenerale = COALESCE((SELECT ROUND(AVG(VotoGenerale), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    MediaPosizione = COALESCE((SELECT ROUND(AVG(VotoPosizione), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    MediaPrezzo = COALESCE((SELECT ROUND(AVG(VotoPrezzo), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    MediaPulizia = COALESCE((SELECT ROUND(AVG(VotoPulizia), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    MediaSpazio = COALESCE((SELECT ROUND(AVG(VotoSpazio), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    MediaSicurezza = COALESCE((SELECT ROUND(AVG(VotoSicurezza), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
                    NumeroRecensioni = (SELECT COUNT(*) FROM Recensione WHERE ID_Garage = $1)
                WHERE ID_Garage = $1;
            `, [id_garage]);
        });

        res.json({ success: true, message: 'Recensione eliminata con successo' });

    } catch (err) {
        console.error("Errore eliminazione recensione:", err);
        res.status(500).json({ success: false, error: err.message || 'Errore interno' });
    }
});

// GET /api/recensioni/:id_prenotazione - Recupera i dati di una singola recensione
router.get('/:id_prenotazione', async (req, res) => {
    const { id_prenotazione } = req.params;

    try {
        const recensione = await db.oneOrNone(`
            SELECT * FROM Recensione 
            WHERE ID_Prenotazione = $1
        `, [id_prenotazione]);

        if (!recensione) {
            return res.status(404).json({ success: false, error: 'Recensione non trovata' });
        }

        res.json({ success: true, data: recensione });
    } catch (err) {
        console.error("Errore recupero recensione:", err);
        res.status(500).json({ success: false, error: err.message || 'Errore interno' });
    }
});

module.exports = router;