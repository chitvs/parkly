const express = require('express');
const router = express.Router();
const db = require('../database/db');

// ritorna la lista di tutti i garage
router.get('/', async (req, res) => {
    try {
        const garage = await db.any('SELECT * FROM Garage');
        res.json({ 
            success: true, 
            risultati: garage.length,
            garage 
        });
    } catch (err) {
        console.error('Errore recupero lista garage:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Errore interno'
        });
    }
});

// dettaglio di un singolo garage
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const garage = await db.oneOrNone('SELECT * FROM Garage WHERE ID_Garage = $1', [id]);

        if (!garage) {
            return res.status(404).json({ 
                success: false, 
                error: 'Garage non trovato' 
            });
        }

        res.json({ 
            success: true, 
            garage 
        });
    } catch (err) {
        console.error('Errore recupero dettaglio garage:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Errore interno' 
        });
    }
});

// stato dei posti per la mappa
router.get('/:id/posti', async (req, res) => {
    try {
        const { id } = req.params;
        const { inizio, fine } = req.query; // date ISO string

        if (!inizio || !fine) {
            return res.status(400).json({ 
                success: false, 
                error: 'Selezionare un intervallo orario' 
            });
        }

        const posti = await db.any(`
            SELECT p.*, 
            EXISTS (
                SELECT 1 FROM Prenotazione pr 
                WHERE pr.ID_Posto = p.ID_Posto 
                AND pr.Stato = 'ATTIVA'
                AND (pr.InizioSosta, pr.FineSosta) OVERLAPS ($2::timestamp, $3::timestamp)
            ) AS is_occupato
            FROM PostoAuto p
            WHERE p.ID_Garage = $1
        `, [id, inizio, fine]
        );

        res.json({ 
            success: true, 
            posti 
        });
    } catch (err) {
        console.error('Errore recupero mappa posti:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Errore interno' 
        });
    }
});

module.exports = router;
