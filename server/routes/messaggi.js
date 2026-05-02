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

// ─── GET /api/messaggi/:idGarage ─────────────────────────────────────────────
// Carica lo storico della conversazione per un garage specifico
router.get('/:idGarage', requireAuth, async (req, res) => {
  const idGarage = parseInt(req.params.idGarage);
  const idUtente = req.session.utente.id;

  try {
    // Verifica che l'utente abbia diritto di accedere a questa conversazione:
    // deve essere il gestore del garage OPPURE avere almeno una prenotazione lì
    const accesso = await db.any(
      `SELECT 1 FROM Garage WHERE ID_Garage = $1 AND ID_Gestore = $2
       UNION
       SELECT 1 FROM Prenotazione p
         JOIN PostoAuto pa ON pa.ID_Posto = p.ID_Posto
         WHERE pa.ID_Garage = $1 AND p.ID_Utente = $2
       LIMIT 1`,
      [idGarage, idUtente]
    );

    if (accesso.length === 0) {
      return res.status(403).json({ error: 'Accesso non autorizzato a questa conversazione.' });
    }

    const messaggi = await db.any(
      `SELECT m.*,
              u_mit.Nome     AS nomemittente,
              u_mit.Cognome  AS cognomemittente,
              u_des.Nome     AS nomedestinatario,
              u_des.Cognome  AS cognomedestinatario
       FROM Messaggio m
       JOIN Utente u_mit ON u_mit.ID_Utente = m.ID_Mittente
       JOIN Utente u_des ON u_des.ID_Utente = m.ID_Destinatario
       WHERE m.ID_Garage = $1
         AND (m.ID_Mittente = $2 OR m.ID_Destinatario = $2)
       ORDER BY m.DataInvio ASC`,
      [idGarage, idUtente]
    );

    // Marca come letti i messaggi ricevuti dall'utente corrente
    await db.none(
      `UPDATE Messaggio SET Letto = TRUE
       WHERE ID_Garage = $1 AND ID_Destinatario = $2 AND Letto = FALSE`,
      [idGarage, idUtente]
    );

    res.json(messaggi);
  } catch (err) {
    console.error('Errore caricamento messaggi:', err);
    res.status(500).json({ error: 'Errore interno del server.' });
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
    res.json({ nonLetti: parseInt(result.totale) });
  } catch (err) {
    console.error('Errore conteggio non letti:', err);
    res.status(500).json({ error: 'Errore interno del server.' });
  }
});

module.exports = router;