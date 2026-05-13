<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { authStore } from '../store/auth.js'
import { walletStore } from '../store/wallet.js'
import * as bootstrap from 'bootstrap'
import 'bootstrap-icons/font/bootstrap-icons.css'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'
import PlanimetriaGarage from '../components/PlanimetriaGarage.vue'
import ChatBox from '../components/ChatBox.vue'
import { getSocket } from '../composables/useChat.js'

//foto profilo standard
import defaultAvatarUrl from '../assets/default-avatar.png'

// ─── Permessi ───────────────────────────────────────────────────────────────
const isGestore = computed(() => authStore.utente?.ruolo === 'GESTORE')

// ─── Navigazione ────────────────────────────────────────────────────────────
const vistaAttiva = ref('statistiche')
const isLoading   = ref(false)
const staSalvando = ref(false)
const messaggio   = ref(null)
const erroriValidazione = ref({})

// ─── Dati principali ────────────────────────────────────────────────────────
const mieiGarage           = ref([])
const storicoPrenotazioni  = ref([])
const allerteStato         = ref([])
const occupazioneGarage    = ref({})
const postiPerGarage       = ref({})
const reRenderKey          = ref(0)

const filtroInizio = ref('')
const filtroFine   = ref('')

// ─── Chat in tempo reale ─────────────────────────────────────────────────────
const chatSelezionata = ref(null)
let socket = null

const handleNuovoMessaggio = (msg) => {
  const prenotazione = storicoPrenotazioni.value.find(
    p => Number(p.id_prenotazione) === Number(msg.id_prenotazione)
  )
  if (prenotazione) {
    const chatAperta =
      chatSelezionata.value &&
      chatSelezionata.value.idPrenotazione === Number(msg.id_prenotazione)
    if (!chatAperta) {
      prenotazione.nonletti = (prenotazione.nonletti || 0) + 1
    }
  }
}

const apriChat = async (prenotazione) => {
  const idGarage  = Number(prenotazione.id_garage)
  const idCliente = Number(prenotazione.id_utente)
  if (!idGarage || !idCliente || isNaN(idGarage) || isNaN(idCliente)) {
    console.error('[Chat] Dati mancanti sulla prenotazione:', prenotazione)
    return
  }
  prenotazione.nonletti = 0
  chatSelezionata.value = null
  await nextTick()
  chatSelezionata.value = {
    idPrenotazione:   Number(prenotazione.id_prenotazione),
    idGarage,
    idDestinatario:   idCliente,
    nomeDestinatario: prenotazione.nomecliente
      ? prenotazione.nomecliente + ' ' + (prenotazione.cognomecliente || '')
      : 'Cliente'
  }
}

const chiudiChat = () => { chatSelezionata.value = null }

// ─── Mappa Leaflet ───────────────────────────────────────────────────────────
const calcolandoCoordinate = ref(false)
let mapInstance    = null
let markerInstance = null

const nuovoGarage = ref({
  nome: '', descrizione: '',
  via: '', civico: '', cap: '', citta: '', provincia: '',
  latitudine: null, longitudine: null,
  tariffabase: null,
  tariffamoto: null,
  tariffafurgone: null,
  sovrapprezzoelettrica: null,
  scontodisabili: null,
  altezzamassima: null,
  orarioapertura: '08:00', orariochiusura: '20:00',
  is24h: false
})

const loadLeaflet = () => {
  return new Promise((resolve) => {
    if (window.L) return resolve()
    const css = document.createElement('link')
    css.rel  = 'stylesheet'
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(css)
    const script    = document.createElement('script')
    script.src      = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload   = resolve
    document.head.appendChild(script)
  })
}

const initMap = () => {
  if (mapInstance) mapInstance.remove()
  const defaultLat = nuovoGarage.value.latitudine || 41.9028
  const defaultLng = nuovoGarage.value.longitudine || 12.4964
  mapInstance = L.map('mappa-garage', { attributionControl: false }).setView([defaultLat, defaultLng], 13)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapInstance)
  mapInstance.on('click', (e) => {
    const lat = parseFloat(e.latlng.lat.toFixed(6))
    const lng = parseFloat(e.latlng.lng.toFixed(6))
    nuovoGarage.value.latitudine  = lat
    nuovoGarage.value.longitudine = lng
    erroriValidazione.value.coordinate = null
    updateMarker(lat, lng)
  })
  if (nuovoGarage.value.latitudine && nuovoGarage.value.longitudine) {
    updateMarker(nuovoGarage.value.latitudine, nuovoGarage.value.longitudine)
  }
}

const updateMarker = (lat, lng) => {
  if (markerInstance) mapInstance.removeLayer(markerInstance)
  markerInstance = L.marker([lat, lng]).addTo(mapInstance)
  mapInstance.setView([lat, lng], 18)
}

const calcolaCoordinate = async () => {
  const { via, civico, citta, provincia } = nuovoGarage.value
  if (!via || !civico || !citta || !provincia) {
    messaggio.value = { tipo: 'error', testo: 'Compila Via, Civico, Città e Provincia prima di cercare la zona.' }
    return
  }
  calcolandoCoordinate.value = true
  try {
    const query = encodeURIComponent(`${via} ${civico}, ${citta}, ${provincia}, Italy`)
    const res   = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`)
    const data  = await res.json()
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat)
      const lon = parseFloat(data[0].lon)
      nuovoGarage.value.latitudine  = lat
      nuovoGarage.value.longitudine = lon
      erroriValidazione.value.coordinate = null
      updateMarker(lat, lon)
      messaggio.value = null
    } else {
      messaggio.value = { tipo: 'error', testo: 'Zona non trovata. Naviga manualmente sulla mappa e clicca sul tuo garage.' }
    }
  } catch {
    messaggio.value = { tipo: 'error', testo: 'Errore durante la ricerca. Riprova.' }
  } finally {
    calcolandoCoordinate.value = false
  }
}

// ─── Canvas / Planimetria ────────────────────────────────────────────────────
const nuovoPosto        = ref({ codice: '', tipo: 'AUTO', isDisabili: false, isElettrica: false, isCoperto: true })
const postiConfigurati  = ref([])
const dimensioniMappa   = ref({ righe: 6, colonne: 12 })
const griglia           = ref([])
const strumentoAttivo   = ref(null)

const MAPPA_DIMENSIONI = {
  'MOTO':    { w: 1, h: 1 },
  'AUTO':    { w: 2, h: 1 },
  'FURGONE': { w: 2, h: 2 }
}

const ridimensionaGriglia = () => {
  const nuova = []
  for (let r = 0; r < dimensioniMappa.value.righe; r++) {
    const riga = []
    for (let c = 0; c < dimensioniMappa.value.colonne; c++) {
      riga.push(griglia.value[r]?.[c] || null)
    }
    nuova.push(riga)
  }
  griglia.value = nuova
}

const codiciPosizionati = computed(() => {
  const codici = new Set()
  griglia.value.forEach(riga => riga.forEach(cella => { if (cella?.isRoot) codici.add(cella.codice) }))
  return codici
})

const generaCodiceAutomatico = (tipo) => {
  const prefisso      = tipo.charAt(0).toUpperCase()
  const postiDelTipo  = postiConfigurati.value.filter(p => p.tipo === tipo)
  let maxNum = 0
  postiDelTipo.forEach(p => {
    const num = parseInt(p.codice.replace(/\D/g, ''), 10)
    if (!isNaN(num) && num > maxNum) maxNum = num
  })
  return `${prefisso}${String(maxNum + 1).padStart(2, '0')}`
}

const autoCompilaPosto = () => {
  const cod = nuovoPosto.value.codice.toUpperCase()
  if (!cod) return
  if (cod.startsWith('M'))      nuovoPosto.value.tipo = 'MOTO'
  else if (cod.startsWith('F')) nuovoPosto.value.tipo = 'FURGONE'
  else                          nuovoPosto.value.tipo = 'AUTO'
  nuovoPosto.value.isElettrica = cod.startsWith('E')
  nuovoPosto.value.isDisabili  = cod.startsWith('D')
}

const aggiungiPostoConfigurato = () => {
  const cod = nuovoPosto.value.codice.trim().toUpperCase() || generaCodiceAutomatico(nuovoPosto.value.tipo)
  if (postiConfigurati.value.find(p => p.codice === cod)) {
    messaggio.value = { tipo: 'error', testo: 'Codice posto già esistente!' }
    return
  }
  postiConfigurati.value.push({
    codice:      cod,
    tipo:        nuovoPosto.value.tipo,
    isElettrica: nuovoPosto.value.isElettrica,
    isDisabili:  nuovoPosto.value.isDisabili,
    isCoperto:   nuovoPosto.value.isCoperto
  })
  const tipoCorrente = nuovoPosto.value.tipo
  nuovoPosto.value = { codice: '', tipo: tipoCorrente, isDisabili: false, isElettrica: false, isCoperto: true }
}

const selezionaStrumento = (posto) => {
  const dim = MAPPA_DIMENSIONI[posto.tipo]
  strumentoAttivo.value = { ...posto, w: dim.w, h: dim.h }
}

const rimuoviItemIn = (r, c) => {
  const cella = griglia.value[r][c]
  if (!cella) return
  const rootCella = griglia.value[cella.rootR][cella.rootC]
  for (let i = 0; i < rootCella.h; i++) {
    for (let j = 0; j < rootCella.w; j++) {
      if (griglia.value[cella.rootR + i]?.[cella.rootC + j] !== undefined) {
        griglia.value[cella.rootR + i][cella.rootC + j] = null
      }
    }
  }
}

const rimuoviPostoConfigurato = (index) => {
  const cod = postiConfigurati.value[index].codice
  postiConfigurati.value.splice(index, 1)
  for (let r = 0; r < dimensioniMappa.value.righe; r++) {
    for (let c = 0; c < dimensioniMappa.value.colonne; c++) {
      const cella = griglia.value[r][c]
      if (cella?.codice === cod && cella.isRoot) rimuoviItemIn(r, c)
    }
  }
}

const clickCella = (r, c) => {
  if (strumentoAttivo.value === 'GOMMA') { rimuoviItemIn(r, c); return }
  if (!strumentoAttivo.value) return
  const p = strumentoAttivo.value
  if (codiciPosizionati.value.has(p.codice)) {
    messaggio.value = { tipo: 'error', testo: 'Posto già posizionato. Usa la gomma per rimuoverlo prima di spostarlo.' }
    return
  }
  if (r + p.h > dimensioniMappa.value.righe || c + p.w > dimensioniMappa.value.colonne) {
    messaggio.value = { tipo: 'error', testo: 'Spazio insufficiente: uscirai dai bordi della planimetria.' }
    return
  }
  for (let i = 0; i < p.h; i++) {
    for (let j = 0; j < p.w; j++) {
      if (griglia.value[r + i][c + j] !== null) {
        messaggio.value = { tipo: 'error', testo: 'Spazio occupato da un altro veicolo.' }
        return
      }
    }
  }
  for (let i = 0; i < p.h; i++) {
    for (let j = 0; j < p.w; j++) {
      griglia.value[r + i][c + j] = {
        isRoot: i === 0 && j === 0,
        codice: p.codice, tipo: p.tipo,
        w: p.w, h: p.h, rootR: r, rootC: c
      }
    }
  }
  strumentoAttivo.value = null
}

const stringaMappaGenerata = computed(() => {
  if (!griglia.value.length) return ''
  const righeStr = []
  for (let r = 0; r < dimensioniMappa.value.righe; r++) {
    const celleStr = []
    for (let c = 0; c < dimensioniMappa.value.colonne; c++) {
      const cella = griglia.value[r][c]
      if (!cella)          celleStr.push('X:1x1')
      else if (cella.isRoot) celleStr.push(`${cella.codice}:${cella.w}x${cella.h}`)
    }
    if (celleStr.length > 0) righeStr.push(celleStr.join('-'))
  }
  const mappaFinale = righeStr.join('\n')
  return mappaFinale.replace(/X:1x1(-X:1x1)*\n/g, '').trim() === 'X:1x1' ? '' : mappaFinale
})

const postiConvertitiPerAnteprima = computed(() =>
  postiConfigurati.value.map(p => ({
    codiceposto: p.codice, tipoveicolo: p.tipo,
    iselettrica: p.isElettrica, isdisabili: p.isDisabili,
    iscoperto: p.isCoperto, is_occupato: false
  }))
)

// ─── Computed statistiche ────────────────────────────────────────────────────
const menuFiltrato = computed(() => {
  if (mieiGarage.value.length === 0) {
    return navItems.filter(item => item.id === 'aggiungi') 
  }
  return navItems
})

const guadagnoMese = computed(() => {
  const ora = new Date()
  return storicoPrenotazioni.value
    .filter(p => p.stato !== 'ANNULLATA'
      && new Date(p.iniziososta).getMonth()    === ora.getMonth()
      && new Date(p.iniziososta).getFullYear() === ora.getFullYear())
    .reduce((acc, p) => acc + parseFloat(p.prezzototale || 0), 0)
    .toFixed(2)
})
const prenotazioniAttive = computed(() => storicoPrenotazioni.value.filter(p => p.stato === 'ATTIVA').length)
const getOccupancy = (idGarage) => occupazioneGarage.value[idGarage] ?? 0

// ─── Utility ─────────────────────────────────────────────────────────────────
const formatData = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
       + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}
const statoBadge = (stato) =>
  stato === 'ATTIVA' ? 'badge--green' : stato === 'ANNULLATA' ? 'badge--red' : 'badge--gray'

// ─── API ─────────────────────────────────────────────────────────────────────
const caricaDati = async () => {
  if (!isGestore.value) return
  isLoading.value = true
  try {
    await Promise.all([caricaGarage(), caricaStorico(), caricaStato()])
  } finally {
    isLoading.value = false
  }
}

const caricaGarage = async () => {
  const res = await fetch('/api/garage/garages-gestore', { credentials: 'include' })
  if (!res.ok) return
  const data = await res.json()
  mieiGarage.value = data
  await Promise.all(data.map(async (g) => {
    try {
      const r = await fetch(`/api/garage/${g.id_garage}/posti`, { credentials: 'include' })
      if (r.ok) postiPerGarage.value[g.id_garage] = (await r.json()).posti
    } catch { }
    try {
      const r = await fetch(`/api/garage/${g.id_garage}/occupazione`, { credentials: 'include' })
      if (r.ok) occupazioneGarage.value[g.id_garage] = Math.round((await r.json()).percentuale)
    } catch { }
  }))
  reRenderKey.value++
}

const aggiornaMappaOrari = async () => {
  if (!filtroInizio.value || !filtroFine.value) {
    messaggio.value = { tipo: 'error', testo: 'Inserisci orario di inizio e di fine!' }
    return
  }
  const iIso = new Date(filtroInizio.value).toISOString()
  const fIso = new Date(filtroFine.value).toISOString()
  await Promise.all(mieiGarage.value.map(async (g) => {
    try {
      const r = await fetch(`/api/garage/${g.id_garage}/posti?inizio=${iIso}&fine=${fIso}`, { credentials: 'include' })
      if (r.ok) postiPerGarage.value[g.id_garage] = (await r.json()).posti
    } catch (e) { console.error(e) }
  }))
  reRenderKey.value++
}

const caricaStorico = async () => {
  const res = await fetch('/api/prenotazioni/prenotazioni-gestore', { credentials: 'include' })
  if (res.ok) storicoPrenotazioni.value = await res.json()
}

const caricaStato = async () => {
  const res = await fetch('/api/garage/stato-garages-gestore', { credentials: 'include' })
  if (res.ok) allerteStato.value = await res.json()
}

// ─── Validazione & Salvataggio ───────────────────────────────────────────────
const validaForm = () => {
  const errori = {}

  if (!nuovoGarage.value.nome?.trim())      errori.nome      = 'Obbligatorio.'
  if (!nuovoGarage.value.via?.trim())       errori.via       = 'Obbligatorio.'
  if (!nuovoGarage.value.civico?.trim())    errori.civico    = 'Obbligatorio.'
  if (!nuovoGarage.value.cap?.trim())       errori.cap       = 'Obbligatorio.'
  if (!nuovoGarage.value.citta?.trim())     errori.citta     = 'Obbligatorio.'
  if (!nuovoGarage.value.provincia?.trim()) errori.provincia = 'Obbligatorio.'

  if (!nuovoGarage.value.latitudine || !nuovoGarage.value.longitudine) {
    errori.coordinate = 'Clicca sulla mappa per catturare le coordinate esatte.'
  }

  if (!nuovoGarage.value.tariffabase || nuovoGarage.value.tariffabase <= 0) {
    errori.tariffabase = 'La tariffa auto è obbligatoria e > 0.'
  }

  const tipiPresenti    = new Set()
  let necessitaElettrica = false
  let necessitaDisabili  = false
  for (const posto of postiConfigurati.value) {
    tipiPresenti.add(posto.tipo)
    if (posto.isElettrica) necessitaElettrica = true
    if (posto.isDisabili)  necessitaDisabili  = true
  }

  if (tipiPresenti.has('MOTO') && (!nuovoGarage.value.tariffamoto || nuovoGarage.value.tariffamoto <= 0)) {
    errori.tariffamoto = 'Hai creato posti MOTO, la tariffa è obbligatoria!'
  }
  if (tipiPresenti.has('FURGONE') && (!nuovoGarage.value.tariffafurgone || nuovoGarage.value.tariffafurgone <= 0)) {
    errori.tariffafurgone = 'Hai creato posti FURGONE, la tariffa è obbligatoria!'
  }
  if (necessitaElettrica && (nuovoGarage.value.sovrapprezzoelettrica === null || nuovoGarage.value.sovrapprezzoelettrica === '')) {
    errori.sovrapprezzoelettrica = 'Hai creato posti ELETTRICI, imposta un sovrapprezzo (anche 0).'
  } else if (nuovoGarage.value.sovrapprezzoelettrica < 0) {
    errori.sovrapprezzoelettrica = 'Il sovrapprezzo non può essere negativo.'
  }
  if (necessitaDisabili && (nuovoGarage.value.scontodisabili === null || nuovoGarage.value.scontodisabili === '')) {
    errori.scontodisabili = 'Hai creato posti DISABILI, imposta uno sconto (anche 0).'
  } else if (nuovoGarage.value.scontodisabili < 0) {
    errori.scontodisabili = 'Lo sconto non può essere negativo.'
  }

  if (postiConfigurati.value.length === 0) {
    errori.mappatestuale = 'Devi configurare almeno un posto auto.'
  } else if (codiciPosizionati.value.size < postiConfigurati.value.length) {
    errori.mappatestuale = 'Devi posizionare TUTTI i posti creati sulla scacchiera prima di poter pubblicare.'
  }

  erroriValidazione.value = errori
  return Object.keys(errori).length === 0
}

const salvaNuovoGarage = async () => {
  messaggio.value = null
  if (!validaForm()) {
    messaggio.value = { tipo: 'error', testo: 'Controlla i campi in rosso e assicurati di aver posizionato tutti i posti sulla mappa.' }
    return
  }
  staSalvando.value = true

  const indirizzoCompleto = `${nuovoGarage.value.via.trim()} ${nuovoGarage.value.civico.trim()}, ${nuovoGarage.value.cap.trim()} ${nuovoGarage.value.citta.trim()} (${nuovoGarage.value.provincia.trim().toUpperCase()})`
  const payload = {
    ...nuovoGarage.value,
    indirizzo:    indirizzoCompleto,
    mappatestuale: stringaMappaGenerata.value,
    posti:        postiConfigurati.value
  }

  try {
    const res = await fetch('/api/garage/garages-gestore', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (res.ok) {
      nuovoGarage.value = {
        nome: '', descrizione: '',
        via: '', civico: '', cap: '', citta: '', provincia: '',
        latitudine: null, longitudine: null,
        tariffabase: null, tariffamoto: null, tariffafurgone: null,
        sovrapprezzoelettrica: null, scontodisabili: null,
        altezzamassima: null, orarioapertura: '08:00', orariochiusura: '20:00', is24h: false
      }
      postiConfigurati.value  = []
      dimensioniMappa.value   = { righe: 6, colonne: 12 }
      ridimensionaGriglia()
      erroriValidazione.value = {}
      if (markerInstance) mapInstance.removeLayer(markerInstance)
      await caricaGarage()
      messaggio.value  = { tipo: 'success', testo: 'Garage pubblicato con successo!' }
      vistaAttiva.value = 'statistiche'
    } else {
      const err = await res.json().catch(() => ({}))
      messaggio.value = { tipo: 'error', testo: err.error || 'Errore durante il salvataggio.' }
    }
  } catch {
    messaggio.value = { tipo: 'error', testo: 'Errore di rete.' }
  } finally {
    staSalvando.value = false
  }
}

// ─── Bootstrap Modal Info ────────────────────────────────────────────────────
const infoModalElement = ref(null)
let infoModalInstance  = null
const openInfoModal    = () => { if (infoModalInstance) infoModalInstance.show() }

// ─── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(async () => {
  ridimensionaGriglia()
  await walletStore.contabilizzaRicavi()
  await walletStore.caricaSaldoSospeso()
  await caricaDati()
  if (mieiGarage.value.length === 0) {
    vistaAttiva.value = 'aggiungi'
  }
  if (infoModalElement.value) {
    infoModalInstance = new bootstrap.Modal(infoModalElement.value)
  }
  socket = getSocket()
  socket.on('nuovo_messaggio', handleNuovoMessaggio)
})

onUnmounted(() => {
  if (infoModalInstance) infoModalInstance.dispose()
  if (socket) socket.off('nuovo_messaggio', handleNuovoMessaggio)
})

watch(vistaAttiva, async (newVal) => {
  messaggio.value = null
  if (newVal === 'aggiungi') {
    await loadLeaflet()
    await nextTick()
    initMap()
  }
})

// ─── Nav ─────────────────────────────────────────────────────────────────────
const navItems = [
  { id: 'statistiche', label: 'Statistiche',    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>' },
  { id: 'garage',      label: 'I miei Garage',  icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>' },
  { id: 'stato',       label: 'Stato Corrente', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' },
  { id: 'storico',     label: 'Storico',         icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>' },
  { id: 'aggiungi',    label: 'Aggiungi Garage', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' },
]
</script>

<template>
  <div class="page-wrapper">
    <Header />

    <!-- Accesso negato -->
    <div v-if="!isGestore" class="access-denied">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
      <h2>Accesso negato</h2>
      <p>Questa area è riservata ai gestori. Effettua il login con un account gestore.</p>
      <RouterLink to="/" class="btn-back">Torna alla Home</RouterLink>
    </div>

    <div v-else class="dashboard-layout">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>
          <span>Area Gestore</span>
        </div>
        <nav class="sidebar-nav">
          <a v-for="item in menuFiltrato" :key="item.id" href="#"
             :class="['nav-item', { active: vistaAttiva === item.id }]"
             @click.prevent="vistaAttiva = item.id">
            <span class="nav-icon" v-html="item.icon"></span>
            <span class="nav-label">{{ item.label }}</span>
            <span v-if="vistaAttiva === item.id" class="nav-indicator"></span>
          </a>
        </nav>
        <div class="sidebar-user">
          <img :src="authStore.utente?.fotoProfilo_URL || defaultAvatarUrl" alt="Avatar" class="sidebar-avatar" />
          <div class="sidebar-user-info">
            <span class="sidebar-user-name">{{ authStore.utente?.nome }} {{ authStore.utente?.cognome }}</span>
            <span class="sidebar-user-role">Gestore</span>
          </div>
        </div>
      </aside>

      <!-- Contenuto principale -->
      <main class="main-content">
        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
          <span>Caricamento dati...</span>
        </div>

        <template v-else>
          <!-- Alert globale -->
          <div v-if="messaggio" :class="['alert', messaggio.tipo, 'mb-4']" style="max-width: 960px; margin-left: auto; margin-right: auto;">
            {{ messaggio.testo }}
            <button @click="messaggio = null" class="close-btn">×</button>
          </div>

          <!-- ── STATISTICHE ─────────────────────────────────────────────── -->
          <section v-if="vistaAttiva === 'statistiche'" class="vista fade-in centered-container">
            <div class="page-header">
              <div>
                <h1>Dashboard</h1>
                <p class="subtitle">Panoramica dei tuoi parcheggi</p>
              </div>
            </div>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-icon stat-icon--blue">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>
                </div>
                <div class="stat-body">
                  <span class="stat-label">Garage Totali</span>
                  <span class="stat-value">{{ mieiGarage.length }}</span>
                </div>
              </div>

              <div class="stat-card">
                <div class="stat-icon stat-icon--green">
                  <i class="bi bi-wallet2" style="font-size: 1.2rem;"></i>
                </div>
                <div class="stat-body">
                  <span class="stat-label">Saldo Disponibile</span>
                  <span class="stat-value">€ {{ authStore.utente?.saldo || '0.00' }}</span>
                </div>
              </div>

              <div class="stat-card">
                <div class="stat-icon stat-icon--amber">
                  <i class="bi bi-clock-history" style="font-size: 1.2rem;"></i>
                </div>
                <div class="stat-body">
                  <span class="stat-label">In Arrivo</span>
                  <span class="stat-value">€ {{ walletStore.saldoSospeso || '0.00' }}</span>
                </div>
              </div>

              <div class="stat-card">
                <div class="stat-icon stat-icon--blue">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div class="stat-body">
                  <span class="stat-label">Prenot. Attive</span>
                  <span class="stat-value">{{ prenotazioniAttive }}</span>
                </div>
              </div>
            </div>
          </section>

          <!-- ── I MIEI GARAGE ──────────────────────────────────────────── -->
          <section v-if="vistaAttiva === 'garage'" class="vista fade-in centered-container">
            <div class="page-header">
              <div>
                <h1>I tuoi garage</h1>
                <p class="subtitle">Gestisci tutti i parcheggi registrati</p>
              </div>
            </div>
            <div class="table-card">
              <table class="parkly-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nome Garage</th>
                    <th>Indirizzo</th>
                    <th>Tariffa Base</th>
                    <th>Stato</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="garage in mieiGarage" :key="garage.id_garage">
                    <td class="td-muted">#{{ garage.id_garage }}</td>
                    <td class="td-bold">
                      <RouterLink :to="`/garage/${garage.id_garage}`" class="garage-link">{{ garage.nome }}</RouterLink>
                    </td>
                    <td class="td-muted">{{ garage.indirizzo }}</td>
                    <td>€ {{ garage.tariffabase }}/h</td>
                    <td>
                      <span :class="['badge', garage.isattivo ? 'badge--green' : 'badge--red']">
                        {{ garage.isattivo ? 'Attivo' : 'Inattivo' }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="mieiGarage.length === 0">
                    <td colspan="5" class="td-empty">Nessun garage trovato.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- ── STATO CORRENTE ─────────────────────────────────────────── -->
          <section v-if="vistaAttiva === 'stato'" class="vista fade-in centered-container">
            <div class="page-header">
              <div>
                <h1>Stato Corrente</h1>
                <p class="subtitle">Occupazione in tempo reale dei tuoi garage</p>
              </div>
            </div>

            <div class="filter-card">
              <h3 style="font-size: 0.9rem; margin-bottom: 12px; color: #333;">Filtra per Orario Sosta</h3>
              <div class="form-row form-row--2col" style="margin-bottom: 0;">
                <div class="form-group">
                  <label class="form-label">Inizio Sosta</label>
                  <input type="datetime-local" class="form-input" v-model="filtroInizio">
                </div>
                <div class="form-group">
                  <label class="form-label">Fine Sosta</label>
                  <input type="datetime-local" class="form-input" v-model="filtroFine">
                </div>
              </div>
              <button class="btn-primary" style="margin-top: 16px; width: 100%;" @click="aggiornaMappaOrari">
                Verifica Disponibilità
              </button>
            </div>

            <div class="stato-grid">
              <div v-for="garage in mieiGarage" :key="garage.id_garage" class="stato-card">
                <div class="stato-card-header">
                  <span class="stato-nome">{{ garage.nome }}</span>
                  <span :class="['badge', garage.isattivo ? 'badge--green' : 'badge--red']">
                    {{ garage.isattivo ? 'Attivo' : 'Inattivo' }}
                  </span>
                </div>
                <p class="stato-indirizzo">{{ garage.indirizzo }}</p>
                <div class="occupancy-wrap">
                  <div class="occupancy-bar">
                    <div class="occupancy-fill"
                         :style="{ width: getOccupancy(garage.id_garage) + '%' }"
                         :class="{ 'fill-warn': getOccupancy(garage.id_garage) > 80 }">
                    </div>
                  </div>
                  <span class="occupancy-pct">{{ getOccupancy(garage.id_garage) }}%</span>
                </div>
                <div class="stato-meta">
                  <span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {{ garage.is24h ? 'Aperto 24h' : `${garage.orarioapertura?.substring(0,5)} - ${garage.orariochiusura?.substring(0,5)}` }}
                  </span>
                  <span>€ {{ garage.tariffabase }}/h</span>
                </div>
                <div class="planimetria-wrapper">
                  <PlanimetriaGarage
                    :key="'mappa-' + garage.id_garage + '-' + reRenderKey"
                    :posti="postiPerGarage[garage.id_garage] || []"
                    :mappaTestuale="garage.mappatestuale"
                  />
                </div>
              </div>
            </div>

            <!-- Allerte -->
            <div v-if="allerteStato.length > 0" class="section-header" style="margin-top: 32px;">
              <h2>Allerte</h2>
            </div>
            <div v-for="allerta in allerteStato" :key="allerta.id"
                 :class="['allerta-card', allerta.tipo === 'warning' ? 'allerta--warn' : 'allerta--danger']">
              <div class="allerta-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <p class="allerta-title">{{ allerta.titolo }}</p>
                <p class="allerta-msg">{{ allerta.messaggio }}</p>
              </div>
            </div>
            <div v-if="allerteStato.length === 0 && mieiGarage.length > 0"
                 class="allerta-card allerta--ok" style="margin-top: 24px;">
              <div class="allerta-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div>
                <p class="allerta-title">Tutto regolare</p>
                <p class="allerta-msg">Tutti i garage operano nei limiti normali.</p>
              </div>
            </div>
          </section>

          <!-- ── STORICO PRENOTAZIONI ────────────────────────────────────── -->
          <section v-if="vistaAttiva === 'storico'" class="vista fade-in centered-container">
            <div class="page-header">
              <div>
                <h1>Storico Prenotazioni</h1>
                <p class="subtitle">Tutte le prenotazioni dei tuoi garage</p>
              </div>
            </div>
            <div class="table-card">
              <table class="parkly-table">
                <thead>
                  <tr>
                    <th>Codice</th>
                    <th>Garage</th>
                    <th>Targa</th>
                    <th>Inizio</th>
                    <th>Fine</th>
                    <th>Importo</th>
                    <th>Stato</th>
                    <th>Chat</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in storicoPrenotazioni" :key="p.id_prenotazione">
                    <td><span class="targa-badge">{{ p.codiceprenotazione }}</span></td>
                    <td class="td-bold">{{ p.nome_garage }}</td>
                    <td><span class="targa-badge">{{ p.targa }}</span></td>
                    <td class="td-muted">{{ formatData(p.iniziososta) }}</td>
                    <td class="td-muted">{{ formatData(p.finesosta) }}</td>
                    <td class="td-bold td-blue">€ {{ p.prezzototale }}</td>
                    <td><span :class="['badge', statoBadge(p.stato)]">{{ p.stato }}</span></td>
                    <td>
                      <button v-if="p.stato === 'ATTIVA'" @click="apriChat(p)"
                              class="btn-chat" title="Scrivi al cliente">
                        <span v-if="p.nonletti > 0" class="chat-notification-dot"></span>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        Scrivi
                      </button>
                    </td>
                  </tr>
                  <tr v-if="storicoPrenotazioni.length === 0">
                    <td colspan="8" class="td-empty">Nessuna prenotazione trovata.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <!-- ── AGGIUNGI GARAGE ─────────────────────────────────────────── -->
          <section v-if="vistaAttiva === 'aggiungi'" class="vista fade-in centered-container">
            <div class="page-header d-flex justify-content-between align-items-center">
              <div>
                <h1 class="d-flex align-items-center gap-3">
                  Pubblica un Garage
                  <button type="button"
                          class="btn btn-outline-primary rounded-circle info-icon-btn"
                          @click="openInfoModal" title="Guida alla pubblicazione">
                    <i class="bi bi-info-lg"></i>
                  </button>
                </h1>
              </div>
            </div>

            <div class="form-card">
              <form @submit.prevent="salvaNuovoGarage">

                <!-- Informazioni generali e indirizzo -->
                <div class="section-header"><h2>Informazioni Generali e Posizione</h2></div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Nome del Garage*</label>
                    <input type="text" :class="['form-input', {'input-error': erroriValidazione.nome}]"
                           v-model="nuovoGarage.nome" placeholder="Es. Garage Roma Centro">
                    <span v-if="erroriValidazione.nome" class="form-error-text">{{ erroriValidazione.nome }}</span>
                  </div>
                </div>

                <div class="form-row form-row--3col">
                  <div class="form-group" style="grid-column: span 2;">
                    <label class="form-label">Via*</label>
                    <input type="text" :class="['form-input', {'input-error': erroriValidazione.via}]"
                           v-model="nuovoGarage.via" placeholder="Es. Via Roma">
                    <span v-if="erroriValidazione.via" class="form-error-text">{{ erroriValidazione.via }}</span>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Civico*</label>
                    <input type="text" :class="['form-input', {'input-error': erroriValidazione.civico}]"
                           v-model="nuovoGarage.civico" placeholder="Es. 10">
                    <span v-if="erroriValidazione.civico" class="form-error-text">{{ erroriValidazione.civico }}</span>
                  </div>
                </div>

                <div class="form-row form-row--3col">
                  <div class="form-group">
                    <label class="form-label">CAP*</label>
                    <input type="text" :class="['form-input', {'input-error': erroriValidazione.cap}]"
                           v-model="nuovoGarage.cap" placeholder="Es. 00100">
                    <span v-if="erroriValidazione.cap" class="form-error-text">{{ erroriValidazione.cap }}</span>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Città*</label>
                    <input type="text" :class="['form-input', {'input-error': erroriValidazione.citta}]"
                           v-model="nuovoGarage.citta" placeholder="Es. Roma">
                    <span v-if="erroriValidazione.citta" class="form-error-text">{{ erroriValidazione.citta }}</span>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Provincia (Sigla)*</label>
                    <input type="text" :class="['form-input', {'input-error': erroriValidazione.provincia}]"
                           v-model="nuovoGarage.provincia" placeholder="Es. RM" maxlength="2">
                    <span v-if="erroriValidazione.provincia" class="form-error-text">{{ erroriValidazione.provincia }}</span>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group" style="flex-direction: row; gap: 10px; align-items: center;">
                    <button type="button" class="btn-secondary" style="padding: 0 20px;"
                            @click="calcolaCoordinate" :disabled="calcolandoCoordinate">
                      {{ calcolandoCoordinate ? 'Ricerca in corso...' : 'Trova zona sulla mappa' }}
                    </button>
                    <span class="form-hint">Cerca per avvicinarti, poi <strong>clicca sulla mappa</strong> per la precisione massima.</span>
                  </div>
                </div>

                <div class="form-row">
                  <div id="mappa-garage" style="height: 350px; width: 100%; border-radius: 8px; border: 1px solid #ccc; z-index: 1;"></div>
                  <span v-if="erroriValidazione.coordinate" class="form-error-text" style="display:block; margin-top:8px;">
                    {{ erroriValidazione.coordinate }}
                  </span>
                </div>

                <div class="form-row form-row--2col">
                  <div class="form-group">
                    <label class="form-label">Latitudine</label>
                    <input type="text" class="form-input" :value="nuovoGarage.latitudine" disabled placeholder="Clicca sulla mappa">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Longitudine</label>
                    <input type="text" class="form-input" :value="nuovoGarage.longitudine" disabled placeholder="Clicca sulla mappa">
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label">Descrizione</label>
                    <input type="text" class="form-input" v-model="nuovoGarage.descrizione" placeholder="Breve descrizione del garage">
                  </div>
                </div>

                <!-- Tariffario e orari -->
                <div class="section-header" style="margin-top: 30px;"><h2>Tariffario e Orari</h2></div>

                <div class="form-row form-row--3col">
                  <div class="form-group">
                    <label class="form-label">Tariffa Auto (€/h)*</label>
                    <input type="number" step="0.50" :class="['form-input', {'input-error': erroriValidazione.tariffabase}]"
                           v-model="nuovoGarage.tariffabase" min="0" placeholder="Es. 2.50">
                    <span v-if="erroriValidazione.tariffabase" class="form-error-text">{{ erroriValidazione.tariffabase }}</span>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Tariffa Moto (€/h)</label>
                    <input type="number" step="0.50" :class="['form-input', {'input-error': erroriValidazione.tariffamoto}]"
                           v-model="nuovoGarage.tariffamoto" min="0" placeholder="Opzionale">
                    <span v-if="erroriValidazione.tariffamoto" class="form-error-text">{{ erroriValidazione.tariffamoto }}</span>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Tariffa Furgone (€/h)</label>
                    <input type="number" step="0.50" :class="['form-input', {'input-error': erroriValidazione.tariffafurgone}]"
                           v-model="nuovoGarage.tariffafurgone" min="0" placeholder="Opzionale">
                    <span v-if="erroriValidazione.tariffafurgone" class="form-error-text">{{ erroriValidazione.tariffafurgone }}</span>
                  </div>
                </div>

                <div class="form-row form-row--3col">
                  <div class="form-group">
                    <label class="form-label">Sovrapprezzo Elettrica (+€/h)</label>
                    <input type="number" step="0.50" :class="['form-input', {'input-error': erroriValidazione.sovrapprezzoelettrica}]"
                           v-model="nuovoGarage.sovrapprezzoelettrica" min="0" placeholder="Es. 2.00">
                    <span v-if="erroriValidazione.sovrapprezzoelettrica" class="form-error-text">{{ erroriValidazione.sovrapprezzoelettrica }}</span>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Sconto Disabili (-€/h)</label>
                    <input type="number" step="0.50" :class="['form-input', {'input-error': erroriValidazione.scontodisabili}]"
                           v-model="nuovoGarage.scontodisabili" min="0" placeholder="Es. 1.00">
                    <span v-if="erroriValidazione.scontodisabili" class="form-error-text">{{ erroriValidazione.scontodisabili }}</span>
                  </div>
                  <div class="form-group">
                    <label class="form-label">Altezza Massima (m)</label>
                    <input type="number" step="0.10" class="form-input" v-model="nuovoGarage.altezzamassima" min="0" placeholder="Opzionale">
                  </div>
                </div>

                <div class="form-row form-row--2col">
                  <div class="form-group">
                    <label class="form-label">Orario Apertura</label>
                    <input type="time" class="form-input" v-model="nuovoGarage.orarioapertura" :disabled="nuovoGarage.is24h">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Orario Chiusura</label>
                    <input type="time" class="form-input" v-model="nuovoGarage.orariochiusura" :disabled="nuovoGarage.is24h">
                  </div>
                </div>
                <div class="form-row">
                  <label class="checkbox-label">
                    <input type="checkbox" v-model="nuovoGarage.is24h" class="checkbox-input">
                    <span>Aperto 24 ore su 24</span>
                  </label>
                </div>

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #E8E8E8;">

                <!-- Configurazione posti -->
                <div class="section-header"><h2>Crea i Posti Auto</h2></div>

                <div class="posto-creator">
                  <div class="form-group">
                    <label class="form-label">Codice</label>
                    <input type="text" class="form-input" v-model="nuovoPosto.codice"
                           placeholder="Es. A01" @input="autoCompilaPosto" @keyup.enter="aggiungiPostoConfigurato">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Veicolo</label>
                    <select class="form-input" v-model="nuovoPosto.tipo">
                      <option value="AUTO">Auto</option>
                      <option value="MOTO">Moto</option>
                      <option value="FURGONE">Furgone</option>
                    </select>
                  </div>
                  <div class="form-group check-group">
                    <label class="checkbox-label"><input type="checkbox" v-model="nuovoPosto.isElettrica" class="checkbox-input"> Elettrica</label>
                    <label class="checkbox-label"><input type="checkbox" v-model="nuovoPosto.isDisabili"  class="checkbox-input"> Disabili</label>
                    <label class="checkbox-label"><input type="checkbox" v-model="nuovoPosto.isCoperto"   class="checkbox-input"> Coperto</label>
                  </div>
                  <div class="form-group" style="justify-content: flex-end;">
                    <button type="button" class="btn-secondary" @click="aggiungiPostoConfigurato">+ Aggiungi</button>
                  </div>
                </div>

                <div class="posti-list vertical-grid" v-if="postiConfigurati.length > 0">
                  <div v-for="(posto, index) in postiConfigurati" :key="index" class="posto-card">
                    <div class="posto-info">
                      <span class="posto-codice">{{ posto.codice }}</span>
                      <span class="posto-tipo">{{ posto.tipo }}</span>
                      <div class="posto-icons">
                        <span v-if="posto.isElettrica" title="Elettrica"><img src="../assets/electricity.svg" class="icon-card"></span>
                        <span v-if="posto.isDisabili"  title="Disabili"><img src="../assets/handicap.svg"    class="icon-card"></span>
                        <span v-if="posto.isCoperto"   title="Coperto"><img src="../assets/parcheggio_coperto.svg" class="icon-card"></span>
                      </div>
                    </div>
                    <button type="button" class="btn-rimuovi" @click="rimuoviPostoConfigurato(index)" title="Rimuovi">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #E8E8E8;">

                <!-- Canvas planimetria -->
                <div class="section-header"><h2>Disegna la Planimetria</h2></div>

                <div class="form-row form-row--2col">
                  <div class="form-group">
                    <label class="form-label">Larghezza (Unità)</label>
                    <input type="number" class="form-input" v-model.number="dimensioniMappa.colonne"
                           @change="ridimensionaGriglia" min="2" max="30">
                  </div>
                  <div class="form-group">
                    <label class="form-label">Altezza (Unità)</label>
                    <input type="number" class="form-input" v-model.number="dimensioniMappa.righe"
                           @change="ridimensionaGriglia" min="2" max="30">
                  </div>
                </div>

                <div class="d-flex justify-content-center w-100" v-if="postiConfigurati.length > 0">
                  <div class="tavolozza">
                    <span class="tavolozza-label">Strumento attivo:</span>
                    <button type="button" class="tool-btn btn-gomma"
                            :class="{ active: strumentoAttivo === 'GOMMA' }"
                            @click="strumentoAttivo = 'GOMMA'">Gomma</button>
                    <button type="button"
                            v-for="posto in postiConfigurati" :key="posto.codice"
                            class="tool-btn"
                            :class="[posto.tipo.toLowerCase(), {
                              active:   strumentoAttivo?.codice === posto.codice,
                              disabled: codiciPosizionati.has(posto.codice)
                            }]"
                            :disabled="codiciPosizionati.has(posto.codice)"
                            @click="selezionaStrumento(posto)">
                      {{ posto.codice }} ({{ posto.tipo }})
                    </button>
                  </div>
                </div>

                <div class="canvas-wrapper d-flex justify-content-center w-100">
                  <div class="canvas-griglia"
                       :style="{ gridTemplateColumns: `repeat(${dimensioniMappa.colonne}, 35px)` }">
                    <template v-for="(riga, r) in griglia" :key="'r-'+r">
                      <div v-for="(cella, c) in riga" :key="'c-'+r+'-'+c"
                           class="cella-canvas"
                           :class="{ occupata: cella, root: cella?.isRoot }"
                           @click="clickCella(r, c)">
                        <span v-if="cella?.isRoot">{{ cella.codice }}</span>
                        <span v-else-if="!cella" class="cella-empty-dot">·</span>
                      </div>
                    </template>
                  </div>
                </div>

                <div v-if="stringaMappaGenerata" class="anteprima-mappa">
                  <h4>Anteprima Planimetria</h4>
                  <PlanimetriaGarage :posti="postiConvertitiPerAnteprima"
                                     :mappaTestuale="stringaMappaGenerata"
                                     :isAnteprima="true" :mostraErrori="false" />
                </div>
                <span v-if="erroriValidazione.mappatestuale" class="form-error-text" style="display:block; margin-top:10px;">
                  {{ erroriValidazione.mappatestuale }}
                </span>

                <div class="form-actions">
                  <button type="submit" class="btn-primary" :disabled="staSalvando">
                    {{ staSalvando ? 'Salvataggio in corso...' : 'Pubblica Garage' }}
                  </button>
                </div>

              </form>
            </div>
          </section>

        </template>
      </main>
    </div>

    <!-- ── Modal Info ──────────────────────────────────────────────────────── -->
    <div class="modal fade" id="infoModal" ref="infoModalElement"
         tabindex="-1" aria-labelledby="infoModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content parkly-modal">
          <div class="modal-header border-0">
            <h5 class="modal-title modal-title-text" id="infoModalLabel">
              <i class="bi bi-info-circle me-2"></i>Guida alla pubblicazione
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body px-4 pb-4 pt-0">
            <ul class="info-list">
              <li>Cerca il tuo indirizzo per avvicinarti, poi clicca sulla mappa interattiva per posizionare il pin esattamente sopra il tuo garage.</li>
              <li>Configura la tipologia del posto (Auto, Moto, Furgone) e aggiungi servizi extra. Il codice verrà generato in automatico se lasciato vuoto.</li>
              <li>Una volta creati i posti, selezionali dalla tavolozza e clicca sulla griglia a scacchiera per disegnare visivamente il layout reale del garage.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Chat Popup ──────────────────────────────────────────────────────── -->
    <div v-if="chatSelezionata" class="chat-popup-container">
      <ChatBox
        @chiudi="chiudiChat"
        :idPrenotazione="chatSelezionata.idPrenotazione"
        :idGarage="chatSelezionata.idGarage"
        :idDestinatario="chatSelezionata.idDestinatario"
        :nomeDestinatario="chatSelezionata.nomeDestinatario"
        ruoloDestinatario="Cliente"
      />
    </div>

    <Footer />
  </div>
</template>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────────────────── */
.page-wrapper    { display: flex; flex-direction: column; min-height: 100vh; background-color: var(--bg-light, #F5F5F3); font-family: 'Inter', -apple-system, sans-serif; }
.dashboard-layout { display: flex; flex: 1; }

.access-denied   { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 80px 20px; color: #aaa; text-align: center; }
.access-denied svg { color: #ddd; }
.access-denied h2  { font-size: 1.4rem; color: #444; margin: 0; }
.access-denied p   { font-size: 0.9rem; color: #888; max-width: 380px; margin: 0; }
.btn-back { margin-top: 8px; display: inline-block; padding: 10px 24px; background: #0066CC; color: #fff; border-radius: 8px; text-decoration: none; font-size: 0.875rem; font-weight: 600; transition: background 0.15s; }
.btn-back:hover { background: #00204A; }

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
.sidebar         { width: 240px; min-width: 240px; background-color: var(--deep-blue, #00204A); display: flex; flex-direction: column; padding: 28px 16px 20px; }
.sidebar-brand   { display: flex; align-items: center; gap: 10px; color: rgba(255,255,255,0.9); font-size: 0.95rem; font-weight: 600; padding: 0 8px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); margin-bottom: 12px; }
.sidebar-nav     { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.nav-item        { position: relative; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; color: rgba(255,255,255,0.5); text-decoration: none; font-size: 0.875rem; font-weight: 500; transition: background 0.15s, color 0.15s; }
.nav-item:hover  { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.85); }
.nav-item.active { background: rgba(255,255,255,0.1); color: #fff; }
.nav-indicator   { position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 3px; height: 18px; background: #0066CC; border-radius: 0 2px 2px 0; }
.nav-icon        { display: flex; align-items: center; flex-shrink: 0; }
.sidebar-user    { display: flex; align-items: center; gap: 10px; padding: 14px 8px 0; border-top: 1px solid rgba(255,255,255,0.08); margin-top: 16px; }
.sidebar-avatar  { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(255,255,255,0.15); flex-shrink: 0; }
.sidebar-user-info { display: flex; flex-direction: column; gap: 1px; overflow: hidden; }
.sidebar-user-name { font-size: 0.82rem; font-weight: 600; color: rgba(255,255,255,0.9); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sidebar-user-role { font-size: 0.7rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.06em; }

/* ── Main ────────────────────────────────────────────────────────────────── */
.main-content { flex: 1; padding: 40px 48px; overflow-y: auto; }
.centered-container { max-width: 960px; margin: 0 auto; }
.loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; min-height: 300px; color: #aaa; font-size: 0.875rem; }
.spinner { width: 32px; height: 32px; border: 3px solid #E8E8E8; border-top-color: #0066CC; border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.vista { animation: fadeIn 0.25s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

/* ── Alert ───────────────────────────────────────────────────────────────── */
.alert         { padding: 12px 16px; border-radius: 8px; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; }
.alert.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
.alert.error   { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
.close-btn     { background: none; border: none; cursor: pointer; color: inherit; opacity: 0.4; font-size: 1.1rem; line-height: 1; }
.close-btn:hover { opacity: 0.8; }

/* ── Page header ─────────────────────────────────────────────────────────── */
.page-header    { margin-bottom: 32px; }
.page-header h1 { font-size: 1.6rem; font-weight: 700; color: var(--deep-blue, #00204A); letter-spacing: -0.5px; margin: 0 0 4px; }
.subtitle       { font-size: 0.875rem; color: #888; margin: 0; }
.section-header { margin-bottom: 12px; }
.section-header h2 { font-size: 1rem; font-weight: 600; color: var(--deep-blue, #00204A); }

/* ── Stat cards ──────────────────────────────────────────────────────────── */
.stats-grid       { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 40px; }
.stat-card        { background: #fff; border: 0.5px solid #E8E8E8; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; }
.stat-icon        { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-icon--blue  { background: #EBF3FF; color: #0066CC; }
.stat-icon--green { background: #EAFAF1; color: #27AE60; }
.stat-icon--amber { background: #FEF9EE; color: #E67E22; }
.stat-body  { display: flex; flex-direction: column; gap: 2px; }
.stat-label { font-size: 0.72rem; color: #999; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
.stat-value { font-size: 1.5rem; font-weight: 700; color: var(--deep-blue, #00204A); letter-spacing: -0.5px; line-height: 1; }

/* ── Table ───────────────────────────────────────────────────────────────── */
.table-card { background: #fff; border: 0.5px solid #E8E8E8; border-radius: 12px; overflow: hidden; }
.parkly-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.parkly-table thead tr { background: #FAFAFA; border-bottom: 0.5px solid #EFEFEF; }
.parkly-table th { padding: 12px 20px; text-align: left; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #aaa; }
.parkly-table tbody tr { border-bottom: 0.5px solid #F5F5F5; transition: background 0.1s; }
.parkly-table tbody tr:last-child { border-bottom: none; }
.parkly-table tbody tr:hover { background: #FAFBFF; }
.parkly-table td { padding: 14px 20px; color: #444; }
.td-muted { color: #bbb; font-size: 0.8rem; }
.td-bold  { font-weight: 600; color: #222; }
.td-blue  { color: #0066CC; }
.td-empty { text-align: center; padding: 40px; color: #ccc; font-size: 0.85rem; }
.garage-link { color: #0066CC; text-decoration: none; font-weight: 600; transition: color 0.15s; }
.garage-link:hover { color: #00204A; text-decoration: underline; }

/* ── Badge & Targa ───────────────────────────────────────────────────────── */
.badge       { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
.badge--green { background: #EAFAF1; color: #1E8449; }
.badge--red   { background: #FDEDEC; color: #C0392B; }
.badge--gray  { background: #F0F0F0; color: #888; }
.targa-badge  { display: inline-block; background: #F5F5F5; border: 0.5px solid #E0E0E0; border-radius: 4px; padding: 2px 8px; font-size: 0.78rem; font-weight: 600; font-family: 'Courier New', monospace; color: #444; letter-spacing: 0.06em; }

/* ── Stato garage ────────────────────────────────────────────────────────── */
.stato-grid     { display: flex; flex-direction: column; gap: 24px; }
.stato-card     { background: #fff; border: 0.5px solid #E8E8E8; border-radius: 12px; padding: 24px; width: 100%; box-sizing: border-box; }
.stato-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.stato-nome     { font-size: 0.9rem; font-weight: 600; color: #222; }
.stato-indirizzo { font-size: 0.78rem; color: #aaa; margin: 0 0 16px; }
.occupancy-wrap { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.occupancy-bar  { flex: 1; height: 6px; background: #F0F0F0; border-radius: 999px; overflow: hidden; }
.occupancy-fill { height: 100%; background: #0066CC; border-radius: 999px; transition: width 0.4s ease; }
.occupancy-fill.fill-warn { background: #E67E22; }
.occupancy-pct  { font-size: 0.78rem; color: #888; font-weight: 600; min-width: 34px; text-align: right; }
.stato-meta     { display: flex; justify-content: space-between; font-size: 0.75rem; color: #aaa; }
.stato-meta span { display: flex; align-items: center; gap: 4px; }
.planimetria-wrapper { margin-top: 16px; border-top: 1px solid #f0f0f0; padding-top: 12px; overflow-x: auto; }
.filter-card    { background: #fff; border: 0.5px solid #E8E8E8; border-radius: 12px; padding: 20px; margin-bottom: 24px; }

/* ── Allerte ─────────────────────────────────────────────────────────────── */
.allerta-card    { display: flex; align-items: flex-start; gap: 16px; padding: 20px 24px; border-radius: 12px; margin-bottom: 12px; border: 0.5px solid transparent; }
.allerta--ok     { background: #EAFAF1; border-color: #A9DFBF; }
.allerta--ok .allerta-icon { color: #27AE60; }
.allerta--warn   { background: #FEF9EE; border-color: #FAD7A0; }
.allerta--warn .allerta-icon { color: #E67E22; }
.allerta--danger { background: #FDEDEC; border-color: #F1948A; }
.allerta--danger .allerta-icon { color: #C0392B; }
.allerta-icon    { display: flex; align-items: center; margin-top: 1px; flex-shrink: 0; }
.allerta-title   { font-size: 0.9rem; font-weight: 600; color: #222; margin: 0 0 4px; }
.allerta-msg     { font-size: 0.85rem; color: #666; margin: 0; line-height: 1.5; }

/* ── Form ────────────────────────────────────────────────────────────────── */
.form-card      { background: #fff; border: 0.5px solid #E8E8E8; border-radius: 12px; padding: 32px; }
.form-row       { margin-bottom: 20px; }
.form-row--2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.form-row--3col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px; }
.form-group     { display: flex; flex-direction: column; gap: 6px; }
.form-label     { font-size: 0.75rem; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.06em; }
.form-input     { height: 48px; border: 0.5px solid #E0E0E0; border-radius: 8px; padding: 0 14px; font-size: 0.9rem; color: #222; background: #FAFAFA; outline: none; font-family: inherit; transition: border-color 0.15s, background 0.15s; width: 100%; box-sizing: border-box; }
.form-input:focus    { border-color: #0066CC; background: #fff; box-shadow: 0 0 0 3px rgba(0,102,204,0.08); }
.form-input:disabled { opacity: 0.4; cursor: not-allowed; }
.form-hint      { font-size: 0.78rem; color: #aaa; }
.checkbox-label { display: flex; align-items: center; gap: 10px; font-size: 0.875rem; color: #444; cursor: pointer; }
.checkbox-input { width: 16px; height: 16px; accent-color: #0066CC; cursor: pointer; }
.input-error    { border-color: #C0392B !important; background-color: #FDEDEC !important; }
.form-error-text { color: #C0392B; font-size: 0.8rem; font-weight: 600; margin-top: 4px; }
.form-actions   { margin-top: 28px; padding-top: 24px; border-top: 0.5px solid #F0F0F0; }
.btn-primary    { background: #0066CC; color: #fff; border: none; border-radius: 8px; height: 48px; padding: 0 32px; font-size: 0.9rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s, transform 0.1s; }
.btn-primary:hover:not(:disabled) { background: #00204A; transform: translateY(-1px); }
.btn-primary:disabled { background: #ccc; cursor: not-allowed; }
.btn-secondary  { background: #fff; border: 1px solid #0066CC; color: #0066CC; height: 48px; padding: 0 20px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-secondary:hover:not(:disabled) { background: #0066CC; color: #fff; }
.btn-secondary:disabled { border-color: #ccc; color: #ccc; cursor: not-allowed; }

/* ── Info btn ────────────────────────────────────────────────────────────── */
.info-icon-btn { width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-width: 2px; }

/* ── Configuratore posti ─────────────────────────────────────────────────── */
.posto-creator { display: grid; grid-template-columns: 2fr 2fr 3fr auto; gap: 12px; align-items: flex-end; background: #FAFBFF; border: 1px solid #D6E4F0; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
.check-group   { display: flex; flex-direction: row; gap: 12px; align-items: center; padding-bottom: 12px; }
.posti-list.vertical-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 24px; }
.posto-card    { display: flex; justify-content: space-between; align-items: center; background: #FAFBFF; border: 1px solid #D6E4F0; border-radius: 8px; padding: 12px 16px; transition: border-color 0.2s, box-shadow 0.2s; }
.posto-card:hover { border-color: #BADCFF; background: #F0F6FF; }
.posto-info    { display: flex; align-items: center; gap: 12px; }
.posto-codice  { font-size: 1.05rem; font-weight: 700; color: #00408A; min-width: 40px; }
.posto-tipo    { font-size: 0.75rem; color: #555; font-weight: 600; background: #E8E8E8; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
.posto-icons   { display: flex; gap: 6px; font-size: 1rem; }
.btn-rimuovi   { background: transparent; border: none; color: #aaa; cursor: pointer; padding: 6px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: all 0.15s ease; }
.btn-rimuovi:hover { background: #FDEDEC; color: #C0392B; }
.icon-card     { width: 14px; height: 14px; margin-right: 5px; }

/* ── Canvas planimetria ──────────────────────────────────────────────────── */
.tavolozza       { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: center; margin-bottom: 16px; padding: 12px; background: #fdfdfd; border: 1px solid #eee; border-radius: 8px; }
.tavolozza-label { font-size: 0.8rem; font-weight: 600; color: #666; margin-right: 8px; }
.tool-btn        { padding: 6px 12px; border: 2px solid transparent; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.8rem; transition: all 0.2s; background: #EBF3FF; color: #00408A; }
.tool-btn:hover  { filter: brightness(0.95); }
.tool-btn.active { border-color: #00408A; box-shadow: 0 0 0 3px rgba(0,64,138,0.2); }
.tool-btn.disabled { opacity: 0.4; cursor: not-allowed; text-decoration: line-through; }
.btn-gomma       { background: #FDEDEC; color: #C0392B; }
.btn-gomma.active { border-color: #C0392B; box-shadow: 0 0 0 3px rgba(192,57,43,0.2); }
.canvas-wrapper  { overflow-x: auto; padding-bottom: 10px; }
.canvas-griglia  { display: grid; gap: 2px; width: fit-content; background: #e0e0e0; border: 2px solid #ccc; padding: 2px; }
.cella-canvas    { height: 35px; background: #FAFAFA; display: flex; align-items: center; justify-content: center; cursor: pointer; user-select: none; transition: filter 0.1s; }
.cella-canvas:hover { filter: brightness(0.9); }
.cella-canvas.occupata { background: #0066CC; color: #fff; }
.cella-canvas.root { font-weight: bold; font-size: 0.75rem; }
.cella-empty-dot { color: #ccc; font-weight: bold; }
.anteprima-mappa { background: #fff; border: 1px solid #E8E8E8; padding: 20px; border-radius: 8px; margin-top: 30px; overflow-x: auto; }
.anteprima-mappa h4 { margin: 0 0 16px; font-size: 1rem; color: #222; }

/* ── Modal ───────────────────────────────────────────────────────────────── */
.parkly-modal     { border-radius: 24px; border: none; box-shadow: 0 15px 50px rgba(0,0,0,0.2); }
.modal-title-text { font-weight: 700; color: #00408a; font-size: 1.3rem; }
.info-list        { padding-left: 20px; color: #444; font-size: 0.95rem; line-height: 1.6; }
.info-list li     { margin-bottom: 12px; }

/* ── Chat ────────────────────────────────────────────────────────────────── */
.btn-chat {
  position: relative;
  display: inline-flex; align-items: center; gap: 5px;
  padding: 5px 12px;
  border: 0.5px solid #0066CC; border-radius: 6px;
  background: #EBF3FF; color: #0066CC;
  font-size: 0.75rem; font-weight: 600;
  cursor: pointer; font-family: inherit;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}
.btn-chat:hover { background: #0066CC; color: #fff; }

.chat-notification-dot {
  position: absolute; top: -4px; right: -4px;
  width: 10px; height: 10px;
  background: #E74C3C; border-radius: 50%;
  border: 2px solid #fff;
}

.chat-popup-container {
  position: fixed; bottom: 24px; right: 24px;
  width: 350px; max-width: calc(100vw - 48px);
  z-index: 9999;
  display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
  animation: slideUp 0.3s ease-out;
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Fix Leaflet z-index ──────────────────────────────────────────────────── */
.leaflet-container { z-index: 1 !important; }

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .sidebar         { display: none; }
  .main-content    { padding: 24px 20px; }
  .stats-grid      { grid-template-columns: 1fr; }
  .form-row--2col  { grid-template-columns: 1fr; }
  .form-row--3col  { grid-template-columns: 1fr; }
  .posto-creator   { grid-template-columns: 1fr; }
  .check-group     { flex-direction: column; align-items: flex-start; }
}
</style>