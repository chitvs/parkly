import { computed } from 'vue'
import { calculateDistance } from '../utils/distance.js'
import { strategic_places } from '../constants/places.js'

export function useSpatialSearch(searchLocation, garages, passaFiltriTecnici, raggioKm, ordinamento, filterTipoVeicolo) {
    
    const matchedPOI = computed(() => {
        const query = searchLocation.value.toLowerCase().trim()
        return query.length > 2
            ? strategic_places.find(p =>
                p.name.toLowerCase().includes(query) ||
                p.synonyms.some(s => s.toLowerCase().includes(query))
            )
            : null
    })

    const hasMoreResults = computed(() => {
        const poi = matchedPOI.value
        if (!poi) return false

        const raggio = raggioKm?.value ?? 2
        const raggioEsteso = Math.max(raggio + 3, 5)

        // Verifica solo se ci sono parcheggi validi nella fascia "estesa"
        return garages.value.some(g => {
        const d = calculateDistance(poi.coords.lat, poi.coords.lng, g.latitudine, g.longitudine)
        return d > raggio && d <= raggioEsteso && passaFiltriTecnici(g)
    })

        return far.length > 0
    })

    const garagesFiltrati = computed(() => {
        const query = searchLocation.value.toLowerCase().trim()
        const poi = matchedPOI.value
        const raggio = raggioKm?.value ?? 2

        const allProcessed = garages.value.map(g => {
            let referencePOI = null
            let distance = 0

            if (poi) {
                referencePOI = poi
                distance = calculateDistance(poi.coords.lat, poi.coords.lng, g.latitudine, g.longitudine)
            } else {
                let minDist = Infinity
                strategic_places.forEach(p => {
                    const d = calculateDistance(p.coords.lat, p.coords.lng, g.latitudine, g.longitudine)
                    if (d < minDist) { minDist = d; referencePOI = p }
                })
                distance = minDist
            }

            return {
                ...g,
                displayPOIName: referencePOI ? referencePOI.name : '',
                displayDistanceKM: distance,
                displayDistanceLabel: distance < 1
                    ? `${Math.round(distance * 1000)}m`
                    : `${distance.toFixed(1)}km`
            }
        })

        let risultatiDaOrdinare = []

        if (poi) {
            // LOGICA SEMPLIFICATA: prendiamo solo quelli dentro il raggio!
            // (Se l'utente clicca "Mostra altri", il raggio si aggiornerà e questa computed si ricalcolerà da sola)
            risultatiDaOrdinare = allProcessed.filter(g => passaFiltriTecnici(g) && g.displayDistanceKM <= raggio)
        } else {
            risultatiDaOrdinare = allProcessed.filter(g => {
                const matchesSearch = g.nome.toLowerCase().includes(query) || g.indirizzo.toLowerCase().includes(query)
                return matchesSearch && passaFiltriTecnici(g)
            })
        }

        const getPriceForSort = (g) => {
            if (filterTipoVeicolo?.value !== 'ALL' && g.tariffeVeicoli && g.tariffeVeicoli[filterTipoVeicolo?.value]) {
                return Number(g.tariffeVeicoli[filterTipoVeicolo.value]);
            }
            return Number(g.tariffabase);
        }

        return risultatiDaOrdinare.sort((a, b) => {
            if (ordinamento?.value === 'prezzo') {
                return getPriceForSort(a) - getPriceForSort(b);
            } else if (ordinamento?.value === 'recensioni') {
                const mediaA = Number(a.mediagenerale) || 0;
                const mediaB = Number(b.mediagenerale) || 0;
                return mediaB - mediaA;
            } else {
                return (a.displayDistanceKM || 0) - (b.displayDistanceKM || 0);
            }
        });
    })

    return {
        matchedPOI,
        garagesFiltrati,
        hasMoreResults
    }
}