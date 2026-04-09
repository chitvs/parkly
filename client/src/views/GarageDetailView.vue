<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { garageStore } from '../store/garage'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'
import PlanimetriaGarage from '../components/PlanimetriaGarage.vue'

const route = useRoute()
const props = defineProps(['id'])
const checkIn = ref(route.query.inizio || '')
const checkOut = ref(route.query.fine || '')
const targa = ref('')
const postoSelezionato = ref(null)
const messaggio = ref(null)
const isMapConfirmed = ref(false)

onMounted(async () => {
    garageStore.clearGarageData()
    await garageStore.fetchGarage(Number(props.id))
    await garageStore.fetchPosti(props.id, '', '')

    if (checkIn.value && checkOut.value) {
        await aggiornaMappa()
    }
})

watch([checkIn, checkOut], () => {
    isMapConfirmed.value = false
    postoSelezionato.value = null
})

const aggiornaMappa = async () => {
    if (!checkIn.value || !checkOut.value) {
        alert('Inserisci data di arrivo e partenza prima di controllare.')
        return
    }

    const dataArrivo = new Date(checkIn.value)
    const dataPartenza = new Date(checkOut.value)
    const adesso = new Date()

    if (dataArrivo < adesso) {
        alert('Non puoi prenotare per un orario passato.')
        return
    }

    if (dataPartenza <= dataArrivo) {
        alert('L\'orario di partenza deve essere successivo a quello di arrivo.')
        return
    }

    await garageStore.fetchPosti(props.id, checkIn.value, checkOut.value)
    isMapConfirmed.value = true
    postoSelezionato.value = null
    messaggio.value = null
}

const resetSelezione = async () => {
    checkIn.value = ''
    checkOut.value = ''
    targa.value = ''
    postoSelezionato.value = null
    messaggio.value = null
    isMapConfirmed.value = false

    await garageStore.fetchPosti(props.id, '', '')
}

const prezzoTotale = computed(() => {
    if (!checkIn.value || !checkOut.value || !postoSelezionato.value) return 0
    const ore = (new Date(checkOut.value) - new Date(checkIn.value)) / (1000 * 60 * 60)
    return ore > 0 ? (ore * postoSelezionato.value.tariffaoraria).toFixed(2) : 0
})

const durataOre = computed(() => {
    if (!checkIn.value || !checkOut.value) return 0
    const ore = (new Date(checkOut.value) - new Date(checkIn.value)) / (1000 * 60 * 60)
    return ore > 0 ? ore.toFixed(1) : 0
})

const gestisciPrenotazione = async () => {
    if (!postoSelezionato.value) return

    const payload = {
        id_posto: postoSelezionato.value.id_posto,
        targa: targa.value,
        inizio: checkIn.value,
        fine: checkOut.value,
        prezzo_totale: prezzoTotale.value
    }

    const res = await garageStore.prenota(payload)
    if (res.success) {
        messaggio.value = { tipo: 'success', testo: `Prenotazione effettuata! Codice: ${res.prenotazione.CodicePrenotazione}` }
        postoSelezionato.value = null
        targa.value = ''
        await aggiornaMappa()
    } else {
        messaggio.value = { tipo: 'error', testo: res.error || 'Errore durante la prenotazione' }
    }
}
</script>

<template>
    <div class="page-container">
        <Header />

        <main v-if="garageStore.isLoading" class="msg-box">Caricamento...</main>
        <main v-else-if="!garageStore.currentGarage" class="msg-box">Garage non trovato.</main>

        <main v-else class="main-content">
            <section class="basic-hero">
                <div class="hero-top">
                    <div class="hero-left">
                        <h1>{{ garageStore.currentGarage.nome }}</h1>
                        <p class="descrizione">{{ garageStore.currentGarage.descrizione }}</p>
                        <div class="badge-row">
                            <div class="badge">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                                {{ garageStore.currentGarage.indirizzo }}
                            </div>
                            <div class="badge">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                {{ garageStore.currentGarage.orarioapertura.substring(0, 5) }} – {{
                                    garageStore.currentGarage.orariochiusura.substring(0,5) }}
                            </div>
                        </div>
                    </div>

                    <div class="hero-right">
                        <div class="prezzo-label">Tariffa base</div>
                        <div class="prezzo-valore">€{{ garageStore.currentGarage.tariffabase }}<span>/ora</span></div>
                    </div>
                </div>
            </section>

            <div v-if="messaggio" :class="['alert', messaggio.tipo]">
                {{ messaggio.testo }}
                <button @click="messaggio = null" class="close-btn">×</button>
            </div>

            <div class="layout-grid">
                <div class="card">
                    <div class="card-header">
                        <h2>Planimetria</h2>
                    </div>
                    <div class="card-body">
                        <PlanimetriaGarage :posti="garageStore.posti"
                            :mappaTestuale="garageStore.currentGarage.mappatestuale"
                            :selectedId="postoSelezionato?.id_posto" :isAnteprima="!isMapConfirmed"
                            @select="(p) => postoSelezionato = p" />
                    </div>
                </div>

                <aside class="card">
                    <div class="card-header">
                        <h2>Orari sosta</h2>
                    </div>
                    <div class="card-body">

                        <div class="form-group">
                            <label>Arrivo</label>
                            <input type="datetime-local" v-model="checkIn">
                        </div>
                        <div class="form-group">
                            <label>Partenza</label>
                            <input type="datetime-local" v-model="checkOut">
                        </div>

                        <div class="action-buttons">
                            <button @click="aggiornaMappa" class="btn outline"
                                :class="{ 'confirmed-btn': isMapConfirmed }">
                                {{ isMapConfirmed ? 'Orari confermati' : 'Controlla disponibilità' }}
                            </button>
                            <button @click="resetSelezione" class="btn ghost">
                                Resetta campi e mappa
                            </button>
                        </div>

                        <div v-if="isMapConfirmed && postoSelezionato" class="prenotazione-box">
                            <hr>
                            <div class="form-group">
                                <label>Targa veicolo</label>
                                <input type="text" v-model="targa" placeholder="Es. AA123BB">
                            </div>

                            <div class="riepilogo">
                                <div class="riepilogo-row">
                                    <span>Posto</span>
                                    <span><strong>{{ postoSelezionato.codiceposto }}</strong></span>
                                </div>
                                <div class="riepilogo-row">
                                    <span>Durata</span>
                                    <span>{{ durataOre }} ore</span>
                                </div>
                                <div class="riepilogo-row">
                                    <span>Tariffa</span>
                                    <span>€{{ postoSelezionato.tariffaoraria }}/ora</span>
                                </div>
                                <div class="riepilogo-row total">
                                    <span>Totale</span>
                                    <span>€ {{ prezzoTotale }}</span>
                                </div>
                            </div>
                        </div>

                        <button class="btn fill" :disabled="!isMapConfirmed || !postoSelezionato || !targa"
                            @click="gestisciPrenotazione">
                            Prenota ora
                        </button>

                    </div>
                </aside>
            </div>
        </main>
        <Footer />
    </div>
</template>

<style scoped>
.page-container {
    background: var(--bg-light);
    min-height: 100vh;
    font-family: 'Inter', -apple-system, sans-serif;
}

.msg-box {
    text-align: center;
    padding: 60px;
    color: #aaa;
    font-size: 0.9rem;
}

/* HERO */
.basic-hero {
    background: var(--deep-blue);
    color: var(--white);
    padding: 36px 0 28px;
}

.hero-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 24px;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 32px;
}

.hero-left h1 {
    font-size: 1.7rem;
    font-weight: 700;
    margin: 0 0 6px;
    letter-spacing: -0.4px;
}

.hero-left .descrizione {
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.5);
    max-width: 520px;
    line-height: 1.6;
    margin: 0 0 16px;
}

.badge-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.badge {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.07);
    border: 0.5px solid rgba(255, 255, 255, 0.15);
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.65);
    white-space: nowrap;
}

.badge svg {
    opacity: 0.55;
    flex-shrink: 0;
}

.hero-right {
    text-align: right;
    flex-shrink: 0;
    padding-top: 4px;
}

.prezzo-label {
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.35);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 4px;
}

.prezzo-valore {
    font-size: 2.2rem;
    font-weight: 700;
    color: var(--white);
    line-height: 1;
}

.prezzo-valore span {
    font-size: 0.95rem;
    font-weight: 400;
    opacity: 0.5;
}

@media (max-width: 600px) {
    .hero-top {
        flex-direction: column;
        gap: 16px;
        padding: 0 20px;
    }

    .hero-right {
        text-align: left;
    }

    .basic-hero {
        padding: 24px 0 20px;
    }
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

.close-btn:hover {
    opacity: 0.8;
}

/* LAYOUT */
.layout-grid {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 20px;
    max-width: 1200px;
    margin: 20px auto;
    padding: 0 32px 48px;
    align-items: start;
}

@media (max-width: 800px) {
    .layout-grid {
        grid-template-columns: 1fr;
        padding: 0 16px 32px;
    }
}

.card {
    background: white;
    border-radius: 10px;
    border: 0.5px solid var(--border-light);
    overflow: hidden;
}

.card-header {
    padding: 14px 20px;
    border-bottom: 0.5px solid #f0f0f0;
}

.card-header h2 {
    margin: 0;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.09em;
    color: #aaa;
}

.card-body {
    padding: 20px;
}

.form-group {
    margin-bottom: 12px;
}

.form-group label {
    display: block;
    margin-bottom: 4px;
    font-size: 0.68rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #aaa;
}

.form-group input {
    width: 100%;
    padding: 9px 11px;
    border: 0.5px solid var(--border-light);
    border-radius: 7px;
    font-size: 0.875rem;
    color: var(--text-dark);
    background: #fafafa;
    box-sizing: border-box;
    outline: none;
    font-family: inherit;
    transition: border-color 0.15s, background 0.15s;
}

.form-group input:focus {
    border-color: var(--primary-blue);
    background: white;
}

.action-buttons {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 4px;
}

.btn {
    width: 100%;
    padding: 10px 12px;
    border-radius: 7px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    border: 0.5px solid var(--border-light);
    background: white;
    color: var(--text-dark);
    transition: background 0.15s;
    font-family: inherit;
    margin-top: 8px;
    text-align: center;
}

.btn:hover {
    background: var(--bg-light);
}

.confirmed-btn {
    background: #e8f5e9 !important;
    border-color: #28a745 !important;
    color: #28a745 !important;
}

.btn.ghost {
    border-color: transparent;
    color: #bbb;
    font-size: 0.78rem;
    margin-top: 2px;
}

.btn.ghost:hover {
    color: #888;
    background: transparent;
}

.btn.fill {
    background: var(--primary-blue);
    color: white;
    border-color: var(--primary-blue);
    margin-top: 16px;
    font-size: 0.9rem;
    font-weight: 600;
    padding: 12px;
}

.btn.fill:hover {
    background: var(--deep-blue);
}

.btn.fill:disabled {
    background: #ccc;
    border-color: #ccc;
    color: white;
    cursor: not-allowed;
}

/* RIEPILOGO PRENOTAZIONE */
.prenotazione-box {
    margin-top: 4px;
}

.prenotazione-box hr {
    border: none;
    border-top: 0.5px solid #f0f0f0;
    margin: 16px 0;
}

.riepilogo {
    background: var(--bg-light);
    border-radius: 8px;
    padding: 12px 14px;
    margin-top: 4px;
}

.riepilogo-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.82rem;
    color: #666;
    padding: 3px 0;
}

.riepilogo-row.total {
    border-top: 0.5px solid var(--border-light);
    margin-top: 8px;
    padding-top: 10px;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-dark);
}

.riepilogo-row.total span:last-child {
    color: var(--primary-blue);
}
</style>