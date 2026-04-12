const express = require("express");
const router = express.Router();
const db = require("../database/db");

// ritorna la lista di tutti i garage
router.get("/", async (req, res) => {
  try {
    const garage = await db.any("SELECT * FROM Garage");
    res.json({
      success: true,
      risultati: garage.length,
      garage,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Errore interno",
    });
  }
});

// dettaglio di un singolo garage
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const garage = await db.oneOrNone(
      "SELECT * FROM Garage WHERE ID_Garage = $1",
      [id],
    );
    if (!garage)
      return res.status(404).json({
        success: false,
        error: "Garage non trovato",
      });
    res.json({
      success: true,
      garage,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Errore interno",
    });
  }
});

// stato dei posti per la planimetria
router.get("/:id/posti", async (req, res) => {
  try {
    const { id } = req.params;
    const { inizio, fine } = req.query;

    // Anteprima, tutti i posti sono come occupati
    if (!inizio || !fine || inizio === "" || fine === "") {
      const querySemplice = `
                SELECT p.*, FALSE AS is_occupato 
                FROM PostoAuto p
                WHERE p.ID_Garage = $1
                ORDER BY p.CodicePosto
            `;
      const posti = await db.any(querySemplice, [id]);
      return res.json({
        success: true,
        posti,
      });
    }

    // Ricerca reale
    const queryComplessa = `
            SELECT p.*, 
            EXISTS (
                SELECT 1 FROM Prenotazione pr 
                WHERE pr.ID_Posto = p.ID_Posto 
                AND pr.Stato = 'ATTIVA'
                AND (pr.InizioSosta, pr.FineSosta) OVERLAPS ($2::timestamp, $3::timestamp)
            ) AS is_occupato
            FROM PostoAuto p
            WHERE p.ID_Garage = $1
            ORDER BY p.CodicePosto
        `;
    const posti = await db.any(queryComplessa, [id, inizio, fine]);
    res.json({
      success: true,
      posti,
    });
  } catch (err) {
    console.error("Errore SQL:", err);
    res.status(500).json({
      success: false,
      error: "Errore recupero mappa posti",
    });
  }
});

module.exports = router;
