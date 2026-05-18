/**
 * Gestisce il recupero della lista pubblica di tutti i garage (es. per la mappa 
 * o la pagina di ricerca). 
 * Mantiene i risultati in uno stato "locale" legato al componente che lo invoca,
 * evitando di appesantire inutilmente lo Store globale.
 */

import { ref } from 'vue'
import { apiFetch } from '../utils/apiClient'

export function useGarages() {
    const isLoading = ref(true)
    const garages = ref([])

    // Recupera i garage che rispettano i vincoli di data
    const fetchGarages = async (checkInDate, checkOutDate) => {
        isLoading.value = true
        try {
            let url = '/api/garage'
            const params = new URLSearchParams()

            if (checkInDate && checkOutDate) {
                params.append('inizio', checkInDate)
                params.append('fine', checkOutDate)
            }

            const queryString = params.toString()
            if (queryString) {
                url += `?${queryString}`
            }

            const response = await apiFetch(url)
            const result = await response.json()

            if (result.success) {
                garages.value = result.garage
            }
        } catch (error) {
            console.error("Errore nel caricamento dei garage:", error)
        } finally {
            isLoading.value = false
        }
    }

    return {
        isLoading,
        garages,
        fetchGarages
    }
}