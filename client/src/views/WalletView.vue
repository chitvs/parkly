<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { authStore } from '../store/auth.js'
import { walletStore } from '../store/wallet.js'
import { alertStore } from '../store/alert.js'

import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'
import Pagination from '../components/Pagination.vue'
import 'bootstrap-icons/font/bootstrap-icons.css'

// Variabili per gestire gli stati di caricamento dei bottoni e delle tabelle
const isLoading = ref(false)
const isLoadingTransazioni = ref(false)
// Array locale per memorizzare la lista dei movimenti (storico)
const transazioni = ref([])

// Variabili per la paginazione delle transazioni
const paginaCorrente = ref(1)
const elementiPerPagina = ref(5)

// Computed property che recupera in modo reattivo il saldo dal profilo utente (nello store auth)
const saldoAttuale = computed(() => {
    return parseFloat(authStore.utente?.saldo || 0)
})

// Oggetto reattivo per memorizzare i dati del form di "Ricarica"
const formRicarica = reactive({
    titolare: '',
    numeroCarta: '',
    scadenza: '',
    cvv: '',
    importo: null
})

// Funzione asincrona per recuperare la lista delle transazioni dal backend
const fetchTransazioni = async () => {
    isLoadingTransazioni.value = true
    try {
        const response = await walletStore.getTransazioni()

        if (response.success && response.data) {
            // Mappiamo i dati per assicurarci che l'importo sia sempre un Float in javascript
            transazioni.value = response.data.map(tx => ({
                ...tx,
                importo: parseFloat(tx.importo)
            }))
        } else {
            transazioni.value = []
        }
    } catch (error) {
        console.error("Errore nel recupero delle transazioni:", error)
    } finally {
        isLoadingTransazioni.value = false
    }
}

// Al caricamento della pagina, esegui il fetch dello storico transazioni
onMounted(async () => {
    await fetchTransazioni()
})

// Computed property che taglia l'array delle transazioni in base alla pagina attuale
const transazioniPaginate = computed(() => {
    const inizio = (paginaCorrente.value - 1) * elementiPerPagina.value
    return transazioni.value.slice(inizio, inizio + elementiPerPagina.value)
})

// --- FUNZIONI DI FORMATTAZIONE DEGLI INPUT (Per migliorare la UX durante la digitazione) ---

// Formatta il nome del titolare della carta di credito
const formattaTitolare = () => {
    // Rimuove numeri e caratteri speciali, ammettendo lettere (anche accentate), spazi e apostrofi. Converte in Maiuscolo.
    formRicarica.titolare = formRicarica.titolare.replace(/[^a-zA-ZÀ-ÿ\s']/g, '').toUpperCase()
}

// Formatta l'intestatario del conto bancario
const formattaIntestatario = () => {
    // Rimuove numeri e caratteri non validi
    prelievoForm.intestatario = prelievoForm.intestatario.replace(/[^a-zA-ZÀ-ÿ\s']/g, '').toUpperCase()
}

// Formatta visivamente il numero di carta di credito inserendo uno spazio ogni 4 cifre
const formattaNumeroCarta = () => {
    let val = formRicarica.numeroCarta.replace(/\D/g, '') // Elimina tutto ciò che non è un numero
    val = val.replace(/(.{4})/g, '$1 ').trim() // Gruppi di 4 separati da spazio
    formRicarica.numeroCarta = val.substring(0, 19) // Blocca la lunghezza massima a 16 cifre + 3 spazi
}

// Formatta la scadenza della carta inserendo in automatico lo slash (MM/YY)
const formattaScadenza = () => {
    let val = formRicarica.scadenza.replace(/\D/g, '')
    if (val.length > 2) {
        val = val.substring(0, 2) + '/' + val.substring(2, 4)
    }
    formRicarica.scadenza = val.substring(0, 5) // Max 5 caratteri
}

// Forza il CVV ad essere esclusivamente numerico (max 4 caratteri per alcune carte come Amex)
const formattaCVV = () => {
    formRicarica.cvv = formRicarica.cvv.replace(/\D/g, '').substring(0, 4)
}

// Formatta i valori monetari (es. aggiunge il simbolo € e due decimali)
const formattaValuta = (valore) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(valore)
}

// Formatta le date delle transazioni per la tabella
const formattaData = (dataString) => {
    const opzioni = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    return new Date(dataString).toLocaleDateString('it-IT', opzioni)
}

// Limita l'importo della ricarica per evitare che superi i 1000 euro massimi consentiti
const limitaImporto = () => {
    // Se l'utente digita un numero maggiore di 1000, lo forziamo a 1000
    if (formRicarica.importo > 1000) {
        formRicarica.importo = 1000
    } else if (formRicarica.importo < 0) {
        formRicarica.importo = 0 // Impedisce numeri negativi
    }
}

// Limita l'importo del prelievo in modo che l'utente non superi il proprio saldo disponibile
const limitaImportoPrelievo = () => {
    // Se l'utente digita un numero maggiore del saldo attuale, lo forziamo al massimo disponibile
    if (prelievoForm.importo > saldoAttuale.value) {
        prelievoForm.importo = saldoAttuale.value
    } else if (prelievoForm.importo < 0) {
        prelievoForm.importo = 0
    }
}

// --- SUBMIT E VALIDAZIONI ---

// Gestisce la sottomissione del form di ricarica
const handleRicarica = async () => {
    alertStore.pulisci()

    // Validazione base: Importo minimo 5€
    if (formRicarica.importo < 5) {
        alertStore.mostra('error', "L'importo minimo per la ricarica è di 5,00€.")
        return
    }

    // Validazione base: Importo massimo 1000€
    if (formRicarica.importo > 1000) {
        alertStore.mostra('error', "Non puoi ricaricare più di 1.000,00€ in una singola transazione.")
        return
    }

    // Validazione Titolare: deve essere composto da almeno due parole (nome e cognome)
    const paroleTitolare = formRicarica.titolare.trim().split(/\s+/)
    if (paroleTitolare.length < 2) {
        alertStore.mostra('error', "Inserisci sia il nome che il cognome del titolare della carta.")
        return
    }

    // Validazione scadenza carta e logica di controllo date
    if (formRicarica.scadenza.length === 5) {
        const [meseStr, annoStr] = formRicarica.scadenza.split('/')

        // Controlliamo che mese e anno siano effettivamente numeri validi convertendoli in interi
        const numMese = parseInt(meseStr, 10)
        const numAnno = parseInt(annoStr, 10)

        // Un mese logico deve essere tra 1 e 12
        if (isNaN(numMese) || numMese < 1 || numMese > 12 || isNaN(numAnno)) {
            alertStore.mostra('error', "Mese o anno di scadenza non validi.")
            return
        }

        const dataOggi = new Date()
        const meseAttuale = dataOggi.getMonth() + 1 // in JS i mesi partono da 0
        // Prende le ultime due cifre dell'anno corrente (es. 2026 -> 26) 
        const annoAttuale = dataOggi.getFullYear() % 100

        // Controlla se la carta è scaduta basandosi sull'anno e mese attuali
        if (numAnno < annoAttuale || (numAnno === annoAttuale && numMese < meseAttuale)) {
            alertStore.mostra('error', "La carta inserita risulta scaduta.")
            return
        }
    } else {
        alertStore.mostra('error', "Formato della data di scadenza non valido.")
        return
    }

    // Se tutto è ok, procede con la simulazione di ricarica
    isLoading.value = true

    try {
        const response = await walletStore.ricaricaSaldo({
            importo: parseFloat(formRicarica.importo)
        })

        if (response.success) {
            alertStore.mostra('success', `Ricarica di ${formattaValuta(formRicarica.importo)} effettuata con successo!`)

            // Resetta i campi del form dopo il successo
            formRicarica.titolare = ''
            formRicarica.numeroCarta = ''
            formRicarica.scadenza = ''
            formRicarica.cvv = ''
            formRicarica.importo = null

            // Aggiorna la tabella delle transazioni
            await fetchTransazioni()
            paginaCorrente.value = 1 // Ritorna alla pagina 1
        } else {
            alertStore.mostra('error', response.error || "Errore durante la ricarica. Verifica i dati.")
        }
    } catch (error) {
        alertStore.mostra('error', "Errore imprevisto di rete.")
    } finally {
        isLoading.value = false
    }
}

// Tab attiva per scegliere tra 'ricarica' e 'prelievo'
const tabAttiva = ref('ricarica')

// Oggetto reattivo per memorizzare i dati del form di "Prelievo"
const prelievoForm = reactive({
    importo: null,
    metodo: 'Bonifico Bancario',
    intestatario: '',
    coordinate: ''
})

// Watcher sulla tab: se l'utente cambia schermata verso "prelievo" e non ha fondi, mostra un avviso
watch(tabAttiva, (nuovaTab) => {
    alertStore.pulisci()
    if (nuovaTab === 'prelievo' && saldoAttuale.value < 5) {
        alertStore.mostra('error', "Saldo insufficiente per richiedere un prelievo. Il minimo è di 5,00€.")
    }
})

// Formatta la visibilità dell'IBAN con gli spazi (se è selezionato bonifico)
const formattaCoordinate = () => {
    if (prelievoForm.metodo === 'Bonifico Bancario') {
        // Rimuove spazi e caratteri speciali, converte in maiuscolo
        let val = prelievoForm.coordinate.replace(/[^A-Z0-9]/ig, '').toUpperCase()
        // Aggiunge uno spazio ogni 4 caratteri
        val = val.replace(/(.{4})/g, '$1 ').trim()
        prelievoForm.coordinate = val.substring(0, 34) // Lunghezza max IBAN con spazi
    }
}

// Funzione per gestire l'invio del form di Prelievo
const handlePrelievo = async () => {
    alertStore.pulisci()

    // Validazione: Input di importo valido
    if (!prelievoForm.importo || prelievoForm.importo <= 0) {
        alertStore.mostra('error', "Inserisci un importo valido.")
        return
    }
    // Validazione: limite minimo stabilito a 5 euro
    if (prelievoForm.importo < 5) {
        alertStore.mostra('error', "L'importo minimo per il prelievo è di 5,00€.")
        return
    }
    // Validazione: Non superare la giacenza
    if (prelievoForm.importo > saldoAttuale.value) {
        alertStore.mostra('error', "Saldo insufficiente.")
        return
    }

    // Validazione coordinate mancanti
    if (!prelievoForm.coordinate.trim()) {
        alertStore.mostra('error', "Inserisci le coordinate per l'accredito.")
        return
    }

    if (prelievoForm.metodo === 'Bonifico Bancario') {
        // Validazione Intestatario Conto (almeno due parole: nome e cognome)
        const paroleIntestatario = prelievoForm.intestatario.trim().split(/\s+/)
        if (paroleIntestatario.length < 2) {
            alertStore.mostra('error', "Inserisci sia il nome che il cognome dell'intestatario del conto.")
            return
        }

        // Controllo regex dell'IBAN (deve iniziare con due lettere e avere numeri/lettere di lunghezza adeguata)
        const ibanRegex = /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/
        const ibanPulito = prelievoForm.coordinate.replace(/\s/g, '').toUpperCase() // Rimuove gli spazi per la regex
        if (!ibanRegex.test(ibanPulito)) {
            alertStore.mostra('error', "Formato IBAN non valido.")
            return
        }
    } else if (prelievoForm.metodo === 'PayPal') {
        // Controllo regex base per verificare che l'input sia una mail
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(prelievoForm.coordinate)) {
            alertStore.mostra('error', "Inserisci un indirizzo email PayPal valido.")
            return
        }
    }

    isLoading.value = true
    try {
        // Prepariamo una dicitura breve per la UI (per oscurare parzialmente l'IBAN o l'email nel database)
        let dicituraBreve = '';

        if (prelievoForm.metodo === 'Bonifico Bancario') {
            const ultimeCifre = prelievoForm.coordinate.slice(-4);
            dicituraBreve = `Bonifico (***${ultimeCifre})`;
        } else if (prelievoForm.metodo === 'PayPal') {
            const [nome, dominio] = prelievoForm.coordinate.split('@');
            // Cripta il nome della mail (es: mar***@dominio.it)
            const nomeMascherato = nome.length > 3 ? nome.substring(0, 3) + '***' : nome + '***';
            dicituraBreve = `PayPal (${nomeMascherato}@${dominio})`;
        }

        // Chiamata all'API passando importo e descrizione metodo criptato
        const response = await walletStore.prelevaFondi({
            importo: parseFloat(prelievoForm.importo),
            metodo: dicituraBreve
        })

        if (response.success) {
            alertStore.mostra('success', "Prelievo effettuato con successo.")
            // Reset form
            prelievoForm.importo = null
            prelievoForm.coordinate = ''
            await fetchTransazioni()
        } else {
            alertStore.mostra('error', response.error)
        }
    } catch (error) {
        alertStore.mostra('error', "Errore durante l'operazione.")
    } finally {
        isLoading.value = false
    }
}

</script>

<template>
    <div class="page-container">
        <Header />

        <main class="main-content">
            <section class="basic-hero centered-hero">
                <div class="hero-content">
                    <h1>Il tuo Portafoglio</h1>
                    <p class="descrizione">Gestisci il tuo saldo e visualizza le tue attività in modo semplice e veloce.
                    </p>

                    <div class="balance-container">
                        <span class="balance-label">Saldo Disponibile</span>
                        <h2 class="balance-amount">{{ formattaValuta(saldoAttuale) }}</h2>
                    </div>
                </div>
            </section>

            <div class="layout-grid wallet-grid">

                <div class="card shadow-sm">
                    <div class="card-tabs">
                        <button class="tab-btn" :class="{ active: tabAttiva === 'ricarica' }"
                            @click="tabAttiva = 'ricarica'">
                            Ricarica Saldo
                        </button>
                        <button class="tab-btn" :class="{ active: tabAttiva === 'prelievo' }"
                            @click="tabAttiva = 'prelievo'">
                            Preleva
                        </button>
                    </div>

                    <div class="card-body">
                        <form v-if="tabAttiva === 'ricarica'" @submit.prevent="handleRicarica">
                            <div class="form-group highlight-box">
                                <label>Importo da ricaricare (€)</label>
                                <input type="number" step="0.01" class="amount-input" v-model="formRicarica.importo"
                                    @input="limitaImporto" placeholder="es. 50.00" required>
                                <small class="hint-text">Min: 5,00 € | Max: 1.000,00 €</small>
                            </div>
                            <h3 class="section-subtitle">Dati Carta</h3>
                            <div class="form-group">
                                <label>Titolare della Carta</label>
                                <input type="text" v-model="formRicarica.titolare" @input="formattaTitolare"
                                    placeholder="MARIO ROSSI" required>
                            </div>
                            <div class="form-group">
                                <label>Numero della Carta</label>
                                <input type="text" class="font-monospace" v-model="formRicarica.numeroCarta"
                                    @input="formattaNumeroCarta" placeholder="0000 0000 0000 0000" required>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Scadenza</label>
                                    <input type="text" class="text-center font-monospace"
                                        v-model="formRicarica.scadenza" @input="formattaScadenza" placeholder="MM/YY"
                                        required>
                                </div>
                                <div class="form-group">
                                    <label>CVV</label>
                                    <input type="text" class="text-center font-monospace" v-model="formRicarica.cvv"
                                        @input="formattaCVV" placeholder="123" required>
                                </div>
                            </div>
                            <button type="submit" class="btn fill w-100" :disabled="isLoading">
                                {{ isLoading ? 'Elaborazione...' : 'Conferma Ricarica' }}
                            </button>
                        </form>

                        <form v-else-if="tabAttiva === 'prelievo'" @submit.prevent="handlePrelievo">

                            <div class="form-group highlight-box">
                                <label>Importo da prelevare (€)</label>
                                <input type="number" step="0.01" min="5" class="amount-input"
                                    v-model.number="prelievoForm.importo" :max="saldoAttuale"
                                    @input="limitaImportoPrelievo" placeholder="es. 50.00" required>
                                <small class="hint-text">Disponibile: {{ formattaValuta(saldoAttuale) }}</small>
                            </div>

                            <h3 class="section-subtitle">Dati Accredito</h3>

                            <div class="form-group">
                                <label>Metodo di Accredito</label>
                                <select v-model="prelievoForm.metodo" required>
                                    <option value="Bonifico Bancario">Bonifico Bancario (IBAN)</option>
                                    <option value="PayPal">PayPal (Email)</option>
                                </select>
                            </div>

                            <div class="form-group" v-if="prelievoForm.metodo === 'Bonifico Bancario'">
                                <label>Intestatario del Conto</label>
                                <input type="text" v-model="prelievoForm.intestatario" @input="formattaIntestatario"
                                    placeholder="MARIO ROSSI" required>
                            </div>

                            <div class="form-group">
                                <label>{{ prelievoForm.metodo === 'PayPal' ? 'Email PayPal' : 'Codice IBAN' }}</label>
                                <input type="text" class="font-monospace" v-model="prelievoForm.coordinate"
                                    @input="formattaCoordinate"
                                    :placeholder="prelievoForm.metodo === 'PayPal' ? 'mario.rossi@email.it' : 'IT00 A000 0000 0000 0000 0000 000'"
                                    required>
                            </div>

                            <button type="submit" class="btn fill w-100" :disabled="isLoading || saldoAttuale < 5">
                                {{ isLoading ? 'Elaborazione...' : 'Conferma Prelievo' }}
                            </button>

                        </form>
                    </div>
                </div>

                <div class="card shadow-sm d-flex-col">
                    <div class="card-header">
                        <h2>Attività Recenti</h2>
                    </div>
                    <div class="card-body flex-grow d-flex-col">

                        <div v-if="isLoadingTransazioni" class="msg-box">
                            Caricamento transazioni...
                        </div>

                        <div v-else-if="transazioni.length === 0" class="msg-box">
                            Nessuna transazione recente.
                        </div>

                        <div v-else class="transactions-wrapper">
                            <div class="transaction-list">
                                <div v-for="tx in transazioniPaginate" :key="tx.id" class="transaction-item">
                                    <div class="tx-left">
                                        <div class="tx-icon" :class="{
                                            'icon-in': tx.importo > 0 && tx.tipo !== 'INCASSO_SOSPESO',
                                            'icon-out': tx.importo < 0,
                                            'icon-pending': tx.tipo === 'INCASSO_SOSPESO'
                                        }">
                                            <i v-if="tx.tipo === 'INCASSO_SOSPESO'" class="bi bi-clock-history"
                                                style="translate: 1.3px;"></i>
                                            <template v-else>{{ tx.importo > 0 ? '↓' : '↑' }}</template>
                                        </div>

                                        <div class="tx-info">
                                            <strong class="tx-desc">{{ tx.descrizione }}</strong>
                                            <small class="tx-date">{{ formattaData(tx.data) }}</small>
                                        </div>
                                    </div>

                                    <div class="tx-amount" :class="{
                                        'text-success': tx.importo > 0 && tx.tipo !== 'INCASSO_SOSPESO',
                                        'text-danger': tx.importo < 0,
                                        'text-pending': tx.tipo === 'INCASSO_SOSPESO'
                                    }">
                                        {{ tx.importo > 0 ? '+' : '' }}{{ formattaValuta(tx.importo) }}
                                    </div>
                                </div>
                            </div>

                            <div v-if="transazioni.length > 0" class="mt-3 d-flex justify-content-center">
                                <Pagination compact v-model:paginaCorrente="paginaCorrente"
                                    v-model:elementiPerPagina="elementiPerPagina"
                                    :totaleElementi="transazioni.length" />
                            </div>

                        </div>

                    </div>
                </div>

            </div>
        </main>

        <Footer />
    </div>
</template>

<style scoped>
:root {
    --primary-blue: #00408A;
    --deep-blue: #042571;
    --border-light: #e0e0e0;
    --text-dark: #333;
    --white: #ffffff;
}

.page-container {
    background: #ffffff;
    min-height: 100vh;
    font-family: 'Inter', -apple-system, sans-serif;
    display: flex;
    flex-direction: column;
}

.main-content {
    flex-grow: 1;
}

.basic-hero.centered-hero {
    background: radial-gradient(circle at center, #002d5e 0%, #001D3D 100%);
    color: var(--white, #fff);
    padding: 56px 20px 48px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.centered-hero h1 {
    font-size: 2.2rem;
    font-weight: 700;
    margin: 0 0 8px;
    letter-spacing: -0.5px;
}

.centered-hero .descrizione {
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.8);
    max-width: 500px;
    margin: 0 auto 32px;
    line-height: 1.5;
}

.balance-container {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 24px 48px;
    border-radius: 16px;
    display: inline-block;
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.balance-label {
    display: block;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 8px;
}

.balance-amount {
    margin: 0;
    font-size: 3.5rem;
    font-weight: 800;
    line-height: 1;
    color: #fff;
    letter-spacing: -1px;
}

.alert {
    max-width: 1200px;
    margin: 16px auto 0;
}

.layout-grid.wallet-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 20px;
    max-width: 1200px;
    margin: 32px auto;
    padding: 0 32px 48px;
    align-items: stretch;
}

@media (max-width: 800px) {
    .layout-grid.wallet-grid {
        grid-template-columns: 1fr;
        padding: 0 16px 32px;
    }

    .balance-amount {
        font-size: 2.5rem;
    }

    .balance-container {
        padding: 20px 32px;
    }
}

.card {
    background: white;
    border-radius: 10px;
    border: 0.5px solid var(--border-light, #e0e0e0);
    overflow: hidden;
    display: flex;
    flex-direction: column;
}

.shadow-sm {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.card-header {
    padding: 14px 20px;
    border-bottom: 0.5px solid #f0f0f0;
}

.card-header h2 {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #888;
}

.card-body {
    padding: 24px 20px;
}

.section-subtitle {
    font-size: 0.85rem;
    font-weight: 600;
    color: #555;
    margin: 20px 0 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #f0f0f0;
}

.form-group {
    margin-bottom: 14px;
}

.form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.form-group label {
    display: block;
    margin-bottom: 6px;
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #888;
}

.form-group input,
.form-group select {
    width: 100%;
    padding: 10px 12px;
    border: 0.5px solid var(--border-light, #e0e0e0);
    border-radius: 7px;
    font-size: 0.9rem;
    color: var(--text-dark, #333);
    background: #fafafa;
    box-sizing: border-box;
    outline: none;
    transition: all 0.2s;
}

.form-group input:focus,
.form-group select:focus {
    border-color: var(--primary-blue, #00408A);
    background: white;
    box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.08);
}

.highlight-box {
    background: #f4f7fb;
    padding: 16px;
    border-radius: 8px;
    border: 1px dashed #c0d3e8;
}

.amount-input {
    font-size: 1.2rem !important;
    font-weight: bold;
    color: var(--primary-blue, #00408A) !important;
}

.hint-text {
    font-size: 0.75rem;
    color: #777;
    margin-top: 6px;
    display: block;
}

.font-monospace {
    font-family: 'Courier New', Courier, monospace;
    letter-spacing: 1px;
}

.btn {
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
    font-family: inherit;
}

.btn.fill {
    background: var(--primary-blue, #00408A);
    color: white;
}

.btn.fill:hover {
    background: var(--deep-blue, #042571);
}

.btn.fill:disabled {
    background: #ccc;
    cursor: not-allowed;
}

.w-100 {
    width: 100%;
}

.d-flex-col {
    display: flex;
    flex-direction: column;
}

.flex-grow {
    flex-grow: 1;
}

.d-flex {
    display: flex;
}

.justify-content-center {
    justify-content: center;
}

.mt-3 {
    margin-top: 1rem;
}

.msg-box {
    text-align: center;
    padding: 40px;
    color: #aaa;
    font-size: 0.9rem;
}

.transactions-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    justify-content: space-between;
}

.transaction-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.transaction-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 12px 14px;
    background: #fff;
    border: 1px solid #eee;
    border-radius: 8px;
    transition: background 0.2s;
}

.transaction-item:hover {
    background: #fdfdfd;
    border-color: #e0e0e0;
}

.tx-left {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.tx-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.1rem;
    flex-shrink: 0;
}

.icon-in {
    background-color: #e8f5e9;
    color: #2e7d32;
}

.icon-out {
    background-color: #ffebee;
    color: #c62828;
}

.tx-info {
    display: flex;
    flex-direction: column;
    padding-top: 2px;
}

.tx-desc {
    font-size: 0.9rem;
    color: #333;
    line-height: 1.3;
    word-break: break-word;
    padding-right: 12px;
}

.tx-date {
    font-size: 0.75rem;
    color: #888;
    margin-top: 4px;
}

.tx-amount {
    font-weight: 700;
    font-size: 0.95rem;
    white-space: nowrap;
    padding-top: 2px;
}

.text-success {
    color: #2e7d32;
}

.text-danger {
    color: #c62828;
}

.card-tabs {
    display: flex;
    background: #f1f1f1;
    border-bottom: 0.5px solid #e0e0e0;
}

.tab-btn {
    flex: 1;
    padding: 14px;
    border: none;
    background: none;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #888;
    cursor: pointer;
    transition: all 0.2s;
}

.tab-btn.active {
    background: white;
    color: var(--primary-blue);
    border-bottom: 2px solid var(--primary-blue);
}

.icon-pending {
    background-color: #FFF4E5;
    color: #FF9800;
}

.text-pending {
    color: #e98c00 !important;
}
</style>