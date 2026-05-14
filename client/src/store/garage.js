import { reactive, markRaw } from 'vue'

export const garageStore = reactive({
  // --- STATI CLIENT ---
  currentGarage: null,
  posti: [],
  recensioni: [],

  // --- STATI GESTORE ---
  mieiGarage: [],
  storicoPrenotazioni: [],
  postiPerGarage: {},
  occupazioneGarage: {},
  idGarageSelezionato: 'TUTTI',

  // --- STATI CONDIVISI ---
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
      return { success: false, error: 'Errore di rete' }
    } finally {
      this.isLoading = false
    }
  },

  async fetchPosti(id, inizio, fine) {
    try {
      let url = `/api/garage/${id}/posti`;
      if (inizio && fine) {
        url += `?inizio=${inizio}&fine=${fine}`;
      }
      const response = await fetch(url, { credentials: 'include' })
      const data = await response.json()
      if (data.success) this.posti = markRaw(data.posti)
      return data
    } catch (err) {
      return { success: false, error: 'Impossibile caricare la mappa' }
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
      return { success: false, error: 'Errore durante la prenotazione' }
    }
  },

  // --- METODI SPECIFICI PER IL GESTORE ---

  async fetchGaragesGestore() {
    this.isLoading = true;
    try {
      const response = await fetch('/api/garage/garages-gestore', { credentials: 'include' });
      const data = await response.json();
      return { success: response.ok, data };
    } catch (err) {
      console.error("Errore fetch garages gestore:", err);
      return { success: false, error: 'Errore di rete' };
    } finally {
      this.isLoading = false;
    }
  },

  async fetchOccupazione(id) {
    try {
      const response = await fetch(`/api/garage/${id}/occupazione`, { credentials: 'include' });
      const data = await response.json();
      return { success: response.ok, percentuale: data.percentuale };
    } catch (err) {
      console.error(`Errore fetch occupazione garage ${id}:`, err);
      return { success: false, percentuale: 0 };
    }
  },

  setGarageSelezionato(id) {
    this.idGarageSelezionato = id;
  },

  async caricaDashboardGestore() {
    this.isLoading = true;
    try {
      const res = await this.fetchGaragesGestore();
      if (!res.success) return { success: false };

      this.mieiGarage = markRaw(res.data);

      if (this.idGarageSelezionato !== 'TUTTI') {
        const esisteAncora = this.mieiGarage.some(g => Number(g.id_garage) === Number(this.idGarageSelezionato));
        if (!esisteAncora) {
          this.idGarageSelezionato = 'TUTTI';
        }
      }

      const nuoviPosti = {};
      const nuovaOccupazione = {};

      await Promise.all(this.mieiGarage.map(async (g) => {
        try {
          const [rPosti, rOcc] = await Promise.all([
            this.fetchPosti(g.id_garage),
            this.fetchOccupazione(g.id_garage)
          ]);
          if (rPosti.success) nuoviPosti[g.id_garage] = rPosti.posti;
          if (rOcc.success) nuovaOccupazione[g.id_garage] = Math.round(rOcc.percentuale);
        } catch (e) {
          console.error(e);
        }
      }));

      this.postiPerGarage = nuoviPosti;
      this.occupazioneGarage = nuovaOccupazione;

      return { success: true };
    } finally {
      this.isLoading = false;
    }
  },

  async caricaStoricoGestore() {
    try {
      const res = await fetch('/api/prenotazioni/prenotazioni-gestore', { credentials: 'include' });
      if (res.ok) {
        this.storicoPrenotazioni = await res.json();
        return { success: true };
      }
      return { success: false };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async createGarage(payload) {
    this.isLoading = true;
    try {
      const res = await fetch('/api/garage/garages-gestore', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore durante la creazione');
      return { success: true, garage: data.garage };
    } catch (err) {
      return { success: false, error: err.message || 'Errore di rete' };
    } finally {
      this.isLoading = false;
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

  async aggiornaMappaOrariGestore(inizioIso, fineIso) {
    await Promise.all(this.mieiGarage.map(async (g) => {
      try {
        const r = await this.fetchPosti(g.id_garage, inizioIso, fineIso);
        if (r.success) {
          this.postiPerGarage[g.id_garage] = r.posti;
        }
      } catch (e) {
        console.error(e);
      }
    }));
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
  },

  async removeMaintenance(idGarage, idPosto, idManutenzione) {
    this.isLoading = true;
    try {
      const response = await fetch(`/api/garage/garages-gestore/${idGarage}/posti/${idPosto}/manutenzione/${idManutenzione}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Errore durante la rimozione');
      return { success: true, message: data.message || 'Posto riaperto con successo' };
    } catch (err) {
      return { success: false, error: err.message || 'Errore di rete' };
    } finally {
      this.isLoading = false;
    }
  }
})