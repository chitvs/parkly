const express = require("express");
const router = express.Router();
const db = require("../database/db");

// ritorna la lista di tutti i garage
router.get("/", async (req, res) => {
  try {
    const { inizio, fine } = req.query;
    let query = "";
    let params = [];

    if (inizio && fine) {
      // 1. RICERCA CON DATE: 
      query = `
        SELECT 
            g.*,
            COALESCE(p.hasCoperto, false) AS "hasCoperto",
            COALESCE(p.hasElettrico, false) AS "hasElettrico",
            COALESCE(p.hasDisabili, false) AS "hasDisabili",
            COALESCE(p.tipiDisponibili, '{}') AS "tipiDisponibili"
        FROM garage g
        INNER JOIN (
            SELECT 
                id_garage,
                BOOL_OR(iscoperto) AS hasCoperto,
                BOOL_OR(iselettrica) AS hasElettrico,
                BOOL_OR(isdisabili) AS hasDisabili,
                ARRAY_AGG(DISTINCT tipoveicolo) AS tipiDisponibili
            FROM postoauto pa
            WHERE NOT EXISTS (
                SELECT 1 FROM prenotazione pr
                WHERE pr.id_posto = pa.id_posto
                AND pr.stato = 'ATTIVA'
                AND (pr.iniziososta, pr.finesosta) OVERLAPS ($1::timestamp, $2::timestamp)
            )
            GROUP BY id_garage
        ) p ON g.id_garage = p.id_garage
        WHERE g.isattivo = TRUE
        
        -- NUOVO CONTROLLO ORARI DI APERTURA E CHIUSURA
        AND (
            g.is24h = TRUE 
            OR (
                -- Caso diurno (es. 08:00 - 20:00)
                g.orarioapertura < g.orariochiusura 
                AND ($1::timestamp::time >= g.orarioapertura AND $1::timestamp::time <= g.orariochiusura)
                AND ($2::timestamp::time >= g.orarioapertura AND $2::timestamp::time <= g.orariochiusura)
            )
            OR (
                -- Caso notturno a cavallo della mezzanotte (es. Testaccio 07:00 - 02:00)
                g.orarioapertura > g.orariochiusura 
                AND ($1::timestamp::time >= g.orarioapertura OR $1::timestamp::time <= g.orariochiusura)
                AND ($2::timestamp::time >= g.orarioapertura OR $2::timestamp::time <= g.orariochiusura)
            )
        )
      `;
      params = [inizio, fine];
    } else {
      query = `
        SELECT 
            g.*,
            COALESCE(p.hasCoperto, false) AS "hasCoperto",
            COALESCE(p.hasElettrico, false) AS "hasElettrico",
            COALESCE(p.hasDisabili, false) AS "hasDisabili",
            COALESCE(p.tipiDisponibili, '{}') AS "tipiDisponibili"
        FROM garage g
        LEFT JOIN (
            SELECT 
                id_garage,
                BOOL_OR(iscoperto) AS hasCoperto,
                BOOL_OR(iselettrica) AS hasElettrico,
                BOOL_OR(isdisabili) AS hasDisabili,
                ARRAY_AGG(DISTINCT tipoveicolo) AS tipiDisponibili
            FROM postoauto
            GROUP BY id_garage
        ) p ON g.id_garage = p.id_garage
        WHERE g.isattivo = TRUE
      `;
    }

    const garage = await db.any(query, params);

    res.json({
      success: true,
      risultati: garage.length,
      garage,
    });
  } catch (err) {
    console.error("Errore SQL in GET /api/garage:", err);
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
