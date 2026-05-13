import { ref, computed, watch } from 'vue'
import { calculateDistance } from '../utils/distance.js'
import { strategic_places } from '../constants/places.js'

export function useSpatialSearch(searchLocation, garages, passaFiltriTecnici, raggioKm) {
    const showExtendedResults = ref(false)

    watch(searchLocation, () => {
        showExtendedResults.value = false
    })

    watch(raggioKm, () => {
        showExtendedResults.value = false
    })

    const matchedPOI = computed(() => {
        const query = searchLocation.value.toLowerCase().trim()
        return query.length > 2
            ? strategic_places.find(p =>
                p.name.toLowerCase().includes(query) ||
                p.synonyms.some(s => s.toLowerCase().includes(query))
            )
            : null
    })

    const garagesFiltrati = computed(() => {
        const query = searchLocation.value.toLowerCase().trim()
        const poi = matchedPOI.value
        const raggio = raggioKm?.value ?? 2
        const raggioEsteso = Math.max(raggio + 3, 5)

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

        if (poi) {
            const near = allProcessed.filter(g => passaFiltriTecnici(g) && g.displayDistanceKM <= raggio)
            const far = allProcessed.filter(g => passaFiltriTecnici(g) && g.displayDistanceKM > raggio && g.displayDistanceKM <= raggioEsteso)

            const results = near.length > 0
                ? (showExtendedResults.value ? [...near, ...far] : near)
                : far

            return results.sort((a, b) => a.displayDistanceKM - b.displayDistanceKM)
        }

        return allProcessed.filter(g => {
            const matchesSearch = g.nome.toLowerCase().includes(query) || g.indirizzo.toLowerCase().includes(query)
            return matchesSearch && passaFiltriTecnici(g)
        })
    })

    const hasMoreResults = computed(() => {
        const poi = matchedPOI.value
        if (!poi || showExtendedResults.value) return false

        const raggio = raggioKm?.value ?? 2
        const raggioEsteso = Math.max(raggio + 3, 5)

        const near = garages.value.filter(g => {
            const d = calculateDistance(poi.coords.lat, poi.coords.lng, g.latitudine, g.longitudine)
            return d <= raggio && passaFiltriTecnici(g)
        })
        const far = garages.value.filter(g => {
            const d = calculateDistance(poi.coords.lat, poi.coords.lng, g.latitudine, g.longitudine)
            return d > raggio && d <= raggioEsteso && passaFiltriTecnici(g)
        })

        return near.length > 0 && far.length > 0
    })

    return {
        showExtendedResults,
        matchedPOI,
        garagesFiltrati,
        hasMoreResults
    }
}