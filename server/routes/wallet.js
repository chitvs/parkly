const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Ricarica del saldo
router.post('/ricarica', async (req, res) => {
    if (!req.session.utente || !req.session.utente.id) {
        return res.status(401).json({ success: false, error: 'Non autorizzato' });
    }

    const { importo } = req.body;

    if (!importo || isNaN(importo) || importo < 5 || importo > 1000) {
        return res.status(400).json({ 
            success: false, 
            error: 'Importo non valido. Minimo 5,00 €, Massimo 1.000,00 € per singola transazione.' 
        });
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
        `, [req.session.utente.id]);

        res.json({ success: true, data: transazioni });
    } catch (err) {
        console.error('Errore recupero transazioni:', err);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});


router.post('/contabilizza-ricavi', async (req, res) => {
    const id_gestore = req.session.utente.id;

    try {
        const risultato = await db.tx(async t => {
            // 1. Cerchiamo le transazioni SOSPESE dove la sosta è FINITA
            const daSbloccare = await t.any(`
                SELECT t.ID_Transazione, t.Importo 
                FROM Transazione t
                JOIN Prenotazione p ON t.ID_Prenotazione = p.ID_Prenotazione
                WHERE t.ID_Utente = $1 
                  AND t.Tipo = 'INCASSO_SOSPESO' 
                  AND p.FineSosta < (NOW() AT TIME ZONE 'Europe/Rome')
                FOR UPDATE OF t
            `, [id_gestore]);

            if (daSbloccare.length === 0) return { sbloccati: 0 };

            const totale = daSbloccare.reduce((acc, tx) => acc + parseFloat(tx.importo), 0);
            const ids = daSbloccare.map(tx => tx.id_transazione);

            // 2. Trasformiamo le transazioni in COMPLETATE
            await t.none(`
                UPDATE Transazione SET Tipo = 'INCASSO_COMPLETATO', 
                Descrizione = REPLACE(Descrizione, 'Incasso in sospeso per prenotazione', 'Incasso per')
                WHERE ID_Transazione IN ($1:csv)
            `, [ids]);

            // 3. Aggiorniamo il saldo reale dell'utente
            const utente = await t.one(`
                UPDATE Utente SET Saldo = Saldo + $1 
                WHERE ID_Utente = $2 RETURNING Saldo
            `, [totale, id_gestore]);

            return { sbloccati: totale, nuovoSaldo: utente.saldo };
        });

        res.json({ success: true, data: risultato });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/saldo-sospeso', async (req, res) => {
    if (!req.session.utente || !req.session.utente.id) {
        return res.status(401).json({ success: false, error: 'Non autorizzato' });
    }

    try {
        const result = await db.one(`
            SELECT COALESCE(SUM(Importo), 0) as totale 
            FROM Transazione 
            WHERE ID_Utente = $1 AND Tipo = 'INCASSO_SOSPESO'
        `, [req.session.utente.id]);

        res.json({ success: true, data: { totale: parseFloat(result.totale) } });
    } catch (err) {
        console.error('Errore recupero saldo sospeso:', err);
        res.status(500).json({ success: false, error: 'Errore interno' });
    }
});

router.post('/preleva', async (req, res) => {
    if (!req.session.utente || !req.session.utente.id) {
        return res.status(401).json({ success: false, error: 'Non autorizzato' });
    }

    const { importo, metodo } = req.body;
    const id_gestore = req.session.utente.id;

    if (!importo || importo <= 0) {
        return res.status(400).json({ success: false, error: 'Importo non valido' });
    }

    try {
        const esito = await db.tx(async t => {
            const utente = await t.one('SELECT Saldo FROM Utente WHERE ID_Utente = $1 FOR UPDATE', [id_gestore]);
            
            if (parseFloat(utente.saldo) < parseFloat(importo)) {
                throw new Error('Saldo insufficiente per il prelievo richiesto');
            }

            // 1. Scaliamo il saldo
            const update = await t.one(`
                UPDATE Utente SET Saldo = Saldo - $1 WHERE ID_Utente = $2 RETURNING Saldo
            `, [importo, id_gestore]);

            // 2. Registriamo la transazione
            await t.none(`
                INSERT INTO Transazione (ID_Utente, Tipo, Importo, Descrizione)
                VALUES ($1, 'PRELIEVO', $2, $3)
            `, [id_gestore, -importo, `Prelievo fondi tramite ${metodo}`]);

            return update.saldo;
        });

        req.session.utente.saldo = esito;
        res.json({ success: true, nuovoSaldo: esito });

    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

module.exports = router;