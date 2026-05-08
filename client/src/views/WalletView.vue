<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { authStore } from '../store/auth.js'
import { walletStore } from '../store/wallet.js'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'
import 'bootstrap-icons/font/bootstrap-icons.css'

const isLoading = ref(false)
const isLoadingTransazioni = ref(false)
const transazioni = ref([])
const messaggio = ref(null)

// paginazione
const paginaCorrente = ref(1)
const elementiPerPagina = 5

const saldoAttuale = computed(() => {
    return parseFloat(authStore.utente?.saldo || 0)
})

const formRicarica = reactive({
    titolare: '',
    numeroCarta: '',
    scadenza: '',
    cvv: '',
    importo: null
})

const fetchTransazioni = async () => {
    isLoadingTransazioni.value = true
    try {
        const response = await walletStore.getTransazioni()

        if (response.success && response.data) {
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

onMounted(async () => {
    await fetchTransazioni()
})

const transazioniPaginate = computed(() => {
    const inizio = (paginaCorrente.value - 1) * elementiPerPagina
    return transazioni.value.slice(inizio, inizio + elementiPerPagina)
})

const totalePagine = computed(() => Math.ceil(transazioni.value.length / elementiPerPagina))

const cambiaPagina = (pag) => {
    if (pag >= 1 && pag <= totalePagine.value) {
        paginaCorrente.value = pag
    }
}

// formattazione
const formattaTitolare = () => {
    // rimuove numeri e caratteri non validi, mantiene lettere (anche accentate), spazi e apostrofi. Converte in Maiuscolo.
    formRicarica.titolare = formRicarica.titolare.replace(/[^a-zA-ZÀ-ÿ\s']/g, '').toUpperCase()
}

const formattaNumeroCarta = () => {
    let val = formRicarica.numeroCarta.replace(/\D/g, '')
    val = val.replace(/(.{4})/g, '$1 ').trim()
    formRicarica.numeroCarta = val.substring(0, 19)
}

const formattaScadenza = () => {
    let val = formRicarica.scadenza.replace(/\D/g, '')
    if (val.length > 2) {
        val = val.substring(0, 2) + '/' + val.substring(2, 4)
    }
    formRicarica.scadenza = val.substring(0, 5)
}

const formattaCVV = () => {
    formRicarica.cvv = formRicarica.cvv.replace(/\D/g, '').substring(0, 4)
}

const formattaValuta = (valore) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(valore)
}

const formattaData = (dataString) => {
    const opzioni = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    return new Date(dataString).toLocaleDateString('it-IT', opzioni)
}

const limitaImporto = () => {
    // se l'utente digita un numero maggiore di 1000, lo forziamo a 1000
    if (formRicarica.importo > 1000) {
        formRicarica.importo = 1000
    }
}

// submit e validazioni
const handleRicarica = async () => {
    messaggio.value = null

    // validazione Importo
    if (formRicarica.importo < 5) {
        messaggio.value = { tipo: 'error', testo: "L'importo minimo per la ricarica è di 5,00€." }
        return
    }

    if (formRicarica.importo > 1000) {
        messaggio.value = { tipo: 'error', testo: "Non puoi ricaricare più di 1.000,00€ in una singola transazione." }
        return
    }

    // validazione Titolare (almeno due parole)
    const paroleTitolare = formRicarica.titolare.trim().split(/\s+/)
    if (paroleTitolare.length < 2) {
        messaggio.value = { tipo: 'error', testo: "Inserisci sia il nome che il cognome del titolare della carta." }
        return
    }

    // validazione scadenza carta
    if (formRicarica.scadenza.length === 5) {
        const [meseStr, annoStr] = formRicarica.scadenza.split('/')

        // controlliamo che mese e anno siano effettivamente numeri validi
        const numMese = parseInt(meseStr, 10)
        const numAnno = parseInt(annoStr, 10)

        // un mese deve essere tra 1 e 12
        if (isNaN(numMese) || numMese < 1 || numMese > 12 || isNaN(numAnno)) {
            messaggio.value = { tipo: 'error', testo: "Mese o anno di scadenza non validi." }
            return
        }

        const dataOggi = new Date()
        const meseAttuale = dataOggi.getMonth() + 1 // i mesi in JS partono da 0
        // prendi le ultime due cifre dell'anno corrente e convertile in numero in modo sicuro
        const annoAttuale = dataOggi.getFullYear() % 100

        // controlla se l'anno è passato, oppure se è l'anno corrente ma il mese è passato
        if (numAnno < annoAttuale || (numAnno === annoAttuale && numMese < meseAttuale)) {
            messaggio.value = { tipo: 'error', testo: "La carta inserita risulta scaduta." }
            return
        }
    } else {
        messaggio.value = { tipo: 'error', testo: "Formato della data di scadenza non valido." }
        return
    }

    // se tutto è ok, procede con la ricarica
    isLoading.value = true

    try {
        const response = await walletStore.ricaricaSaldo({
            importo: parseFloat(formRicarica.importo)
        })

        if (response.success) {
            messaggio.value = { tipo: 'success', testo: `Ricarica di ${formattaValuta(formRicarica.importo)} effettuata con successo!` }

            formRicarica.titolare = ''
            formRicarica.numeroCarta = ''
            formRicarica.scadenza = ''
            formRicarica.cvv = ''
            formRicarica.importo = null

            await fetchTransazioni()
            paginaCorrente.value = 1
        } else {
            messaggio.value = { tipo: 'error', testo: response.error || "Errore durante la ricarica. Verifica i dati." }
        }
    } catch (error) {
        messaggio.value = { tipo: 'error', testo: "Errore imprevisto di rete." }
    } finally {
        isLoading.value = false
    }
}

// Aggiungi queste variabili reattive
const tabAttiva = ref('ricarica') // 'ricarica' o 'prelievo'
const prelievoForm = reactive({
    importo: null,
    metodo: 'Bonifico Bancario',
    coordinate: '' // IBAN o Email PayPal
})

// Funzione per gestire il prelievo
const handlePrelievo = async () => {
    messaggio.value = null

    if (!prelievoForm.importo || prelievoForm.importo <= 0) {
        messaggio.value = { tipo: 'error', testo: "Inserisci un importo valido." }
        return
    }
    if (prelievoForm.importo < 5) {
        messaggio.value = { tipo: 'error', testo: "L'importo minimo per il prelievo è di 5,00€." }
        return
    }
    if (prelievoForm.importo > saldoAttuale.value) {
        messaggio.value = { tipo: 'error', testo: "Saldo insufficiente." }
        return
    }

    if (!prelievoForm.coordinate.trim()) {
        messaggio.value = { tipo: 'error', testo: "Inserisci le coordinate per l'accredito." }
        return
    }

    if (prelievoForm.metodo === 'Bonifico Bancario') {
        const ibanRegex = /^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/
        const ibanPulito = prelievoForm.coordinate.replace(/\s/g, '').toUpperCase()
        if (!ibanRegex.test(ibanPulito)) {
            messaggio.value = { tipo: 'error', testo: "Formato IBAN non valido." }
            return
        }
    } else if (prelievoForm.metodo === 'PayPal') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(prelievoForm.coordinate)) {
            messaggio.value = { tipo: 'error', testo: "Inserisci un indirizzo email PayPal valido." }
            return
        }
    }

    isLoading.value = true
    try {
        const response = await walletStore.prelevaFondi({
            importo: parseFloat(prelievoForm.importo),
            metodo: `${prelievoForm.metodo}: ${prelievoForm.coordinate}`
        })

        if (response.success) {
            messaggio.value = { tipo: 'success', testo: "Richiesta di prelievo inviata con successo." }
            prelievoForm.importo = null
            prelievoForm.coordinate = ''
            await fetchTransazioni()
        } else {
            messaggio.value = { tipo: 'error', testo: response.error }
        }
    } catch (error) {
        messaggio.value = { tipo: 'error', testo: "Errore durante l'operazione." }
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

            <div v-if="messaggio" :class="['alert', messaggio.tipo]">
                {{ messaggio.testo }}
                <button @click="messaggio = null" class="close-btn">x</button>
            </div>

            <div class="layout-grid wallet-grid">

                <div class="card shadow-sm">
                    <div class="card-tabs">
                        <button class="tab-btn" :class="{ active: tabAttiva === 'ricarica' }"
                            @click="tabAttiva = 'ricarica'">
                            Ricarica Saldo
                        </button>
                        <button class="tab-btn" :class="{ active: tabAttiva === 'prelievo' }"
                            @click="tabAttiva = 'prelievo'">
                            Preleva Saldo
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

                            <!-- Avviso saldo insufficiente -->
                            <div v-if="saldoAttuale < 5" class="info-prelievo"
                                style="border-left: 3px solid #c62828; color: #c62828; background: #fff5f5;">
                                Saldo insufficiente per richiedere un prelievo. Il minimo è di 5,00€.
                            </div>

                            <div class="form-group highlight-box-alt">
                                <label>Importo da prelevare (€)</label>
                                <input type="number" step="0.01" class="amount-input-alt" v-model="prelievoForm.importo"
                                    :max="saldoAttuale" placeholder="0.00" required>
                                <small class="hint-text">Disponibile: {{ formattaValuta(saldoAttuale) }}</small>
                            </div>

                            <div class="form-group mt-3">
                                <label>Metodo di Accredito</label>
                                <select class="form-input-select" v-model="prelievoForm.metodo">
                                    <option value="Bonifico Bancario">Bonifico Bancario (IBAN)</option>
                                    <option value="PayPal">PayPal (Email)</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label>{{ prelievoForm.metodo === 'PayPal' ? 'Email PayPal' : 'Codice IBAN' }}</label>
                                <input type="text" v-model="prelievoForm.coordinate"
                                    :placeholder="prelievoForm.metodo === 'PayPal' ? 'email@esempio.it' : 'IT00X00000...'"
                                    required>
                            </div>

                            <!-- Tasto sempre attivo, la validazione avviene al submit -->
                            <button type="submit" class="btn btn-success-fill w-100" :disabled="isLoading">
                                {{ isLoading ? 'Trasferimento in corso...' : 'Invia Richiesta di Prelievo' }}
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
                                            <i v-if="tx.tipo === 'INCASSO_SOSPESO'" class="bi bi-clock-history" style="translate: 1.3px;"></i>
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

                            <div class="pagination-horizontal" v-if="totalePagine > 1">
                                <button class="page-btn" :disabled="paginaCorrente === 1"
                                    @click="cambiaPagina(paginaCorrente - 1)">«</button>

                                <div class="page-numbers">
                                    <span v-for="p in totalePagine" :key="p" class="page-dot"
                                        :class="{ active: paginaCorrente === p }" @click="cambiaPagina(p)">{{ p
                                        }}</span>
                                </div>

                                <button class="page-btn" :disabled="paginaCorrente === totalePagine"
                                    @click="cambiaPagina(paginaCorrente + 1)">»</button>
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
    --bg-light: #f8f9fa;
    --text-dark: #333;
    --white: #ffffff;
}

.page-container {
    background: var(--bg-light, #f8f9fa);
    min-height: 100vh;
    font-family: 'Inter', -apple-system, sans-serif;
    display: flex;
    flex-direction: column;
}

.main-content {
    flex-grow: 1;
}

.basic-hero.centered-hero {
    background: var(--primary-blue, #00408A);
    background: linear-gradient(135deg, #00408A 0%, #042571 100%);
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
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 0.85rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.alert.success {
    background: #d4edda;
    color: #155724;
    border: 1px solid #c3e6cb;
}

.alert.error {
    background: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
}

.close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    opacity: 0.4;
    font-size: 1.1rem;
    line-height: 1;
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

.form-group input {
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

.form-group input:focus {
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

.pagination-horizontal {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #f0f0f0;
}

.page-btn {
    background: none;
    border: 1px solid #eee;
    border-radius: 6px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #555;
    font-weight: bold;
    transition: 0.2s;
}

.page-btn:hover:not(:disabled) {
    background: #f4f7fb;
    border-color: #c0d3e8;
    color: var(--primary-blue, #00408A);
}

.page-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.page-numbers {
    display: flex;
    gap: 6px;
}

.page-dot {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    color: #666;
    cursor: pointer;
    transition: 0.2s;
}

.page-dot:hover {
    background: #f0f0f0;
}

.page-dot.active {
    background: var(--primary-blue, #00408A);
    color: white;
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

.highlight-box-alt {
    background: #e8f5e9;
    padding: 16px;
    border-radius: 8px;
    border: 1px dashed #27ae60;
}

.amount-input-alt {
    width: 100%;
    background: transparent;
    border: none;
    font-size: 1.2rem;
    font-weight: bold;
    color: #2e7d32;
    outline: none;
}

.form-input-select {
    width: 100%;
    padding: 10px;
    border-radius: 7px;
    border: 1px solid #ddd;
    background: #fafafa;
}

.btn-success-fill {
    background: #27ae60;
    color: white;
    margin-top: 10px;
}

.btn-success-fill:hover:not(:disabled) {
    background: #219150;
}

.info-prelievo {
    font-size: 0.75rem;
    color: #666;
    margin: 15px 0;
    padding: 10px;
    background: #f9f9f9;
    border-radius: 6px;
}


/* Assicurati che .tx-icon sia configurato così per la centratura perfetta */
.tx-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    flex-shrink: 0;
    line-height: 0; /* Impedisce che l'altezza del testo sballi l'icona */
}

.tx-icon i {
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
}

.icon-pending {
    background-color: #FFF4E5;
    color: #FF9800;
}

.text-pending {
    color: #e98c00 !important;
}

</style>