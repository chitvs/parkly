const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { isLoggato } = require('../middleware/authMiddleware');

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

            // 2. Controllo orari garage
            const checkOrari = await t.one(`
                SELECT 
                    g.Is24h, g.OrarioApertura, g.OrarioChiusura,
                    g.Nome AS nome_garage, g.ID_Gestore,
                    p.CodicePosto,
                    ($2::timestamp::time >= g.OrarioApertura AND $2::timestamp::time <= g.OrarioChiusura) AS inizio_valido,
                    ($3::timestamp::time >= g.OrarioApertura AND $3::timestamp::time <= g.OrarioChiusura) AS fine_valida
                FROM Garage g
                JOIN PostoAuto p ON g.ID_Garage = p.ID_Garage
                WHERE p.ID_Posto = $1
            `, [id_posto, inizio, fine]);

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
router.get('/', async (req, res) => {
    if (!req.session.utente || !req.session.utente.id) {
        return res.status(401).json({ success: false, error: 'Non autorizzato' });
    }

    const utenteId = req.session.utente.id;

    try {
        // 1. LAZY UPDATE: Aggiorniamo fisicamente lo stato sul DB prima di leggere
        await db.none(`
            UPDATE Prenotazione 
            SET Stato = 'CONCLUSA' 
            WHERE ID_Utente = $1 
              AND Stato = 'ATTIVA' 
              AND FineSosta < (NOW() + INTERVAL '2 hours')
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

// Annullamento di una prenotazione
router.put('/:codice/annulla', async (req, res) => {
    if (!req.session.utente || !req.session.utente.id) {
        return res.status(401).json({ success: false, error: 'Non autorizzato' });
    }

    try {
        const codicePrenotazione = req.params.codice;
        const utenteId = req.session.utente.id;
        
        // eseguiamo tutto in una transazione per evitare di annullare senza rimborsare
        const nuovoSaldo = await db.tx(async t => {
            // troviamo la prenotazione e blocchiamo la riga per l'update
            const prenotazione = await t.oneOrNone(`
                SELECT ID_Prenotazione, PrezzoTotale, Stato 
                FROM Prenotazione 
                WHERE CodicePrenotazione = $1 AND ID_Utente = $2 AND Stato = 'ATTIVA'
                FOR UPDATE
            `, [codicePrenotazione, utenteId]);

            if (!prenotazione) {
                throw { status: 400, message: 'Prenotazione non trovata o già annullata.' };
            }

            // Aggiorniamo lo stato in ANNULLATA
            await t.none(`
                UPDATE Prenotazione 
                SET Stato = 'ANNULLATA' 
                WHERE ID_Prenotazione = $1
            `, [prenotazione.id_prenotazione]);

            // riaccreditiamo i soldi al cliente
            const utente = await t.one(`
                UPDATE Utente 
                SET Saldo = Saldo + $1 
                WHERE ID_Utente = $2
                RETURNING Saldo
            `, [prenotazione.prezzototale, utenteId]);

            // Elimina l'INCASSO_SOSPESO del gestore — la prenotazione è annullata, quei soldi non esistono più
            await t.none(`
                DELETE FROM Transazione 
                WHERE ID_Prenotazione = $1 AND Tipo = 'INCASSO_SOSPESO'
            `, [prenotazione.id_prenotazione]);

            // salvo la transazione nel db
            await t.none(`
                INSERT INTO Transazione (ID_Utente, ID_Prenotazione, Tipo, Importo, Descrizione)
                VALUES ($1, $2, 'RIMBORSO', $3, $4)
            `, [utenteId, prenotazione.id_prenotazione, prenotazione.prezzototale, `Rimborso prenotazione ${codicePrenotazione}`]);

            return utente.saldo;
        });

        req.session.utente.saldo = nuovoSaldo;

        res.json({ 
            success: true, 
            messaggio: 'Prenotazione annullata e importo rimborsato con successo',
            nuovoSaldo: nuovoSaldo
        });

    } catch (err) {
        console.error('Errore annullamento prenotazione:', err);
        if (err.status) {
            return res.status(err.status).json({ success: false, error: err.message });
        }
        res.status(500).json({ success: false, error: 'Errore interno del server' });
    }
});

// recupera lo storico delle prenotazioni del gestore loggato
router.get('/prenotazioni-gestore', async (req, res) => {
    try {
        const utenteLoggato = req.session?.utente;
        
        if (!utenteLoggato || utenteLoggato.ruolo !== 'GESTORE') {
            return res.status(401).json({ error: 'Accesso negato' });
        }
        
        const idGestore = utenteLoggato.id;
        
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