import { reactive, markRaw } from 'vue'

export const garageStore = reactive({
  currentGarage: null,
  posti: [],
  recensioni: [],
  isLoading: false,

  clearGarageData() {
    this.currentGarage = null
    this.posti = []
    this.recensioni = []
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

  async fetchRecensioni(id) {
    try {
      const response = await fetch(`/api/garage/${id}/recensioni`)
      const data = await response.json()
      if (data.success) {
        this.recensioni = markRaw(data.recensioni)
      }
    } catch (err) {
      console.error('Impossibile caricare le recensioni', err)
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

  async updateGarage(id, garageData) {
    this.isLoading = true
    try {
      const response = await fetch(`/api/garage/garages-gestore/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(garageData),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Errore durante l\'aggiornamento')
      return { success: true, garage: data.garage }
    } catch (err) {
      return { success: false, error: err.message || 'Errore di rete' }
    } finally {
      this.isLoading = false
    }
  },

  async addMaintenance(idGarage, idPosto, maintenanceData) {
    this.isLoading = true
    try {
      const response = await fetch(`/api/garage/garages-gestore/${idGarage}/posti/${idPosto}/manutenzione`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maintenanceData),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Errore durante l\'inserimento della manutenzione')
      return { success: true, message: data.message }
    } catch (err) {
      return { success: false, error: err.message || 'Errore di rete' }
    } finally {
      this.isLoading = false
    }
  }
})