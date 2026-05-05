const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Ricarica del saldo
router.post('/ricarica', async (req, res) => {
    if (!req.session.utente || !req.session.utente.id) {
        return res.status(401).json({ success: false, error: 'Non autorizzato' });
    }

    const { importo } = req.body;

    if (!importo || isNaN(importo) || importo < 5) {
        return res.status(400).json({ success: false, error: 'Importo non valido (minimo 5€)' });
    }

    try {
        const nuovoSaldo = await db.tx(async t => {
            const result = await t.one(
                `UPDATE Utente SET Saldo = Saldo + $1 WHERE ID_Utente = $2 RETURNING Saldo`,
                [importo, req.session.utente.id]
            );

            await t.none(
                `INSERT INTO Transazione (ID_Utente, Tipo, Importo, Descrizione) 
                 VALUES ($1, 'RICARICA', $2, 'Ricarica')`,
                [req.session.utente.id, importo]
            );

            return result.saldo;
        });

        // Aggiorniamo anche la sessione lato server per coerenza
        req.session.utente.saldo = nuovoSaldo;

        res.json({ success: true, nuovoSaldo: nuovoSaldo });
    } catch (err) {
        console.error('Errore durante la ricarica:', err);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

// Recupero storico transazioni
router.get('/transazioni', async (req, res) => {
    if (!req.session.utente || !req.session.utente.id) {
        return res.status(401).json({ success: false, error: 'Non autorizzato' });
    }

    try {
        const transazioni = await db.any(`
            SELECT 
                ID_Transazione as id,
                Tipo as tipo,
                Importo as importo,
                Descrizione as descrizione,
                DataCreazione as data
            FROM Transazione
            WHERE ID_Utente = $1
            ORDER BY DataCreazione DESC
            LIMIT 30
        `, [req.session.utente.id]);

        res.json({ success: true, data: transazioni });
    } catch (err) {
        console.error('Errore recupero transazioni:', err);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

module.exports = router;