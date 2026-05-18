/**
 * --- API CLIENT ---
 * Centralizza le chiamate fetch verso il backend.
 * - Imposta automaticamente 'credentials: include' per le sessioni.
 * - Imposta 'Content-Type: application/json' di default.
 * - Riconosce automaticamente i FormData (es. upload immagini) e lascia
 * che sia il browser a gestire i boundary e gli header corretti.
 */

// Nei vari store se è presente solo il method: 'GET' può essere trascurato poichè di dafault per i browser. 
// Viene però lasciato per miglior comprensibilità del codice. 

export async function apiFetch(endpoint, customConfig = {}) {
    // Estrapoliamo eventuali header personalizzati
    const headers = { ...customConfig.headers };

    // Se stiamo inviando un body e NON è un FormData (quindi è JSON puro),
    // impostiamo il Content-Type (se non è già stato sovrascritto manualmente)
    if (customConfig.body && !(customConfig.body instanceof FormData)) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    // Assembliamo la configurazione finale
    const config = {
        ...customConfig,
        credentials: customConfig.credentials || 'include', // Il default è sempre 'include'
        headers
    };

    // Eseguiamo la fetch
    return fetch(endpoint, config);
}