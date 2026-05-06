// Usa pg-promise (db) e autenticazione via sessione, coerente con il resto del progetto

const express = require('express');
const router = express.Router();
const db = require('../database/db');

// ─── Middleware: verifica sessione attiva ─────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session?.utente) {
    return res.status(401).json({ error: 'Non autenticato.' });
  }
  next();
}

// ─── GET /api/messaggi/:idPrenotazione ───────────────────────────
// Carica lo storico della conversazione specifica per questa prenotazione
router.get('/:idPrenotazione', requireAuth, async (req, res) => {
  const idPrenotazione = parseInt(req.params.idPrenotazione);
  const idUtente = req.session.utente.id;

  try {
    // Verifica che l'utente sia o il cliente della prenotazione o il gestore
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

    // Estrazione di solo i messaggi di QUESTA precisa prenotazione
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

    // Marca come letti
    await db.none(
      `UPDATE Messaggio SET Letto = TRUE
       WHERE ID_Prenotazione = $1 AND ID_Destinatario = $2 AND Letto = FALSE`,
      [idPrenotazione, idUtente]
    );

    res.json(messaggi);
  } catch (err) {
    console.error('Errore caricamento messaggi:', err);
    res.status(500).json({ error: 'Errore interno' });
  }
});

// ─── GET /api/messaggi/non-letti/count ───────────────────────────────────────
// Conta i messaggi non letti dell'utente (usato per il badge nell'header)
router.get('/non-letti/count', requireAuth, async (req, res) => {
  try {
    const result = await db.one(
      `SELECT COUNT(*) AS totale
       FROM Messaggio
       WHERE ID_Destinatario = $1 AND Letto = FALSE`,
      [req.session.utente.id]
    );
    res.json({ nonletti: parseInt(result.totale) });
  } catch (err) {
    console.error('Errore conteggio non letti:', err);
    res.status(500).json({ error: 'Errore interno del server.' });
  }
});

module.exports = router;