import { reactive, markRaw } from 'vue'

export const garageStore = reactive({
  currentGarage: null,
  posti: [],
  isLoading: false,

  clearGarageData() {
    this.currentGarage = null
    this.posti = []
  },

  async fetchGarage(id) {
    this.isLoading = true
    try {
      const response = await fetch(`/api/garage/${id}`)
      const data = await response.json()
      if (data.success) this.currentGarage = markRaw(data.garage)
      return data
    } catch (err) {
      return {
        success: false,
        error: 'Errore di rete',
      }
    } finally {
      this.isLoading = false
    }
  },

  async fetchPosti(id, inizio, fine) {
    try {
      const response = await fetch(`/api/garage/${id}/posti?inizio=${inizio}&fine=${fine}`)
      const data = await response.json()
      if (data.success) this.posti = markRaw(data.posti)
      return data
    } catch (err) {
      return {
        success: false,
        error: 'Impossibile caricare la mappa',
      }
    }
  },

  async prenota(payload) {
    try {
      const response = await fetch('/api/prenotazioni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return await response.json()
    } catch (err) {
      return {
        success: false,
        error: 'Errore durante la prenotazione',
      }
    }
  },
})
