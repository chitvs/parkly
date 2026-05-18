/*
 * Autenticazione e gestione del profilo utente.
 *
 * Endpoint pubblici (no auth):
 *   POST /register  - Registrazione nuovo account
 *   POST /login     - Login con email o nomeUtente
 *
 * Endpoint protetti (richiedono sessione attiva):
 *   GET /me                 - Sincronizzazione sessione col frontend
 *   GET /profile            - Dati profilo (senza password)
 *   PUT /profile            - Aggiornamento dati profilo
 *   PUT /change-password    - Cambio password
 *   PUT /upgrade-role       - Promozione a GESTORE
 *   POST /upload-avatar     - Upload foto profilo su Supabase
 *   POST /logout            - Distruzione sessione
 *   DELETE /delete-account  - Soft-delete account
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const db = require("../database/db");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
const { isLoggato } = require("../middleware/authMiddleware");

// Configura il client Supabase usando le variabili dell'environment
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// Configura Multer (handler per le foto prima di mandarle a Supabase)
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/auth/register
// Crea un nuovo account utente e avvia automaticamente la sessione.
router.post("/register", async (req, res) => {
  const {
    nome,
    cognome,
    nomeUtente,
    email,
    password,
    ruolo,
    telefono,
    codiceFiscale,
  } = req.body;

  try {
    // Verifica unicità di email e nome utente prima di procedere
    const utenteEsistente = await db.oneOrNone(
      `SELECT 1 FROM Utente WHERE Email = $1 OR NomeUtente = $2`,
      [email, nomeUtente],
    );
    if (utenteEsistente) {
      return res
        .status(400)
        .json({ success: false, error: "Email o Nome Utente già in uso." });
    }

    // Hash della password con bcrypt (salt rounds = 10)
    const passwordHash = await bcrypt.hash(password, 10);

    // Salvataggio nel database
    const nuovoUtente = await db.one(
      `INSERT INTO Utente (Nome, Cognome, NomeUtente, Email, PasswordHash, Ruolo, Telefono, CodiceFiscale)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id_utente, nome, cognome, nomeutente, email, ruolo`,
      [
        nome,
        cognome,
        nomeUtente,
        email,
        passwordHash,
        ruolo || "CLIENTE", // default CLIENTE se non specificato
        telefono || null,
        codiceFiscale || null,
      ],
    );

    // Avvia la sessione immediatamente dopo la registrazione
    req.session.utente = {
      id: nuovoUtente.id_utente,
      nome: nuovoUtente.nome,
      cognome: nuovoUtente.cognome,
      nomeUtente: nuovoUtente.nomeutente,
      saldo: 0.0,
      email: nuovoUtente.email,
      ruolo: nuovoUtente.ruolo,
    };

    res.json({
      success: true,
      messaggio: "Registrazione completata.",
      utente: req.session.utente,
    });
  } catch (err) {
    console.error("[auth] Errore registrazione:", err);
    res
      .status(500)
      .json({ success: false, error: "Errore interno del server." });
  }
});

// POST /api/auth/login
// Autentica l'utente tramite email o nomeUtente e crea la sessione.
router.post("/login", async (req, res) => {
  const { identificatore, password } = req.body; // identificatore = email o nomeUtente

  try {
    // Cerca per email o nomeUtente e verifica che l'account sia attivo
    const utente = await db.oneOrNone(
      `SELECT * FROM Utente WHERE (Email = $1 OR NomeUtente = $1) AND IsAttivo = TRUE`,
      [identificatore],
    );
    if (!utente) {
      return res
        .status(401)
        .json({ success: false, error: "Credenziali non valide." });
    }

    // Confronta le password usando bcrypt
    const passwordOk = await bcrypt.compare(password, utente.passwordhash);
    if (!passwordOk) {
      return res
        .status(401)
        .json({ success: false, error: "Password errata." });
    }

    // Salva l'utente nella sessione
    req.session.utente = {
      id: utente.id_utente,
      nome: utente.nome,
      cognome: utente.cognome,
      nomeUtente: utente.nomeutente,
      saldo: utente.saldo,
      email: utente.email,
      ruolo: utente.ruolo,
      fotoProfilo_URL: utente.fotoprofilo_url,
    };

    res.json({ success: true, utente: req.session.utente });
  } catch (err) {
    console.error("[auth] Errore login:", err);
    res
      .status(500)
      .json({ success: false, error: "Errore interno del server." });
  }
});

// PUT /api/auth/change-password
// Cambia la password dell'utente loggato previa verifica di quella corrente.
router.put("/change-password", isLoggato, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    // La nuova password non può essere uguale alla vecchia
    if (currentPassword === newPassword) {
      return res
        .status(400)
        .json({
          success: false,
          error: "La nuova password non può essere identica a quella attuale.",
        });
    }

    // Recupero l'hash della password attuale dal database
    const utente = await db.oneOrNone(
      `SELECT PasswordHash FROM Utente WHERE id_utente = $1`,
      [req.session.utente.id],
    );
    if (!utente)
      return res
        .status(404)
        .json({ success: false, error: "Utente non trovato." });

    // Confronto la password inserita con l'hash nel DB
    const passwordOk = await bcrypt.compare(
      currentPassword,
      utente.passwordhash,
    );
    if (!passwordOk) {
      return res
        .status(401)
        .json({ success: false, error: "La password attuale è errata." });
    }

    // Se è corretta, cripto la nuova password
    const nuovoHash = await bcrypt.hash(newPassword, 10);

    // Salvo la nuova password nel database
    await db.none(`UPDATE Utente SET PasswordHash = $1 WHERE id_utente = $2`, [
      nuovoHash,
      req.session.utente.id,
    ]);

    res.json({ success: true, messaggio: "Password aggiornata con successo." });
  } catch (err) {
    console.error("[auth] Errore cambio password:", err);
    res
      .status(500)
      .json({ success: false, error: "Errore interno del server." });
  }
});

// GET /api/auth/profile
// Restituisce i dati del profilo dell'utente loggato.
// NON include PasswordHash per sicurezza.
router.get("/profile", isLoggato, async (req, res) => {
  try {
    const utente = await db.oneOrNone(
      `SELECT id_utente, nome, cognome, nomeutente, email, telefono, codiceFiscale, fotoprofilo_url, ruolo, saldo
       FROM Utente WHERE id_utente = $1`,
      [req.session.utente.id],
    );
    if (!utente)
      return res
        .status(404)
        .json({ success: false, error: "Utente non trovato." });

    res.json({ success: true, data: utente });
  } catch (err) {
    console.error("[auth] Errore recupero profilo:", err);
    res
      .status(500)
      .json({ success: false, error: "Errore interno del server." });
  }
});

// PUT /api/auth/profile
// Aggiorna i dati anagrafici del profilo e sincronizza la sessione.
router.put("/profile", isLoggato, async (req, res) => {
  const { nome, cognome, nomeUtente, email, telefono, codiceFiscale } =
    req.body;

  try {
    // Verifica che email e nomeUtente non siano già in uso da un altro account
    const datiEsistenti = await db.oneOrNone(
      `SELECT id_utente FROM Utente
       WHERE (Email = $1 OR NomeUtente = $2) AND id_utente != $3`,
      [email, nomeUtente, req.session.utente.id],
    );
    if (datiEsistenti) {
      return res.status(400).json({
        success: false,
        error: "Questa email o nome utente è già in uso da un altro account.",
      });
    }

    // Eseguo l'UPDATE nel database
    const utenteAggiornato = await db.one(
      `UPDATE Utente
       SET Nome = $1, Cognome = $2, NomeUtente = $3, Email = $4, Telefono = $5, CodiceFiscale = $6
       WHERE id_utente = $7
       RETURNING id_utente, nome, nomeutente, email, ruolo`,
      [
        nome,
        cognome,
        nomeUtente,
        email,
        telefono || null,
        codiceFiscale || null,
        req.session.utente.id,
      ],
    );

    // Aggiorno i dati salvati nella sessione
    req.session.utente.nome = utenteAggiornato.nome;
    req.session.utente.nomeUtente = utenteAggiornato.nomeutente;
    req.session.utente.email = utenteAggiornato.email;

    res.json({
      success: true,
      messaggio: "Profilo aggiornato con successo.",
      utente: req.session.utente,
    });
  } catch (err) {
    console.error("[auth] Errore aggiornamento profilo:", err);
    res
      .status(500)
      .json({ success: false, error: "Errore interno del server." });
  }
});

// POST /api/auth/logout
// Distrugge la sessione server e cancella il cookie lato client.
router.post("/logout", isLoggato, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("[auth] Errore distruzione sessione:", err);
      return res
        .status(500)
        .json({ success: false, message: "Impossibile chiudere la sessione." });
    }
    res.clearCookie("connect.sid");
    res.json({ success: true, message: "Logout effettuato con successo." });
  });
});

// DELETE /api/auth/delete-account
// Eliminazione dell'account con soft-delete,
// imposta IsAttivo = FALSE senza cancellare i dati dal DB.
// Successivamente distrugge la sessione per disconnettere l'utente.
router.delete("/delete-account", isLoggato, async (req, res) => {
  try {
    const utenteId = req.session.utente.id;

    // Spengo l'utente nel db (soft-delete)
    await db.none(`UPDATE Utente SET IsAttivo = FALSE WHERE id_utente = $1`, [
      utenteId,
    ]);

    // Distruggo la sessione corrente in modo che venga buttato fuori dall'app
    req.session.destroy((err) => {
      if (err) {
        console.error("[auth] Errore sessione dopo eliminazione account:", err);
        return res.status(500).json({
          success: false,
          error: "Impossibile disconnettere l'account.",
        });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true, message: "Account eliminato con successo." });
    });
  } catch (err) {
    console.error("[auth] Errore eliminazione account:", err);
    res
      .status(500)
      .json({ success: false, error: "Errore interno del server." });
  }
});

// GET /api/auth/me
// Restituisce i dati della sessione corrente.
// Usato dal frontend all'avvio per sincronizzarsi con lo stato del server
// (es. dopo un refresh della pagina).
router.get("/me", isLoggato, (req, res) => {
  res.json({ success: true, utente: req.session.utente });
});

// POST /api/auth/upload-avatar
// Carica una nuova foto profilo su Supabase Storage.
// Prima elimina la foto precedente (se esiste) per non lasciare file orfani.
router.post(
  "/upload-avatar",
  isLoggato,
  upload.single("avatar"),
  async (req, res) => {
    if (!req.file)
      return res.status(400).json({ error: "Nessun file caricato." });

    try {
      const file = req.file;
      const utenteId = req.session.utente.id;

      // Elimina la vecchia foto dal bucket se l'utente ne aveva già una
      const vecchiaUrl = req.session.utente.fotoProfilo_URL;
      if (vecchiaUrl) {
        // Estrapolo solo il nome del file finale dall'URL (es: 12_avatar_1690000.jpg)
        const vecchioNomeFile = vecchiaUrl.split("/").pop();
        // Dico a Supabase di cancellarlo dal bucket
        await supabase.storage.from("avatars").remove([vecchioNomeFile]);
      }

      // Creo la nuova foto
      // Nome file univoco: userId_avatar_timestamp.ext — Date.now() garantisce no collisioni
      const estensione = file.originalname.split(".").pop();
      const nomeFile = `${utenteId}_avatar_${Date.now()}.${estensione}`;

      // Carico il file su Supabase Storage nel bucket 'avatars'
      const { data, error } = await supabase.storage
        .from("avatars")
        .upload(nomeFile, file.buffer, {
          contentType: file.mimetype,
          upsert: false, // Messo a false: avendo Date.now() il nome è sempre unico, non c'è niente da sovrascrivere
        });

      if (error) throw error;

      // Ottengo l'URL pubblico della foto appena caricata
      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(nomeFile);
      const urlFoto = publicUrlData.publicUrl;

      // Salva l'URL nel DB e aggiorna la sessione
      await db.none(
        `UPDATE Utente SET FotoProfilo_URL = $1 WHERE id_utente = $2`,
        [urlFoto, utenteId],
      );
      req.session.utente.fotoProfilo_URL = urlFoto;

      res.json({ success: true, url: urlFoto });
    } catch (err) {
      console.error("[auth] Errore upload avatar:", err);
      res
        .status(500)
        .json({ success: false, error: "Errore durante il caricamento." });
    }
  },
);

// PUT /api/auth/upgrade-role
// Promuove l'utente loggato al ruolo GESTORE e sincronizza la sessione.
router.put("/upgrade-role", isLoggato, async (req, res) => {
  try {
    const utenteId = req.session.utente.id;

    // Aggiornamento sul database impostando il ruolo a 'GESTORE'
    const utenteAggiornato = await db.one(
      `UPDATE Utente SET Ruolo = 'GESTORE' WHERE id_utente = $1 RETURNING ruolo`,
      [utenteId],
    );

    // Sincronizzazione della sessione
    req.session.utente.ruolo = utenteAggiornato.ruolo;

    res.json({
      success: true,
      messaggio: "Congratulazioni! Ora sei un Gestore su Parkly.",
      utente: req.session.utente,
    });
  } catch (err) {
    console.error("[auth] Errore upgrade ruolo:", err);
    res.status(500).json({
      success: false,
      error: "Errore interno durante l'aggiornamento del profilo.",
    });
  }
});

module.exports = router;
