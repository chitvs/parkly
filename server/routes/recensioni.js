/*
 * Gestione delle recensioni dei garage.
 * Tutte le scritture avvengono in transazione e ricalcolano le medie.
 *
 * Endpoint pubblici (no auth):
 * GET /:id_prenotazione    - Recupera i dati di una singola recensione
 *
 * Endpoint protetti (richiedono sessione attiva):
 * POST /                   - Crea una nuova recensione
 * PUT /:id_prenotazione    - Modifica una recensione esistente
 * DELETE /:id_prenotazione - Elimina una recensione
 */

const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { isLoggato } = require("../middleware/authMiddleware");
const { ricalcolaMediaGarage } = require("../helpers/recensioneHelpers");

// POST /api/recensioni
// Crea una nuova recensione per una prenotazione conclusa.
router.post("/", isLoggato, async (req, res) => {
  const {
    id_prenotazione,
    id_garage,
    voto_generale,
    voto_posizione,
    voto_prezzo,
    voto_pulizia,
    voto_spazio,
    voto_sicurezza,
    commento,
  } = req.body;

  const id_utente = req.session.utente.id;

  if (!id_prenotazione || !id_garage || !voto_generale) {
    return res.status(400).json({ success: false, error: "Dati mancanti." });
  }

  try {
    await db.tx(async (t) => {
      // La prenotazione deve esistere, appartenere all'utente ed essere CONCLUSA
      const prenotazione = await t.oneOrNone(
        `SELECT Stato FROM Prenotazione WHERE ID_Prenotazione = $1 AND ID_Utente = $2`,
        [id_prenotazione, id_utente],
      );

      if (!prenotazione)
        throw new Error("Prenotazione non trovata o non autorizzata.");
      if (prenotazione.stato !== "CONCLUSA")
        throw new Error("Puoi recensire solo soste concluse.");

      await t.none(
        `INSERT INTO Recensione
           (ID_Prenotazione, ID_Utente, ID_Garage,
            VotoGenerale, VotoPosizione, VotoPrezzo, VotoPulizia, VotoSpazio, VotoSicurezza, Commento)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          id_prenotazione,
          id_utente,
          id_garage,
          voto_generale,
          voto_posizione,
          voto_prezzo,
          voto_pulizia,
          voto_spazio,
          voto_sicurezza,
          commento,
        ],
      );

      await ricalcolaMediaGarage(t, id_garage);
    });

    res.json({ success: true, message: "Recensione salvata con successo." });
  } catch (err) {
    console.error("[recensioni] Errore creazione:", err.message);
    // Codice 23505 = violazione unique constraint (recensione già esistente per questa prenotazione)
    if (err.code === "23505") {
      return res
        .status(400)
        .json({ success: false, error: "Hai già recensito questa sosta." });
    }
    res
      .status(500)
      .json({ success: false, error: err.message || "Errore interno." });
  }
});

// PUT /api/recensioni/:id_prenotazione
// Modifica una recensione esistente dell'utente loggato.
router.put("/:id_prenotazione", isLoggato, async (req, res) => {
  const { id_prenotazione } = req.params;
  const {
    id_garage,
    voto_generale,
    voto_posizione,
    voto_prezzo,
    voto_pulizia,
    voto_spazio,
    voto_sicurezza,
    commento,
  } = req.body;

  const id_utente = req.session.utente.id;

  if (!id_prenotazione || !id_garage || !voto_generale) {
    return res.status(400).json({ success: false, error: "Dati mancanti." });
  }

  try {
    await db.tx(async (t) => {
      const result = await t.result(
        `UPDATE Recensione
         SET VotoGenerale = $1, VotoPosizione = $2, VotoPrezzo = $3,
             VotoPulizia  = $4, VotoSpazio    = $5, VotoSicurezza = $6, Commento = $7
         WHERE ID_Prenotazione = $8 AND ID_Utente = $9`,
        [
          voto_generale,
          voto_posizione,
          voto_prezzo,
          voto_pulizia,
          voto_spazio,
          voto_sicurezza,
          commento,
          id_prenotazione,
          id_utente,
        ],
      );

      if (result.rowCount === 0)
        throw new Error("Recensione non trovata o non autorizzata.");

      await ricalcolaMediaGarage(t, id_garage);
    });

    res.json({ success: true, message: "Recensione aggiornata con successo." });
  } catch (err) {
    console.error("[recensioni] Errore modifica:", err.message);
    res
      .status(500)
      .json({ success: false, error: err.message || "Errore interno." });
  }
});

// DELETE /api/recensioni/:id_prenotazione
// Elimina una recensione dell'utente loggato.
router.delete("/:id_prenotazione", isLoggato, async (req, res) => {
  const { id_prenotazione } = req.params;
  const { id_garage } = req.query;
  const id_utente = req.session.utente.id;

  if (!id_prenotazione || !id_garage) {
    return res.status(400).json({ success: false, error: "Dati mancanti." });
  }

  try {
    await db.tx(async (t) => {
      const result = await t.result(
        `DELETE FROM Recensione WHERE ID_Prenotazione = $1 AND ID_Utente = $2`,
        [id_prenotazione, id_utente],
      );

      if (result.rowCount === 0)
        throw new Error("Recensione non trovata o non autorizzata.");

      await ricalcolaMediaGarage(t, id_garage);
    });

    res.json({ success: true, message: "Recensione eliminata con successo." });
  } catch (err) {
    console.error("[recensioni] Errore eliminazione:", err.message);
    res
      .status(500)
      .json({ success: false, error: err.message || "Errore interno." });
  }
});

// GET /api/recensioni/:id_prenotazione
// Recupera i dati di una singola recensione (pubblica, no auth richiesta).
router.get("/:id_prenotazione", async (req, res) => {
  const { id_prenotazione } = req.params;

  try {
    const recensione = await db.oneOrNone(
      `SELECT * FROM Recensione WHERE ID_Prenotazione = $1`,
      [id_prenotazione],
    );

    if (!recensione) {
      return res
        .status(404)
        .json({ success: false, error: "Recensione non trovata." });
    }

    res.json({ success: true, data: recensione });
  } catch (err) {
    console.error("[recensioni] Errore recupero:", err.message);
    res
      .status(500)
      .json({ success: false, error: err.message || "Errore interno." });
  }
});

module.exports = router;
