import { ref } from 'vue'

export function useGarages() {
    const isLoading = ref(true)
    const garages = ref([])

    const fetchGarages = async (checkInDate, checkOutDate) => {
        isLoading.value = true
        try {
            let url = '/api/garage'
            const params = new URLSearchParams()

            // Usiamo i parametri passati alla funzione invece dei ref globali
            if (checkInDate && checkOutDate) {
                params.append('inizio', checkInDate)
                params.append('fine', checkOutDate)
            }

            const queryString = params.toString()
            if (queryString) {
                url += `?${queryString}`
            }

            const response = await fetch(url)
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

    // Esponiamo le variabili e la funzione per farle usare al componente
    return {
        isLoading,
        garages,
        fetchGarages
    }
}