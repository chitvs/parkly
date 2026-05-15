const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { isLoggato } = require('../middleware/authMiddleware');

/**
 * GET /api/messaggi/:idPrenotazione
 * Restituisce lo storico dei messaggi di una specifica prenotazione.
 */
router.get('/:idPrenotazione', isLoggato, async (req, res) => {
  const idPrenotazione = parseInt(req.params.idPrenotazione);
  const idUtente = req.session.utente.id; // Chi sta facendo la richiesta?

  try {
    // Controlliamo se l'utente loggato è il Cliente che ha prenotato, 
    // o è il Gestore proprietario del garage di quella prenotazione.
    const accesso = await db.any(
      `SELECT 1 FROM Prenotazione p
       JOIN PostoAuto pa ON pa.ID_Posto = p.ID_Posto
       JOIN Garage g ON g.ID_Garage = pa.ID_Garage
       WHERE p.ID_Prenotazione = $1 AND (p.ID_Utente = $2 OR g.ID_Gestore = $2)
       LIMIT 1`,
      [idPrenotazione, idUtente]
    );

    if (accesso.length === 0) {
      return res.status(403).json({ error: 'Accesso negato.' });
    }

    // Prendiamo tutti i messaggi ordinati dal più vecchio al più recente
    const messaggi = await db.any(
      `SELECT m.*,
              u_mit.Nome     AS nomemittente,
              u_mit.Cognome  AS cognomemittente
       FROM Messaggio m
       JOIN Utente u_mit ON u_mit.ID_Utente = m.ID_Mittente
       WHERE m.ID_Prenotazione = $1
       ORDER BY m.DataInvio ASC`,
      [idPrenotazione]
    );

    // Segniamo come letti tutti i messaggi in cui l'utente loggato era il "Destinatario"
    await db.none(
      `UPDATE Messaggio SET Letto = TRUE
       WHERE ID_Prenotazione = $1 AND ID_Destinatario = $2 AND Letto = FALSE`,
      [idPrenotazione, idUtente]
    );

    // Invia la risposta al frontend
    res.json(messaggi);
  } catch (err) {
    console.error('Errore caricamento messaggi:', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

module.exports = router;