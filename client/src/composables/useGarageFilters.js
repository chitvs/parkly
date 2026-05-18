/**
 * Gestisce lo stato reattivo di tutti i filtri di ricerca per i garage 
 * (prezzo, tipologia veicolo, servizi, raggio di ricerca) e fornisce 
 * la logica per valutare se un singolo garage rispetta i criteri scelti.
 */

import { ref } from 'vue'

export function useGarageFilters() {

    // STATO DEI FILTRI 
    // Filtri booleani
    const filter24h = ref(false)
    const filterCoperto = ref(false)
    const filterElettrico = ref(false)
    const filterDisabili = ref(false)
    // Filtri quantitativi
    const maxPrice = ref(25)
    const minHeight = ref(0)
    const raggioKm = ref(2) // N.B. il filtraggio spaziale e delegato a useSpatialSearch.js
    // Filtri selettivi
    const filterTipoVeicolo = ref('ALL')
    const ordinamento = ref('distanza')

    // AZIONI

    // Resetta tutti i filtri ai loro valori predefiniti
    const resetTechnicalFilters = () => {
        filter24h.value = false
        filterCoperto.value = false
        filterElettrico.value = false
        filterDisabili.value = false
        maxPrice.value = 25
        minHeight.value = 0
        raggioKm.value = 2
        filterTipoVeicolo.value = 'ALL'
        ordinamento.value = 'distanza'
    }

    // Valuta se un garage passa tutti i filtri impostati dall'utente
    const passaFiltriTecnici = (g) => {

        // Calcolo del prezzo
        // Iniziamo con la tariffa di base come riferimento standard
        let tariffaDiRiferimento = Number(g.tariffabase);

        // se il backend ci ha mandato l'oggetto con le tariffe e abbiamo un veicolo specifico selezionato
        if (g.tariffeVeicoli && filterTipoVeicolo.value !== 'ALL') {
            const tariffaSpecifica = g.tariffeVeicoli[filterTipoVeicolo.value];
            // se esiste una tariffa per quel veicolo in questo garage, usala, altrimenti il garage non è valido per il prezzo
            if (tariffaSpecifica) {
                tariffaDiRiferimento = Number(tariffaSpecifica);
            } else {
                // Se il garage non ha tariffe per questo veicolo impostiamo infinity per far fallire matematicamente il confronto
                tariffaDiRiferimento = Infinity;
            }
        }
        
        // Il garage verrà riportato solo se passarà tutti i criteri selezionati
        return (!filter24h.value || g.is24h) &&
            tariffaDiRiferimento <= maxPrice.value &&
            (!minHeight.value || (g.altezzamassima && Number(g.altezzamassima) >= minHeight.value)) &&
            (!filterCoperto.value || g.hasCoperto) &&
            (!filterElettrico.value || g.hasElettrico) &&
            (!filterDisabili.value || g.hasDisabili) &&
            (filterTipoVeicolo.value === 'ALL' || g.tipiDisponibili?.includes(filterTipoVeicolo.value))
    }

    // Return degli stati e dei metodi
    return {
        filter24h,
        maxPrice,
        minHeight,
        filterCoperto,
        filterElettrico,
        filterDisabili,
        filterTipoVeicolo,
        raggioKm,
        ordinamento,
        resetTechnicalFilters,
        passaFiltriTecnici
    }
}