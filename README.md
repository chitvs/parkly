<h1 align="center">
  <img src="https://raw.githubusercontent.com/chitvs/parkly/readme/client/src/assets/parkly_logo-intero-00408A.svg" width="280" alt="Parkly">
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D" alt="Vue.js" />
  <img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" />
  <img src="https://img.shields.io/badge/Bootstrap-563D7C?style=for-the-badge&logo=bootstrap&logoColor=white" alt="Bootstrap" />
  <img src="https://img.shields.io/badge/Leaflet-199900?style=for-the-badge&logo=leaflet&logoColor=white" alt="Leaflet" />
  <img src="https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-404D59?style=for-the-badge&logo=express&logoColor=white" alt="Express.js" />
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
</p>

Parkly è un'applicazione web full-stack per la gestione e la prenotazione di parcheggi, un progetto nato durante il corso di _Tecnologie e Sistemi Web_, all'Università degli Studi di Roma "La Sapienza".

## Indice

- [Architettura e tecnologie utilizzate](#architettura-e-tecnologie-utilizzate)
- [Struttura del progetto](#struttura-del-progetto)
- [Schema del database](#schema-del-database)
- [Funzionalità](#funzionalità)
  - [Flusso di autenticazione](#flusso-di-autenticazione)
  - [Ricerca dei garage](#ricerca-dei-garage)
  - [Prenotazione di un parcheggio](#prenotazione-di-un-parcheggio)
  - [Gestione del portafoglio](#gestione-del-portafoglio)
  - [Il ruolo Gestore e la pubblicazione di un garage](#il-ruolo-gestore-e-la-pubblicazione-di-un-garage)
  - [Sistema di recensioni](#sistema-di-recensioni)
  - [Chat interattiva](#chat-interattiva)
- [Viste](#viste)
- [Installazione](#installazione)
  - [Prerequisiti](#prerequisiti)
  - [Installazione delle dipendenze](#installazione-delle-dipendenze)
  - [Configurazione del database](#configurazione-del-database)
  - [Variabili d'ambiente](#variabili-dambiente)
  - [Avvio](#avvio)
- [Autori](#autori)

## Architettura e tecnologie utilizzate

Il progetto è strutturato secondo un'architettura client-server, separando l'interfaccia utente dalle API e dalla gestione dei dati.

Il frontend è basato su Vue.js e Vite. L'interfaccia è costruita con Bootstrap, mentre per il rendering e l'integrazione della mappa geografica è stato utilizzato Leaflet.

Il backend è un server Node.js basato su Express. Per l'autenticazione abbiamo utilizzato express-session e cookie, proteggendo le password con bcrypt.

Per quanto riguarda i dati abbiamo scelto un database relazionale, PostgreSQL (hostato tramite Supabase). Oltre al database, sfruttiamo il bucket di Supabase Storage (interfacciato tramite multer in memoria sul server) per la gestione di alcuni file statici, come le foto profilo degli utenti.

Infine, per le funzionalità in tempo reale della chat abbiamo integrato Socket.IO.

## Struttura del progetto

```
parkly/
├── client/
│   └── src/
│       ├── assets/          # Immagini e icone
│       ├── components/      # Componenti UI riutilizzabili
│       ├── composables/     # Logica reattiva incapsulata
│       ├── router/          # Routing lato client
│       ├── store/           # Stato applicativo
│       ├── utils/           # Funzioni ausiliarie
│       └── views/           # Viste
└── server/
    ├── database/
    │   ├── parkly.sql       # Definizione dello schema
    │   └── seed.sql         # Dati di esempio
    ├── middleware/
    │   └── authMiddleware.js
    ├── routes/              # Endpoint API
    └── index.js
```

## Schema del database

Il database è composto da sette tabelle. `Utente` è l'entità centrale: un utente con ruolo `GESTORE` può possedere uno o più `Garage`, ciascuno composto da più `PostoAuto`. Una `Prenotazione` associa un utente a un posto per un intervallo temporale definito e costituisce il presupposto per le entità dipendenti: `Messaggio`, `Recensione` e `Transazione`. Di seguito il diagramma E-R:

<p align="center">
  <img src="./client/src/assets/schema-database.svg" width="100%" alt="Diagramma E-R">
</p>

## Funzionalità

- Prenotazione di posti auto con selezione dell'intervallo orario e addebito automatico sul portafoglio.
- Ricerca garage per posizione geografica su mappa interattiva e lista, con filtri per tipo di veicolo, accesso disabili, ricarica elettrica e copertura.
- Portafoglio integrato con ricarica manuale e storico completo delle transazioni.
- Chat in tempo reale tra cliente e gestore, contestualizzata alle prenotazioni attive.
- Sistema di recensioni vincolate alle prenotazioni concluse.
- Dashboard gestore con occupazione in tempo reale, statistiche mensili e planimetria interattiva del garage.

### Flusso di autenticazione

L'accesso è gestito tramite sessioni e password criptate. Gli utenti possono gestire il proprio profilo, personalizzare l'avatar, aggiornare i dati personali o richiedere il ruolo di Gestore. Il sistema supporta anche l'eliminazione dell'account tramite soft-delete per preservare l'integrità dello storico.

### Ricerca dei garage

La ricerca combina il posizionamento geografico e la disponibilità temporale. Lato client, il sistema calcola la distanza tra destinazione e garage, ordinando i risultati per vicinanza. I filtri reattivi permettono di affinare la ricerca per tipo di veicolo e servizi accessori come ricarica elettrica, accesso disabili e copertura del posto auto.

Lato backend, il sistema verifica l'effettiva disponibilità dei posti interrogando il database con la clausola `OVERLAPS`. Questo incrocio temporale esclude i garage già occupati negli orari selezionati, garantendo all'utente solo risultati prenotabili.

### Prenotazione di un parcheggio

Il flusso di prenotazione garantisce la massima coerenza dei dati attraverso transazioni atomiche. L'utente seleziona il posto dalla planimetria interattiva e il client valida formalmente i dati calcolando il preventivo.

Per prevenire conflitti di prenotazione simultanea, il server applica un lock a livello di tupla sul database. All'interno della stessa transazione, il sistema verifica il saldo, addebita il costo sul portafoglio e genera il ticket.

### Gestione del portafoglio

Parkly integra un portafoglio virtuale per semplificare i pagamenti, permettendo ricariche comprese tra 5€ e 1000€. L'uso di transazioni atomiche nel backend garantisce che l'aggiornamento del saldo e la registrazione del movimento nello storico avvengano simultaneamente.

Gli utenti possono consultare lo storico completo delle proprie attività tramite una lista cronologica paginata, che distingue esplicitamente ricariche, pagamenti e rimborsi.

### Il ruolo Gestore e la pubblicazione di un garage

La dashboard dedicata ai gestori permette di pubblicare nuovi garage su Parkly attraverso un flusso guidato in tre fasi. 

Nella prima fase viene definita la posizione del garage: partendo da un indirizzo, il sistema interroga un'API di geocodifica e genera delle coordinate, per garantire la massima precisione è permesso all'utente di affinare manualmente le coordinate tramite click diretto sulla mappa.

La seconda fase riguarda la configurazione tecnica dei posti auto. Il gestore definisce ogni parcheggio specificando la tipologia di veicolo e i servizi inclusi, come la ricarica elettrica, l'accessibilità per disabili o la copertura. Per velocizzare l'inserimento e migliorare l'esperienza dell'utente, il sistema è in grado di generare automaticamente i codici identificativi dei posti in base alla categoria selezionata.

L'ultima fase consiste nel disegno della planimetria tramite una griglia interattiva. Ogni posto occupa uno spazio proporzionale alle dimensioni del veicolo e il componente PlanimetriaGarage ne renderizza l'anteprima in tempo reale elaborando i dati inseriti. Il layout finale viene salvato nel database come stringa testuale, permettendo al client di ricostruire fedelmente la piantina durante il processo di prenotazione.

### Sistema di recensioni

Al termine di una sosta, l'utente ha la possibilità di valutare la propria esperienza assegnando un voto da 1 a 5 stelle e lasciando un commento. Per garantire l'affidabilità e l'autenticità dei feedback mostrati agli altri utenti, il sistema permette di recensire esclusivamente i garage in cui si è effettivamente completata una prenotazione.

### Chat interattiva

Per facilitare la coordinazione tra utenti, Parkly integra un sistema di messaggistica in tempo reale basato su Socket.IO. 

La chat è strettamente legata a una specifica prenotazione: il backend instrada i messaggi attraverso "room" private e verifica l'identità dei partecipanti prima di ogni invio.

## Viste

| Rotta | Componente | Descrizione |
|---|---|---|
| `/` | `HomeView` | Homepage |
| `/garage` | `GarageView` | Lista garage con mappa interattiva e filtri |
| `/garage/:id` | `GarageDetailView` | Dettaglio garage, disponibilità e prenotazione |
| `/prenotazioni` | `BookingsView` | Storico e prenotazioni attive dell'utente |
| `/portafoglio` | `WalletView` | Gestione saldo e storico transazioni |
| `/dashboard-gestore` | `GestoreDashboardView` | Dashboard del gestore |
| `/profile` | `ProfileView` | Impostazioni account ed eliminazione |
| `/register` | `RegisterView` | Registrazione sulla piattaforma |
| `/diventa-gestore` | `BecomeGestoreView` | Richiesta ruolo gestore |

## Installazione

### Prerequisiti

Node.js e un'istanza PostgreSQL, locale o remota.

### Installazione delle dipendenze

```bash
git clone https://github.com/chitvs/parkly.git
cd parkly

cd server && npm install
cd ../client && npm install
```

### Configurazione del database

Dopo aver creato l'istanza del database (locale o remota), creare le tabelle con il codice in `parkly.sql` e popolarle con `seed.sql` per avere dei dati di prova.

### Variabili d'ambiente

Creare un file `.env` in `server/` con le seguenti variabili:

```env
DB_USER
DB_PASSWORD
DB_HOST
DB_PORT
DB_NAME
SESSION_SECRET
PORT
SUPABASE_URL
SUPABASE_SERVICE_KEY
```

> [!NOTE]  
> Le variabili d'ambiente possono differire in base alla configurazione del database.
> Durante lo sviluppo di Parkly Supabase è stato usato per creare l'istanza PostgreSQL e semplificare la collaborazione, dunque sono presenti le variabili `SUPABASE_URL` e `SUPABASE_SERVICE_KEY`.

### Avvio

Assicurarsi di essere nella root del progetto ed eseguire:

```bash
npm run dev
```

Il client sarà disponibile su `http://localhost:5173`, il server su `http://localhost:3000`. Per testare il server collegarsi a `localhost:3000/test-db`.

Se il server risponde con successo, l'applicazione è connessa correttamente.

## Autori

Sviluppato da Andrea Carbone, Alessandro Chitarrini, Matteo Crugliano e Davide Gaglione.
