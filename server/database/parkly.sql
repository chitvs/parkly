-- SERIAL: crea un intero auto-incrementante.
-- NOT NULL: impedisce l'inserimento di valori nulli.
-- UNIQUE: garantisce che non esistano due record con lo stesso valore per quel campo.
-- CHECK: applica una regola di validazione logica o di dominio sui dati in ingresso.
-- DEFAULT: assegna un valore predefinito se non viene specificato durante l'INSERT.
-- ON DELETE CASCADE: se il record padre viene eliminato, elimina a cascata i record figli collegati.

-- 1. UTENTE
CREATE TABLE Utente (
    ID_Utente SERIAL PRIMARY KEY,
    Ruolo VARCHAR(10) CHECK (Ruolo IN ('CLIENTE', 'GESTORE')) DEFAULT 'CLIENTE',
    Nome VARCHAR(50) NOT NULL,
    Cognome VARCHAR(50) NOT NULL,
    CodiceFiscale VARCHAR(16) UNIQUE,
    Email VARCHAR(100) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    Telefono VARCHAR(20),
    DataRegistrazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    IsAttivo BOOLEAN DEFAULT TRUE
    FotoProfilo_URL text DEFAULT NULL;
    Saldo DECIMAL(8, 2) NOT NULL DEFAULT 0.00
);

-- 2. GARAGE  
CREATE TABLE Garage (
    ID_Garage SERIAL PRIMARY KEY,
    ID_Gestore INT NOT NULL,
    Nome VARCHAR(100) NOT NULL,
    Descrizione TEXT,
    Indirizzo VARCHAR(150) NOT NULL,
    Latitudine DECIMAL(8,6),
    Longitudine DECIMAL(9,6),   
    -- Capienza INT NOT NULL, basta calcolarla con un COUNT(*), è inutile ai fini del database
    AltezzaMassima DECIMAL(4,2),
    TariffaBase DECIMAL(5, 2) NOT NULL,
    OrarioApertura TIME NOT NULL,
    OrarioChiusura TIME NOT NULL,
    Is24h BOOLEAN DEFAULT FALSE, -- Se è TRUE ignoriamo gli orari di apertura e chiusura
    MappaTestuale TEXT, -- Mappa ASCII
    IsAttivo BOOLEAN DEFAULT TRUE,  
    DataCreazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ID_Gestore) REFERENCES Utente(ID_Utente) ON DELETE CASCADE
);

-- 3. POSTO AUTO  
CREATE TABLE PostoAuto (
    ID_Posto SERIAL PRIMARY KEY,
    ID_Garage INT NOT NULL,
    CodicePosto VARCHAR(10) NOT NULL,  
    TipoVeicolo VARCHAR(10) CHECK (TipoVeicolo IN ('AUTO', 'MOTO', 'BICI', 'FURGONE', 'CAMPER')) DEFAULT 'AUTO',
    IsDisabili BOOLEAN DEFAULT FALSE,
    IsElettrica BOOLEAN DEFAULT FALSE,  
    IsCoperto BOOLEAN DEFAULT TRUE,    
    TariffaOraria DECIMAL(5, 2) NOT NULL,  
    -- IsDisponibile BOOLEAN DEFAULT TRUE, basta calcolarla con il tempo reale e i parametri InizioSosta e FineSosta della tabella Prenotazione
    FOREIGN KEY (ID_Garage) REFERENCES Garage(ID_Garage) ON DELETE CASCADE,
    UNIQUE(ID_Garage, CodicePosto)
);

-- 4. PRENOTAZIONE
CREATE TABLE Prenotazione (
    ID_Prenotazione SERIAL PRIMARY KEY,
    ID_Utente INT NOT NULL,  
    ID_Posto INT NOT NULL,
    CodicePrenotazione VARCHAR(10) UNIQUE,
    Targa VARCHAR(15),
    Note TEXT,
    InizioSosta TIMESTAMP NOT NULL,
    FineSosta TIMESTAMP NOT NULL,
    InizioEffettivo TIMESTAMP DEFAULT NULL,
    FineEffettiva TIMESTAMP DEFAULT NULL,
    PrezzoTotale DECIMAL(8, 2) NOT NULL,
    Stato VARCHAR(15) CHECK (Stato IN ('ATTIVA', 'ANNULLATA', 'CONCLUSA')) DEFAULT 'ATTIVA',
    DataCreazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ID_Utente) REFERENCES Utente(ID_Utente) ON DELETE CASCADE,
    FOREIGN KEY (ID_Posto) REFERENCES PostoAuto(ID_Posto) ON DELETE CASCADE,
    CONSTRAINT CHK_DateSosta CHECK (FineSosta > InizioSosta)
);
