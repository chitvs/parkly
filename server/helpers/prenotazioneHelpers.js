/*
 * Funzioni di supporto riutilizzabili dalla logica delle prenotazioni.
 */

/*
 * Annulla una prenotazione ATTIVA e gestisce il rimborso al cliente
 * e la rimozione dell'incasso sospeso per il gestore.
 *
 * Questa funzione va eseguita all'interno di una transazione pg-promise esistente (t),
 * così da garantire l'atomicità dell'intera operazione.
 */
async function annullaERimborsa(t, pren, descrizioneRimborso) {
  // Segna la prenotazione come ANNULLATA
  await t.none(
    `UPDATE Prenotazione SET Stato = 'ANNULLATA' WHERE ID_Prenotazione = $1`,
    [pren.id_prenotazione],
  );

  // Accredita il rimborso sul saldo del cliente
  await t.none(`UPDATE Utente SET Saldo = Saldo + $1 WHERE ID_Utente = $2`, [
    pren.prezzototale,
    pren.id_utente,
  ]);

  // Registra la transazione di rimborso nello storico del cliente
  await t.none(
    `INSERT INTO Transazione (ID_Utente, ID_Prenotazione, Tipo, Importo, Descrizione)
     VALUES ($1, $2, 'RIMBORSO', $3, $4)`,
    [
      pren.id_utente,
      pren.id_prenotazione,
      pren.prezzototale,
      descrizioneRimborso,
    ],
  );

  // Rimuovi l'incasso sospeso del gestore per questa prenotazione.
  // Non viene registrata una transazione negativa sul gestore — la riga sparisce e basta.
  await t.none(
    `DELETE FROM Transazione WHERE ID_Prenotazione = $1 AND Tipo = 'INCASSO_SOSPESO'`,
    [pren.id_prenotazione],
  );
}

/*
 * Calcola la percentuale di rimborso spettante al cliente in base
 * alle politiche di cancellazione di Parkly:
 *
 *  - Entro 15 min dalla prenotazione  -> 100% (diritto di recesso rapido)
 *  - Più di 12 ore all'inizio sosta   -> 100%
 *  - Tra 0 e 12 ore all'inizio sosta  ->  50% (penale)
 *  - Sosta già iniziata               ->   0%
 *
 * oreAllInizio sono le ore mancanti all'inizio della sosta (può essere negativo).
 * minutiDallaCreazione sono i minuti trascorsi dalla creazione della prenotazione.
 * ritorna la percentuale decimale (es. 1 = 100%, 0.5 = 50%, 0 = nessun rimborso).
 */
function calcolaPercentualeRimborso(oreAllInizio, minutiDallaCreazione) {
  if (minutiDallaCreazione <= 15 || oreAllInizio > 12) return 1;
  if (oreAllInizio > 0) return 0.5;
  return 0;
}

module.exports = { annullaERimborsa, calcolaPercentualeRimborso };
