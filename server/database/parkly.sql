-- UTENTE
CREATE TABLE Utente (
    ID_Utente SERIAL PRIMARY KEY,
    Ruolo VARCHAR(10) CHECK (Ruolo IN ('CLIENTE', 'GESTORE')) DEFAULT 'CLIENTE',
    Nome VARCHAR(50) NOT NULL,
    Cognome VARCHAR(50) NOT NULL,
    CodiceFiscale VARCHAR(16) UNIQUE,
    NomeUtente VARCHAR(50) NOT NULL UNIQUE,
    Email VARCHAR(100) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    Telefono VARCHAR(20),
    DataRegistrazione TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Europe/Rome'),
    IsAttivo BOOLEAN DEFAULT TRUE,
    FotoProfilo_URL text DEFAULT NULL,
    Saldo DECIMAL(8, 2) NOT NULL DEFAULT 0.00
);

-- GARAGE  
CREATE TABLE Garage (
    ID_Garage SERIAL PRIMARY KEY,
    ID_Gestore INT NOT NULL,
    Nome VARCHAR(100) NOT NULL,
    Descrizione TEXT,
    Indirizzo VARCHAR(150) NOT NULL,
    Latitudine DECIMAL(8,6),
    Longitudine DECIMAL(9,6),   
    AltezzaMassima DECIMAL(4,2),
    TariffaAuto DECIMAL(5, 2) NOT NULL,
    TariffaMoto DECIMAL(5, 2),
    TariffaFurgone DECIMAL(5, 2),
    SovrapprezzoElettrica DECIMAL(5, 2),
    ScontoDisabili DECIMAL(5, 2),
    OrarioApertura TIME NOT NULL,
    OrarioChiusura TIME NOT NULL,
    Is24h BOOLEAN DEFAULT FALSE,
    MappaTestuale TEXT,
    NRighe INT NOT NULL,  
    NColonne INT NOT NULL,
    IsAttivo BOOLEAN DEFAULT TRUE,  
    DataCreazione TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Europe/Rome'),
    MediaGenerale DECIMAL(3,2) DEFAULT 0.00,
    MediaPosizione DECIMAL(3,2) DEFAULT 0.00,
    MediaPrezzo DECIMAL(3,2) DEFAULT 0.00,
    MediaPulizia DECIMAL(3,2) DEFAULT 0.00,
    MediaSpazio DECIMAL(3,2) DEFAULT 0.00,
    MediaSicurezza DECIMAL(3,2) DEFAULT 0.00,
    NumeroRecensioni INT DEFAULT 0,
    FOREIGN KEY (ID_Gestore) REFERENCES Utente(ID_Utente) ON DELETE CASCADE
);

-- POSTO AUTO  
CREATE TABLE PostoAuto (
    ID_Posto SERIAL PRIMARY KEY,
    ID_Garage INT NOT NULL,
    CodicePosto VARCHAR(10) NOT NULL,  
    TipoVeicolo VARCHAR(10) CHECK (TipoVeicolo IN ('AUTO', 'MOTO', 'FURGONE')) DEFAULT 'AUTO',
    IsDisabili BOOLEAN DEFAULT FALSE,
    IsElettrica BOOLEAN DEFAULT FALSE,  
    IsCoperto BOOLEAN DEFAULT TRUE,
    IsAttivo BOOLEAN DEFAULT TRUE,    
    FOREIGN KEY (ID_Garage) REFERENCES Garage(ID_Garage) ON DELETE CASCADE,
    UNIQUE(ID_Garage, CodicePosto)
);

-- MANUTENZIONE POSTO
CREATE TABLE ManutenzionePosto (
    ID_Manutenzione SERIAL PRIMARY KEY,
    ID_Posto INT NOT NULL,
    Inizio TIMESTAMP NOT NULL,
    Fine TIMESTAMP NOT NULL,
    Motivazione TEXT,
    DataCreazione TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Europe/Rome'),
    FOREIGN KEY (ID_Posto) REFERENCES PostoAuto(ID_Posto) ON DELETE CASCADE,
    CONSTRAINT CHK_DateManutenzione CHECK (Fine > Inizio)
);

-- PRENOTAZIONE
CREATE TABLE Prenotazione (
    ID_Prenotazione SERIAL PRIMARY KEY,
    ID_Utente INT NOT NULL,  
    ID_Posto INT NOT NULL,
    CodicePrenotazione VARCHAR(11) UNIQUE,
    Targa VARCHAR(15),
    Note TEXT,
    CodiceDisabilita VARCHAR(50) DEFAULT NULL,
    InizioSosta TIMESTAMP NOT NULL,
    FineSosta TIMESTAMP NOT NULL,
    PrezzoTotale DECIMAL(8, 2) NOT NULL,
    Stato VARCHAR(15) CHECK (Stato IN ('ATTIVA', 'ANNULLATA', 'CONCLUSA')) DEFAULT 'ATTIVA',
    DataCreazione TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Europe/Rome'),
    FOREIGN KEY (ID_Utente) REFERENCES Utente(ID_Utente) ON DELETE CASCADE,
    FOREIGN KEY (ID_Posto) REFERENCES PostoAuto(ID_Posto) ON DELETE CASCADE,
    CONSTRAINT CHK_DateSosta CHECK (FineSosta > InizioSosta)
);

-- MESSAGGIO
CREATE TABLE Messaggio (
    ID_Messaggio SERIAL PRIMARY KEY,
    ID_Mittente INT NOT NULL,
    ID_Destinatario INT NOT NULL,
    ID_Prenotazione INT NOT NULL,
    Testo TEXT NOT NULL,
    Letto BOOLEAN DEFAULT FALSE,
    DataInvio TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Europe/Rome'),
    FOREIGN KEY (ID_Mittente) REFERENCES Utente(ID_Utente) ON DELETE CASCADE,
    FOREIGN KEY (ID_Destinatario) REFERENCES Utente(ID_Utente) ON DELETE CASCADE,
    FOREIGN KEY (ID_Prenotazione) REFERENCES Prenotazione(ID_Prenotazione) ON DELETE CASCADE,
    CONSTRAINT CHK_No_Self_Chat CHECK (ID_Mittente <> ID_Destinatario)
);
 
-- Indici per velocizzare le query di caricamento conversazione
CREATE INDEX idx_messaggio_mittente ON Messaggio(ID_Mittente);
CREATE INDEX idx_messaggio_destinatario ON Messaggio(ID_Destinatario);


-- RECENSIONE
CREATE TABLE Recensione (
    ID_Recensione SERIAL PRIMARY KEY,
    ID_Prenotazione INT NOT NULL UNIQUE, 
    ID_Utente INT NOT NULL,
    ID_Garage INT NOT NULL,
    VotoGenerale INT CHECK (VotoGenerale >= 1 AND VotoGenerale <= 5) NOT NULL,
    VotoPosizione INT CHECK (VotoPosizione >= 1 AND VotoPosizione <= 5) NOT NULL,
    VotoPrezzo INT CHECK (VotoPrezzo >= 1 AND VotoPrezzo <= 5) NOT NULL,
    VotoPulizia INT CHECK (VotoPulizia >= 1 AND VotoPulizia <= 5) NOT NULL,
    VotoSpazio INT CHECK (VotoSpazio >= 1 AND VotoSpazio <= 5) NOT NULL,
    VotoSicurezza INT CHECK (VotoSicurezza >= 1 AND VotoSicurezza <= 5) NOT NULL,
    Commento TEXT,
    DataCreazione TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Europe/Rome'),
    FOREIGN KEY (ID_Prenotazione) REFERENCES Prenotazione(ID_Prenotazione) ON DELETE CASCADE,
    FOREIGN KEY (ID_Utente) REFERENCES Utente(ID_Utente) ON DELETE CASCADE,
    FOREIGN KEY (ID_Garage) REFERENCES Garage(ID_Garage) ON DELETE CASCADE
);

-- TRANSAZIONE
CREATE TABLE Transazione (
    ID_Transazione SERIAL PRIMARY KEY,
    ID_Utente INT NOT NULL,
    ID_Prenotazione INT DEFAULT NULL,
    Tipo VARCHAR(20) CHECK (Tipo IN ('RICARICA', 'PRENOTAZIONE', 'RIMBORSO', 'INCASSO_SOSPESO', 'INCASSO_COMPLETATO', 'PRELIEVO')) NOT NULL,
    Importo DECIMAL(8, 2) NOT NULL,
    Descrizione TEXT NOT NULL,
    DataCreazione TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Europe/Rome'),
    FOREIGN KEY (ID_Utente) REFERENCES Utente(ID_Utente) ON DELETE CASCADE,
    FOREIGN KEY (ID_Prenotazione) REFERENCES Prenotazione(ID_Prenotazione) ON DELETE SET NULL
);

/*

Note e scelte varie:

> Nella tabella garage non c'è bisogno del campo Capienza, infatti basta calcolarla con un banale COUNT(*). Per quanto riguarda il campo is24h, Se è TRUE ignoriamo del tutto gli orari di apertura e chiusura. Il campo MappaTestuale fa riferimento alla mappa ASCII (planimetria) del garage, che DEVE essere scritto nel formato corretto!

> Nella tabella PostoAuto non serve il campo IsDisponibile, basta vedere il tempo reale e i parametri InizioSosta e FineSosta della tabella Prenotazione

> La chat è consentita solo fra Cliente e Gestore di un garage prenotato, la validazione avviene lato server prima di persistere il messaggio.
-------------------------------------------

Alcuni significati delle parole chiave sql:

-- SERIAL: crea un intero auto-incrementante.
-- NOT NULL: impedisce l'inserimento di valori nulli.
-- UNIQUE: garantisce che non esistano due record con lo stesso valore per quel campo.
-- CHECK: applica una regola di validazione logica o di dominio sui dati in ingresso.
-- DEFAULT: assegna un valore predefinito se non viene specificato durante l'INSERT.
-- ON DELETE CASCADE: se il record padre viene eliminato, elimina a cascata i record figli collegati.

*/
