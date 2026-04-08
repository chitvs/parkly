import { reactive } from 'vue'

export const authStore = reactive({
  utente: null,
  isInitialized: false,

  
  // Funzione centralizzata per il SET dell'utente
  setUtente(dati) {
    this.utente = dati;
    if (dati) 
      localStorage.setItem('utente', JSON.stringify(dati));
    else 
      localStorage.removeItem('utente');
  },
  
  // Verifica se la sessione server sia ancora valida
  async checkAuth() {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        this.setUtente(data.utente);
      } else {
        this.setUtente(null);
      }
    } catch (err) {
      console.error("Errore verifica auth:", err);
      this.setUtente(null);
    } finally {
      this.isInitialized = true;
    }
  },

  // Logica Login centralizzata
  async login(email, password) {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.message || "Credenziali errate" };
      }
      
      const data = await response.json();
      if (data.success) {
        this.setUtente(data.utente);
      }
      return data; // Restituiamo il risultato al componente per gestire i messaggi/errori
    } catch (err) {
      console.error("Errore di rete durante il login:", err);
      return { success: false, error: "Errore di connessione" };
    }
  },

  // Logica Registrazione centralizzata
  async register(payload) {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success && data.utente) {
        this.setUtente(data.utente);
      }
      return data;
    } catch (err) {
      console.error("Errore durante la registrazione:", err);
      return { success: false, error: "Errore di connessione" };
    }
  },

// chiamo API per ricevere dati:
async getProfile() {
  try {
    // Assicurati che credenziali/cookie vengano inviati per leggere la sessione
    const response = await fetch('/api/auth/profile', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include' // <-- FONDAMENTALE per far funzionare le sessioni Express
    });
    
    return await response.json();
  } catch (error) {
    console.error("Errore fetch profilo:", error);
    return { success: false };
  }
},

// Logica Logout completa
  async logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error("Errore durante il logout lato server:", err);
    } finally {
      this.setUtente(null);
    }
  }
})