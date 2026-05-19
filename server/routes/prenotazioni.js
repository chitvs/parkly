/*
 * Gestione del ciclo di vita delle prenotazioni:
 * creazione, consultazione, annullamento (con calcolo rimborso).
 * Tutte le scritture avvengono in transazioni pg-promise.
 *
 * Endpoint protetti (richiedono sessione attiva):
 * POST /                                   - Crea una nuova prenotazione
 * GET /                                    - Recupera lo storico prenotazioni dell'utente
 * PUT /:codice/annulla                     - Annulla prenotazione e calcola rimborso
 * GET /:codice/anteprima-annullamento      - Calcola anteprima del rimborso senza applicarlo
 *
 * Endpoint protetti (richiedono ruolo GESTORE):
 * GET /prenotazioni-gestore                - Storico di tutte le prenotazioni ricevute
 */

const express = require("express");
const router = express.Router();
const db = require("../database/db");
const { isLoggato, isGestore } = require("../middleware/authMiddleware");
const {
  annullaERimborsa,
  calcolaPercentualeRimborso,
} = require("../helpers/prenotazioneHelpers");

// POST /api/prenotazioni
// Crea una nuova prenotazione e scala il saldo del cliente.
router.post("/", isLoggato, async (req, res) => {
  const {
    id_posto,
    targa,
    note,
    inizio,
    fine,
    prezzo_totale,
    codice_disabilita,
  } = req.body;
  const id_utente = req.session.utente.id;

  try {
    const nuova = await db.tx(async (t) => {
      // Controlla che il saldo sia sufficiente prima di fare qualsiasi altra query
      const utente = await t.one(
        `SELECT Saldo FROM Utente WHERE ID_Utente = $1`,
        [id_utente],
      );
      if (parseFloat(utente.saldo) < parseFloat(prezzo_totale)) {
        throw {
          isCustom: true,
          status: 402,
          message: "Credito insufficiente per completare la prenotazione.",
        };
      }

      // Verifica orari del garage, stato del garage e stato del posto in un'unica query
      const checkOrari = await t.one(
        `SELECT
            g.Is24h, g.OrarioApertura, g.OrarioChiusura,
            g.IsAttivo   AS garage_attivo,
            g.Nome       AS nome_garage,
            g.ID_Gestore,
            p.CodicePosto,
            p.IsAttivo   AS posto_attivo,
            -- Verifica che l'orario di INIZIO rientri nell'apertura
            (CASE
              WHEN g.OrarioApertura <= g.OrarioChiusura
                THEN ($2::timestamp::time >= g.OrarioApertura AND $2::timestamp::time <= g.OrarioChiusura)
              ELSE
                ($2::timestamp::time >= g.OrarioApertura OR  $2::timestamp::time <= g.OrarioChiusura)
            END) AS inizio_valido,
            -- Verifica che l'orario di FINE rientri nell'apertura
            (CASE
              WHEN g.OrarioApertura <= g.OrarioChiusura
                THEN ($3::timestamp::time >= g.OrarioApertura AND $3::timestamp::time <= g.OrarioChiusura)
              ELSE
                ($3::timestamp::time >= g.OrarioApertura OR  $3::timestamp::time <= g.OrarioChiusura)
            END) AS fine_valida
         FROM Garage g
         JOIN PostoAuto p ON g.ID_Garage = p.ID_Garage
         WHERE p.ID_Posto = $1`,
        [id_posto, inizio, fine],
      );

      // Blocco di sicurezza: il garage o il posto potrebbero essere stati disattivati
      // dal gestore nell'intervallo tra la visualizzazione e l'invio del form
      if (!checkOrari.garage_attivo || !checkOrari.posto_attivo) {
        throw {
          isCustom: true,
          status: 403,
          message:
            "Operazione annullata: questo garage o posto auto è stato appena disabilitato dal gestore.",
        };
      }

      if (
        !checkOrari.is24h &&
        (!checkOrari.inizio_valido || !checkOrari.fine_valida)
      ) {
        throw {
          isCustom: true,
          status: 400,
          message:
            "Gli orari selezionati non rientrano nell'orario di apertura del garage.",
        };
      }

      // Lock del posto con SELECT FOR UPDATE per evitare double-booking concorrenti
      const posto = await t.one(
        `SELECT IsDisabili FROM PostoAuto WHERE ID_Posto = $1 FOR UPDATE`,
        [id_posto],
      );
      if (posto.isdisabili && !codice_disabilita?.trim()) {
        throw {
          isCustom: true,
          status: 400,
          message:
            "Codice Contrassegno Disabili obbligatorio per questo parcheggio.",
        };
      }

      // Controllo disponibilità: nessuna prenotazione attiva si sovrappone all'intervallo
      const occupato = await t.oneOrNone(
        `SELECT ID_Prenotazione FROM Prenotazione
         WHERE ID_Posto = $1 AND Stato = 'ATTIVA'
           AND (InizioSosta, FineSosta) OVERLAPS ($2::timestamp, $3::timestamp)`,
        [id_posto, inizio, fine],
      );
      if (occupato) {
        throw {
          isCustom: true,
          status: 409,
          message: "Posto non più disponibile per gli orari selezionati.",
        };
      }

      // Generazione del codice univoco di prenotazione (formato PR-XXXXXXXX)
      let codice = "";
      let codiceLibero = false;
      while (!codiceLibero) {
        codice =
          "PR-" + Math.random().toString(36).substring(2, 10).toUpperCase();
        const esisteGia = await t.oneOrNone(
          `SELECT ID_Prenotazione FROM Prenotazione WHERE CodicePrenotazione = $1`,
          [codice],
        );
        if (!esisteGia) codiceLibero = true;
      }

      // Scala il saldo del cliente
      const userUpdate = await t.one(
        `UPDATE Utente SET Saldo = Saldo - $1 WHERE ID_Utente = $2 RETURNING Saldo`,
        [prezzo_totale, id_utente],
      );
      req.session.utente.saldo = userUpdate.saldo;

      // Inserisce la prenotazione (deve avvenire PRIMA delle transazioni per avere l'ID)
      const nuovaPrenotazione = await t.one(
        `INSERT INTO Prenotazione
           (ID_Utente, ID_Posto, CodicePrenotazione, Targa, Note, CodiceDisabilita, InizioSosta, FineSosta, PrezzoTotale)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING ID_Prenotazione, CodicePrenotazione`,
        [
          id_utente,
          id_posto,
          codice,
          targa,
          note,
          posto.isdisabili ? codice_disabilita : null,
          inizio,
          fine,
          prezzo_totale,
        ],
      );

      // Registra la transazione di pagamento per il cliente (importo negativo)
      await t.none(
        `INSERT INTO Transazione (ID_Utente, ID_Prenotazione, Tipo, Importo, Descrizione)
         VALUES ($1, $2, 'PRENOTAZIONE', $3, $4)`,
        [
          id_utente,
          nuovaPrenotazione.id_prenotazione,
          -prezzo_totale,
          `Pagamento prenotazione ${codice}`,
        ],
      );

      // Registra l'incasso sospeso per il gestore (verrà sbloccato al termine della sosta)
      await t.none(
        `INSERT INTO Transazione (ID_Utente, ID_Prenotazione, Tipo, Importo, Descrizione)
         VALUES ($1, $2, 'INCASSO_SOSPESO', $3, $4)`,
        [
          checkOrari.id_gestore,
          nuovaPrenotazione.id_prenotazione,
          prezzo_totale,
          `Incasso in sospeso per prenotazione ${codice}`,
        ],
      );

      return nuovaPrenotazione;
    });

    res.json({
      success: true,
      messaggio: "Prenotazione confermata.",
      prenotazione: nuova,
    });
  } catch (err) {
    console.error("[prenotazioni] Errore creazione:", err);
    if (err.isCustom)
      return res
        .status(err.status)
        .json({ success: false, error: err.message });
    res.status(500).json({ success: false, error: "Errore interno." });
  }
});

// GET /api/prenotazioni
// Recupera tutte le prenotazioni dell'utente loggato.
// Prima di restituire i dati, aggiorna lazily le prenotazioni scadute → CONCLUSA.
router.get("/", isLoggato, async (req, res) => {
  const utenteId = req.session.utente.id;

  try {
    // segna le prenotazioni scadute come CONCLUSA al momento della lettura
    await db.none(
      `UPDATE Prenotazione
       SET Stato = 'CONCLUSA'
       WHERE ID_Utente = $1
         AND Stato = 'ATTIVA'
         AND FineSosta < (NOW() AT TIME ZONE 'Europe/Rome')`,
      [utenteId],
    );

    const prenotazioni = await db.any(
      `SELECT
          p.ID_Prenotazione,   -- necessario per collegare la recensione
          pa.ID_Garage,        -- necessario per la recensione e il link al garage
          p.ID_Utente,
          p.CodicePrenotazione, p.Targa, p.InizioSosta, p.FineSosta,
          p.PrezzoTotale, p.Stato, p.DataCreazione,
          g.ID_Gestore,        -- necessario al frontend per aprire la chat con il gestore
          g.Nome    AS NomeGarage,
          g.Indirizzo,
          pa.CodicePosto,
          -- Flag: l'utente ha già lasciato una recensione per questa prenotazione?
          CASE WHEN r.ID_Recensione IS NOT NULL THEN TRUE ELSE FALSE END AS ha_recensito,
          -- Messaggi non letti per questa prenotazione
          (SELECT COUNT(*)
           FROM Messaggio m
           WHERE m.ID_Prenotazione = p.ID_Prenotazione
             AND m.ID_Destinatario = $1
             AND m.Letto = FALSE)::int AS nonletti
       FROM Prenotazione p
       JOIN PostoAuto pa ON p.ID_Posto    = pa.ID_Posto
       JOIN Garage    g  ON pa.ID_Garage  = g.ID_Garage
       LEFT JOIN Recensione r ON p.ID_Prenotazione = r.ID_Prenotazione
       WHERE p.ID_Utente = $1
       ORDER BY p.InizioSosta DESC`,
      [utenteId],
    );

    res.json({ success: true, data: prenotazioni });
  } catch (err) {
    console.error("[prenotazioni] Errore recupero:", err);
    res
      .status(500)
      .json({ success: false, error: "Errore interno del server." });
  }
});

// PUT /api/prenotazioni/:codice/annulla
// Annulla una prenotazione ATTIVA applicando la policy di rimborso di Parkly:
//   - Entro 15 min dalla prenotazione  -> 100%
//   - Più di 12 ore all'inizio sosta   -> 100%
//   - Tra 0 e 12 ore all'inizio sosta  ->  50% (penale 50% al gestore)
//   - Sosta già iniziata               ->   0%
router.put("/:codice/annulla", isLoggato, async (req, res) => {
  try {
    const codicePrenotazione = req.params.codice;
    const utenteId = req.session.utente.id;

    const risultato = await db.tx(async (t) => {
      // Recupera la prenotazione con lock per evitare annullamenti concorrenti
      const prenotazione = await t.oneOrNone(
        `SELECT
            p.ID_Prenotazione, p.ID_Utente, p.PrezzoTotale, p.Stato, g.ID_Gestore,
            (EXTRACT(EPOCH FROM (p.InizioSosta - (NOW() AT TIME ZONE 'Europe/Rome'))) / 3600) AS ore_all_inizio,
            (EXTRACT(EPOCH FROM (NOW() - p.DataCreazione)) / 60)                              AS minuti_dalla_creazione
         FROM Prenotazione p
         JOIN PostoAuto pa ON p.ID_Posto    = pa.ID_Posto
         JOIN Garage    g  ON pa.ID_Garage  = g.ID_Garage
         WHERE p.CodicePrenotazione = $1 AND p.ID_Utente = $2 AND p.Stato = 'ATTIVA'
         FOR UPDATE OF p`,
        [codicePrenotazione, utenteId],
      );

      if (!prenotazione) {
        throw {
          status: 400,
          message: "Prenotazione non trovata o già annullata.",
        };
      }

      const oreAllInizio = parseFloat(prenotazione.ore_all_inizio);
      const minutiDallaCreazione = parseFloat(
        prenotazione.minuti_dalla_creazione,
      );
      const percentualeRimborso = calcolaPercentualeRimborso(
        oreAllInizio,
        minutiDallaCreazione,
      );
      const importoRimborso =
        parseFloat(prenotazione.prezzototale) * percentualeRimborso;
      const penaleGestore =
        parseFloat(prenotazione.prezzototale) - importoRimborso;

      // Aggiorna stato, rimborsa cliente, rimuove incasso sospeso
      await annullaERimborsa(
        t,
        prenotazione,
        `Rimborso (${percentualeRimborso * 100}%) prenotazione ${codicePrenotazione}`,
      );

      // Se c'è una penale, accreditala subito al gestore come incasso definitivo
      if (penaleGestore > 0) {
        await t.none(
          `UPDATE Utente SET Saldo = Saldo + $1 WHERE ID_Utente = $2`,
          [penaleGestore, prenotazione.id_gestore],
        );
        await t.none(
          `INSERT INTO Transazione (ID_Utente, ID_Prenotazione, Tipo, Importo, Descrizione)
           VALUES ($1, $2, 'INCASSO_COMPLETATO', $3, $4)`,
          [
            prenotazione.id_gestore,
            prenotazione.id_prenotazione,
            penaleGestore,
            `Penale annullamento prenotazione ${codicePrenotazione}`,
          ],
        );
      }

      const utenteAggiornato = await t.one(
        `SELECT Saldo FROM Utente WHERE ID_Utente = $1`,
        [utenteId],
      );
      return { nuovoSaldo: utenteAggiornato.saldo, importoRimborso };
    });

    req.session.utente.saldo = risultato.nuovoSaldo;

    res.json({
      success: true,
      messaggio: `Prenotazione annullata. Rimborsato: €${risultato.importoRimborso.toFixed(2)}`,
      nuovoSaldo: risultato.nuovoSaldo,
    });
  } catch (err) {
    console.error("[prenotazioni] Errore annullamento:", err);
    res
      .status(err.status || 500)
      .json({ success: false, error: err.message || "Errore interno." });
  }
});

// GET /api/prenotazioni/:codice/anteprima-annullamento
// Restituisce un'anteprima del rimborso senza effettuare modifiche.
// Usata dal frontend per mostrare la modale di conferma.
router.get("/:codice/anteprima-annullamento", isLoggato, async (req, res) => {
  try {
    const prenotazione = await db.oneOrNone(
      `SELECT p.PrezzoTotale,
              (EXTRACT(EPOCH FROM (p.InizioSosta - (NOW() AT TIME ZONE 'Europe/Rome'))) / 3600) AS ore_all_inizio,
              (EXTRACT(EPOCH FROM (NOW() - p.DataCreazione)) / 60)                              AS minuti_dalla_creazione
       FROM Prenotazione p
       WHERE p.CodicePrenotazione = $1 AND p.ID_Utente = $2 AND p.Stato = 'ATTIVA'`,
      [req.params.codice, req.session.utente.id],
    );

    if (!prenotazione) throw new Error("Prenotazione non trovata.");

    const oreAllInizio = parseFloat(prenotazione.ore_all_inizio);
    const minutiDallaCreazione = parseFloat(
      prenotazione.minuti_dalla_creazione,
    );
    const prezzo = parseFloat(prenotazione.prezzototale);
    const percentuale =
      calcolaPercentualeRimborso(oreAllInizio, minutiDallaCreazione) * 100;

    // Costruisce il messaggio descrittivo per la modale di conferma
    let messaggio, motivazione, classe;
    if (minutiDallaCreazione <= 15) {
      messaggio = "Rimborso Totale";
      motivazione =
        "Hai annullato entro 15 minuti dalla prenotazione (Diritto di Recesso Rapido).";
      classe = "text-success";
    } else if (oreAllInizio > 12) {
      messaggio = "Rimborso Totale";
      motivazione =
        "Hai annullato con più di 12 ore di preavviso rispetto all'inizio della sosta.";
      classe = "text-success";
    } else if (oreAllInizio > 0) {
      messaggio = "Rimborso Parziale";
      motivazione =
        "Mancano meno di 12 ore alla sosta: viene applicata una penale del 50%.";
      classe = "text-warning";
    } else {
      messaggio = "Nessun Rimborso";
      motivazione =
        "La sosta è già iniziata. Libererai solo il posto auto per altri utenti.";
      classe = "text-danger";
    }

    res.json({
      success: true,
      dati: {
        rimborso: prezzo * (percentuale / 100),
        messaggio,
        motivazione,
        classe,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/prenotazioni/prenotazioni-gestore
// Storico di tutte le prenotazioni dei garage del gestore loggato.
router.get("/prenotazioni-gestore", isGestore, async (req, res) => {
  try {
    const idGestore = req.session.utente.id;

    const result = await db.any(
      `SELECT
          p.*,
          g.Nome  AS nome_garage,
          pa.ID_Garage,
          u.Nome  AS nomecliente,
          u.Cognome AS cognomecliente,
          -- Messaggi non letti per questa prenotazione (dal punto di vista del gestore)
          (SELECT COUNT(*)
           FROM Messaggio m
           WHERE m.ID_Prenotazione = p.ID_Prenotazione
             AND m.ID_Destinatario = $1
             AND m.Letto = FALSE)::int AS nonletti
       FROM Prenotazione p
       JOIN PostoAuto pa ON p.ID_Posto   = pa.ID_Posto
       JOIN Garage    g  ON pa.ID_Garage = g.ID_Garage
       JOIN Utente    u  ON p.ID_Utente  = u.ID_Utente
       WHERE g.ID_Gestore = $1
       ORDER BY p.InizioSosta DESC`,
      [idGestore],
    );

    res.json(result);
  } catch (err) {
    console.error("[prenotazioni] Errore storico gestore:", err);
    res.status(500).json({ error: "Errore interno." });
  }
});

module.exports = router;
