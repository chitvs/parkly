// Gestisce la mappa interattiva (Leaflet/OpenStreetMap) per permettere al 
// gestore di posizionare il pin del proprio garage.

import { ref } from 'vue'

export function useGarageMapGestore() {

    // Inizializzazione 

    const calcolandoCoordinate = ref(false)
    let mapInstance = null
    let markerInstance = null

    // Carica Leaflet dinamicamente solo quando serve, per non appesantire il bundle iniziale
    const loadLeaflet = () => {
        return new Promise((resolve) => {
            if (window.L) return resolve()
            const css = document.createElement('link')
            css.rel = 'stylesheet'
            css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
            document.head.appendChild(css)
            const script = document.createElement('script')
            script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
            script.onload = resolve
            document.head.appendChild(script)
        })
    }

    // Gestione interfaccia mappa

    // Aggiorna visivamente il marker sulla mappa
    const updateMarker = (lat, lng) => {
        if (!mapInstance) return
        if (markerInstance) mapInstance.removeLayer(markerInstance)
        markerInstance = window.L.marker([lat, lng]).addTo(mapInstance)
        mapInstance.setView([lat, lng], 18)
    }

    // Inizializza la mappa e gestisce il click manuale dell'utente
    const initMap = (elementId, defaultLat, defaultLng, onMapClick) => {
        if (mapInstance) mapInstance.remove()

        // Coordinate di default (Roma se non specificate)
        const lat = defaultLat || 41.9028
        const lng = defaultLng || 12.4964

        mapInstance = window.L.map(elementId, { attributionControl: false }).setView([lat, lng], 13)
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapInstance)

        // Gestione del click sulla mappa
        mapInstance.on('click', (e) => {
            const newLat = parseFloat(e.latlng.lat.toFixed(6))
            const newLng = parseFloat(e.latlng.lng.toFixed(6))
            updateMarker(newLat, newLng)
            
            // Passa le coordinate al componente che usa il composable
            if (onMapClick) onMapClick(newLat, newLng)
        })

        if (defaultLat && defaultLng) {
            updateMarker(defaultLat, defaultLng)
        }
    }

    // Cerca le coordinate partendo dall'indirizzo testuale
    const calcolaCoordinate = async (via, civico, citta, provincia) => {
        if (!via || !civico || !citta || !provincia) {
            return { success: false, error: 'Compila Via, Civico, Città e Provincia prima di cercare la zona.' }
        }

        calcolandoCoordinate.value = true
        try {
            const query = encodeURIComponent(`${via} ${civico}, ${citta}, ${provincia}, Italy`)
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`)
            const data = await res.json()

            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat)
                const lon = parseFloat(data[0].lon)
                updateMarker(lat, lon)
                return { success: true, lat, lon }
            } else {
                return { success: false, error: 'Zona non trovata. Naviga manualmente sulla mappa e clicca sul tuo garage.' }
            }
        } catch {
            return { success: false, error: 'Errore durante la ricerca. Riprova.' }
        } finally {
            calcolandoCoordinate.value = false
        }
    }

    return {
        calcolandoCoordinate,
        loadLeaflet,
        initMap,
        updateMarker,
        calcolaCoordinate
    }
}