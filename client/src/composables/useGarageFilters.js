import { ref } from 'vue'

export function useGarageFilters() {
    
    const filter24h = ref(false)
    const maxPrice = ref(25)
    const minHeight = ref(0)
    const filterCoperto = ref(false)
    const filterElettrico = ref(false)
    const filterDisabili = ref(false)
    const filterTipoVeicolo = ref('ALL') // può essere 'ALL', 'AUTO', 'MOTO', 'FURGONE'

    const resetTechnicalFilters = () => {
        filter24h.value = false
        filterCoperto.value = false
        filterElettrico.value = false
        filterDisabili.value = false
        maxPrice.value = 25
        minHeight.value = 0
        filterTipoVeicolo.value = 'ALL'
    }

    const passaFiltriTecnici = (g) => {
        // capiamo quale tariffa guardare per questo garage
        let tariffaDiRiferimento = Number(g.tariffabase);

        // se il backend ci ha mandato l'oggetto con le tariffe e abbiamo un veicolo specifico selezionato
        if (g.tariffeVeicoli && filterTipoVeicolo.value !== 'ALL') {
            const tariffaSpecifica = g.tariffeVeicoli[filterTipoVeicolo.value];
            // se esiste una tariffa per quel veicolo in questo garage, usala, altrimenti il garage non è valido per il prezzo
            if (tariffaSpecifica) {
                tariffaDiRiferimento = Number(tariffaSpecifica);
            } else {
                // se cerco MOTO e questo garage non ha prezzi per MOTO, teoricamente lo escludiamo
                // ma in realtà questo garage verrà già bloccato dal filtro in fondo (includes)
                tariffaDiRiferimento = Infinity; 
            }
        }

        return (!filter24h.value || g.is24h) &&
            tariffaDiRiferimento <= maxPrice.value &&
            (!minHeight.value || (g.altezzamassima && Number(g.altezzamassima) >= minHeight.value)) &&
            (!filterCoperto.value || g.hasCoperto) &&
            (!filterElettrico.value || g.hasElettrico) &&
            (!filterDisabili.value || g.hasDisabili) &&
            (filterTipoVeicolo.value === 'ALL' || g.tipiDisponibili?.includes(filterTipoVeicolo.value))
    }

    return {
        filter24h,
        maxPrice,
        minHeight,
        filterCoperto,
        filterElettrico,
        filterDisabili,
        filterTipoVeicolo,
        resetTechnicalFilters,
        passaFiltriTecnici
    }
}