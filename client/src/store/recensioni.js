import { reactive } from 'vue'

export const recensioniStore = reactive({
  
  // Invia una nuova recensione al server
  async postReview(reviewData) {
    try {
      const response = await fetch('/api/recensioni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(reviewData)
      });
      
      return await response.json();
    } catch (error) {
      console.error("Errore invio recensione:", error);
      return { success: false, error: "Errore di connessione al server" };
    }
  }

})