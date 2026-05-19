/*
 * Gestione del portafoglio degli utenti: ricarica, prelievo, storico transazioni.
 * Include la logica di sblocco ricavi per i gestori.
 *
 * Endpoint protetti (richiedono sessione attiva):
 * POST /ricarica              - Aggiunge credito al saldo dell'utente
 * GET /transazioni            - Storico di tutti i movimenti dell'utente
 * POST /preleva               - Effettua un prelievo dal saldo
 *
 * Endpoint protetti (richiedono ruolo GESTORE):
 * POST /contabilizza-ricavi   - Sblocca gli incassi sospesi a sosta terminata
 * GET /saldo-sospeso          - Somma degli incassi in attesa di sblocco
 */

const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { isLoggato, isGestore } = require("../middleware/authMiddleware");

// POST /api/wallet/ricarica
// Aggiunge credito al saldo dell'utente.
// L'importo è vincolato tra 5€ e 1.000€ per singola transazione.
router.post("/ricarica", isLoggato, async (req, res) => {
  const { importo } = req.body;
  const utenteId = req.session.utente.id;

  if (!importo || isNaN(importo) || importo < 5 || importo > 1000) {
    return res.status(400).json({
      success: false,
      error:
        "Importo non valido. Minimo 5,00 €, Massimo 1.000,00 € per singola transazione.",
    });
  }

  try {
    const nuovoSaldo = await db.tx(async (t) => {
      // Aggiorna il saldo e registra la transazione in modo atomico
      const result = await t.one(
        `UPDATE Utente SET Saldo = Saldo + $1 WHERE ID_Utente = $2 RETURNING Saldo`,
        [importo, utenteId],
      );
      await t.none(
        `INSERT INTO Transazione (ID_Utente, Tipo, Importo, Descrizione)
         VALUES ($1, 'RICARICA', $2, 'Ricarica')`,
        [utenteId, importo],
      );
      return result.saldo;
    });

    // Sincronizza il saldo nella sessione per evitare un reload
    req.session.utente.saldo = nuovoSaldo;
    res.json({ success: true, nuovoSaldo });
  } catch (err) {
    console.error("[wallet] Errore ricarica:", err);
    res
      .status(500)
      .json({ success: false, error: "Errore interno del server." });
  }
});

// GET /api/wallet/transazioni
// Restituisce lo storico completo delle transazioni dell'utente loggato,
// ordinate dalla più recente alla più vecchia.
router.get("/transazioni", isLoggato, async (req, res) => {
  try {
    const transazioni = await db.any(
      `SELECT
          ID_Transazione AS id,
          Tipo           AS tipo,
          Importo        AS importo,
          Descrizione    AS descrizione,
          DataCreazione  AS data
       FROM Transazione
       WHERE ID_Utente = $1
       ORDER BY DataCreazione DESC`,
      [req.session.utente.id],
    );
    res.json({ success: true, data: transazioni });
  } catch (err) {
    console.error("[wallet] Errore storico transazioni:", err);
    res
      .status(500)
      .json({ success: false, error: "Errore interno del server." });
  }
});

// POST /api/wallet/contabilizza-ricavi
// (Solo gestore) Sblocca tutti gli incassi sospesi le cui soste sono terminate.
// Converte le transazioni da INCASSO_SOSPESO a INCASSO_COMPLETATO
// e accredita il totale sul saldo del gestore.
router.post("/contabilizza-ricavi", isGestore, async (req, res) => {
  const id_gestore = req.session.utente.id;

  try {
    const risultato = await db.tx(async (t) => {
      // Trova gli incassi sospesi la cui sosta è già terminata
      // FOR UPDATE blocca le righe per evitare doppio sblocco concorrente
      const daSbloccare = await t.any(
        `SELECT t.ID_Transazione, t.Importo
         FROM Transazione t
         JOIN Prenotazione p ON t.ID_Prenotazione = p.ID_Prenotazione
         WHERE t.ID_Utente = $1
           AND t.Tipo = 'INCASSO_SOSPESO'
           AND p.FineSosta < (NOW() AT TIME ZONE 'Europe/Rome')
         FOR UPDATE OF t`,
        [id_gestore],
      );

      if (daSbloccare.length === 0) return { sbloccati: 0 };

      const totale = daSbloccare.reduce(
        (acc, tx) => acc + parseFloat(tx.importo),
        0,
      );
      const ids = daSbloccare.map((tx) => tx.id_transazione);

      // Aggiorna il tipo e la descrizione delle transazioni sbloccate
      await t.none(
        `UPDATE Transazione
         SET Tipo = 'INCASSO_COMPLETATO',
             Descrizione = REPLACE(Descrizione, 'Incasso in sospeso per prenotazione', 'Incasso per')
         WHERE ID_Transazione IN ($1:csv)`,
        [ids],
      );

      // Accredita il totale sbloccato sul saldo del gestore
      const utente = await t.one(
        `UPDATE Utente SET Saldo = Saldo + $1 WHERE ID_Utente = $2 RETURNING Saldo`,
        [totale, id_gestore],
      );

      return { sbloccati: totale, nuovoSaldo: utente.saldo };
    });

    res.json({ success: true, data: risultato });
  } catch (err) {
    console.error("[wallet] Errore contabilizza-ricavi:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/wallet/saldo-sospeso
// (Solo gestore) Restituisce la somma degli incassi ancora in attesa di sblocco.
router.get("/saldo-sospeso", isGestore, async (req, res) => {
  try {
    const result = await db.one(
      `SELECT COALESCE(SUM(Importo), 0) AS totale
       FROM Transazione
       WHERE ID_Utente = $1 AND Tipo = 'INCASSO_SOSPESO'`,
      [req.session.utente.id],
    );
    res.json({ success: true, data: { totale: parseFloat(result.totale) } });
  } catch (err) {
    console.error("[wallet] Errore saldo sospeso:", err);
    res.status(500).json({ success: false, error: "Errore interno." });
  }
});

// POST /api/wallet/preleva
// Effettua un prelievo dal saldo dell'utente.
// Usa SELECT FOR UPDATE per evitare race condition sul saldo.
router.post("/preleva", isLoggato, async (req, res) => {
  const { importo, metodo } = req.body;
  const utenteId = req.session.utente.id;

  if (!importo || importo <= 0) {
    return res
      .status(400)
      .json({ success: false, error: "Importo non valido." });
  }

  try {
    const nuovoSaldo = await db.tx(async (t) => {
      // Lock sulla riga utente per evitare prelievi concorrenti che portino il saldo in negativo
      const utente = await t.one(
        `SELECT Saldo FROM Utente WHERE ID_Utente = $1 FOR UPDATE`,
        [utenteId],
      );

      if (parseFloat(utente.saldo) < parseFloat(importo)) {
        throw new Error("Saldo insufficiente per il prelievo richiesto.");
      }

      const update = await t.one(
        `UPDATE Utente SET Saldo = Saldo - $1 WHERE ID_Utente = $2 RETURNING Saldo`,
        [importo, utenteId],
      );

      // L'importo viene salvato come negativo per convenzione nello storico transazioni
      await t.none(
        `INSERT INTO Transazione (ID_Utente, Tipo, Importo, Descrizione)
         VALUES ($1, 'PRELIEVO', $2, $3)`,
        [utenteId, -importo, `Prelievo fondi tramite ${metodo}`],
      );

      return update.saldo;
    });

    req.session.utente.saldo = nuovoSaldo;
    res.json({ success: true, nuovoSaldo });
  } catch (err) {
    console.error("[wallet] Errore prelievo:", err);
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
