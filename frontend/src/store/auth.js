import { reactive } from 'vue'

export const authStore = reactive({
  utente: JSON.parse(localStorage.getItem('utente')) || null,
  setUtente(dati) {
    this.utente = dati;
    if (dati) localStorage.setItem('utente', JSON.stringify(dati));
    else localStorage.removeItem('utente');
  }
})