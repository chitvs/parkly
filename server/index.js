/*
 * Entry point del server Parkly.
 *
 * Responsabilità:
 * - Configura Express con CORS, sessione e middleware di base
 * - Monta le route API
 * - Avvia il server HTTP
 * - Inizializza Socket.io per la chat in tempo reale
 */

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const session = require("express-session");
const cors = require("cors");

// Carica le variabili d'ambiente dal .env nella root del progetto
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const db = require("./database/db");

// Importazione delle rotte dell'applicazione
const authRoutes = require("./routes/auth");
const garagesRoutes = require("./routes/garage");
const prenotazioniRoutes = require("./routes/prenotazioni");
const recensioniRoutes = require("./routes/recensioni");
const walletRoutes = require("./routes/wallet");
const messaggiRoutes = require("./routes/messaggi");

const app = express();
const port = process.env.PORT || 3000;

// CORS
// Accetta richieste solo dal frontend Vue in sviluppo (porta 5173).
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true, // necessario per inviare/ricevere i cookie di sessione
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Parsing automatico del body JSON per tutte le route
app.use(express.json());

// SESSIONE
// La sessione viene creata come middleware separato così da poter essere riutilizzata
// sia da Express (API HTTP) che da Socket.io (WebSocket).
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET, // firma crittografica del cookie
  resave: false, // non risalva la sessione se non modificata
  saveUninitialized: false, // non crea sessioni vuote per utenti non loggati
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // scade dopo 24 ore
    secure: false,
    sameSite: "lax",
  },
});

app.use(sessionMiddleware);

// NO-CACHE
// Disabilita il caching del browser per le risposte API.
// Previene la visualizzazione di dati vecchi dopo logout o cambio di stato.
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  next();
});

// FRONTEND STATICO
app.use("/client", express.static(path.join(__dirname, "../client")));

// ROUTE API
app.use("/api/auth", authRoutes);
app.use("/api/garage", garagesRoutes);
app.use("/api/prenotazioni", prenotazioniRoutes);
app.use("/api/messaggi", messaggiRoutes);
app.use("/api/recensioni", recensioniRoutes);
app.use("/api/wallet", walletRoutes);

// TEST DEL DATABASE
// Endpoint di diagnostica: verifica che il database risponda correttamente.
app.get("/test-db", async (req, res) => {
  try {
    const data = await db.any("SELECT NOW()");
    res.json({ success: true, orario: data[0].now });
  } catch (err) {
    console.error("[DB] Health check fallito:", err);
    res
      .status(500)
      .json({ success: false, error: "Connessione al database fallita." });
  }
});

// HTTP SERVER
// Creazione del server HTTP partendo dall'app Express, necessario per agganciare Socket.io
const httpServer = http.createServer(app);

// SOCKET.IO
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Condivide il middleware sessione con Socket.io:
// socket.request.session conterrà gli stessi dati di req.session nelle API REST.
io.engine.use(sessionMiddleware);

// AUTENTICAZIONE SOCKET
// Middleware eseguito ogni volta che un client tenta di connettersi via Socket
// Rifiuta connessioni senza sessione valida.
io.use((socket, next) => {
  const utente = socket.request.session?.utente;
  if (!utente) {
    return next(new Error("Non autenticato: sessione mancante o scaduta."));
  }
  socket.utente = utente; // rende l'utente accessibile agli event listener del socket
  next();
});

/*
 * funzione helper:
 * Verifica che l'utente abbia diritto a scrivere in una conversazione.
 * Un utente è autorizzato se è il cliente della prenotazione
 * oppure il gestore del garage coinvolto.
 */
async function verificaRelazione(idUtente, idPrenotazione) {
  const rows = await db.any(
    `SELECT 1
     FROM Prenotazione p
     JOIN PostoAuto pa ON pa.ID_Posto  = p.ID_Posto
     JOIN Garage    g  ON g.ID_Garage  = pa.ID_Garage
     WHERE p.ID_Prenotazione = $2
       AND (p.ID_Utente = $1 OR g.ID_Gestore = $1)
     LIMIT 1`,
    [idUtente, idPrenotazione],
  );
  return rows.length > 0;
}

// EVENTI SOCKET.IO
io.on("connection", (socket) => {
  const utente = socket.utente;
  console.log(
    `[Socket] Connesso: ${utente.nome} ${utente.cognome} (ID: ${utente.id})`,
  );

  // Unisce l'utente a una stanza privata che ha come nome il suo ID (es: user:5)
  // Questo permette di inviare messaggi a uno specifico utente sapendo solo il suo ID
  socket.join(`user:${utente.id}`);

  // Listener per l'evento di invio messaggio da parte del client
  socket.on(
    "invia_messaggio",
    async ({ idDestinatario, idPrenotazione, testo }) => {
      // Validazione base dell'input
      if (!idDestinatario || !idPrenotazione || !testo?.trim()) {
        return socket.emit("errore", { msg: "Dati messaggio incompleti." });
      }

      try {
        // Controllo autorizzazione: solo le parti coinvolte nella prenotazione possono scriversi
        const autorizzato = await verificaRelazione(utente.id, idPrenotazione);
        if (!autorizzato) {
          return socket.emit("errore", {
            msg: "Non autorizzato per questa prenotazione.",
          });
        }

        // Salvataggio permanente nel database con ID_Prenotazione
        const messaggio = await db.one(
          `INSERT INTO Messaggio (ID_Mittente, ID_Destinatario, ID_Prenotazione, Testo)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
          [utente.id, idDestinatario, idPrenotazione, testo.trim()],
        );

        const payload = {
          id_messaggio: messaggio.id_messaggio,
          id_mittente: messaggio.id_mittente,
          id_destinatario: messaggio.id_destinatario,
          id_prenotazione: messaggio.id_prenotazione,
          testo: messaggio.testo,
          letto: messaggio.letto,
          datainvio: messaggio.datainvio,
          nomemittente: utente.nome,
          cognomemittente: utente.cognome,
        };

        // Recapita il messaggio in tempo reale al destinatario (nella sua stanza privata)
        io.to(`user:${idDestinatario}`).emit("nuovo_messaggio", payload);

        // Conferma al mittente che il messaggio è stato consegnato
        socket.emit("messaggio_inviato", payload);
      } catch (err) {
        console.error("[Socket] Errore invio messaggio:", err);
        socket.emit("errore", { msg: "Errore interno durante l'invio." });
      }
    },
  );

  // Listener per la disconnessione
  socket.on("disconnect", () => {
    console.log(
      `[Socket] Disconnesso: ${utente.nome} ${utente.cognome} (ID: ${utente.id})`,
    );
  });
});

// AVVIO
httpServer.listen(port, () => {
  console.log(`[Server] In ascolto sulla porta ${port}...`);
});
