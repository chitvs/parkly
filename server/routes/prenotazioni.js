const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { isLoggato, isGestore } = require('../middleware/authMiddleware');

router.post('/', isLoggato, async (req, res) => {
    const { id_posto, targa, note, inizio, fine, prezzo_totale, codice_disabilita } = req.body;
    const id_utente = req.session.utente.id;

    try {
        const nuova = await db.tx(async t => {

            // 1. Controllo saldo
            const utente = await t.one(`SELECT Saldo FROM Utente WHERE ID_Utente = $1`, [id_utente]);
            const saldoCorrente = parseFloat(utente.saldo || 0);
            const costoSosta = parseFloat(prezzo_totale);
            if (saldoCorrente < costoSosta) {
                throw { isCustom: true, status: 402, message: 'Credito insufficiente per completare la prenotazione.' };
            }

            // 2. Controllo orari garage, stato garage e stato posto
            const checkOrari = await t.one(`
                SELECT 
                    g.Is24h, g.OrarioApertura, g.OrarioChiusura, 
                    g.IsAttivo AS garage_attivo, -- NUOVO CONTROLLO
                    g.Nome AS nome_garage, g.ID_Gestore,
                    p.CodicePosto, 
                    p.IsAttivo AS posto_attivo, -- NUOVO CONTROLLO
                    
                    -- Controllo INIZIO
                    (CASE 
                        WHEN g.OrarioApertura <= g.OrarioChiusura THEN 
                            ($2::timestamp::time >= g.OrarioApertura AND $2::timestamp::time <= g.OrarioChiusura)
                        ELSE 
                            ($2::timestamp::time >= g.OrarioApertura OR $2::timestamp::time <= g.OrarioChiusura)
                    END) AS inizio_valido,

                    -- Controllo FINE
                    (CASE 
                        WHEN g.OrarioApertura <= g.OrarioChiusura THEN 
                            ($3::timestamp::time >= g.OrarioApertura AND $3::timestamp::time <= g.OrarioChiusura)
                        ELSE 
                            ($3::timestamp::time >= g.OrarioApertura OR $3::timestamp::time <= g.OrarioChiusura)
                    END) AS fine_valida

                FROM Garage g
                JOIN PostoAuto p ON g.ID_Garage = p.ID_Garage
                WHERE p.ID_Posto = $1
            `, [id_posto, inizio, fine]);

            // BLOCCO DI SICUREZZA: Se il garage o il posto sono stati disattivati nel frattempo
            if (!checkOrari.garage_attivo || !checkOrari.posto_attivo) {
                throw { isCustom: true, status: 403, message: "Operazione annullata: questo garage o posto auto è stato appena disabilitato dal gestore." };
            }

            if (!checkOrari.is24h && (!checkOrari.inizio_valido || !checkOrari.fine_valida)) {
                throw { isCustom: true, status: 400, message: "Gli orari selezionati non rientrano nell'orario di apertura del garage." };
            }

            // 3. Lock posto e controllo disabili
            const posto = await t.one('SELECT IsDisabili FROM PostoAuto WHERE ID_Posto = $1 FOR UPDATE', [id_posto]);
            if (posto.isdisabili && (!codice_disabilita || codice_disabilita.trim() === '')) {
                throw { isCustom: true, status: 400, message: 'Codice Contrassegno Disabili obbligatorio per questo parcheggio.' };
            }

            // 4. Controllo disponibilità
            const occupato = await t.oneOrNone(`
                SELECT ID_Prenotazione FROM Prenotazione 
                WHERE ID_Posto = $1 AND Stato = 'ATTIVA'
                AND (InizioSosta, FineSosta) OVERLAPS ($2::timestamp, $3::timestamp)
            `, [id_posto, inizio, fine]);
            if (occupato) {
                throw { isCustom: true, status: 409, message: 'Posto non più disponibile per gli orari selezionati.' };
            }

            // 5. Genera codice univoco
            let codice = '';
            let codiceLibero = false;
            while (!codiceLibero) {
                codice = 'PR-' + Math.random().toString(36).substring(2, 10).toUpperCase();
                const esisteGia = await t.oneOrNone(`SELECT ID_Prenotazione FROM Prenotazione WHERE CodicePrenotazione = $1`, [codice]);
                if (!esisteGia) codiceLibero = true;
            }

            // 6. Scala il saldo
            const userUpdate = await t.one(`
                UPDATE Utente SET Saldo = Saldo - $1 WHERE ID_Utente = $2 RETURNING Saldo
            `, [prezzo_totale, id_utente]);
            req.session.utente.saldo = userUpdate.saldo;

            // 7. Inserisci la prenotazione e recupera l'ID ← DEVE VENIRE PRIMA DELLE TRANSAZIONI
            const nuovaPrenotazione = await t.one(`
                INSERT INTO Prenotazione (ID_Utente, ID_Posto, CodicePrenotazione, Targa, Note, CodiceDisabilita, InizioSosta, FineSosta, PrezzoTotale)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING ID_Prenotazione, CodicePrenotazione
            `, [
                id_utente, id_posto, codice, targa, note,
                posto.isdisabili ? codice_disabilita : null,
                inizio, fine, prezzo_totale
            ]);

            // 8. Ora che l'ID esiste, inserisci le transazioni
            await t.none(`
                INSERT INTO Transazione (ID_Utente, ID_Prenotazione, Tipo, Importo, Descrizione)
                VALUES ($1, $2, 'PRENOTAZIONE', $3, $4)
            `, [id_utente, nuovaPrenotazione.id_prenotazione, -prezzo_totale, `Pagamento prenotazione ${codice}`]);

            await t.none(`
                INSERT INTO Transazione (ID_Utente, ID_Prenotazione, Tipo, Importo, Descrizione)
                VALUES ($1, $2, 'INCASSO_SOSPESO', $3, $4)
            `, [checkOrari.id_gestore, nuovaPrenotazione.id_prenotazione, prezzo_totale, `Incasso in sospeso per prenotazione ${codice}`]);

            return nuovaPrenotazione;
        });

        res.json({ success: true, messaggio: 'Prenotazione confermata', prenotazione: nuova });

    } catch (err) {
        console.error('Errore salvataggio prenotazione:', err);
        if (err.isCustom) {
            return res.status(err.status).json({ success: false, error: err.message });
        }
        res.status(500).json({ success: false, error: 'Errore interno' });
    }
});

// Recupero le prenotazioni dell'utente loggato (in prenotazioni.js)
router.get('/', isLoggato, async (req, res) => {

    const utenteId = req.session.utente.id;

    try {
        // 1. LAZY UPDATE: Aggiorniamo fisicamente lo stato sul DB prima di leggere
        await db.none(`
            UPDATE Prenotazione 
            SET Stato = 'CONCLUSA' 
            WHERE ID_Utente = $1 
              AND Stato = 'ATTIVA' 
              AND FineSosta < (NOW() AT TIME ZONE 'Europe/Rome')
        `, [utenteId]);

        // 2. RECUPERO DATI POTENZIATO
        const query = `
            SELECT 
                p.ID_Prenotazione, -- Cruciale per la recensione
                pa.ID_Garage,      -- Cruciale per la recensione
                p.ID_Utente,       -- Cruciale per la recensione
                p.CodicePrenotazione, p.Targa, p.InizioSosta, p.FineSosta, 
                p.PrezzoTotale, p.Stato, p.DataCreazione,
                
                -- Flag per sapere se mostrare o meno le stelline sulla card
                CASE 
                    WHEN r.ID_Recensione IS NOT NULL THEN TRUE
                    ELSE FALSE
                END AS ha_recensito,

                pa.CodicePosto, 
                g.Nome AS NomeGarage, 
                g.Indirizzo,
                g.ID_Gestore, --Serve al frontend per aprire la chat

                -- SUBQUERY MESSAGGI NON LETTI PER QUESTA PRENOTAZIONE
                (
                    SELECT COUNT(*)
                    FROM Messaggio m
                    WHERE m.ID_Prenotazione = p.ID_Prenotazione
                      AND m.ID_Destinatario = $1
                      AND m.Letto = FALSE
                )::int AS nonletti

            FROM Prenotazione p
            JOIN PostoAuto pa ON p.ID_Posto = pa.ID_Posto
            JOIN Garage g ON pa.ID_Garage = g.ID_Garage
            LEFT JOIN Recensione r ON p.ID_Prenotazione = r.ID_Prenotazione
            WHERE p.ID_Utente = $1
            ORDER BY p.InizioSosta DESC
        `;

        const prenotazioni = await db.any(query, [utenteId]);
        res.json({ success: true, data: prenotazioni });

    } catch (err) {
        console.error('Errore recupero/aggiornamento prenotazioni:', err);
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

// annullamento prenotazione
router.put('/:codice/annulla', isLoggato, async (req, res) => {

    try {
        const codicePrenotazione = req.params.codice;
        const utenteId = req.session.utente.id;
        
        const risultato = await db.tx(async t => {
            const prenotazione = await t.oneOrNone(`
                SELECT 
                    p.ID_Prenotazione, p.PrezzoTotale, p.Stato, g.ID_Gestore,
                    
                    -- Calcolo ore mancanti all'inizio della sosta
                    (EXTRACT(EPOCH FROM (p.InizioSosta - (NOW() AT TIME ZONE 'Europe/Rome'))) / 3600) AS ore_all_inizio,
                    
                    -- Calcolo minuti passati dalla creazione della prenotazione
                    (EXTRACT(EPOCH FROM (NOW() - p.DataCreazione)) / 60) AS minuti_dalla_creazione

                FROM Prenotazione p
                JOIN PostoAuto pa ON p.ID_Posto = pa.ID_Posto
                JOIN Garage g ON pa.ID_Garage = g.ID_Garage
                WHERE p.CodicePrenotazione = $1 AND p.ID_Utente = $2 AND p.Stato = 'ATTIVA'
                FOR UPDATE OF p
            `, [codicePrenotazione, utenteId]);

            if (!prenotazione) {
                throw { status: 400, message: 'Prenotazione non trovata o già annullata.' };
            }

            const oreAllInizio = parseFloat(prenotazione.ore_all_inizio);
            const minutiDallaCreazione = parseFloat(prenotazione.minuti_dalla_creazione);

            let percentualeRimborso = 0;
            if (oreAllInizio > 12 || minutiDallaCreazione <= 15) {
                percentualeRimborso = 1; // Rimborso Totale
            } else if (oreAllInizio > 0) {
                percentualeRimborso = 0.5; // Rimborso Parziale (Penale 50%)
            } else {
                percentualeRimborso = 0; // Nessun Rimborso (Sosta già iniziata)
            }

            const importoRimborso = parseFloat(prenotazione.prezzototale) * percentualeRimborso;
            const penaleGestore = parseFloat(prenotazione.prezzototale) - importoRimborso;

            // 3. Aggiorniamo lo stato della prenotazione
            await t.none(`UPDATE Prenotazione SET Stato = 'ANNULLATA' WHERE ID_Prenotazione = $1`, [prenotazione.id_prenotazione]);

            // 4. Gestione Transazioni - CLIENTE
            if (importoRimborso > 0) {
                await t.none(`UPDATE Utente SET Saldo = Saldo + $1 WHERE ID_Utente = $2`, [importoRimborso, utenteId]);
                await t.none(`
                    INSERT INTO Transazione (ID_Utente, ID_Prenotazione, Tipo, Importo, Descrizione)
                    VALUES ($1, $2, 'RIMBORSO', $3, $4)
                `, [utenteId, prenotazione.id_prenotazione, importoRimborso, `Rimborso (${percentualeRimborso*100}%) prenotazione ${codicePrenotazione}`]);
            }

            // 5. Gestione Transazioni - GESTORE
            await t.none(`DELETE FROM Transazione WHERE ID_Prenotazione = $1 AND Tipo = 'INCASSO_SOSPESO'`, [prenotazione.id_prenotazione]);

            if (penaleGestore > 0) {
                await t.none(`UPDATE Utente SET Saldo = Saldo + $1 WHERE ID_Utente = $2`, [penaleGestore, prenotazione.id_gestore]);
                await t.none(`
                    INSERT INTO Transazione (ID_Utente, ID_Prenotazione, Tipo, Importo, Descrizione)
                    VALUES ($1, $2, 'INCASSO_COMPLETATO', $3, $4)
                `, [prenotazione.id_gestore, prenotazione.id_prenotazione, penaleGestore, `Penale annullamento prenotazione ${codicePrenotazione}`]);
            }

            const utenteAggiornato = await t.one(`SELECT Saldo FROM Utente WHERE ID_Utente = $1`, [utenteId]);
            return { nuovoSaldo: utenteAggiornato.saldo, importoRimborso };
        });

        req.session.utente.saldo = risultato.nuovoSaldo;

        res.json({ 
            success: true, 
            messaggio: `Prenotazione annullata. Rimborsato: €${risultato.importoRimborso.toFixed(2)}`,
            nuovoSaldo: risultato.nuovoSaldo
        });

    } catch (err) {
        console.error('Errore annullamento:', err);
        res.status(err.status || 500).json({ success: false, error: err.message || 'Errore interno' });
    }
});

router.get('/:codice/anteprima-annullamento', isLoggato, async (req, res) => {
    try {
        const prenotazione = await db.oneOrNone(`
            SELECT p.PrezzoTotale,
                   (EXTRACT(EPOCH FROM (p.InizioSosta - (NOW() AT TIME ZONE 'Europe/Rome'))) / 3600) AS ore_all_inizio,
                   (EXTRACT(EPOCH FROM (NOW() - p.DataCreazione)) / 60) AS minuti_dalla_creazione
            FROM Prenotazione p
            WHERE p.CodicePrenotazione = $1 AND p.ID_Utente = $2 AND p.Stato = 'ATTIVA'
        `, [req.params.codice, req.session.utente.id]);

        if (!prenotazione) throw new Error('Prenotazione non trovata');

        const oreAllInizio = parseFloat(prenotazione.ore_all_inizio);
        const minutiDallaCreazione = parseFloat(prenotazione.minuti_dalla_creazione);
        const prezzo = parseFloat(prenotazione.prezzototale);

        let percentuale = 0, messaggio = '', motivazione = '', classe = '';

        if (minutiDallaCreazione <= 15) {
            percentuale = 100;
            messaggio = 'Rimborso Totale';
            motivazione = 'Hai annullato entro 15 minuti dalla prenotazione (Diritto di Recesso Rapido).';
            classe = 'text-success';
        } else if (oreAllInizio > 12) {
            percentuale = 100;
            messaggio = 'Rimborso Totale';
            motivazione = 'Hai annullato con più di 12 ore di preavviso rispetto all\'inizio della sosta.';
            classe = 'text-success';
        } else if (oreAllInizio > 0) {
            percentuale = 50;
            messaggio = 'Rimborso Parziale';
            motivazione = 'Mancano meno di 12 ore alla sosta: viene applicata una penale del 50%.';
            classe = 'text-warning';
        } else {
            percentuale = 0;
            messaggio = 'Nessun Rimborso';
            motivazione = 'La sosta è già iniziata. Libererai solo il posto auto per altri utenti.';
            classe = 'text-danger';
        }

        res.json({ 
            success: true, 
            dati: { 
                rimborso: prezzo * (percentuale / 100), 
                messaggio, 
                motivazione, 
                classe 
            } 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// recupera lo storico delle prenotazioni del gestore loggato
router.get('/prenotazioni-gestore', isGestore, async (req, res) => {
    try {

        const idGestore = req.session.utente.id;
        
        const query = `
            SELECT 
                p.*, 
                g.Nome as nome_garage,
                pa.ID_Garage,
                u.Nome as nomecliente,
                u.Cognome as cognomecliente,

                -- SUBQUERY MESSAGGI NON LETTI PER QUESTA PRENOTAZIONE
                (
                    SELECT COUNT(*)
                    FROM Messaggio m
                    WHERE m.ID_Prenotazione = p.ID_Prenotazione
                      AND m.ID_Destinatario = $1
                      AND m.Letto = FALSE
                )::int AS nonletti

            FROM Prenotazione p
            JOIN PostoAuto pa ON p.ID_Posto = pa.ID_Posto
            JOIN Garage g ON pa.ID_Garage = g.ID_Garage
            JOIN Utente u ON p.ID_Utente = u.ID_Utente
            WHERE g.ID_Gestore = $1
            ORDER BY p.InizioSosta DESC
        `;
        
        const result = await db.any(query, [idGestore]);
        res.json(result);

    } catch (error) {
        console.error("Errore storico gestore:", error);
        res.status(500).json({ error: 'Errore interno' });
    }
});

module.exports = router;