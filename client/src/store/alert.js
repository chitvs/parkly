import { reactive } from 'vue'

export const alertStore = reactive({
    messaggio: null,
    timeoutId: null,

    mostra(tipo, testo, durata = 5000) {
        // Pulisce eventuali timeout precedenti per evitare sovrapposizioni
        if (this.timeoutId) {
            clearTimeout(this.timeoutId)
        }

        this.messaggio = { tipo, testo }

        // Autochiusura opzionale (di default 5 secondi)
        if (durata > 0) {
            this.timeoutId = setTimeout(() => {
                this.pulisci()
            }, durata)
        }
    },

    pulisci() {
        this.messaggio = null
        
        // Pulisce eventuali timeout precedenti e stoppa il timeout in anticipo
        if (this.timeoutId) {
            clearTimeout(this.timeoutId)
            this.timeoutId = null
        }
    }
})