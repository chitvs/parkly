import { ref } from 'vue'

export function useGarageFilters() {
    // 1. Stato dei filtri
    const filter24h = ref(false)
    const maxPrice = ref(25)
    const minHeight = ref(0)
    const filterCoperto = ref(false)
    const filterElettrico = ref(false)
    const filterDisabili = ref(false)
    const filterTipoVeicolo = ref('ALL')

    // 2. Logica di reset (solo per i filtri tecnici)
    const resetTechnicalFilters = () => {
        filter24h.value = false
        filterCoperto.value = false
        filterElettrico.value = false
        filterDisabili.value = false
        maxPrice.value = 25
        minHeight.value = 0
        filterTipoVeicolo.value = 'ALL'
    }

    // 3. Logica di validazione del singolo garage
    const passaFiltriTecnici = (g) => {
        return (!filter24h.value || g.is24h) &&
            Number(g.tariffabase) <= maxPrice.value &&
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