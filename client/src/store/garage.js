/**
 * --- GARAGE STORE ---
 * Gestisce l'intero dominio dei Garage.
 * E' suddiviso in:
 *  1. LATO CLIENTE: Ricerca, visualizzazione dettagli, mappa posti e prenotazione.
 *  2. LATO GESTORE: Creazione/modifica garage, statistiche dashboard, manutenzioni.
 * ============================================================================
 */

import { reactive, markRaw } from 'vue'
import { apiFetch } from '../utils/apiClient'

export const garageStore = reactive({
  // --- STATI CLIENT ---
  currentGarage: null,
  posti: [],
  recensioni: [],

  // --- STATI GESTORE ---
  mieiGarage: [],
  postiPerGarage: {},
  occupazioneGarage: {},
  idGarageSelezionato: 'TUTTI',

  // --- STATI CONDIVISI ---
  isLoading: false,


  // AZIONI LATO CLIENTE

  // Pulisice lo stato per evitare sfarfallii causati da dati vecchi quando si passa da un garage all'altro
  clearGarageData() {
    this.currentGarage = null
    this.posti = []
    this.recensioni = []
  },

  async fetchGarage(id) {
    this.isLoading = true
    try {
      const response = await apiFetch(`/api/garage/${id}`)
      const data = await response.json()
      if (data.success) this.currentGarage = markRaw(data.garage)
      return data
    } catch (err) {
      return { success: false, error: 'Errore di rete' }
    } finally {
      this.isLoading = false
    }
  },

  // Reucpera i posti del garage con id
  // N.B. : se forniti inizio e fine i posti vengono anche filtrati restituendo solo quelli disponibili per la prenotazione
  async fetchPosti(id, inizio, fine) {
    try {
      let url = `/api/garage/${id}/posti`;
      if (inizio && fine) {
        url += `?inizio=${inizio}&fine=${fine}`;
      }
      const response = await apiFetch(url)
      const data = await response.json()
      if (data.success) this.posti = markRaw(data.posti)
      return data
    } catch (err) {
      return { success: false, error: 'Impossibile caricare la mappa' }
    }
  },

  // Recupera le recensioni per il determinato garage. 
  async fetchRecensioni(id) {
    try {
      const response = await apiFetch(`/api/garage/${id}/recensioni`)
      const data = await response.json()
      if (data.success) {
        this.recensioni = markRaw(data.recensioni)
      }
    } catch (err) {
      console.error('Impossibile caricare le recensioni', err)
    }
  },

  // Metoto per prenotare un posto
  async prenota(payload) {
    try {
      const response = await apiFetch('/api/prenotazioni', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      return await response.json()
    } catch (err) {
      return { success: false, error: 'Errore durante la prenotazione' }
    }
  },


  // AZIONI LATO GESTORE ---

  // Reucper i garage posseduti dal gestore
  async fetchGaragesGestore() {
    this.isLoading = true;
    try {
      const response = await apiFetch('/api/garage/garages-gestore');
      const data = await response.json();
      return { success: response.ok, data };
    } catch (err) {
      console.error("Errore fetch garages gestore:", err);
      return { success: false, error: 'Errore di rete' };
    } finally {
      this.isLoading = false;
    }
  },

  // Ritorna la percentuale dei posti occupati
  async fetchOccupazione(id) {
    try {
      const response = await apiFetch(`/api/garage/${id}/occupazione`);
      const data = await response.json();
      return { success: response.ok, percentuale: data.percentuale };
    } catch (err) {
      console.error(`Errore fetch occupazione garage ${id}:`, err);
      return { success: false, percentuale: 0 };
    }
  },

  // Aggiorna i dati locali per il garage selezioanto
  setGarageSelezionato(id) {
    this.idGarageSelezionato = id;
  },

  // Carica la dashboard del gestore, in particolare popolando i vari campi in base al garage selezionato
  async caricaDashboardGestore() {
    this.isLoading = true;
    try {
      const res = await this.fetchGaragesGestore();
      if (!res.success) return { success: false };

      this.mieiGarage = markRaw(res.data);

      // Di default vengono mostrati tutti i garage
      if (this.idGarageSelezionato !== 'TUTTI') {
        const esisteAncora = this.mieiGarage.some(g => Number(g.id_garage) === Number(this.idGarageSelezionato));
        if (!esisteAncora) {
          this.idGarageSelezionato = 'TUTTI';
        }
      }

      // Variabili temporanee
      const nuoviPosti = {};
      const nuovaOccupazione = {};

      // Vengono eseguite le richieste in parallelo per ottimizzare i tempi
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

      // Aggiornamento locale dei nuovi risultati
      this.postiPerGarage = nuoviPosti;
      this.occupazioneGarage = nuovaOccupazione;

      return { success: true };
    } finally {
      this.isLoading = false;
    }
  },

  // Utlizzato dal gestore per creare un nuovo garage
  async createGarage(payload) {
    this.isLoading = true;
    try {
      const res = await apiFetch('/api/garage/garages-gestore', {
        method: 'POST',
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

  // Utilizzato per modificare i dati del garage selezionato
  async updateGarage(id, garageData) {
    this.isLoading = true
    try {
      const response = await apiFetch(`/api/garage/garages-gestore/${id}`, {
        method: 'PUT',
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

  async uploadPhotos(idGarage, formData) {
    this.isLoading = true;
    try {
      const response = await apiFetch(`/api/garage/${idGarage}/upload-photos`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Errore durante l'upload delle foto");
      return { success: true, urls: data.urls };
    } catch (err) {
      return { success: false, error: err.message || 'Errore di rete' };
    } finally {
      this.isLoading = false;
    }
  },

  // Utilizzata per simulare la mappa dei posti 
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

  // Permette di mettere un posto in manutenzione e quindi bloccarlo per evitare nuove prenotazioni.
  async addMaintenance(idGarage, idPosto, maintenanceData) {
    this.isLoading = true
    try {
      const response = await apiFetch(`/api/garage/garages-gestore/${idGarage}/posti/${idPosto}/manutenzione`, {
        method: 'POST',
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

  // Sblocca un posto in manutenzione rendendolo nuovamente disponibile per la prenotazione. 
  async removeMaintenance(idGarage, idPosto, idManutenzione) {
    this.isLoading = true;
    try {
      const response = await apiFetch(`/api/garage/garages-gestore/${idGarage}/posti/${idPosto}/manutenzione/${idManutenzione}`, {
        method: 'DELETE',
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