-- 1. UTENTE
CREATE TABLE Utente (
    ID_Utente INT AUTO_INCREMENT PRIMARY KEY,
    Ruolo ENUM('CLIENTE', 'GESTORE') NOT NULL DEFAULT 'CLIENTE',
    Nome VARCHAR(50) NOT NULL,
    Cognome VARCHAR(50) NOT NULL,
    Email VARCHAR(100) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    Telefono VARCHAR(20),
    DataRegistrazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. GARAGE 
CREATE TABLE Garage (
    ID_Garage INT AUTO_INCREMENT PRIMARY KEY,
    ID_Gestore INT NOT NULL,
    Nome VARCHAR(100) NOT NULL,
    Indirizzo VARCHAR(150) NOT NULL,
    Latitudine DECIMAL(8,6),   -- Numero decimale con max 10 cifre totali e 8 dopo la virgola
    Longitudine DECIMAL(9,6),   
    Capienza INT NOT NULL,
    PrezzoOrario DECIMAL(5, 2) NOT NULL,
    OrarioApertura TIME NOT NULL,
    OrarioChiusura TIME NOT NULL,
    Planimetria_URL VARCHAR(255), -- Percorso planimetria per selezione posto 
    IsAttivo BOOLEAN DEFAULT TRUE, -- Per la disattivazione temporanea 
    DataCreazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ID_Gestore) REFERENCES Utenti(ID_Utente) ON DELETE CASCADE
);

-- 3. POSTO AUTO 
CREATE TABLE PostoAuto (
    ID_Posto INT AUTO_INCREMENT PRIMARY KEY,
    ID_Garage INT NOT NULL,
    CodicePosto VARCHAR(10) NOT NULL, 

    TipoVeicolo ENUM('AUTO', 'MOTO', 'BICI', 'FURGONE', 'CAMPER') DEFAULT 'AUTO',
    IsDisabili BOOLEAN DEFAULT FALSE,
    IsElettrica BOOLEAN DEFAULT FALSE, 
    IsCoperto BOOLEAN DEFAULT TRUE,    

    -- Prezzo specifico per questo posto (sovrascrive o sostituisce quello generico del garage)
    TariffaOraria DECIMAL(5, 2) NOT NULL, 
    
    -- CoordinateUI VARCHAR(100), 
    FOREIGN KEY (ID_Garage) REFERENCES Garage(ID_Garage) ON DELETE CASCADE,
    UNIQUE(ID_Garage, CodicePosto)
);

-- 4. PRENOTAZIONE
CREATE TABLE Prenotazione (
    ID_Prenotazione INT AUTO_INCREMENT PRIMARY KEY,
    ID_Utente INT NOT NULL, 
    ID_Posto INT NOT NULL,
    InizioSosta DATETIME NOT NULL,
    FineSosta DATETIME NOT NULL,
    PrezzoTotale DECIMAL(8, 2) NOT NULL,
    Stato ENUM('ATTIVA', 'ANNULLATA', 'CONCLUSA') DEFAULT 'ATTIVA',
    DataCreazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ID_Utente) REFERENCES Utenti(ID_Utente) ON DELETE CASCADE,
    FOREIGN KEY (ID_Posto) REFERENCES PostiAuto(ID_Posto) ON DELETE CASCADE,
    CONSTRAINT CHK_DateSosta CHECK (FineSosta > InizioSosta)
);
