<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'
import GarageFilters from '../components/GarageFilters.vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const router = useRouter()

// --- COSTANTI ---
const MAP_CENTER = [41.9028, 12.4964]
const TILE_LAYER = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

// --- STATO UI E DATI ---
const isLoading = ref(true)
const garages = ref([])
const isMapFullscreen = ref(false)

// --- RICERCA E FILTRI ---
const searchLocation = ref('')
const checkIn = ref('')
const checkOut = ref('')

const filter24h = ref(false)
const maxPrice = ref(25)
const minHeight = ref(0)
const filterCoperto = ref(false)
const filterElettrico = ref(false)
const filterDisabili = ref(false)
const filterTipoVeicolo = ref('ALL')

// --- STATO MAPPE ---
const mapContainer = ref(null)
const fullMapContainer = ref(null)
let mapInstance = null
let fullMapInstance = null

const markersRefs = {}
let hoverTimer = null
let activeMarkerId = null

// --- LOGICA DATI ---
const fetchGarages = async () => {
    isLoading.value = true
    try {
        const response = await fetch('/api/garage')
        const result = await response.json()
        if (result.success) garages.value = result.garage
    } catch (error) {
        console.error("Errore nel caricamento dei garage:", error)
    } finally {
        isLoading.value = false
    }
}

onMounted(async () => {
    await fetchGarages()
    await nextTick()
    
    if (mapContainer.value) {
        mapInstance = L.map(mapContainer.value, {
            center: MAP_CENTER,
            zoom: 13,
            dragging: false, touchZoom: false, scrollWheelZoom: false,
            doubleClickZoom: false, boxZoom: false, keyboard: false,
            zoomControl: false, attributionControl: false
        })
        L.tileLayer(TILE_LAYER).addTo(mapInstance)
        setTimeout(() => mapInstance.invalidateSize(), 400)
    }
})

// --- FILTRI DINAMICI ---
const garagesFiltrati = computed(() => {
    const query = searchLocation.value.toLowerCase().trim()

    return garages.value.filter(g => {
        const matchesSearch = g.nome.toLowerCase().includes(query) || g.indirizzo.toLowerCase().includes(query)
        const matches24h = !filter24h.value || g.is24h
        const matchesPrice = Number(g.tariffabase) <= maxPrice.value
        const matchesHeight = !minHeight.value || (g.altezzamassima && Number(g.altezzamassima) >= minHeight.value)
        const matchesCoperto = !filterCoperto.value || g.hasCoperto
        const matchesElettrico = !filterElettrico.value || g.hasElettrico
        const matchesDisabili = !filterDisabili.value || g.hasDisabili
        const matchesTipo = filterTipoVeicolo.value === 'ALL' || (g.tipiDisponibili?.includes(filterTipoVeicolo.value))

        return matchesSearch && matches24h && matchesPrice && matchesHeight &&
               matchesCoperto && matchesElettrico && matchesDisabili && matchesTipo
    })
})

const resetFilters = () => {
    filter24h.value = filterCoperto.value = filterElettrico.value = filterDisabili.value = false
    maxPrice.value = 25
    minHeight.value = 0
    filterTipoVeicolo.value = 'ALL'
    searchLocation.value = ''
}

// --- LOGICA INTERAZIONE MAPPA ---
const highlightMarker = (garage) => {
    if (hoverTimer) clearTimeout(hoverTimer)
    if (!fullMapInstance) return

    // Reset marker precedente
    if (activeMarkerId && markersRefs[activeMarkerId]) {
        markersRefs[activeMarkerId].getElement()?.classList.remove('is-active')
    }

    // Attiva nuovo marker
    const currentMarker = markersRefs[garage.id_garage]
    if (currentMarker) {
        currentMarker.getElement()?.classList.add('is-active')
        activeMarkerId = garage.id_garage
    }
}

const selectGarage = (garage) => {
    if (hoverTimer) clearTimeout(hoverTimer)
    if (!fullMapInstance || !garage.latitudine) return

    fullMapInstance.flyTo([garage.latitudine, garage.longitudine], 15, { duration: 1.2 })
    markersRefs[garage.id_garage]?.openPopup()
    highlightMarker(garage)
}

const resetMapView = () => {
    if (hoverTimer) clearTimeout(hoverTimer)
    if (!fullMapInstance) return

    fullMapInstance.closePopup()
    fullMapInstance.flyTo(MAP_CENTER, 11, { duration: 1.0 })

    if (activeMarkerId && markersRefs[activeMarkerId]) {
        markersRefs[activeMarkerId].getElement()?.classList.remove('is-active')
        activeMarkerId = null
    }
}

// --- GESTIONE FULLSCREEN ---
const openMapFullscreen = async () => {
    isMapFullscreen.value = true
    document.body.style.overflow = 'hidden'
    await nextTick()

    if (fullMapContainer.value && !fullMapInstance) {
        fullMapInstance = L.map(fullMapContainer.value, {
            center: MAP_CENTER,
            zoom: 11,
            zoomControl: false,
            attributionControl: false
        })
        L.tileLayer(TILE_LAYER).addTo(fullMapInstance)

        const activeIds = garagesFiltrati.value.map(g => g.id_garage)

        garages.value.forEach(g => {
            if (g.latitudine && g.longitudine) {
                const customIcon = L.divIcon({
                    className: 'custom-garage-marker',
                    html: '<div class="marker-pin"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })

                const marker = L.marker([g.latitudine, g.longitudine], { icon: customIcon })
                
                marker.bindPopup(`
                    <div class="map-popup-content">
                        <strong>${g.nome}</strong><br>${g.indirizzo}<br>
                        <a href="/garage/${g.id_garage}" class="popup-detail-link">Vedi dettagli →</a>
                    </div>
                `)

                markersRefs[g.id_garage] = marker
                if (activeIds.includes(g.id_garage)) marker.addTo(fullMapInstance)
            }
        })
    }
}

const closeMapFullscreen = () => {
    isMapFullscreen.value = false
    document.body.style.overflow = ''
    if (hoverTimer) clearTimeout(hoverTimer)
    if (fullMapInstance) {
        fullMapInstance.remove()
        fullMapInstance = null
    }
    Object.keys(markersRefs).forEach(key => delete markersRefs[key])
}

// Sincronizzazione marker con filtri
watch(garagesFiltrati, (newGarages) => {
    if (!fullMapInstance) return
    const activeIds = newGarages.map(g => g.id_garage)

    Object.keys(markersRefs).forEach(id => {
        const marker = markersRefs[id]
        activeIds.includes(Number(id)) ? marker.addTo(fullMapInstance) : marker.remove()
    })
}, { deep: true })

const goToDetail = (garage) => router.push({ name: 'garage-detail', params: { id: garage.id_garage } })
const handleSearch = () => console.log("Ricerca eseguita")
</script>

<template>
    <Header />
    <div class="garage-wrapper">

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
                        <button class="map-view-btn" @click="openMapFullscreen">
                            <span class="pin-emoji">📍</span>
                            Vedi su mappa
                        </button>
                        <Teleport to="body">
                            <Transition name="fs-fade">
                                <div v-if="isMapFullscreen" class="fs-overlay">
                                    <div class="fs-body">

                                        <div class="fs-left-half">

                                            <div class="fs-col-filters">
                                                <div class="fs-panel-header">
                                                    <h3
                                                        style="display: flex; justify-content: space-between; width: 100%;">
                                                        Filtri
                                                        <button @click="resetFilters" class="reset-btn"
                                                            style="color: white;">Reset</button>
                                                    </h3>
                                                </div>
                                                <div class="fs-scroll-content">
                                                    <GarageFilters v-model:filterTipoVeicolo="filterTipoVeicolo"
                                                        v-model:maxPrice="maxPrice" v-model:filter24h="filter24h"
                                                        v-model:filterCoperto="filterCoperto"
                                                        v-model:filterElettrico="filterElettrico"
                                                        v-model:filterDisabili="filterDisabili"
                                                        v-model:minHeight="minHeight" />
                                                </div>
                                            </div>

                                            <div class="fs-col-cards">
                                                <div class="fs-panel-header">
                                                    <h3>{{ garagesFiltrati.length }} Risultati</h3>
                                                </div>
                                                <div class="fs-scroll-content">
                                                    <div v-for="garage in garagesFiltrati"
                                                        :key="'fs-' + garage.id_garage" class="fs-mini-card"
                                                        @mouseenter="highlightMarker(garage)" @click="selectGarage(garage)">
                                                        <div class="mini-thumb">
                                                            <div class="gcard-letter-box">{{ garage.nome.charAt(0) }}
                                                            </div>
                                                        </div>
                                                        <div class="mini-details">
                                                            <h4>{{ garage.nome }}</h4>
                                                            <p>{{ garage.indirizzo.slice(0, 30) }}...</p>
                                                            <span class="mini-price">€{{
                                                                Number(garage.tariffabase).toFixed(2) }}/ora</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="fs-right-half">
                                            <div ref="fullMapContainer" class="fs-map-canvas"></div>

                                            <div class="fs-map-controls">
                                                <div class="fs-floating-search">
                                                    <span>🔍</span>
                                                    <input type="text" v-model="searchLocation"
                                                        placeholder="Cerca sulla mappa..." />
                                                </div>
                                                <button class="fs-reset-view" @click="resetMapView"
                                                    title="Ripristina visuale">
                                                    <span style="font-size: 1.2rem;">🔄</span>
                                                </button>
                                                <button class="fs-close-circle" @click="closeMapFullscreen">✕</button>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </Transition>
                        </Teleport>
                    </div>
                </div>
                <!-- ZONE FILTERS -->
                <div class="zone-filters">
                    <div class="filter-header">
                        <h3>Filtri</h3>
                        <button @click="resetFilters" class="reset-btn">Reset</button>
                    </div>

                    <GarageFilters v-model:filterTipoVeicolo="filterTipoVeicolo" v-model:maxPrice="maxPrice"
                        v-model:filter24h="filter24h" v-model:filterCoperto="filterCoperto"
                        v-model:filterElettrico="filterElettrico" v-model:filterDisabili="filterDisabili"
                        v-model:minHeight="minHeight" />
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
                                    <span><img src="../assets/pin.svg" class="icon-card" alt="Pin"
                                            style="transform: translateY(-3px)" />{{ garage.indirizzo }}</span>
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
    <Footer />
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

/* FULLSCREEN */

/* --- LAYOUT 25/25/50 --- */
.fs-overlay {
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: white;
}

.fs-body {
    display: flex;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
}

/* Sinistra (50%) */
.fs-left-half {
    width: 50%;
    display: flex;
    height: 100%;
    border-right: 1px solid #e2e8f0;
}

/* Sotto-colonne (25% + 25%) */
.fs-col-filters,
.fs-col-cards {
    width: 50%;
    display: flex;
    flex-direction: column;
    height: 100%;
}

.fs-col-filters {
    border-right: 1px solid #f1f5f9;
    background: #fff;
}

.fs-col-cards {
    background: #f8fafc;
}

/* Destra (50%) */
.fs-right-half {
    width: 50%;
    height: 100%;
    position: relative;
}

.fs-map-canvas {
    width: 100%;
    height: 100%;
}

/* --- CONTROLLI FLUTTUANTI --- */
.fs-map-controls {
    position: absolute;
    top: 20px;
    left: 20px;
    right: 20px;
    display: flex;
    justify-content: space-between;
    z-index: 1000;
    pointer-events: none;
    /* Fondamentale per muovere la mappa sotto */
}

.fs-floating-search {
    pointer-events: auto;
    background: white;
    padding: 10px 20px;
    border-radius: 50px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: center;
    gap: 10px;
    width: 320px;
}

.fs-floating-search input {
    border: none;
    outline: none;
    width: 100%;
    font-weight: 500;
}

.fs-close-circle {
    pointer-events: auto;
    background: white;
    border: none;
    width: 45px;
    height: 45px;
    border-radius: 50%;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    font-size: 1.2rem;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* --- DETTAGLI CARD E PANNELLI --- */
.fs-panel-header {
    padding: 20px;
    border-bottom: 1px solid #f1f5f9;
    background: #00408A;
}

.fs-panel-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: white;
}

.fs-scroll-content {
    flex: 1;
    overflow-y: auto;
    padding: 15px;
}

.fs-mini-card {
    background: white;
    border: 1px solid #c5d4eb;
    border-radius: 10px;
    padding: 12px;
    margin-bottom: 12px;
    display: flex;
    gap: 12px;
    cursor: pointer;
    transition: 0.2s;
}

.fs-mini-card:hover {
    border-color: #006ce4;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.mini-thumb {
    width: 60px;
    height: 60px;
    background: #003580;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.mini-thumb .gcard-letter-box {
    font-size: 1.5rem;
}

.mini-details h4 {
    margin: 0;
    font-size: 0.9rem;
    color: #006ce4;
}

.mini-details p {
    margin: 2px 0;
    font-size: 0.75rem;
    color: #64748b;
}

.mini-price {
    font-weight: bold;
    font-size: 0.85rem;
    color: #1e293b;
}

/* Stile per il marker divIcon */
:deep(.custom-garage-marker) {
    background: none;
    border: none;
}

/* Stile base del pin (già presente, assicurati sia così) */
:deep(.marker-pin) {
    width: 18px;
    height: 18px;
    background-color: #00408A;
    border: 2px solid #ffffff;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
    /* Animazione fluida per il bagliore */
}

/* EFFETTO ILLUMINAZIONE */
:deep(.custom-garage-marker.is-active .marker-pin) {
    background-color: #006ce4 !important;
    transform: scale(1.4);
    border-color: #fff;
    box-shadow: 0 0 20px #006ce4, 0 0 10px rgba(255, 204, 0, 0.6);
    z-index: 1000 !important;
}

:deep(.custom-garage-marker:hover .marker-pin) {
    transform: scale(1.2);
    background-color: #006ce4;
}

:deep(.map-popup-content) {
    font-family: 'Inter', sans-serif;
    padding: 5px;
}

:deep(.popup-detail-link) {
    display: inline-block;
    margin-top: 8px;
    color: #006ce4;
    text-decoration: none;
    font-weight: 700;
    font-size: 0.85rem;
}

:deep(.popup-detail-link:hover) {
    text-decoration: underline;
}

/* tasto per la reset view */
.fs-reset-view {
    pointer-events: auto;
    background: white;
    border: none;
    width: 45px;
    height: 45px;
    border-radius: 50%;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 10px;
    transition: transform 0.2s;
}

.fs-reset-view:hover {
    transform: scale(1.1);
    background-color: #f8fafc;
}


.fs-floating-search {
    margin-right: auto;
}
</style>