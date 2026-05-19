/*
 * Recupero dello storico messaggi per una prenotazione.
 * (L'invio in tempo reale avviene tramite Socket.io in index.js)
 *
 * Endpoint protetti (richiedono sessione attiva e autorizzazione per la prenotazione):
 * GET /:idPrenotazione   - Restituisce lo storico chat e segna i messaggi come letti
 */

const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { isLoggato } = require("../middleware/authMiddleware");

// GET /api/messaggi/:idPrenotazione
// Restituisce lo storico dei messaggi di una prenotazione, dal più vecchio al più recente.
// Segna automaticamente come letti i messaggi in cui l'utente è il destinatario.
router.get("/:idPrenotazione", isLoggato, async (req, res) => {
  const idPrenotazione = parseInt(req.params.idPrenotazione);
  const idUtente = req.session.utente.id;

  try {
    // Controllo accesso: solo il cliente della prenotazione o il gestore del garage possono leggere
    const accesso = await db.any(
      `SELECT 1 FROM Prenotazione p
       JOIN PostoAuto pa ON pa.ID_Posto  = p.ID_Posto
       JOIN Garage    g  ON g.ID_Garage  = pa.ID_Garage
       WHERE p.ID_Prenotazione = $1
         AND (p.ID_Utente = $2 OR g.ID_Gestore = $2)
       LIMIT 1`,
      [idPrenotazione, idUtente],
    );
    if (accesso.length === 0) {
      return res.status(403).json({ error: "Accesso negato." });
    }

    // Recupera i messaggi con nome e cognome del mittente (per visualizzarli in chat)
    const messaggi = await db.any(
      `SELECT
          m.*,
          u_mit.Nome    AS nomemittente,
          u_mit.Cognome AS cognomemittente
       FROM Messaggio m
       JOIN Utente u_mit ON u_mit.ID_Utente = m.ID_Mittente
       WHERE m.ID_Prenotazione = $1
       ORDER BY m.DataInvio ASC`,
      [idPrenotazione],
    );

    // Marca come letti tutti i messaggi non ancora letti di cui l'utente è il destinatario
    await db.none(
      `UPDATE Messaggio SET Letto = TRUE
       WHERE ID_Prenotazione = $1 AND ID_Destinatario = $2 AND Letto = FALSE`,
      [idPrenotazione, idUtente],
    );

    res.json(messaggi);
  } catch (err) {
    console.error("[messaggi] Errore caricamento:", err);
    res.status(500).json({ error: "Errore interno del server." });
  }
});

module.exports = router;
