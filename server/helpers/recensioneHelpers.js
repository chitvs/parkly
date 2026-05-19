/*
 * Funzioni di supporto per la gestione delle recensioni.
 */

/*
 * Ricalcola tutte le medie voto del garage e aggiorna il contatore delle recensioni.
 * Va chiamata dentro una transazione (t) ogni volta che una recensione viene
 * creata, modificata o eliminata.
 */
async function ricalcolaMediaGarage(t, idGarage) {
  await t.none(
    `UPDATE Garage SET
        MediaGenerale  = COALESCE((SELECT ROUND(AVG(VotoGenerale),  2) FROM Recensione WHERE ID_Garage = $1), 0.00),
        MediaPosizione = COALESCE((SELECT ROUND(AVG(VotoPosizione), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
        MediaPrezzo    = COALESCE((SELECT ROUND(AVG(VotoPrezzo),    2) FROM Recensione WHERE ID_Garage = $1), 0.00),
        MediaPulizia   = COALESCE((SELECT ROUND(AVG(VotoPulizia),   2) FROM Recensione WHERE ID_Garage = $1), 0.00),
        MediaSpazio    = COALESCE((SELECT ROUND(AVG(VotoSpazio),    2) FROM Recensione WHERE ID_Garage = $1), 0.00),
        MediaSicurezza = COALESCE((SELECT ROUND(AVG(VotoSicurezza), 2) FROM Recensione WHERE ID_Garage = $1), 0.00),
        NumeroRecensioni = (SELECT COUNT(*) FROM Recensione WHERE ID_Garage = $1)
     WHERE ID_Garage = $1`,
    [idGarage],
  );
}

module.exports = { ricalcolaMediaGarage };
