// Gestisce la logica di ricerca spaziale ed ordinamento dei garage.
// Identifica se la ricerca corrisponde a un Punto di Interesse (POI) noto,
// calcola le distanze relative e applica i filtri tecnici e l'ordinamento.

import { computed } from 'vue'
import { calculateDistance } from '../utils/distance.js'
import { strategic_places } from '../constants/places.js'


export function useSpatialSearch(searchLocation, garages, passaFiltriTecnici, raggioKm, ordinamento, filterTipoVeicolo) {


    // Controlla se la stringa cercata corrisponde al nome o a un sinonimo di un POI salvato
    const matchedPOI = computed(() => {
        const query = searchLocation.value.toLowerCase().trim()
        return query.length > 2
            ? strategic_places.find(p =>
                p.name.toLowerCase().includes(query) ||
                p.synonyms.some(s => s.toLowerCase().includes(query))
            )
            : null
    })

    // Verifica se ci sono ulteriori garage validi espandendo temporaneamente il raggio di ricerca.
    const hasMoreResults = computed(() => {
        const poi = matchedPOI.value
        if (!poi) return false

        const raggio = raggioKm?.value ?? 2
        const raggioEsteso = Math.max(raggio + 3, 5)

        return garages.value.some(g => {
            const d = calculateDistance(poi.coords.lat, poi.coords.lng, g.latitudine, g.longitudine)
            return d > raggio && d <= raggioEsteso && passaFiltriTecnici(g)
        })
    })


    // Elabora l'array di tutti i garage calcolando le distanze e applicando l'ordinamento richiesto
    const garagesFiltrati = computed(() => {
        const query = searchLocation.value.toLowerCase().trim()
        const poi = matchedPOI.value
        const raggio = raggioKm?.value ?? 2

        // Primo step: Calcoliamo le distanze assolute rispetto al POI selezionato o a quello più vicino
        const allProcessed = garages.value.map(g => {
            let referencePOI = null
            let distance = 0

            if (poi) {
                referencePOI = poi
                distance = calculateDistance(poi.coords.lat, poi.coords.lng, g.latitudine, g.longitudine)
            } else {
                // Se non c'è una ricerca per POI esplicito, mappa la distanza rispetto al punto strategico più vicino
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

        // Secondo step: Filtriamo i risultati in base al tipo di ricerca effettuata
        if (poi) {
            // Se c'è un POI, teniamo solo i garage che passano i filtri e sono dentro il raggio chilometrico scelto
            risultatiDaOrdinare = allProcessed.filter(g => passaFiltriTecnici(g) && g.displayDistanceKM <= raggio)
        } else {
            // Se è una ricerca testuale libera, cerchiamo corrispondenze parziali sul nome del garage o sull'indirizzo
            risultatiDaOrdinare = allProcessed.filter(g => {
                const matchesSearch = g.nome.toLowerCase().includes(query) || g.indirizzo.toLowerCase().includes(query)
                return matchesSearch && passaFiltriTecnici(g)
            })
        }

        // Funzione di utility interna per recuperare la tariffa corretta da usare durante la fase di sorting
        const getPriceForSort = (g) => {
            if (filterTipoVeicolo?.value !== 'ALL' && g.tariffeVeicoli && g.tariffeVeicoli[filterTipoVeicolo?.value]) {
                return Number(g.tariffeVeicoli[filterTipoVeicolo.value]);
            }
            return Number(g.tariffabase);
        }

        // Terzo step: Applichiamo l'algoritmo di ordinamento basandoci sulla scelta della UI
        return risultatiDaOrdinare.sort((a, b) => {
            if (ordinamento?.value === 'prezzo') {
                return getPriceForSort(a) - getPriceForSort(b);
            } else if (ordinamento?.value === 'recensioni') {
                const mediaA = Number(a.mediagenerale) || 0;
                const mediaB = Number(b.mediagenerale) || 0;
                return mediaB - mediaA;
            } else {
                // Ordinamento predefinito: per distanza crescente
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