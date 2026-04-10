<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import Header from '../components/Header.vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const router = useRouter()

// --- STATO UI E RICERCA ---
const isLoading = ref(true) // Parte su true per il caricamento
const searchLocation = ref('')
const checkIn = ref('')
const checkOut = ref('')

const garages = ref([])
const mapContainer = ref(null)
let mapInstance = null

// --- RECUPERO DATI REALI ---
const fetchGarages = async () => {
    isLoading.value = true
    try {
        const response = await fetch('/api/garage')
        const result = await response.json()
        if (result.success) {
            garages.value = result.garage
        }
    } catch (error) {
        console.error("Errore nel caricamento dei garage:", error)
    } finally {
        isLoading.value = false
    }
}

onMounted(async () => {
    await fetchGarages()
    try {
        await nextTick()
        if (mapContainer.value) {
            mapInstance = L.map(mapContainer.value, {
                center: [41.9028, 12.4964],
                zoom: 13,
                dragging: false, touchZoom: false, scrollWheelZoom: false,
                doubleClickZoom: false, boxZoom: false, keyboard: false,
                zoomControl: false, attributionControl: false
            })
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance)
            setTimeout(() => { mapInstance.invalidateSize() }, 400)
        }
    } catch (error) {
        console.error("Errore mappa:", error)
    }
})

// --- STATO FILTRI ---
const filter24h = ref(false)
const maxPrice = ref(25) // Valore massimo di default per lo slider
const minHeight = ref(0)
const filterCoperto = ref(false)
const filterElettrico = ref(false)
const filterDisabili = ref(false)
const filterTipoVeicolo = ref('ALL')

// --- FILTRO DINAMICO AGGIORNATO ---
const garagesFiltrati = computed(() => {
    const query = searchLocation.value.toLowerCase().trim()

    return garages.value.filter(g => {
        // Filtro Testuale
        const matchesSearch = g.nome.toLowerCase().includes(query) ||
            g.indirizzo.toLowerCase().includes(query)
        // Filtri Base
        const matches24h = !filter24h.value || g.is24h
        const matchesPrice = Number(g.tariffabase) <= maxPrice.value
        const matchesHeight = !minHeight.value || (g.altezzamassima && Number(g.altezzamassima) >= minHeight.value)
        // Nuovi Filtri (Assumendo che l'API restituisca questi campi aggregati dal database)
        const matchesCoperto = !filterCoperto.value || g.hasCoperto
        const matchesElettrico = !filterElettrico.value || g.hasElettrico
        const matchesDisabili = !filterDisabili.value || g.hasDisabili
        // Filtro Tipo Veicolo (Controlla se il garage ha posti per quel tipo)
        const matchesTipo = filterTipoVeicolo.value === 'ALL' || (g.tipiDisponibili && g.tipiDisponibili.includes(filterTipoVeicolo.value))

        return matchesSearch && matches24h && matchesPrice && matchesHeight &&
            matchesCoperto && matchesElettrico && matchesDisabili && matchesTipo
    })
})

// Funzione per resettare tutto
// Reset aggiornato
const resetFilters = () => {
    filter24h.value = false
    maxPrice.value = 25
    minHeight.value = 0
    filterCoperto.value = false
    filterElettrico.value = false
    filterDisabili.value = false
    filterTipoVeicolo.value = 'ALL'
    searchLocation.value = ''
}

const goToDetail = (garage) => {
    router.push({ name: 'garage-detail', params: { id: garage.id_garage } })
}

const handleSearch = () => { console.log("Ricerca eseguita") }
</script>

<template>
    <div class="garage-wrapper">
        <Header />

        <section class="search-area">
            <div class="search-container">
                <form @submit.prevent="handleSearch" class="search-box">

                    <div class="input-group location-group">
                        <div class="icon">📍</div>
                        <div class="fields">
                            <label>Dove vuoi parcheggiare?</label>
                            <input type="text" v-model="searchLocation" placeholder="Città, indirizzo o stazione..."
                                required>
                        </div>
                    </div>

                    <div class="input-group">
                        <label>Check-in</label>
                        <input type="datetime-local" v-model="checkIn" required>
                    </div>

                    <div class="input-group">
                        <label>Check-out</label>
                        <input type="datetime-local" v-model="checkOut" required>
                    </div>

                    <button type="submit" class="search-btn">Cerca</button>
                </form>
            </div>
        </section>

        <div class="page-body">
            <aside class="sidebar">
                <!-- ZONE MAP -->
                <div class="zone-map">
                    <div ref="mapContainer" class="leaflet-map-canvas"></div>
                    <div class="map-overlay">
                        <button class="map-view-btn">
                            <span class="pin-emoji">📍</span>
                            Vedi su mappa
                        </button>
                    </div>
                </div>
                <!-- ZONE FILTERS -->
                <div class="zone-filters">
                    <div class="filter-header">
                        <h3>Filtra per:</h3>
                        <button @click="resetFilters" class="reset-btn">Reset</button>
                    </div>

                    <div class="filter-group">
                        <label>Tipo di veicolo</label>
                        <select v-model="filterTipoVeicolo" class="filter-select">
                            <option value="ALL">Tutti</option>
                            <option value="AUTO">🚗 Auto</option>
                            <option value="MOTO">🏍️ Moto</option>
                            <option value="FURGONE">🚐 Furgone</option>
                        </select>
                    </div>

                    <hr class="filter-divider">

                    <div class="filter-group">
                        <label>Prezzo massimo: <strong>€ {{ maxPrice.toFixed(2) }}</strong></label>
                        <input type="range" v-model.number="maxPrice" min="1" max="25" step="0.5" class="slider">
                    </div>

                    <hr class="filter-divider">

                    <div class="filter-group">
                        <label><b>Caratteristiche:</b></label>
                        <div class="checkbox-list">
                            <label class="checkbox-container">
                                <input type="checkbox" v-model="filter24h">
                                <span> Aperto 24/7 </span>
                            </label>
                            <label class="checkbox-container">
                                <input type="checkbox" v-model="filterCoperto">
                                <span> Posti al coperto </span>
                            </label>
                            <label class="checkbox-container">
                                <input type="checkbox" v-model="filterElettrico">
                                <span> Ricarica elettrica </span>
                            </label>
                            <label class="checkbox-container">
                                <input type="checkbox" v-model="filterDisabili">
                                <span> Accesso disabili </span>
                            </label>
                        </div>
                    </div>

                    <hr class="filter-divider">

                    <div class="filter-group">
                        <label>Altezza minima veicolo</label>
                        <select v-model.number="minHeight" class="filter-select">
                            <option :value="0">Qualsiasi altezza</option>
                            <option :value="1.4">Oltre 1.40m</option>
                            <option :value="1.6">Oltre 1.60m</option>
                            <option :value="1.9">Oltre 1.90m</option>
                            <option :value="2.1">Oltre 2.10m</option>
                            <option :value="2.3">Oltre 2.30m</option>
                            <option :value="2.5">Oltre 2.50m</option>
                        </select>
                    </div>
                </div>
            </aside>
            <!-- ZONE RESULTS -->
            <main class="zone-results">
                <div v-if="isLoading" class="loading-state text-center py-5">
                    <div class="spinner"></div>
                    <p>Caricamento parcheggi...</p>
                </div>

                <div v-else-if="garagesFiltrati.length === 0" class="empty-state">
                    <p>Nessun garage trovato a {{ searchLocation || 'destinazione' }}.</p>
                </div>

                <template v-else>
                    <div class="results-header">
                        <h2 class="results-count">
                            {{ searchLocation || 'Risultati' }}: <span>{{ garagesFiltrati.length }} parcheggi
                                trovati</span>
                        </h2>
                    </div>

                    <div class="garage-list">
                        <div v-for="garage in garagesFiltrati" :key="garage.id_garage" class="garage-card"
                            @click="goToDetail(garage)">

                            <div class="gcard-thumb">
                                <div class="gcard-letter-box">{{ garage.nome.charAt(0) }}</div>
                                <span v-if="garage.is24h" class="gcard-badge-top">24/7</span>
                            </div>

                            <div class="gcard-main">
                                <h3 class="gcard-title">{{ garage.nome }}</h3>
                                <div class="gcard-location">
                                    <span>📍 {{ garage.indirizzo }}</span>
                                </div>

                                <div class="gcard-services">
                                    <span class="service-badge info">
                                        <img src="../assets/orologio.svg" class="icon-card" alt="Orario" /> {{
                                            garage.is24h ? '24/7' : garage.orarioapertura.slice(0, 5) + ' - ' +
                                        garage.orariochiusura.slice(0, 5) }}
                                    </span>

                                    <span v-if="garage.altezzamassima" class="service-badge info">
                                        <img src="../assets/altezza_massima.svg" class="icon-card"
                                            alt="AltezzaMassima" /> Max: {{ garage.altezzamassima }}m
                                    </span>

                                    <span v-if="garage.hasCoperto" class="service-badge feature">
                                        <img src="../assets/parcheggio_coperto.svg" class="icon-card" alt="Coperto" />
                                        Coperto
                                    </span>

                                    <span v-if="garage.hasElettrico" class="service-badge feature">
                                        <img src="../assets/electricity.svg" class="icon-card" alt="Elettrico" />
                                        Ricarica
                                    </span>

                                    <span v-if="garage.hasDisabili" class="service-badge feature">
                                        <img src="../assets/handicap.svg" class="icon-card" alt="Disabili" /> Disabili
                                    </span>
                                </div>
                            </div>

                            <div class="gcard-right">
                                <div class="gcard-price-block">
                                    <span class="price-label">TARIFFA BASE</span>
                                    <span class="price-value">€{{ Number(garage.tariffabase).toFixed(2) }}/ora</span>
                                </div>
                            </div>

                        </div>
                    </div>
                </template>
            </main>
        </div>

    </div>
</template>

<style scoped>
/* Contenitore principale */
.garage-wrapper {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-color: #f8fafc;
}

/* Stile dell'area blu della ricerca */
.search-area {
    background-color: #002E5C;
    padding: 2.5rem 0;
}

.search-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1.5rem;
}

/* La scatola bianca che contiene gli input */
.search-box {
    display: flex;
    background: #ffffff;
    padding: 0.8rem;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    gap: 12px;
}

/* Gruppi di input singoli */
.input-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0.5rem 1rem;
    background: #ffffff;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    transition: all 0.3s;
}

.input-group:focus-within {
    border-color: #00408A;
    box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.1);
}

/* Variante specifica per la località (con icona) */
.location-group {
    flex: 1.8;
    flex-direction: row;
    align-items: center;
    gap: 12px;
}

.location-group .fields {
    display: flex;
    flex-direction: column;
    flex: 1;
}

.input-group label {
    font-size: 0.7rem;
    font-weight: 800;
    color: #00408A;
    text-transform: uppercase;
    margin-bottom: 2px;
}

.input-group input {
    border: none;
    outline: none;
    font-size: 1rem;
    width: 100%;
    color: #1e293b;
}

/* Pulsante Cerca */
.search-btn {
    background-color: #00408A;
    color: #ffffff;
    border: none;
    font-size: 1.1rem;
    font-weight: 700;
    padding: 0 2.5rem;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s;
}

.search-btn:hover {
    background-color: #00336e;
    transform: translateY(-2px);
}

/* Contenitore principale sotto la barra di ricerca */
.page-body {
    display: flex;
    max-width: 90% !important;
    width: 100%;
    margin: 2rem auto;
    padding: 0 0.5rem;
    gap: 1.5rem;
    /* Spazio tra sidebar e risultati */
}

/* Sidebar: contiene Mappa (Sopra) e Filtri (Sotto) */
.sidebar {
    width: 300px;
    /* Larghezza fissa per la colonna sinistra */
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    /* Spazio tra mappa e filtri */
}

/* ZONA 1: Stile base per il box mappa */
/* Sovrascrivi o aggiorna .zone-map */
.zone-map {
    width: 100%;
    height: 180px;
    border-radius: 20px;
    overflow: hidden;
    position: relative;
    /* Fondamentale per posizionare l'overlay */
    border: 1px solid #cbd5e1;
}

.leaflet-map-canvas {
    width: 100%;
    height: 100%;
    z-index: 1;
    /* Livello basso */
}

.map-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    pointer-events: none;
}

.map-view-btn {
    /* Riattiva il click solo sul bottone */
    pointer-events: auto;

    background-color: #00408A;
    color: #ffffff;
    border: none;
    padding: 12px 24px;
    border-radius: 12px;
    font-weight: 700;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 4px 15px rgba(0, 64, 138, 0.4);
    cursor: pointer;
}

/* ZONA 2: Stile base per il box filtri */
.zone-filters {
    background-color: #ffffff;
    border-radius: 12px;
    border: 1px solid #cbd5e1;
    padding: 1.5rem;
}

/* --- FILTRI SIDEBAR --- */
.filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.filter-header h3 {
    font-size: 1.1rem;
    font-weight: 700;
    color: #1e293b;
}

.reset-btn {
    background: none;
    border: none;
    color: #006ce4;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
}

.filter-group {
    margin-bottom: 1rem;
}

.filter-group label {
    display: block;
    font-size: 0.9rem;
    color: #4b5563;
    margin-bottom: 10px;
}

.filter-divider {
    border: 0;
    border-top: 1px solid #e2e8f0;
    margin: 1rem 0;
}

/* Slider Prezzo */
.slider {
    width: 100%;
    accent-color: #00408A;
    cursor: pointer;
}

.range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 5px;
}

/* Custom Checkbox */
.checkbox-group {
    margin-bottom: 1rem;
}

.checkbox-list {
    display: flex;
    flex-direction: column;
}

.checkbox-container {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    cursor: pointer;
    font-size: 0.85rem;
    color: #4b5563;
}

.checkbox-container input {
    width: 16px;
    height: 16px;
    accent-color: #00408A;
}

.checkbox-container input[type="checkbox"] {
    margin: 0;          /* rimuove offset strani */
    transform: translateY(2px); /* micro-fix visivo */
}

/* Select Altezza */
.filter-select {
    width: 100%;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    background-color: #f8fafc;
    font-size: 0.9rem;
    outline: none;
}

.filter-select:focus {
    border-color: #00408A;
}

/* ZONA 3: Area principale per i risultati */
/* Header Risultati */
.results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.results-count {
    font-size: 1.4rem;
    font-weight: 700;
    color: #0f172a;
}

.results-count span {
    color: #64748b;
    font-weight: 400;
    font-size: 1rem;
}

.sort-btn {
    background: white;
    border: 1px solid #cbd5e1;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 0.85rem;
    cursor: pointer;
}

/* Container Lista */
.zone-results {
    flex: 1;
}

.garage-list {
    display: flex;
    flex-direction: column;
}

/* --- STILE CARD --- */
.garage-card {
    display: flex;
    background: white;
    border: 1px solid #c5d4eb;
    border-radius: 8px;
    margin-bottom: 16px;
    overflow: hidden;
    height: 160px;
    /* Ridotta l'altezza dato che c'è meno testo */
    transition: box-shadow 0.2s;
    cursor: pointer;
}

.garage-card:hover {
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    border-color: #006ce4;
}

.gcard-thumb {
    width: 180px;
    background-color: #003580;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.gcard-letter-box {
    font-size: 4rem;
    font-weight: 800;
    color: rgba(255, 255, 255, 0.1);
    text-transform: uppercase;
}

.gcard-badge-top {
    position: absolute;
    top: 8px;
    left: 8px;
    background: #008009;
    color: white;
    padding: 2px 6px;
    font-size: 0.65rem;
    font-weight: 700;
    border-radius: 4px;
}

.gcard-main {
    flex: 1;
    padding: 16px;
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.gcard-title {
    font-size: 1.2rem;
    color: #006ce4;
    margin: 0 0 8px 0;
    font-weight: 700;
}

.gcard-location {
    font-size: 0.85rem;
    color: #4b5563;
    margin-bottom: 12px;
}

.gcard-services {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    /* Spazio tra le pillole */
    margin-top: 10px;
}

/* Stile base della pillola */
.service-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 50px;
    /* Rende il bordo perfettamente tondo ai lati */
    font-size: 0.75rem;
    font-weight: 600;
    border: 1px solid transparent;
}

/* Colore Grigio per Info (Orario/Altezza) */
.service-badge.info {
    background-color: #f1f5f9;
    color: #475569;
    border-color: #e2e8f0;
}

/* Colore Verde per Caratteristiche (Coperto/Elettrico/Disabili) */
.service-badge.feature {
    background-color: #e8f5e9;
    /* Verde molto chiaro */
    color: #0e701b;
    /* Testo verde scuro per leggibilità */
    border-color: #c8e6c9;
}

/* Icone all'interno delle pillole */
.icon-card {
    width: 14px;
    height: 14px;
    margin-right: 5px;
}

.gcard-right {
    width: 160px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-left: 1px solid #f1f5f9;
    text-align: right;
}

.price-label {
    font-size: 0.7rem;
    color: #6b6b6b;
    display: block;
}

.price-value {
    font-size: 1.4rem;
    font-weight: 700;
    color: #1a1a1a;
    display: block;
    margin-bottom: 12px;
}

/* Stile per le icone nei filtri */
.icon-small {
    width: 14px;
    height: 14px;
    vertical-align: middle;
    margin-left: 4px;
}

/* Spinner */
.spinner {
    width: 30px;
    height: 30px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #00408A;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 1rem auto;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}
</style>