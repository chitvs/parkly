const express = require("express");
const router = express.Router();
const db = require("../database/db");
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { isGestore } = require('../middleware/authMiddleware');

// configura il client Supabase usando le variabili dell'environment
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// configura Multer (handler per le foto prima di mandarle a Supabase)
const upload = multer({ storage: multer.memoryStorage() });

// Ritorna la lista di tutti i garage (FILTRATA DAI CLONI CON DISTINCT ON)
router.get("/", async (req, res) => {
  try {
    const { inizio, fine } = req.query;
    let query = "";
    let params = [];

    if (inizio && fine) {
      query = `
        SELECT DISTINCT ON (g.nome)
            g.*,
            g.TariffaAuto AS tariffabase, 
            json_strip_nulls(json_build_object(
                'AUTO', g.TariffaAuto,
                'MOTO', g.TariffaMoto,
                'FURGONE', g.TariffaFurgone
            )) AS "tariffeVeicoli",
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
        AND (
            g.is24h = TRUE 
            OR (
                g.orarioapertura < g.orariochiusura 
                AND ($1::timestamp::time >= g.orarioapertura AND $1::timestamp::time <= g.orariochiusura)
                AND ($2::timestamp::time >= g.orarioapertura AND $2::timestamp::time <= g.orariochiusura)
            )
            OR (
                g.orarioapertura > g.orariochiusura 
                AND ($1::timestamp::time >= g.orarioapertura OR $1::timestamp::time <= g.orariochiusura)
                AND ($2::timestamp::time >= g.orarioapertura OR $2::timestamp::time <= g.orariochiusura)
            )
        )
        ORDER BY g.nome, g.id_garage ASC
      `;
      params = [inizio, fine];
    } else {
      query = `
        SELECT DISTINCT ON (g.nome)
            g.*,
            g.TariffaAuto AS tariffabase, 
            json_strip_nulls(json_build_object(
                'AUTO', g.TariffaAuto,
                'MOTO', g.TariffaMoto,
                'FURGONE', g.TariffaFurgone
            )) AS "tariffeVeicoli",
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
        ORDER BY g.nome, g.id_garage ASC
      `;
    }

    const garage = await db.any(query, params);

    res.json({ success: true, risultati: garage.length, garage });
  } catch (err) {
    console.error("Errore SQL in GET /api/garage:", err);
    res.status(500).json({ success: false, error: "Errore interno" });
  }
});

router.get('/garages-gestore', isGestore, async (req, res) => {
  try {
    const idGestore = req.session.utente.id;
    const result = await db.any('SELECT * FROM Garage WHERE ID_Gestore = $1', [idGestore]);
    res.json(result);
  } catch (error) {
    console.error("Errore recupero garage:", error);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// Crea un nuovo garage per il gestore loggato
router.post('/garages-gestore', isGestore, async (req, res) => {
  try {
    const idGestore = req.session.utente.id;
    const {
      nome, descrizione, indirizzo, via, civico, cap, citta, provincia, latitudine, longitudine,
      tariffabase, tariffamoto, tariffafurgone, sovrapprezzoelettrica, scontodisabili,
      altezzamassima, orarioapertura, orariochiusura, is24h, mappatestuale, posti,
      nrighe, ncolonne
    } = req.body;

    if (!nome || !indirizzo || !tariffabase || !latitudine || !longitudine) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti.' });
    }

    const apertura = is24h ? '00:00' : (orarioapertura || '08:00');
    const chiusura = is24h ? '23:59' : (orariochiusura || '20:00');
    const mappa = mappatestuale || null;

    const result = await db.tx(async t => {
      const garage = await t.one(
        `INSERT INTO Garage
          (ID_Gestore, Nome, Descrizione, Indirizzo, Via, Civico, Cap, Citta, Provincia, Latitudine, Longitudine, AltezzaMassima, TariffaAuto, TariffaMoto, TariffaFurgone, SovrapprezzoElettrica, ScontoDisabili, OrarioApertura, OrarioChiusura, Is24h, MappaTestuale, NRighe, NColonne, IsAttivo)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, TRUE)
         RETURNING *`,
        [
          idGestore,
          nome,
          descrizione || null,
          indirizzo, 
          via || null,
          civico || null,
          cap || null,
          citta || null,
          provincia || null,
          latitudine,
          longitudine,
          altezzamassima || null,
          tariffabase,
          tariffamoto || null,
          tariffafurgone || null,
          sovrapprezzoelettrica || null,
          scontodisabili || null,
          apertura,
          chiusura,
          is24h || false,
          mappa,
          nrighe,
          ncolonne
        ]
      );

      // Inserimento posti auto
      if (posti && Array.isArray(posti) && posti.length > 0) {
        for (const posto of posti) {
          await t.none(
            `INSERT INTO PostoAuto 
              (ID_Garage, CodicePosto, TipoVeicolo, IsDisabili, IsElettrica, IsCoperto)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              garage.id_garage, posto.codice, posto.tipo || 'AUTO',
              posto.isDisabili || false, posto.isElettrica || false,
              posto.isCoperto !== undefined ? posto.isCoperto : true
            ]
          );
        }
      }

      return garage;
    });

    res.status(201).json({ success: true, garage: result });

  } catch (error) {
    console.error("Errore creazione garage e posti:", error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Errore: Codici dei posti duplicati o non validi.' });
    }
    res.status(500).json({ error: 'Errore interno del server durante il salvataggio.' });
  }
});

// Caricamento foto del garage
router.post('/:id/upload-photos', isGestore, upload.array('foto_garage', 10), async (req, res) => {

  const idGarage = req.params.id;
  const idGestore = req.session.utente.id;
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'Nessun file caricato' });
  }

  try {
    const garage = await db.oneOrNone('SELECT ID_Garage FROM Garage WHERE ID_Garage = $1 AND ID_Gestore = $2', [idGarage, idGestore]);
    if (!garage) return res.status(403).json({ error: 'Garage non trovato o non autorizzato' });

    const urlsCaricate = [];

    for (const file of files) {
      const estensione = file.originalname.split('.').pop();
      const nomeFile = `${idGarage}/${Date.now()}_${Math.random().toString(36).substring(7)}.${estensione}`;

      const { error } = await supabase
        .storage
        .from('garage-photos')
        .upload(nomeFile, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage.from('garage-photos').getPublicUrl(nomeFile);
      urlsCaricate.push(publicUrlData.publicUrl);
    }

    await db.none(
      'UPDATE Garage SET Foto_URLs = array_cat(COALESCE(Foto_URLs, ARRAY[]::TEXT[]), $1) WHERE ID_Garage = $2',
      [urlsCaricate, idGarage]
    );

    res.json({ success: true, urls: urlsCaricate });

  } catch (err) {
    console.error('Errore caricamento foto garage:', err);
    res.status(500).json({ error: 'Errore durante il caricamento delle foto' });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const garage = await db.oneOrNone("SELECT *, TariffaAuto AS tariffabase FROM Garage WHERE ID_Garage = $1", [id]);
    if (!garage) return res.status(404).json({ success: false, error: "Garage non trovato" });
    res.json({ success: true, garage });
  } catch (err) {
    res.status(500).json({ success: false, error: "Errore interno" });
  }
});

router.get("/:id/posti", async (req, res) => {
  try {
    const { id } = req.params;
    const { inizio, fine } = req.query;

    const formattaPosti = (rows) => {
      return rows.map(r => ({
        ...r,
        is_occupato: r.is_prenotato || r.is_in_manutenzione,
        manutenzione: r.is_in_manutenzione ? {
          id_manutenzione: r.id_manutenzione,
          inizio: r.manutenzione_inizio,
          fine: r.manutenzione_fine,
          motivazione: r.manutenzione_motivo
        } : null
      }));
    };

    if (!inizio || !fine || inizio === "") {
      const querySemplice = `
        SELECT p.*, 
        EXISTS (
            SELECT 1 FROM Prenotazione pr 
            WHERE pr.ID_Posto = p.ID_Posto 
            AND pr.Stato = 'ATTIVA'
            AND (NOW() AT TIME ZONE 'Europe/Rome') BETWEEN pr.InizioSosta AND pr.FineSosta
        ) AS is_prenotato,
        m.ID_Manutenzione,
        m.Inizio AS manutenzione_inizio,
        m.Fine AS manutenzione_fine,
        m.Motivazione AS manutenzione_motivo,
        CASE WHEN m.ID_Manutenzione IS NOT NULL THEN true ELSE false END AS is_in_manutenzione,
        GREATEST(
            (CASE 
                WHEN p.TipoVeicolo = 'AUTO' THEN g.TariffaAuto 
                WHEN p.TipoVeicolo = 'MOTO' THEN g.TariffaMoto 
                WHEN p.TipoVeicolo = 'FURGONE' THEN g.TariffaFurgone 
            END)
            + CASE WHEN p.IsElettrica THEN COALESCE(g.SovrapprezzoElettrica, 0) ELSE 0 END
            - CASE WHEN p.IsDisabili THEN COALESCE(g.ScontoDisabili, 0) ELSE 0 END
        , 0) as tariffaoraria
        FROM PostoAuto p
        JOIN Garage g ON p.ID_Garage = g.ID_Garage
        LEFT JOIN LATERAL (
            SELECT ID_Manutenzione, Inizio, Fine, Motivazione
            FROM ManutenzionePosto
            WHERE ID_Posto = p.ID_Posto
            AND (NOW() AT TIME ZONE 'Europe/Rome') BETWEEN Inizio AND Fine
            ORDER BY Inizio ASC
            LIMIT 1
        ) m ON true
        WHERE p.ID_Garage = $1 AND p.IsAttivo = TRUE
        ORDER BY p.CodicePosto
      `;
      const rows = await db.any(querySemplice, [id]);
      const posti = formattaPosti(rows);
      return res.json({ success: true, posti });
    }

    const queryComplessa = `
        SELECT p.*, 
        EXISTS (
            SELECT 1 FROM Prenotazione pr 
            WHERE pr.ID_Posto = p.ID_Posto 
            AND pr.Stato = 'ATTIVA'
            AND (pr.InizioSosta, pr.FineSosta) OVERLAPS ($2::timestamp, $3::timestamp)
        ) AS is_prenotato,
        m.ID_Manutenzione,
        m.Inizio AS manutenzione_inizio,
        m.Fine AS manutenzione_fine,
        m.Motivazione AS manutenzione_motivo,
        CASE WHEN m.ID_Manutenzione IS NOT NULL THEN true ELSE false END AS is_in_manutenzione,
        GREATEST(
            (CASE 
                WHEN p.TipoVeicolo = 'AUTO' THEN g.TariffaAuto 
                WHEN p.TipoVeicolo = 'MOTO' THEN g.TariffaMoto 
                WHEN p.TipoVeicolo = 'FURGONE' THEN g.TariffaFurgone 
            END)
            + CASE WHEN p.IsElettrica THEN COALESCE(g.SovrapprezzoElettrica, 0) ELSE 0 END
            - CASE WHEN p.IsDisabili THEN COALESCE(g.ScontoDisabili, 0) ELSE 0 END
        , 0) as tariffaoraria
        FROM PostoAuto p
        JOIN Garage g ON p.ID_Garage = g.ID_Garage
        LEFT JOIN LATERAL (
            SELECT ID_Manutenzione, Inizio, Fine, Motivazione
            FROM ManutenzionePosto
            WHERE ID_Posto = p.ID_Posto
            AND (Inizio, Fine) OVERLAPS ($2::timestamp, $3::timestamp)
            ORDER BY Inizio ASC
            LIMIT 1
        ) m ON true
        WHERE p.ID_Garage = $1 AND p.IsAttivo = TRUE
        ORDER BY p.CodicePosto
    `;
    const rows = await db.any(queryComplessa, [id, inizio, fine]);
    const posti = formattaPosti(rows);

    res.json({ success: true, posti });
  } catch (err) {
    console.error("Errore SQL:", err);
    res.status(500).json({ success: false, error: "Errore recupero mappa posti" });
  }
});

router.get('/:id/occupazione', async (req, res) => {
  try {
    const idGarage = req.params.id;
    const resultPosti = await db.one('SELECT COUNT(*) as tot FROM PostoAuto WHERE ID_Garage = $1', [idGarage]);
    const resultOccupati = await db.one(`
          SELECT COUNT(*) as occ FROM Prenotazione p
          JOIN PostoAuto pa ON p.ID_Posto = pa.ID_Posto
          WHERE pa.ID_Garage = $1 AND p.Stato = 'ATTIVA' 
          AND (NOW() AT TIME ZONE 'Europe/Rome') BETWEEN p.InizioSosta AND p.FineSosta
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

router.get("/:id/recensioni", async (req, res) => {
  try {
    const { id } = req.params;
    const recensioni = await db.any(`
        SELECT 
            r.VotoGenerale, r.VotoPosizione, r.VotoPrezzo, r.VotoPulizia, r.VotoSpazio, r.VotoSicurezza, 
            r.Commento, r.DataCreazione, 
            u.Nome, SUBSTRING(u.Cognome, 1, 1) AS InizialeCognome, u.FotoProfilo_URL 
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

// Modifica di un garage esistente
router.put('/garages-gestore/:id', isGestore, async (req, res) => {
  try {

    const idGarage = req.params.id;
    const idGestore = req.session.utente.id;

    const {
      nome, descrizione, indirizzo, via, civico, cap, citta, provincia, latitudine, longitudine,
      tariffabase, tariffamoto, tariffafurgone, sovrapprezzoelettrica, scontodisabili,
      altezzamassima, orarioapertura, orariochiusura, is24h, mappatestuale, posti, nrighe, ncolonne
    } = req.body;

    if (!nome || !indirizzo || !tariffabase || !latitudine || !longitudine) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti.' });
    }

    const apertura = is24h ? '00:00' : (orarioapertura || '08:00');
    const chiusura = is24h ? '23:59' : (orariochiusura || '20:00');
    const mappa = mappatestuale || null;

    const result = await db.tx(async t => {
      // Verifica che il garage sia di questo gestore
      const garageEsistente = await t.oneOrNone('SELECT ID_Garage FROM Garage WHERE ID_Garage = $1 AND ID_Gestore = $2', [idGarage, idGestore]);
      if (!garageEsistente) throw new Error('Garage non trovato o non autorizzato');

      // Aggiornamento dati generali
      const garage = await t.one(`
        UPDATE Garage SET
          Nome = $1, Descrizione = $2, Indirizzo = $3, Via = $4, Civico = $5, Cap = $6, Citta = $7, Provincia = $8,
          Latitudine = $9, Longitudine = $10, AltezzaMassima = $11, TariffaAuto = $12, TariffaMoto = $13,
          TariffaFurgone = $14, SovrapprezzoElettrica = $15, ScontoDisabili = $16, OrarioApertura = $17,
          OrarioChiusura = $18, Is24h = $19, MappaTestuale = $20, NRighe = $21, NColonne = $22
        WHERE ID_Garage = $23
        RETURNING *
      `, [
        nome, descrizione || null, indirizzo, via || null, civico || null, cap || null, citta || null, provincia || null,
        latitudine, longitudine, altezzamassima || null, tariffabase, tariffamoto || null,
        tariffafurgone || null, sovrapprezzoelettrica || null, scontodisabili || null, apertura,
        chiusura, is24h || false, mappa, nrighe, ncolonne, idGarage
      ]);

      // Gestione Posti Auto
      const postiAttuali = await t.any('SELECT ID_Posto, CodicePosto FROM PostoAuto WHERE ID_Garage = $1 AND IsAttivo = TRUE', [idGarage]);
      const codiciRicevuti = posti.map(p => p.codice);

      for (const pDB of postiAttuali) {
        if (!codiciRicevuti.includes(pDB.codiceposto)) {
          await t.none('UPDATE PostoAuto SET IsAttivo = FALSE WHERE ID_Posto = $1', [pDB.id_posto]);
        }
      }

      if (posti && Array.isArray(posti)) {
        for (const posto of posti) {
          await t.none(`
            INSERT INTO PostoAuto (ID_Garage, CodicePosto, TipoVeicolo, IsDisabili, IsElettrica, IsCoperto, IsAttivo)
            VALUES ($1, $2, $3, $4, $5, $6, TRUE)
            ON CONFLICT (ID_Garage, CodicePosto) 
            DO UPDATE SET 
              TipoVeicolo = EXCLUDED.TipoVeicolo,
              IsDisabili = EXCLUDED.IsDisabili,
              IsElettrica = EXCLUDED.IsElettrica,
              IsCoperto = EXCLUDED.IsCoperto,
              IsAttivo = TRUE
          `, [
            idGarage, posto.codice, posto.tipo || 'AUTO',
            posto.isDisabili || false, posto.isElettrica || false,
            posto.isCoperto !== undefined ? posto.isCoperto : true
          ]);
        }
      }

      return garage;
    });

    res.json({ success: true, garage: result });

  } catch (error) {
    console.error("Errore modifica garage:", error);
    res.status(500).json({ error: error.message || 'Errore interno del server durante il salvataggio.' });
  }
});

// ─── Aggiunta blocco manutenzione a un singolo posto ─────────────────────────
router.post('/garages-gestore/:id/posti/:id_posto/manutenzione', isGestore, async (req, res) => {
    try {

        const { id, id_posto } = req.params;
        const { inizio, fine, motivazione } = req.body;
        const idGestore = req.session.utente.id;

    if (!inizio || !fine) return res.status(400).json({ error: 'Date obbligatorie' });

    await db.tx(async t => {
      const checkProprieta = await t.oneOrNone(`
                SELECT g.ID_Garage 
                FROM Garage g JOIN PostoAuto p ON g.ID_Garage = p.ID_Garage 
                WHERE g.ID_Garage = $1 AND p.ID_Posto = $2 AND g.ID_Gestore = $3
            `, [id, id_posto, idGestore]);

      if (!checkProprieta) throw new Error('Posto non trovato o non autorizzato');

      const occupato = await t.oneOrNone(`
                SELECT ID_Prenotazione FROM Prenotazione 
                WHERE ID_Posto = $1 AND Stato = 'ATTIVA'
                AND (InizioSosta, FineSosta) OVERLAPS ($2::timestamp, $3::timestamp)
            `, [id_posto, inizio, fine]);

      if (occupato) throw new Error('Impossibile disabilitare: sono presenti prenotazioni attive in questo periodo.');

      await t.none(`
                INSERT INTO ManutenzionePosto (ID_Posto, Inizio, Fine, Motivazione)
                VALUES ($1, $2, $3, $4)
            `, [id_posto, inizio, fine, motivazione || null]);
    });

    res.json({ success: true, message: 'Posto disabilitato con successo per il periodo selezionato.' });

  } catch (error) {
    console.error('Errore manutenzione:', error);
    res.status(400).json({ error: error.message || 'Errore interno' });
  }
});

// DELETE /api/garage/garages-gestore/:idGarage/posti/:idPosto/manutenzione/:idManutenzione
router.delete('/garages-gestore/:idGarage/posti/:idPosto/manutenzione/:idManutenzione', isGestore, async (req, res) => {
    try {

        const idGestore = req.session.utente.id;
        const { idGarage, idPosto, idManutenzione } = req.params;

        const checkGarage = await db.oneOrNone(
            'SELECT 1 FROM Garage WHERE ID_Garage = $1 AND ID_Gestore = $2',
            [idGarage, idGestore]
        );
        
        if (!checkGarage) {
            console.log("Errore: Il garage non appartiene a questo gestore");
            return res.status(403).json({ success: false, error: "Non hai i permessi per gestire questo garage" });
        }

        const result = await db.result(
            'DELETE FROM ManutenzionePosto WHERE ID_Manutenzione = $1 AND ID_Posto = $2',
            [idManutenzione, idPosto]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: "Manutenzione non trovata (forse già eliminata)" });
        }

        res.json({ success: true, message: "Manutenzione rimossa. Il posto è di nuovo disponibile." });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, error: "Errore interno del server: " + err.message });
    }

    const idGestore = utenteLoggato.id || utenteLoggato.id_utente;
    const { idGarage, idPosto, idManutenzione } = req.params;

    if (!idGestore) {
      throw new Error("ID Gestore risultante è undefined!");
    }

    const checkGarage = await db.oneOrNone(
      'SELECT 1 FROM Garage WHERE ID_Garage = $1 AND ID_Gestore = $2',
      [idGarage, idGestore]
    );

    if (!checkGarage) {
      console.log("Errore: Il garage non appartiene a questo gestore");
      return res.status(403).json({ success: false, error: "Non hai i permessi per gestire questo garage" });
    }

    const result = await db.result(
      'DELETE FROM ManutenzionePosto WHERE ID_Manutenzione = $1 AND ID_Posto = $2',
      [idManutenzione, idPosto]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: "Manutenzione non trovata (forse già eliminata)" });
    }

    res.json({ success: true, message: "Manutenzione rimossa. Il posto è di nuovo disponibile." });
  } catch (err) {
    console.error("!!! ERRORE CRASH IN DELETE MANUTENZIONE !!!");
    console.error(err.message);
    res.status(500).json({ success: false, error: "Errore interno del server: " + err.message });
  }
});

module.exports = router;