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

module.exports = router;