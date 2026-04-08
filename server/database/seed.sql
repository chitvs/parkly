-- UTENTI
INSERT INTO Utente (Ruolo, Nome, Cognome, CodiceFiscale, Email, PasswordHash, Telefono) VALUES
('GESTORE', 'Alessandro', 'Galli', 'GLLLSN70A01H501A', 'alessandro.g@garage.it', '$2b$10$WPKYQS3SIp5VEf4SKRKx3O5HVlY6XMOM1lle/fnGc2/ZKhek5VQu.', '3310000001'),
('GESTORE', 'Roberta', 'Randi', 'RNDRRT75B41H501B', 'roberta.r@garage.it', '$2b$10$lN6k5YY30hrFMFHedDL9v.UFgP9VoXScHZbRRk9HmwkLNqnpEJBR2', '3310000002'),
('GESTORE', 'Fabio', 'Santi', 'SNTFBA80C01H501C', 'fabio.s@garage.it', '$2b$10$vEVaU1KOg6DeaPoFWA0HBOZffryYgBkdZah.P/h4J6T9KaLQtuzue', '3310000003'),
('GESTORE', 'Sonia', 'Fabbri', 'FBBSNO85D41H501D', 'sonia.f@garage.it', '$2b$10$xEdYdhxpEHU5KuYqGTDJs.y5C5eiicy9jy70qCM5z62/x86pV43MG', '3310000004'),
('CLIENTE', 'Marco', 'Liberti', 'LBRMRC90E15H501E', 'marco.l@email.com', '$2b$10$WsxqnMAdJjFvYWsm0uPN6OuZ8xkaMibrt3FLvr33f4czAXyfxvc3i', '3400000001'),
('CLIENTE', 'Chiara', 'Valenti', 'VLNCHR92F52H501F', 'chiara.v@email.com', '$2b$10$xxeT0orM5SGPJ67LL1oGgOVwuLYqdyo//nyw0CZHNz.8olX9nNXu2', '3400000002'),
('CLIENTE', 'Paolo', 'Dessi', 'DSSPLA94G10H501G', 'paolo.d@email.com', '$2b$10$ISIhd1D5EU5GPKq3Tr2CIeAkJSATIDPfUSdBQoV05l14muNDSuOh2', '3400000003'),
('CLIENTE', 'Simona', 'Reale', 'RLESNO96H50H501H', 'simona.r@email.com', '$2b$10$wrEc8cgwi3KysvKawcYUgePJbVFHwJUlIuropNQwDHL7sDuX8DYui', '3400000004'),
('CLIENTE', 'Davide', 'Moro', 'MRODVD98L20H501I', 'davide.m@email.com', '$2b$10$nLxPdWaiThqojfaCZ5RgGeUq4viZBRg5.CO72k6uu3V1xFtAom6rm', '3400000005'),
('CLIENTE', 'Giada', 'Serra', 'SRRGDA99M45H501L', 'giada.s@email.com', '$2b$10$LXSwRxWPIl0wRboIgW4NSuF3LQ/A6CvyRpVj8QD0Cw/0uWkVwQ.ty', '3400000006');

-- GARAGE
INSERT INTO Garage (ID_Gestore, Nome, Descrizione, Indirizzo, Latitudine, Longitudine, AltezzaMassima, TariffaBase, OrarioApertura, OrarioChiusura, Is24h, Planimetria_URL) VALUES
(1, 'EUR business parking', 'Ampio parcheggio zona uffici EUR.', 'Viale Europa, 150, 00144 Roma', 41.8285, 12.4673, 2.50, 3.00, '08:00:00', '20:00:00', FALSE, '/assets/mappe/eur.png'),
(2, 'Parioli green parking', 'Esclusivo e videosorvegliato.', 'Via dei Parioli, 12, 00197 Roma', 41.9258, 12.4883, 2.10, 6.00, '07:00:00', '23:00:00', FALSE, '/assets/mappe/parioli.png'),
(3, 'San Giovanni 24/7 parking', 'Vicinissimo alla Metro A.', 'Via Appia Nuova, 45, 00183 Roma', 41.8851, 12.5105, 2.30, 4.00, '00:00:00', '23:59:59', TRUE, '/assets/mappe/sangiovanni.png'),
(4, 'Ostiense 24/7 parking', 'Ideale per la zona Gazometro.', 'Via del Porto Fluviale, 5, 00154 Roma', 41.8722, 12.4811, 3.50, 3.50, '00:00:00', '23:59:59', TRUE, '/assets/mappe/ostiense.png'),
(1, 'Vaticano parking', 'A due passi da Piazza San Pietro.', 'Via delle Fornaci, 20, 00165 Roma', 41.9001, 12.4550, 2.10, 5.50, '06:00:00', '22:00:00', FALSE, '/assets/mappe/vaticano.png'),
(2, 'Testaccio market garage', 'Perfetto per il mercato e i locali.', 'Via Galvani, 30, 00153 Roma', 41.8775, 12.4789, 2.40, 3.00, '07:00:00', '02:00:00', FALSE, '/assets/mappe/testaccio.png');

-- POSTI AUTO
INSERT INTO PostoAuto (ID_Garage, CodicePosto, TipoVeicolo, IsDisabili, IsElettrica, IsCoperto, TariffaOraria, Coord_X, Coord_Y) VALUES
-- Garage 1: EUR
(1, 'E01', 'AUTO', FALSE, TRUE, TRUE, 3.50, 10.0, 20.0), 
(1, 'E02', 'AUTO', FALSE, FALSE, TRUE, 3.00, 20.0, 20.0), 
(1, 'E03', 'FURGONE', FALSE, FALSE, FALSE, 5.00, 30.0, 20.0),
(1, 'E04', 'AUTO', FALSE, FALSE, TRUE, 3.00, 40.0, 20.0),
(1, 'E05', 'AUTO', TRUE, FALSE, TRUE, 3.00, 50.0, 20.0),
-- Garage 2: Parioli
(2, 'P01', 'AUTO', TRUE, FALSE, TRUE, 6.00, 15.0, 15.0), 
(2, 'P02', 'AUTO', FALSE, TRUE, TRUE, 7.50, 15.0, 30.0), 
(2, 'P03', 'MOTO', FALSE, FALSE, TRUE, 2.50, 15.0, 45.0),
-- Garage 3: San Giovanni
(3, 'S01', 'AUTO', FALSE, FALSE, TRUE, 4.00, 10.0, 10.0), 
(3, 'S02', 'AUTO', FALSE, FALSE, TRUE, 4.00, 25.0, 10.0), 
(3, 'S03', 'AUTO', TRUE, FALSE, TRUE, 4.00, 40.0, 10.0), 
(3, 'S04', 'BICI', FALSE, FALSE, TRUE, 1.00, 55.0, 10.0),
-- Garage 4: Ostiense
(4, 'O01', 'CAMPER', FALSE, FALSE, FALSE, 10.00, 5.0, 50.0), 
(4, 'O02', 'FURGONE', FALSE, FALSE, FALSE, 7.00, 20.0, 50.0), 
(4, 'O03', 'AUTO', FALSE, TRUE, TRUE, 4.50, 35.0, 50.0),
(4, 'O04', 'AUTO', FALSE, FALSE, TRUE, 3.50, 50.0, 50.0),
-- Garage 5: Vaticano
(5, 'V01', 'AUTO', FALSE, FALSE, TRUE, 5.50, 80.0, 20.0), 
(5, 'V02', 'AUTO', FALSE, TRUE, TRUE, 6.50, 80.0, 35.0), 
(5, 'V03', 'MOTO', FALSE, FALSE, TRUE, 3.00, 80.0, 50.0),
-- Garage 6: Testaccio
(6, 'T01', 'AUTO', FALSE, FALSE, TRUE, 3.00, 40.0, 70.0), 
(6, 'T02', 'AUTO', FALSE, FALSE, TRUE, 3.00, 50.0, 70.0), 
(6, 'T03', 'AUTO', TRUE, FALSE, TRUE, 3.00, 60.0, 70.0);

-- PRENOTAZIONI
INSERT INTO Prenotazione (ID_Utente, ID_Posto, CodicePrenotazione, Targa, Note, InizioSosta, FineSosta, PrezzoTotale, Stato) VALUES
(5, 1, 'RM-X1', 'DF123GH', 'Tutto ok', CURRENT_TIMESTAMP - INTERVAL '5 days 4 hours', CURRENT_TIMESTAMP - INTERVAL '5 days', 14.00, 'CONCLUSA'),
(6, 7, 'RM-X2', 'EL555RR', '', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 day 22 hours', 8.00, 'CONCLUSA'),
(7, 2, 'RM-A1', 'BK999PP', 'In riunione', CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP + INTERVAL '2 hours', 12.00, 'ATTIVA'),
(8, 11, 'RM-A2', 'CA000MP', 'Camper turista', CURRENT_TIMESTAMP - INTERVAL '20 hours', CURRENT_TIMESTAMP + INTERVAL '4 hours', 240.00, 'ATTIVA'),
(9, 14, 'RM-A3', 'FE111TT', '', CURRENT_TIMESTAMP - INTERVAL '30 minutes', CURRENT_TIMESTAMP + INTERVAL '2 hours', 13.75, 'ATTIVA'),
(10, 5, 'RM-F1', 'GA222SS', 'Prenotazione per domani', CURRENT_TIMESTAMP + INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '1 day 5 hours', 37.50, 'ATTIVA'),
(5, 18, 'RM-F2', 'DF123GH', 'Ritorno a Testaccio', CURRENT_TIMESTAMP + INTERVAL '2 days', CURRENT_TIMESTAMP + INTERVAL '2 days 3 hours', 9.00, 'ATTIVA'),
(6, 4, 'RM-C1', 'EL555RR', 'Cambiato idea', CURRENT_TIMESTAMP - INTERVAL '10 days 2 hours', CURRENT_TIMESTAMP - INTERVAL '10 days', 12.00, 'ANNULLATA');