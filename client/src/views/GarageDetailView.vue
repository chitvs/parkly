<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { garageStore } from '../store/garage'
import 'bootstrap-icons/font/bootstrap-icons.css'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'
import PlanimetriaGarage from '../components/PlanimetriaGarage.vue'

const route = useRoute()
const props = defineProps(['id'])
const checkIn = ref(route.query.inizio || '')
const checkOut = ref(route.query.fine || '')
const targa = ref('')
const note = ref('')
const postoSelezionato = ref(null)
const messaggio = ref(null)
const isMapConfirmed = ref(false)
const isPrenotando = ref(false)

onMounted(async () => {
    garageStore.clearGarageData()
    await garageStore.fetchGarage(Number(props.id))
    await garageStore.fetchPosti(props.id, '', '')
    await garageStore.fetchRecensioni(props.id)

    if (checkIn.value && checkOut.value) {
        await aggiornaMappa()
    }
})

watch([checkIn, checkOut], () => {
    isMapConfirmed.value = false
    postoSelezionato.value = null
})

const formattaTarga = () => {
    // rimuove qualsiasi carattere che non sia lettera o numero e converte in maiuscolo
    targa.value = targa.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

// la targa rispetta il formato italiano?
const isTargaValida = computed(() => {
    // ^[A-Z]{2} (inizia con 2 lettere) 
    // \d{3} (3 numeri) 
    // [A-Z]{2}$ (finisce con 2 lettere)
    const regex = /^[A-Z]{2}\d{3}[A-Z]{2}$/
    return regex.test(targa.value)
})

const aggiornaMappa = async () => {
    if (!checkIn.value || !checkOut.value) {
        messaggio.value = { tipo: 'error', testo: 'Inserisci data di arrivo e partenza prima di controllare.' }
        return
    }

    const dataArrivo = new Date(checkIn.value)
    const dataPartenza = new Date(checkOut.value)
    const adesso = new Date()

    if (dataArrivo < adesso) {
        messaggio.value = { tipo: 'error', testo: 'Non puoi prenotare per un orario passato.' }
        return
    }

    if (dataPartenza <= dataArrivo) {
        messaggio.value = { tipo: 'error', testo: 'L\'orario di partenza deve essere successivo a quello di arrivo.' }
        return
    }

    messaggio.value = null
    await garageStore.fetchPosti(props.id, checkIn.value, checkOut.value)
    isMapConfirmed.value = true
    postoSelezionato.value = null
}

const resetSelezione = async () => {
    checkIn.value = ''
    checkOut.value = ''
    targa.value = ''
    note.value = ''
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

    if (!isTargaValida.value) {
        messaggio.value = { tipo: 'error', testo: 'Inserisci una targa valida prima di procedere.' }
        return
    }

    isPrenotando.value = true;

    const payload = {
        id_posto: postoSelezionato.value.id_posto,
        targa: targa.value,
        note: note.value,
        inizio: checkIn.value,
        fine: checkOut.value,
        prezzo_totale: prezzoTotale.value
    }

    const res = await garageStore.prenota(payload)

    isPrenotando.value = false;

    if (res.success) {
        await aggiornaMappa()
        messaggio.value = { tipo: 'success', testo: `Prenotazione avvenuta con successo! Il tuo codice è: ${res.prenotazione.codiceprenotazione}` }
        postoSelezionato.value = null
        targa.value = ''
        note.value = ''
    } else {
        messaggio.value = { tipo: 'error', testo: res.error || 'Errore durante la prenotazione' }
    }
}

const formattaDataRecensione = (dataString) => {
    if (!dataString) return ''
    const data = new Date(dataString)
    return new Intl.DateTimeFormat('it-IT', {
        month: 'long',
        year: 'numeric'
    }).format(data)
}

// Calcola le percentuali per la "scaletta" dei voti complessivi
const distribuzioneVoti = computed(() => {
    const recensioni = garageStore.recensioni
    const totale = recensioni.length
    const distrib = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    if (totale === 0) return distrib
    recensioni.forEach(r => {
        const voto = Math.floor(r.votogenerale || 0)
        if (distrib[voto] !== undefined) {
            distrib[voto]++
        }
    })
    for (let i = 1; i <= 5; i++) {
        distrib[i] = (distrib[i] / totale) * 100
    }
    return distrib
})

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

                            <div class="badge" v-if="garageStore.currentGarage.is24h">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                Aperto 24h
                            </div>

                            <div class="badge" v-else>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                                {{ garageStore.currentGarage.orarioapertura.substring(0, 5) }} - {{
                                    garageStore.currentGarage.orariochiusura.substring(0, 5) }}
                            </div>
                            <div class="badge" v-if="garageStore.currentGarage.altezzamassima">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 22V5" />
                                    <path d="M7 10l5-5 5 5" />
                                    <line x1="4" y1="2" x2="20" y2="2" />
                                </svg>
                                Max {{ garageStore.currentGarage.altezzamassima }}m
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
                <button @click="messaggio = null" class="close-btn">x</button>
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
                            @select="(p) => postoSelezionato = p"
                            @error="(msg) => messaggio = { tipo: 'error', testo: msg }" />
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
                                <input type="text" v-model="targa" @input="formattaTarga" placeholder="Es. AA123BB"
                                    maxlength="7" required>
                                <small v-if="targa.length > 0 && !isTargaValida" class="error-text">
                                    Formato non valido.
                                </small>
                            </div>
                            <div class="form-group">
                                <label>Note (opzionale)</label>
                                <input type="text" v-model="note">
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

                        <button class="btn fill"
                            :disabled="!isMapConfirmed || !postoSelezionato || !targa || !isTargaValida""
                            @click="gestisciPrenotazione">
                            Prenota ora
                        </button>

                    </div>
                </aside>
            </div>
            <!-- SEZIONE RECENSIONI -->
            <section class="reviews-section card" v-if="garageStore.currentGarage">
                <div class="card-body">

                    <div class="overall-rating-header">
                        <h2 class="rating-number">{{ Number(garageStore.currentGarage.mediagenerale).toFixed(2) }}</h2>

                        <div class="average-stars">
                            <i v-for="i in 5" :key="i" class="bi" :class="[
                                garageStore.currentGarage.mediagenerale >= i ? 'bi-star-fill star--on' :
                                    garageStore.currentGarage.mediagenerale >= i - 0.5 ? 'bi-star-half star--on' :
                                        'bi-star star--off'
                            ]">
                            </i>
                        </div>

                        <span class="reviews-count">
                            {{ garageStore.recensioni.length }} recensioni
                        </span>
                    </div>

                    <hr class="reviews-divider">

                    <!-- CONTENITORE UNICO PER CHI HA RECENSIONI -->
                    <div v-if="garageStore.recensioni.length > 0">

                        <div class="reviews-breakdown">
                            <!-- Sinistra: Scaletta dei voti -->
                            <div class="rating-ladder">
                                <div v-for="star in 5" :key="star" class="ladder-row">
                                    <span class="ladder-num">{{ 6 - star }}</span>
                                    <div class="ladder-bar-bg">
                                        <div class="ladder-bar-fill"
                                            :style="{ width: distribuzioneVoti[6 - star] + '%' }">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Destra: Categorie Specifiche -->
                            <div class="categories-grid">
                                <div class="category-item">
                                    <span class="cat-label"><i class="bi bi-geo-alt"></i> Posizione</span>
                                    <span class="cat-val">{{ Number(garageStore.currentGarage.mediaposizione).toFixed(1)
                                        }}</span>
                                </div>
                                <div class="category-item">
                                    <span class="cat-label"><i class="bi bi-tag"></i> Qualità/Prezzo</span>
                                    <span class="cat-val">{{ Number(garageStore.currentGarage.mediaprezzo).toFixed(1)
                                        }}</span>
                                </div>
                                <div class="category-item">
                                    <span class="cat-label"><i class="bi bi-stars"></i> Pulizia</span>
                                    <span class="cat-val">{{ Number(garageStore.currentGarage.mediapulizia).toFixed(1)
                                        }}</span>
                                </div>
                                <div class="category-item">
                                    <span class="cat-label"><i class="bi bi-car-front"></i> Spazio Manovra</span>
                                    <span class="cat-val">{{ Number(garageStore.currentGarage.mediaspazio).toFixed(1)
                                        }}</span>
                                </div>
                                <div class="category-item">
                                    <span class="cat-label"><i class="bi bi-shield-check"></i> Sicurezza</span>
                                    <span class="cat-val">{{ Number(garageStore.currentGarage.mediasicurezza).toFixed(1)
                                        }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Inizio Blocco Commenti Singoli (ORA È SOTTO!) -->
                        <div class="user-comments-section mt-5 pt-4 border-top">
                            <div class="comments-grid">
                                <div v-for="(recensione, index) in garageStore.recensioni" :key="index"
                                    class="comment-card">
                                    <div class="comment-header">
                                        <!-- Avatar -->
                                        <div class="user-avatar">
                                            <img v-if="recensione.fotoprofilo_url" :src="recensione.fotoprofilo_url"
                                                alt="User avatar">
                                            <span v-else>{{ recensione.nome.charAt(0).toUpperCase() }}</span>
                                        </div>

                                        <!-- Nome e Info -->
                                        <div class="user-info">
                                            <h4 class="user-name">{{ recensione.nome }} {{ recensione.inizialecognome
                                                }}.</h4>
                                        </div>
                                    </div>

                                    <div class="comment-meta">
                                        <!-- Stelline piccole per la singola recensione -->
                                        <div class="small-stars">
                                            <i v-for="star in 5" :key="'s' + star" class="bi"
                                                :class="star <= Math.round(recensione.votogenerale) ? 'bi-star-fill star--on' : 'bi-star star--off'">
                                            </i>
                                        </div>
                                        <span class="meta-dot">·</span>
                                        <span class="comment-date">{{ formattaDataRecensione(recensione.datacreazione)
                                            }}</span>
                                    </div>

                                    <!-- Testo Recensione -->
                                    <p class="comment-text" v-if="recensione.commento">{{ recensione.commento }}</p>
                                    <p class="comment-text text-muted fst-italic" v-else>Nessun commento testuale
                                        lasciato.</p>
                                </div>
                            </div>
                        </div>
                        <!-- Fine Blocco Commenti Singoli -->

                    </div>

                    <div v-else class="empty-reviews text-center py-4 text-muted">
                        Nessuna recensione presente al momento. Sii il primo a prenotare e recensire!
                    </div>

                </div>
            </section>
        </main>
    </div>
    <Footer />
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

.form-group input,
.form-group textarea {
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

.form-group textarea {
    resize: vertical;
    min-height: 60px;
}

.form-group input:focus,
.form-group textarea:focus {
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

.error-text {
    color: #dc3545;
    font-size: 0.75rem;
    margin-top: 4px;
    display: block;
}

/* SEZIONE RECENSIONI */
.reviews-section {
    max-width: 1200px;
    margin: 0 auto 40px;
    width: calc(100% - 64px);
    /* Allinea col padding della grid */
}

.overall-rating-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 24px;
}

.overall-rating-header h2.rating-number {
    font-size: 4.5rem;
    font-weight: 800;
    color: var(--text-dark);
    margin: 0 0 4px 0;
    line-height: 1;
    letter-spacing: -0.05em;
}

.average-stars {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
}

.average-stars i {
    font-size: 2.2rem;
    transition: transform 0.2s;
}

.star--on {
    color: #f59e0b;
    /* Colore giallo che usi in BookingsView */
    filter: drop-shadow(0 3px 10px rgba(245, 158, 11, 0.45));
}

.star--off {
    color: #dde3ed;
}

.overall-rating-header h2 {
    font-size: 4rem;
    font-weight: 800;
    color: var(--text-dark);
    margin: 0;
    line-height: 1.1;
    letter-spacing: -0.04em;
}

.reviews-count {
    font-size: 1.1rem;
    font-weight: 600;
    color: #64748b;
}

.reviews-divider {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 0 0 32px 0;
}

.reviews-breakdown {
    display: flex;
    gap: 60px;
    align-items: flex-start;
}

/* Scaletta Sinistra */
.rating-ladder {
    flex: 0 0 300px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.ladder-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.ladder-num {
    font-weight: 600;
    font-size: 0.9rem;
    color: #334155;
    width: 12px;
}

.ladder-bar-bg {
    flex-grow: 1;
    height: 6px;
    background: #e2e8f0;
    border-radius: 99px;
    overflow: hidden;
}

.ladder-bar-fill {
    height: 100%;
    background: #0f172a;
    border-radius: 99px;
    transition: width 0.5s ease-out;
}

/* Categorie Destra */
.categories-grid {
    flex-grow: 1;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 24px 32px;
}

.category-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-left: 20px;
    border-left: 1px solid #f1f5f9;
}

.cat-label {
    font-size: 0.85rem;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 8px;
}

.cat-label i {
    font-size: 1.1rem;
    color: var(--text-dark);
}

.cat-val {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-dark);
}

/* GRIGLIA COMMENTI */
.user-comments-section {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid #e2e8f0;
}

.comments-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 32px 48px;
}

.comment-card {
    display: flex;
    flex-direction: column;
}

.comment-header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
}

.user-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background-color: #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    color: #64748b;
    font-weight: 700;
    font-size: 1.2rem;
    flex-shrink: 0;
}

.user-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.user-info {
    display: flex;
    flex-direction: column;
}

.user-name {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-dark);
}

.comment-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}

.small-stars {
    display: flex;
    gap: 2px;
}

.small-stars i {
    font-size: 0.8rem;
}

.meta-dot {
    color: #94a3b8;
    font-weight: bold;
}

.comment-date {
    font-size: 0.9rem;
    color: #64748b;
}

.comment-text {
    font-size: 1rem;
    line-height: 1.6;
    color: #334155;
    margin: 0;
    /* Limita il testo a 4 righe, aggiungendo i puntini di sospensione per commenti molto lunghi */
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>