<script setup>
import { ref, onMounted, nextTick, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'
import Pagination from '../components/Pagination.vue'
import SearchBar from '../components/SearchBar.vue'
import GarageFilters from '../components/GarageFilters.vue'
import { useGarages } from '../composables/useGarages.js'
import { useGarageFilters } from '../composables/useGarageFilters.js'
import { useSpatialSearch } from '../composables/useSpatialSearch.js'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const router = useRouter()
const route = useRoute()

const MAP_CENTER = [41.9028, 12.4964]
const TILE_LAYER = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

const isMapFullscreen = ref(false)
const hoveredGarageId = ref(null)

const searchLocation = ref('')
const checkIn = ref('')
const checkOut = ref('')

const mapContainer = ref(null)
const fullMapContainer = ref(null)
let mapInstance = null
let fullMapInstance = null
let searchMarkerInstance = null

const markersRefs = {}

const { isLoading, garages, fetchGarages } = useGarages()

const {
    filter24h, maxPrice, minHeight, filterCoperto,
    filterElettrico, filterDisabili, filterTipoVeicolo,
    resetTechnicalFilters, passaFiltriTecnici
} = useGarageFilters()

const getDisplayPrice = (garage) => {
    // se l'utente ha selezionato un veicolo specifico e il backend ci ha mandato i dati
    if (filterTipoVeicolo.value !== 'ALL' && garage.tariffeVeicoli && garage.tariffeVeicoli[filterTipoVeicolo.value]) {
        return Number(garage.tariffeVeicoli[filterTipoVeicolo.value]).toFixed(2);
    }
    // altrimenti mostra la tariffa base generica
    return Number(garage.tariffabase).toFixed(2);
}
//

const {
    showExtendedResults,
    matchedPOI,
    garagesFiltrati,
    hasMoreResults
} = useSpatialSearch(searchLocation, garages, passaFiltriTecnici)

const paginaCorrente = ref(1)
const elementiPerPagina = ref(5)

const garagesPaginati = computed(() => {
    const inizio = (paginaCorrente.value - 1) * elementiPerPagina.value
    return garagesFiltrati.value.slice(inizio, inizio + elementiPerPagina.value)
})

const scrollInAlto = () => window.scrollTo({ top: 0, behavior: 'smooth' })

watch(searchLocation, () => {
    if (!searchLocation.value.trim() && searchMarkerInstance) {
        searchMarkerInstance.remove()
        searchMarkerInstance = null
        if (fullMapInstance) fullMapInstance.flyTo(MAP_CENTER, 11, { duration: 1.0 })
    }
})

watch([checkIn, checkOut], async ([newIn, newOut]) => {
    if ((newIn && newOut) || (!newIn && !newOut)) {
        if (newIn && newOut && new Date(newIn) >= new Date(newOut)) {
            alert("La data di check-out deve essere successiva a quella di check-in")
            return
        }
        await fetchGarages(newIn, newOut)
    }
})

watch(garagesFiltrati, (newGarages) => {
    paginaCorrente.value = 1
    if (!fullMapInstance) return
    const activeIds = newGarages.map(g => g.id_garage)
    Object.keys(markersRefs).forEach(id => {
        const marker = markersRefs[id]
        activeIds.includes(Number(id)) ? marker.addTo(fullMapInstance) : marker.remove()
    })
}, { deep: true })

onMounted(async () => {

    if (route.query.location) searchLocation.value = route.query.location
    if (route.query.checkIn) checkIn.value = route.query.checkIn
    if (route.query.checkOut) checkOut.value = route.query.checkOut

    await fetchGarages(checkIn.value, checkOut.value)
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

const resetFilters = () => {
    resetTechnicalFilters()
    searchLocation.value = ''
    checkIn.value = ''
    checkOut.value = ''
}


const setHover = (garage, active) => {
    Object.values(markersRefs).forEach(m => {
        m.getElement()?.classList.remove('is-active')
        m.setZIndexOffset(0)
    })

    if (active) {
        hoveredGarageId.value = garage.id_garage
        const currentMarker = markersRefs[garage.id_garage]
        if (currentMarker) {
            currentMarker.getElement()?.classList.add('is-active')
            currentMarker.setZIndexOffset(9000)
        }
    } else {
        hoveredGarageId.value = null
    }
}

const selectGarage = (garage) => {
    if (!fullMapInstance || !garage.latitudine) return
    fullMapInstance.flyTo([garage.latitudine, garage.longitudine], 15, { duration: 1.2 })
    markersRefs[garage.id_garage]?.openPopup()
    setHover(garage, true)
}

const resetMapView = () => {
    if (!fullMapInstance) return
    setHover(null, false)
    fullMapInstance.closePopup()
    fullMapInstance.flyTo(MAP_CENTER, 11, { duration: 1.0 })
}

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

                marker.on('mouseover', () => setHover(g, true))
                marker.on('mouseout', () => setHover(g, false))
            }
        })
        if (matchedPOI.value) {
            placeSearchMarker(matchedPOI.value.coords.lat, matchedPOI.value.coords.lng, matchedPOI.value.name)
        }

    }
}

const placeSearchMarker = (lat, lon, name, openPopup = false) => {
    if (searchMarkerInstance) {
        searchMarkerInstance.remove()
    }
    const redIcon = L.divIcon({
        className: 'custom-search-marker',
        html: '<div class="search-marker-pin"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    })
    searchMarkerInstance = L.marker([lat, lon], { icon: redIcon })
        .addTo(fullMapInstance)
        .bindPopup(`<div style="text-align:center; font-weight:bold; font-family:Inter, sans-serif;">${name}</div>`)
    if (openPopup) searchMarkerInstance.openPopup()
}

const closeMapFullscreen = () => {
    isMapFullscreen.value = false
    document.body.style.overflow = ''
    if (fullMapInstance) {
        fullMapInstance.remove()
        fullMapInstance = null
    }
    if (searchMarkerInstance) {
        searchMarkerInstance = null
    }
    Object.keys(markersRefs).forEach(key => delete markersRefs[key])
}

const goToDetail = (garage) => {
    const queryParams = {}
    if (checkIn.value) queryParams.inizio = checkIn.value
    if (checkOut.value) queryParams.fine = checkOut.value
    router.push({
        name: 'garage-detail',
        params: { id: garage.id_garage },
        query: queryParams
    })
}

const handleSuggestionSelected = (place) => {
    if (fullMapInstance && place.lat && place.lon) {
        fullMapInstance.flyTo([place.lat, place.lon], 14, { duration: 1.5 })
        placeSearchMarker(place.lat, place.lon, place.name, true)
    }
}
</script>

<template>
    <Header />
    <div class="garage-wrapper">

        <section class="search-area">
            <div class="search-container">
                <SearchBar v-model:location="searchLocation" v-model:checkIn="checkIn" v-model:checkOut="checkOut"
                    @suggestion-selected="handleSuggestionSelected" />
            </div>
        </section>

        <div class="page-body">
            <aside class="sidebar">
                <div class="zone-map">
                    <div ref="mapContainer" class="leaflet-map-canvas"></div>
                    <div class="map-overlay">
                        <button class="map-view-btn" @click="openMapFullscreen">
                            <img src="../assets/pin.svg" class="icon-card" alt="Pin"
                                            style="transform: scale(1.5) translateY(-1px); filter:  invert(1);" /> Vedi su mappa
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
                                                    <div v-for="garage in garagesPaginati"
                                                        :key="'fs-' + garage.id_garage" class="fs-mini-card"
                                                        @mouseenter="setHover(garage, true)"
                                                        @click="selectGarage(garage)">
                                                        <div class="mini-thumb">
                                                            <div class="gcard-letter-box">{{ garage.nome.charAt(0) }}
                                                            </div>
                                                        </div>
                                                        <div class="mini-details">
                                                            <h4>{{ garage.nome }}</h4>
                                                            <p>{{ garage.indirizzo.slice(0, 30) }}...</p>
                                                            <p v-if="garage.displayPOIName">
                                                                a {{ garage.displayDistanceLabel }} da {{
                                                                    garage.displayPOIName }}
                                                            </p>
                                                            <span class="mini-price">€{{ getDisplayPrice(garage) }}/ora</span>
                                                        </div>
                                                    </div>

                                                    <div v-if="garagesFiltrati.length > 0"
                                                        class="mt-3 d-flex justify-content-center">
                                                        <Pagination compact v-model:paginaCorrente="paginaCorrente"
                                                            v-model:elementiPerPagina="elementiPerPagina"
                                                            :totaleElementi="garagesFiltrati.length"
                                                            @cambio-pagina="scrollInAlto" />
                                                    </div>

                                                    <div v-if="hasMoreResults" class="fs-extended-results-mini">
                                                        <p>Ci sono altri parcheggi entro 5km</p>
                                                        <button @click.stop="showExtendedResults = true"
                                                            class="btn-show-more-mini">
                                                            Mostra altri
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="fs-right-half">
                                            <div ref="fullMapContainer" class="fs-map-canvas"></div>

                                            <div class="fs-map-controls">
                                                <div class="fs-floating-search">
                                                    <SearchBar v-model:location="searchLocation" :simple="true"
                                                        placeholder="Cerca sulla mappa..."
                                                        @suggestion-selected="handleSuggestionSelected" />
                                                </div>
                                                <button class="fs-reset-view" @click="resetMapView"
                                                    title="Ripristina visuale">
                                                    <span style="font-size: 1.2rem;"><img src="../assets/refresh.svg"
                                                            class="icon-card" alt="Pin"
                                                            style="transform:translateX(3px) translateY(-0.5px) scale(1.7)" /></span>
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

            <main class="zone-results">
                <div v-if="isLoading" class="loading-state text-center py-5">
                    <div class="spinner"></div>
                    <p>Caricamento parcheggi...</p>
                </div>

                <div v-else-if="garagesFiltrati.length === 0 && !hasMoreResults" class="empty-state">
                    <p>Nessun garage trovato a {{ searchLocation || 'destinazione' }}.</p>
                </div>

                <template v-else>
                    <div class="results-header" v-if="garagesFiltrati.length > 0">
                        <h2 class="results-count">
                            Risultati: <span>{{ garagesFiltrati.length }} parcheggi
                                trovati</span>
                        </h2>
                    </div>

                    <div class="garage-list">
                        <div v-for="garage in garagesPaginati" :key="garage.id_garage" class="garage-card"
                            @click="goToDetail(garage)">

                            <div class="gcard-thumb">
                                <div class="gcard-letter-box">{{ garage.nome.charAt(0) }}</div>
                                <span v-if="garage.is24h" class="gcard-badge-top">24/7</span>
                            </div>

                            <div class="gcard-main">
                                <h3 class="gcard-title">{{ garage.nome }}</h3>
                                <div class="gcard-location">
                                    <span>
                                        <img src="../assets/pin.svg" class="icon-card" alt="Pin"
                                            style="transform: translateY(-3px)" />{{ garage.indirizzo }}
                                    </span>
                                    <div v-if="garage.displayPOIName" class="distance-tag">
                                        <img src="../assets/distance.svg" class="icon-card" alt="Distanza"
                                            style="transform: translateY(-3px) scale(1.5)" />
                                        a {{ garage.displayDistanceLabel }} da {{ garage.displayPOIName }}
                                    </div>
                                </div>

                                <div class="gcard-services">
                                    <span class="service-badge info">
                                        <img src="../assets/orologio.svg" class="icon-card" alt="Orario" />
                                        {{ garage.is24h ? '24/7' : garage.orarioapertura.slice(0, 5) + ' - ' +
                                            garage.orariochiusura.slice(0, 5) }}
                                    </span>
                                    <span v-if="garage.altezzamassima" class="service-badge info">
                                        <img src="../assets/altezza_massima.svg" class="icon-card"
                                            alt="Altezza massima" />
                                        Max: {{ garage.altezzamassima }}m
                                    </span>
                                    <span v-if="garage.hasCoperto" class="service-badge feature">
                                        <img src="../assets/parcheggio_coperto.svg" class="icon-card" alt="Coperto" />
                                        Coperto
                                    </span>
                                    <span v-if="garage.hasElettrico" class="service-badge feature">
                                        <img src="../assets/electricity.svg" class="icon-card"
                                            alt="Ricarica elettrica" />
                                        Ricarica
                                    </span>
                                    <span v-if="garage.hasDisabili" class="service-badge feature">
                                        <img src="../assets/handicap.svg" class="icon-card"
                                            alt="Accessibile disabili" />
                                        Disabili
                                    </span>
                                </div>
                            </div>

                            <div class="gcard-right">
                                <div class="gcard-price-block">
                                    <span class="price-label">
                                        {{ filterTipoVeicolo === 'ALL' ? 'TARIFFA BASE' : 'TARIFFA ' + filterTipoVeicolo }}
                                    </span>
                                    <span class="price-value">€{{ getDisplayPrice(garage) }}/ora</span>
                                </div>
                            </div>
                        </div>

                        <div v-if="garagesFiltrati.length > 0" class="mt-3 px-2">
                            <Pagination v-model:paginaCorrente="paginaCorrente"
                                v-model:elementiPerPagina="elementiPerPagina"
                                :totaleElementi="garagesFiltrati.length" />
                        </div>

                        <div v-if="hasMoreResults" class="extended-results-container">
                            <p class="extended-info">Ci sono altri parcheggi un po' più distanti...</p>
                            <button @click.stop="showExtendedResults = true" class="btn-show-more">
                                Visualizza altri parcheggi (entro 5km)
                            </button>
                        </div>
                    </div>
                </template>
            </main>
        </div>
    </div>
    <Footer />
</template>

<style scoped>
.garage-wrapper {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-color: #f8fafc;
}

.search-area {
    background-color: #002E5C;
    padding: 2.5rem 0;
}

.search-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1.5rem;
}

.page-body {
    display: flex;
    width: 100%;
    max-width: 90% !important;
    margin: 2rem auto;
    padding: 0 0.5rem;
    gap: 1.5rem;
    align-items: flex-start;
}

.sidebar {
    width: 300px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    position: sticky;
    top: 20px;
    height: fit-content;
}

.zone-map {
    width: 100%;
    height: 180px;
    border-radius: 20px;
    overflow: hidden;
    position: relative;
    border: 1px solid #cbd5e1;
}

.leaflet-map-canvas {
    width: 100%;
    height: 100%;
    z-index: 1;
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

.zone-filters {
    background-color: #ffffff;
    border-radius: 12px;
    border: 1px solid #cbd5e1;
    padding: 1.5rem;
}

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

.zone-results {
    flex: 1;
}

.garage-list {
    display: flex;
    flex-direction: column;
}

.garage-card {
    display: flex;
    background: white;
    border: 1px solid #c5d4eb;
    border-radius: 8px;
    margin-bottom: 16px;
    overflow: hidden;
    height: 180px;
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
    margin-top: 10px;
}

.service-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 50px;
    font-size: 0.75rem;
    font-weight: 600;
    border: 1px solid transparent;
}

.service-badge.info {
    background-color: #f1f5f9;
    color: #475569;
    border-color: #e2e8f0;
}

.service-badge.feature {
    background-color: #e8f5e9;
    color: #0e701b;
    border-color: #c8e6c9;
}

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
    border-left: 1px solid #ffffff;
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

.fs-left-half {
    width: 50%;
    display: flex;
    height: 100%;
    border-right: 1px solid #e2e8f0;
}

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

.fs-right-half {
    width: 50%;
    height: 100%;
    position: relative;
}

.fs-map-canvas {
    width: 100%;
    height: 100%;
}

.fs-map-controls {
    position: absolute;
    top: 20px;
    left: 20px;
    right: 20px;
    display: flex;
    justify-content: space-between;
    z-index: 1000;
    pointer-events: none;
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
    background-color: #ffffff;
    box-shadow: 0 4px 15px rgba(0, 108, 228, 0.2);
    transform: translateY(-2px);
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

.extended-results-container {
    text-align: center;
    padding: 2rem;
    background: #f1f5f9;
    border: 2px dashed #cbd5e1;
    border-radius: 12px;
    margin-top: 1rem;
}

.extended-info {
    color: #64748b;
    font-size: 0.9rem;
    margin-bottom: 1rem;
}

.btn-show-more {
    background-color: white;
    color: #00408A;
    border: 2px solid #00408A;
    padding: 10px 24px;
    border-radius: 8px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-show-more:hover {
    background-color: #00408A;
    color: white;
}

.fs-extended-results-mini {
    text-align: center;
    padding: 15px;
    background: #f1f5f9;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    margin-top: 10px;
}

.fs-extended-results-mini p {
    font-size: 0.75rem;
    color: #64748b;
    margin-bottom: 8px;
}

.btn-show-more-mini {
    background-color: white;
    color: #00408A;
    border: 1.5px solid #00408A;
    padding: 6px 16px;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-show-more-mini:hover {
    background-color: #00408A;
    color: white;
}

:deep(.custom-search-marker) {
    background: none;
    border: none;
    overflow: visible !important;
}

:deep(.custom-garage-marker) {
    background: none;
    border: none;
}

:deep(.marker-pin) {
    width: 18px;
    height: 18px;
    background-color: #00408A;
    border: 2px solid #ffffff;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
}

:deep(.custom-garage-marker.is-active .marker-pin),
:deep(.custom-garage-marker:hover .marker-pin) {
    background-color: #006ce4 !important;
    transform: scale(1.3);
    box-shadow: 0 0 20px rgba(0, 108, 228, 0.6);
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

:deep(.search-marker-pin) {
    width: 20px;
    height: 20px;
    background-color: #dc3545;
    /* Rosso acceso */
    border: 2px solid #ffffff;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    animation: pulse-red 1.5s infinite;
}

@keyframes pulse-red {
    0% {
        box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7);
    }

    70% {
        box-shadow: 0 0 0 10px rgba(220, 53, 69, 0);
    }

    100% {
        box-shadow: 0 0 0 0 rgba(220, 53, 69, 0);
    }
}
</style>