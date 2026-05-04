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

// recupera i garage del gestore loggato
router.get('/garages-gestore', async (req, res) => {
  try {
    const utenteLoggato = req.session?.utente;
    if (!utenteLoggato || utenteLoggato.ruolo !== 'GESTORE') {
      return res.status(401).json({ error: 'Accesso negato' });
    }
    const idGestore = utenteLoggato.id;
    const result = await db.any('SELECT * FROM Garage WHERE ID_Gestore = $1', [idGestore]);
    res.json(result);
  } catch (error) {
    console.error("Errore recupero garage:", error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// crea un nuovo garage per il gestore loggato
router.post('/garages-gestore', async (req, res) => {
  try {
    const utenteLoggato = req.session?.utente;
    if (!utenteLoggato || utenteLoggato.ruolo !== 'GESTORE') {
      return res.status(401).json({ error: 'Accesso negato' });
    }

    const idGestore = utenteLoggato.id;

    const {
      nome,
      descrizione,
      indirizzo,
      tariffabase,
      altezzamassima,
      orarioapertura,
      orariochiusura,
      is24h,
      mappatestuale
    } = req.body;

    // Validazione campi obbligatori
    if (!nome || !indirizzo || !tariffabase) {
      return res.status(400).json({ error: 'Nome, indirizzo e tariffa base sono obbligatori.' });
    }

    // Se is24h, usiamo orari di default (vengono ignorati dalla logica ma la colonna è NOT NULL)
    const apertura = is24h ? '00:00' : (orarioapertura || '08:00');
    const chiusura = is24h ? '23:59' : (orariochiusura || '20:00');

    // Il testo della planimetria arriva già come stringa dal FileReader del frontend
    const mappa = mappatestuale || null;

    const result = await db.one(
      `INSERT INTO Garage
        (ID_Gestore, Nome, Descrizione, Indirizzo, AltezzaMassima, TariffaBase, OrarioApertura, OrarioChiusura, Is24h, MappaTestuale, IsAttivo)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
       RETURNING *`,
      [
        idGestore,
        nome,
        descrizione || null,
        indirizzo,
        altezzamassima || null,
        tariffabase,
        apertura,
        chiusura,
        is24h || false,
        mappa
      ]
    );

    res.status(201).json({ success: true, garage: result });

  } catch (error) {
    console.error("Errore creazione garage:", error);
    res.status(500).json({ error: 'Errore interno del server.' });
  }
});

// recupera le allerte/stato
router.get('/stato-garages-gestore', async (req, res) => {
  res.json([]);
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

// calcolo occupazione in tempo reale (per la dashboard del gestore)
router.get('/:id/occupazione', async (req, res) => {
  try {
    const idGarage = req.params.id;
    const resultPosti = await db.one('SELECT COUNT(*) as tot FROM PostoAuto WHERE ID_Garage = $1', [idGarage]);

    const resultOccupati = await db.one(`
          SELECT COUNT(*) as occ FROM Prenotazione p
          JOIN PostoAuto pa ON p.ID_Posto = pa.ID_Posto
          WHERE pa.ID_Garage = $1 AND p.Stato = 'ATTIVA' 
          AND NOW() BETWEEN p.InizioSosta AND p.FineSosta
      `, [idGarage]);

    const tot = parseInt(resultPosti.tot);
    const occ = parseInt(resultOccupati.occ);
    const percentuale = tot > 0 ? (occ / tot) * 100 : 0;

    res.json({ success: true, percentuale });
  } catch (err) {
    console.error("Errore occupazione:", err);
    res.status(500).json({ success: false, percentuale: 0 });
  }
});

// GET /api/garage/:id/recensioni - Recupera le recensioni di un singolo garage
router.get("/:id/recensioni", async (req, res) => {
  try {
    const { id } = req.params;
    const recensioni = await db.any(`
        SELECT 
            r.VotoGenerale, r.VotoPosizione, r.VotoPrezzo, r.VotoPulizia, r.VotoSpazio, r.VotoSicurezza, 
            r.Commento, r.DataCreazione, 
            u.Nome, 
            SUBSTRING(u.Cognome, 1, 1) AS InizialeCognome, 
            u.FotoProfilo_URL 
        FROM Recensione r
        JOIN Utente u ON r.ID_Utente = u.ID_Utente
        WHERE r.ID_Garage = $1
        ORDER BY r.DataCreazione DESC
    `, [id]);

    res.json({ success: true, recensioni });
  } catch (err) {
    console.error("Errore recupero recensioni:", err);
    res.status(500).json({ success: false, error: "Errore interno" });
  }
});

module.exports = router;
