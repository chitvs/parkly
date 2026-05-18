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
    const garage = await db.oneOrNone(
        "SELECT *, TariffaAuto AS tariffabase FROM Garage WHERE ID_Garage = $1 AND IsAttivo = TRUE", 
        [id]
    );
    if (!garage) {
        return res.status(404).json({ success: false, error: "Garage non trovato o temporaneamente non disponibile" });
    }
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
    const idGestore = req.session.utente.id;
    const idGarage = req.params.id;
    const body = req.body;

    // 1. Sicurezza: Verifica che il garage esista e appartenga al gestore loggato
    const checkGarage = await db.oneOrNone(
      'SELECT ID_Garage FROM Garage WHERE ID_Garage = $1 AND ID_Gestore = $2',
      [idGarage, idGestore]
    );

    if (!checkGarage) {
      return res.status(403).json({ error: 'Accesso negato o garage non trovato.' });
    }

    // 2. AGGIORNAMENTO PARZIALE: Caso del Toggle Switch (attiva/disattiva garage)
    if (body.isattivo !== undefined && !body.nome) {
      try {
        const updatedGarage = await db.tx(async t => {
            // Se stiamo DISATTIVANDO il garage (isattivo === false)
            if (body.isattivo === false) {
                // A. Controlla se ci sono auto ATTUALMENTE parcheggiate
                const inCorso = await t.any(`
                    SELECT 1 FROM Prenotazione p
                    JOIN PostoAuto pa ON p.ID_Posto = pa.ID_Posto
                    WHERE pa.ID_Garage = $1 AND p.Stato = 'ATTIVA'
                    AND p.InizioSosta <= (NOW() AT TIME ZONE 'Europe/Rome') 
                    AND p.FineSosta > (NOW() AT TIME ZONE 'Europe/Rome')
                `, [idGarage]);

                if (inCorso.length > 0) {
                    throw new Error("Impossibile disattivare il garage: ci sono auto attualmente parcheggiate all'interno.");
                }

                // B. Trova le prenotazioni future attive per annullarle
                const future = await t.any(`
                    SELECT p.ID_Prenotazione, p.ID_Utente, p.PrezzoTotale, p.CodicePrenotazione
                    FROM Prenotazione p
                    JOIN PostoAuto pa ON p.ID_Posto = pa.ID_Posto
                    WHERE pa.ID_Garage = $1 AND p.Stato = 'ATTIVA'
                    AND p.InizioSosta > (NOW() AT TIME ZONE 'Europe/Rome')
                `, [idGarage]);

                // C. Annulla e rimborsa
                for (const pren of future) {
                    await t.none(`UPDATE Prenotazione SET Stato = 'ANNULLATA' WHERE ID_Prenotazione = $1`, [pren.id_prenotazione]);
                    await t.none(`UPDATE Utente SET Saldo = Saldo + $1 WHERE ID_Utente = $2`, [pren.prezzototale, pren.id_utente]);
                    await t.none(`
                        INSERT INTO Transazione (ID_Utente, ID_Prenotazione, Tipo, Importo, Descrizione)
                        VALUES ($1, $2, 'RIMBORSO', $3, $4)
                    `, [pren.id_utente, pren.id_prenotazione, pren.prezzototale, `Rimborso totale per chiusura forzata del garage (Prenotazione ${pren.codiceprenotazione})`]);
                    
                    // Rimuovi l'incasso sospeso del gestore
                    await t.none(`DELETE FROM Transazione WHERE ID_Prenotazione = $1 AND Tipo = 'INCASSO_SOSPESO'`, [pren.id_prenotazione]);
                }
            }

            // D. Esegui il cambio di stato effettivo
            return await t.one(
                'UPDATE Garage SET IsAttivo = $1 WHERE ID_Garage = $2 RETURNING *',
                [body.isattivo, idGarage]
            );
        });
        
        return res.status(200).json({ success: true, garage: updatedGarage });
        
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    }

    // 3. AGGIORNAMENTO COMPLETO: Caso del Form di Modifica
    const {
      nome, descrizione, indirizzo, via, civico, cap, citta, provincia, latitudine, longitudine,
      tariffabase, tariffamoto, tariffafurgone, sovrapprezzoelettrica, scontodisabili,
      altezzamassima, orarioapertura, orariochiusura, is24h, mappatestuale, posti, 
      nrighe, ncolonne 
    } = body;

    if (!nome || !indirizzo || !tariffabase || !latitudine || !longitudine) {
      return res.status(400).json({ error: 'Campi obbligatori mancanti.' });
    }

    const apertura = is24h ? '00:00' : (orarioapertura || '08:00');
    const chiusura = is24h ? '23:59' : (orariochiusura || '20:00');
    const mappa = mappatestuale || null;

    const result = await db.tx(async t => {
      // A. Aggiorna l'anagrafica del Garage
      const garage = await t.one(
        `UPDATE Garage SET 
          Nome = $1, Descrizione = $2, Indirizzo = $3, Via = $4, Civico = $5, Cap = $6, Citta = $7, Provincia = $8, 
          Latitudine = $9, Longitudine = $10, AltezzaMassima = $11, TariffaAuto = $12, TariffaMoto = $13, 
          TariffaFurgone = $14, SovrapprezzoElettrica = $15, ScontoDisabili = $16, OrarioApertura = $17, 
          OrarioChiusura = $18, Is24h = $19, MappaTestuale = $20, NRighe = $21, NColonne = $22
         WHERE ID_Garage = $23 
         RETURNING *`,
        [
          nome, descrizione || null, indirizzo, via || null, civico || null, cap || null, citta || null, provincia || null,
          latitudine, longitudine, altezzamassima || null, tariffabase, tariffamoto || null, tariffafurgone || null,
          sovrapprezzoelettrica || null, scontodisabili || null, apertura, chiusura, is24h || false, mappa,
          nrighe, ncolonne, idGarage
        ]
      );

      // B. Gestione Intelligente dei Posti Auto
      if (posti && Array.isArray(posti)) {
        const codiciMantenuti = [];

        for (const posto of posti) {
          codiciMantenuti.push(posto.codice);

          // UPSERT: Inserisce il posto se non esiste, altrimenti aggiorna le caratteristiche riattivandolo
          await t.none(
            `INSERT INTO PostoAuto 
              (ID_Garage, CodicePosto, TipoVeicolo, IsDisabili, IsElettrica, IsCoperto, IsAttivo)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE)
             ON CONFLICT (ID_Garage, CodicePosto) 
             DO UPDATE SET 
              TipoVeicolo = EXCLUDED.TipoVeicolo,
              IsDisabili = EXCLUDED.IsDisabili,
              IsElettrica = EXCLUDED.IsElettrica,
              IsCoperto = EXCLUDED.IsCoperto,
              IsAttivo = TRUE`,
            [
              idGarage,
              posto.codice,
              posto.tipo || 'AUTO',
              posto.isDisabili || false,
              posto.isElettrica || false,
              posto.isCoperto !== undefined ? posto.isCoperto : true
            ]
          );
        }

        // SOFT DELETE: Disattiva i posti che sono stati rimossi dalla mappa dal gestore
        // Non facciamo una DELETE reale per non distruggere le prenotazioni associate passate
        if (codiciMantenuti.length > 0) {
          await t.none(
            `UPDATE PostoAuto SET IsAttivo = FALSE 
             WHERE ID_Garage = $1 AND CodicePosto != ALL($2::text[])`,
            [idGarage, codiciMantenuti]
          );
        } else {
          // Se per qualche motivo ha rimosso TUTTI i posti
          await t.none(`UPDATE PostoAuto SET IsAttivo = FALSE WHERE ID_Garage = $1`, [idGarage]);
        }
      }

      return garage;
    });

    res.status(200).json({ success: true, garage: result });

  } catch (error) {
    console.error("Errore aggiornamento garage:", error);
    if (error.code === '23505') {
       return res.status(400).json({ error: 'Errore: Codici dei posti duplicati o non validi.' });
    }
    res.status(500).json({ error: 'Errore interno del server durante il salvataggio.' });
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

            // 2. Troviamo le prenotazioni attive in conflitto e verifichiamo se qualcuna è GIÀ iniziata
            const prenotazioniCoinvolte = await t.any(`
                SELECT ID_Prenotazione, ID_Utente, PrezzoTotale, CodicePrenotazione,
                       (InizioSosta <= (NOW() AT TIME ZONE 'Europe/Rome')) AS is_in_corso
                FROM Prenotazione 
                WHERE ID_Posto = $1 AND Stato = 'ATTIVA'
                AND (InizioSosta, FineSosta) OVERLAPS ($2::timestamp, $3::timestamp)
            `, [id_posto, inizio, fine]);

            // 3. Controllo: blocca categoricamente se c'è una sosta attualmente in corso
            const prenotazioneInCorso = prenotazioniCoinvolte.find(p => p.is_in_corso);
            if (prenotazioneInCorso) {
                throw new Error('Impossibile mettere in manutenzione: è presente un\'auto attualmente parcheggiata in questo posto.');
            }

            // 4. Gestione: Annullamento automatico e Rimborsi (solo per prenotazioni FUTURE)
            for (const pren of prenotazioniCoinvolte) {
                // Imposta stato su ANNULLATA
                await t.none(`UPDATE Prenotazione SET Stato = 'ANNULLATA' WHERE ID_Prenotazione = $1`, [pren.id_prenotazione]);

                // Rimborsa il cliente al 100%
                await t.none(`UPDATE Utente SET Saldo = Saldo + $1 WHERE ID_Utente = $2`, [pren.prezzototale, pren.id_utente]);
                await t.none(`
                    INSERT INTO Transazione (ID_Utente, ID_Prenotazione, Tipo, Importo, Descrizione)
                    VALUES ($1, $2, 'RIMBORSO', $3, $4)
                `, [pren.id_utente, pren.id_prenotazione, pren.prezzototale, `Rimborso totale per annullamento forzato dal gestore (Prenotazione ${pren.codiceprenotazione})`]);

                // Elimina l'incasso sospeso del gestore  ATTENZIONE: il gestore non vedrà nel portafoglio l'annullamento poichè la riga sparisce e basta. 
                await t.none(`DELETE FROM Transazione WHERE ID_Prenotazione = $1 AND Tipo = 'INCASSO_SOSPESO'`, [pren.id_prenotazione]);
            }

            // 5. Inserimento della manutenzione
            await t.none(`
                INSERT INTO ManutenzionePosto (ID_Posto, Inizio, Fine, Motivazione)
                VALUES ($1, $2, $3, $4)
            `, [id_posto, inizio, fine, motivazione || null]);
    });

        res.json({ success: true, message: 'Manutenzione avviata. Le eventuali prenotazioni future in conflitto sono state annullate e rimborsate.' });

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