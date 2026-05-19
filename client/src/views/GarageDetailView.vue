<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { garageStore } from '../store/garage'
import { authStore } from '../store/auth'
import { alertStore } from '../store/alert'
import 'bootstrap-icons/font/bootstrap-icons.css'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'
import PlanimetriaGarage from '../components/PlanimetriaGarage.vue'
import Pagination from '../components/Pagination.vue'

const route = useRoute()
const router = useRouter()
const props = defineProps(['id'])
const checkIn = ref(route.query.inizio || '')
const checkOut = ref(route.query.fine || '')
const targa = ref('')
const note = ref('')
const codiceDisabilita = ref('')
const postoSelezionato = ref(null)
const isMapConfirmed = ref(false)
const isPrenotando = ref(false)
const indiceFotoAttiva = ref(null)

// genera la data e ora attuale in formato locale ISO per bloccare le date passate nel calendario nativo
const oggiIso = computed(() => {
    // Calcola l'offset del fuso orario corrente per ottenere la stringa ISO corretta
    const tzoffset = (new Date()).getTimezoneOffset() * 60000; // offset in millisecondi
    return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
})

// Gestore eventi tastiera per chiudere la modale foto o scorrere tra di esse
const handleKeydown = (e) => {
    // Funziona solo se c'è una foto attualmente visualizzata a schermo intero
    if (indiceFotoAttiva.value !== null) {
        if (e.key === 'Escape') chiudiFoto()
        if (e.key === 'ArrowRight') fotoSuccessiva()
        if (e.key === 'ArrowLeft') fotoPrecedente()
    }
}

onMounted(async () => {
    // listener per utilizzare ESC e le frecce nella galleria immagini
    document.addEventListener('keydown', handleKeydown)

    // Pulisce lo store ed effettua la fetch dei dati completi del garage
    garageStore.clearGarageData()
    await garageStore.fetchGarage(Number(props.id))

    // Se il garage non esiste (es. id invalido), reindirizza alla pagina 404
    if (!garageStore.currentGarage) {
        router.push({ name: 'NotFound' })
        return
    }

    // Effettua la fetch dei posti (senza filtri data iniziali) e delle recensioni
    await garageStore.fetchPosti(props.id, '', '')
    await garageStore.fetchRecensioni(props.id)

    // Se arrivano già checkIn e checkOut dai parametri dell'URL, aggiorna automaticamente la mappa
    if (checkIn.value && checkOut.value) {
        await aggiornaMappa()
    }
})

// Pulizia del listener alla distruzione del componente per evitare memory leaks
onUnmounted(() => {
    // rimuovo il listener quando il componente viene distrutto
    document.removeEventListener('keydown', handleKeydown)
})

// Ascolta i cambiamenti delle date per resettare la selezione ed evitare prenotazioni non valide
watch([checkIn, checkOut], () => {
    isMapConfirmed.value = false
    postoSelezionato.value = null
    alertStore.pulisci() // Pulisce eventuali errori precedenti quando si cambiano le date
})

// Estrae le foto in modo sicuro dal garage corrente o restituisce array vuoto
const fotoGarage = computed(() => {
    return garageStore.currentGarage?.foto_urls || []
})

// Apre la modale per visualizzare una foto a schermo intero
const apriFoto = (index) => {
    indiceFotoAttiva.value = index
    document.body.style.overflow = 'hidden' // Blocca lo scroll della pagina sottostante
}

// Chiude la modale della galleria foto
const chiudiFoto = () => {
    indiceFotoAttiva.value = null
    document.body.style.overflow = '' // Sblocca lo scroll della pagina
}

// Passa all'immagine successiva nella galleria
const fotoSuccessiva = () => {
    if (indiceFotoAttiva.value === null || fotoGarage.value.length === 0) return
    // passa alla foto successiva, tornando alla prima se siamo all'ultima (% length)
    indiceFotoAttiva.value = (indiceFotoAttiva.value + 1) % fotoGarage.value.length
}

// Passa all'immagine precedente nella galleria
const fotoPrecedente = () => {
    if (indiceFotoAttiva.value === null || fotoGarage.value.length === 0) return
    // passa alla precedente, andando all'ultima se siamo alla prima
    indiceFotoAttiva.value = (indiceFotoAttiva.value - 1 + fotoGarage.value.length) % fotoGarage.value.length
}

// Computed property che legge e prepara i prezzi base direttamente dal record del garage
const tariffePerVeicolo = computed(() => {
    const g = garageStore.currentGarage;
    if (!g) return {};

    const tariffe = {};
    if (g.tariffamoto) tariffe['MOTO'] = Number(g.tariffamoto);
    if (g.tariffaauto) tariffe['AUTO'] = Number(g.tariffaauto);
    if (g.tariffafurgone) tariffe['FURGONE'] = Number(g.tariffafurgone);

    // Se non è specificata una tariffa auto, si prova a usare una tariffa base generica come fallback
    if (!tariffe['AUTO'] && g.tariffabase) tariffe['AUTO'] = Number(g.tariffabase);

    return tariffe;
});

// Calcola se c'è un sovrapprezzo per la ricarica elettrica da mostrare nell'interfaccia
const sovrapprezzoElettrica = computed(() => {
    const val = garageStore.currentGarage?.sovrapprezzoelettrica;
    return val && Number(val) > 0 ? Number(val).toFixed(2) : null;
});

// Calcola se c'è uno sconto disabili impostato dal gestore
const scontoDisabili = computed(() => {
    const val = garageStore.currentGarage?.scontodisabili;
    return val && Number(val) > 0 ? Number(val).toFixed(2) : null;
});

// Rimuove spazi o caratteri speciali dalla targa e la forza in maiuscolo
const formattaTarga = () => {
    targa.value = targa.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

// Valida la targa in formato standard italiano (es: AA123BB)
const isTargaValida = computed(() => {
    const regex = /^[A-Z]{2}\d{3}[A-Z]{2}$/
    return regex.test(targa.value)
})

// Rimuove spazi, formatta il codice disabili CUDE in maiuscolo consentendo solo trattini
const formattaCude = () => {
    // rimuove qualsiasi carattere che non sia lettera, numero o trattino, e converte in maiuscolo
    codiceDisabilita.value = codiceDisabilita.value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase()
}

// Verifica che il codice disabili rispetti i criteri solo se il posto è riservato a disabili
const isCudeValido = computed(() => {
    // se non abbiamo selezionato un posto per disabili, il campo è tecnicamente "valido" a prescindere
    if (!postoSelezionato.value?.isdisabili) return true;

    // solo lettere maiuscole, numeri e trattini. Lunghezza da 5 a 20 caratteri.
    const regex = /^[A-Z0-9-]{5,20}$/;
    return regex.test(codiceDisabilita.value);
})

// Funzione chiamata per validare le date di sosta e aggiornare la disponibilità dei posti in mappa
const aggiornaMappa = async () => {
    alertStore.pulisci()

    // Verifica che entrambi i campi data siano compilati
    if (!checkIn.value || !checkOut.value) {
        alertStore.mostra('error', 'Inserisci data di arrivo e partenza prima di controllare.')
        return
    }

    const dataArrivo = new Date(checkIn.value)
    const dataPartenza = new Date(checkOut.value)
    const adesso = new Date()

    // Verifica che l'arrivo non sia passato
    if (dataArrivo < adesso) {
        alertStore.mostra('error', 'Non puoi prenotare per un orario passato.')
        return
    }

    // Verifica che la partenza avvenga dopo l'arrivo
    if (dataPartenza <= dataArrivo) {
        alertStore.mostra('error', 'L\'orario di partenza deve essere successivo a quello di arrivo.')
        return
    }

    // Richiede allo store i posti disponibili in quel frangente temporale
    await garageStore.fetchPosti(props.id, checkIn.value, checkOut.value)

    // Conferma l'apertura della mappa cliccabile e resetta eventuale posto già selezionato
    isMapConfirmed.value = true
    postoSelezionato.value = null
}

// Resetta tutto lo stato di prenotazione per ripartire da zero
const resetSelezione = async () => {
    checkIn.value = ''
    checkOut.value = ''
    targa.value = ''
    note.value = ''
    postoSelezionato.value = null
    codiceDisabilita.value = ''
    isMapConfirmed.value = false
    alertStore.pulisci()

    // Richiede la mappa senza vincoli temporali (modalità visualizzazione)
    await garageStore.fetchPosti(props.id, '', '')
}

// Calcola il prezzo della sosta in base alla durata e alla tariffa oraria del posto
const prezzoTotale = computed(() => {
    if (!checkIn.value || !checkOut.value || !postoSelezionato.value) return 0
    const ore = (new Date(checkOut.value) - new Date(checkIn.value)) / (1000 * 60 * 60)
    return ore > 0 ? (ore * postoSelezionato.value.tariffaoraria).toFixed(2) : 0
})

// Calcola la durata della sosta in ore per riepilogarla in UI
const durataOre = computed(() => {
    if (!checkIn.value || !checkOut.value) return 0
    const ore = (new Date(checkOut.value) - new Date(checkIn.value)) / (1000 * 60 * 60)
    return ore > 0 ? ore.toFixed(1) : 0
})

// Funzione principale per l'invio della prenotazione al backend
const gestisciPrenotazione = async () => {
    if (!postoSelezionato.value) return
    alertStore.pulisci()

    // Ultimi controlli di validazione lato client
    if (!isTargaValida.value) {
        alertStore.mostra('error', 'Inserisci una targa valida prima di procedere.')
        return
    }

    if (postoSelezionato.value.isdisabili && !isCudeValido.value) {
        alertStore.mostra('error', 'Inserisci un codice Contrassegno CUDE valido (es. IT-1234567).')
        return
    }

    isPrenotando.value = true; // Mostra stato di caricamento sul pulsante

    // Prepara il payload per l'API
    const payload = {
        id_posto: postoSelezionato.value.id_posto,
        targa: targa.value,
        note: note.value,
        inizio: checkIn.value,
        fine: checkOut.value,
        prezzo_totale: prezzoTotale.value,
        codice_disabilita: codiceDisabilita.value
    }

    // Invoca store di prenotazione
    const res = await garageStore.prenota(payload)

    isPrenotando.value = false;

    if (res.success) {
        // Se l'utente è loggato, aggiorna visivamente il suo saldo riducendolo
        if (authStore.utente) {
            authStore.utente.saldo = parseFloat(authStore.utente.saldo) - parseFloat(prezzoTotale.value);
            authStore.setUtente(authStore.utente); // Aggiorna lo store autenticazione
        }

        // Ricarica la mappa aggiornando le nuove disponibilità
        await aggiornaMappa()

        // Mostra il successo e il codice univoco generato
        alertStore.mostra('success', `Prenotazione avvenuta con successo! Il tuo codice è: ${res.prenotazione.codiceprenotazione}`)

        // Pulisce i campi compilati
        postoSelezionato.value = null
        targa.value = ''
        note.value = ''
        window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
        alertStore.mostra('error', res.error || 'Errore durante la prenotazione')
    }
}

const recensioneSelezionata = ref(null)

// Gestisce l'apertura del modale per mostrare la recensione completa quando è troppo lunga
const apriModalCommento = (recensione) => {
    recensioneSelezionata.value = recensione
    document.body.style.overflow = 'hidden'
}

// Chiude il modale recensione
const chiudiModalCommento = () => {
    recensioneSelezionata.value = null
    document.body.style.overflow = ''
}

// Formatta la data del commento (es. "Maggio 2026")
const formattaDataRecensione = (dataString) => {
    if (!dataString) return ''
    const data = new Date(dataString)
    return new Intl.DateTimeFormat('it-IT', {
        month: 'long',
        year: 'numeric'
    }).format(data)
}

// Computed property che calcola le percentuali dei voti da 1 a 5 stelle per la barra progressi
const distribuzioneVoti = computed(() => {
    const recensioni = garageStore.recensioni
    const totale = recensioni.length
    const distrib = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    if (totale === 0) return distrib

    // Conta le occorrenze di ciascun voto intero
    recensioni.forEach(r => {
        const voto = Math.floor(r.votogenerale || 0)
        if (distrib[voto] !== undefined) {
            distrib[voto]++
        }
    })

    // Trasforma i conteggi assoluti in percentuale
    for (let i = 1; i <= 5; i++) {
        distrib[i] = (distrib[i] / totale) * 100
    }
    return distrib
})

const recensioniPerPagina = ref(4)
const paginaRecensioniCorrente = ref(1)

// Computed property per gestire lo slice di recensioni in base alla paginazione attiva
const recensioniPaginate = computed(() => {
    const inizio = (paginaRecensioniCorrente.value - 1) * recensioniPerPagina.value
    return garageStore.recensioni.slice(inizio, inizio + recensioniPerPagina.value)
})

// Chiude eventuali modali di commento aperte al cambio della pagina recensioni
watch(paginaRecensioniCorrente, () => {
    chiudiModalCommento()
})

</script>

<template>
    <div class="page-container">
        <Header />

        <main v-if="garageStore.isLoading" class="msg-box">Caricamento...</main>

        <main v-else class="main-content">
            <section class="basic-hero">
                <div class="hero-top">
                    <div class="hero-left">
                        <h1>{{ garageStore.currentGarage?.nome }}</h1>
                        <p class="descrizione">{{ garageStore.currentGarage?.descrizione }}</p>
                        <div class="badge-row">
                            <div class="badge">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                                {{ garageStore.currentGarage?.indirizzo }}
                            </div>

                            <div class="badge" v-if="garageStore.currentGarage?.is24h">
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
                                {{ garageStore.currentGarage?.orarioapertura.substring(0, 5) }} - {{
                                    garageStore.currentGarage?.orariochiusura.substring(0, 5) }}
                            </div>

                            <div class="badge" v-if="garageStore.currentGarage?.altezzamassima">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M12 22V5" />
                                    <path d="M7 10l5-5 5 5" />
                                    <line x1="4" y1="2" x2="20" y2="2" />
                                </svg>
                                Max {{ garageStore.currentGarage?.altezzamassima }}m
                            </div>
                        </div>
                    </div>

                    <div class="hero-right">
                        <div class="prezzo-label">Tariffe a partire da:</div>

                        <div class="price-line" v-if="tariffePerVeicolo['MOTO']">
                            <span class="v-tipo">Moto</span>
                            <span class="prezzo-valore-small">€{{ tariffePerVeicolo['MOTO'].toFixed(2)
                                }}<span>/h</span></span>
                        </div>

                        <div class="price-line" v-if="tariffePerVeicolo['AUTO']">
                            <span class="v-tipo">Auto</span>
                            <span class="prezzo-valore-small">€{{ tariffePerVeicolo['AUTO'].toFixed(2)
                                }}<span>/h</span></span>
                        </div>

                        <div class="price-line" v-if="tariffePerVeicolo['FURGONE']">
                            <span class="v-tipo">Furgone</span>
                            <span class="prezzo-valore-small">€{{ tariffePerVeicolo['FURGONE'].toFixed(2)
                                }}<span>/h</span></span>
                        </div>

                        <div class="special-rates-container" v-if="sovrapprezzoElettrica || scontoDisabili">
                            <div class="special-line ev-line" v-if="sovrapprezzoElettrica">
                                <span class="v-tipo">Ricarica elettrica</span>
                                <span class="prezzo-valore-small">+€{{ sovrapprezzoElettrica }}<span>/h</span></span>
                            </div>
                            <div class="special-line cude-line" v-if="scontoDisabili">
                                <span class="v-tipo">Sconto Disabili</span>
                                <span class="prezzo-valore-small">-€{{ scontoDisabili }}<span>/h</span></span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="gallery-section" v-if="fotoGarage.length > 0">
                <div class="gallery-track">
                    <img v-for="(url, index) in fotoGarage" :key="index" :src="url" alt="Foto garage"
                        class="gallery-img" @click="apriFoto(index)">
                </div>
            </section>

            <div class="layout-grid">

                <div class="left-column">
                    <div class="card">
                        <div class="card-header">
                            <h2>Planimetria</h2>
                        </div>
                        <div class="card-body">
                            <PlanimetriaGarage :posti="garageStore.posti"
                                :mappaTestuale="garageStore.currentGarage?.mappatestuale"
                                :selectedId="postoSelezionato?.id_posto" :isAnteprima="!isMapConfirmed"
                                @select="(p) => postoSelezionato = p"
                                @error="(msg) => alertStore.mostra('error', msg)" />
                        </div>
                    </div>

                    <section class="reviews-section card" v-if="garageStore.currentGarage">
                        <div class="card-header">
                            <h2>Recensioni</h2>
                        </div>
                        <div class="card-body">

                            <div v-if="garageStore.recensioni.length > 0">

                                <div class="reviews-top-row">
                                    <div class="overall-rating-header">
                                        <h2 class="rating-number">{{
                                            Number(garageStore.currentGarage.mediagenerale).toFixed(2) }}</h2>

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
                                </div>

                                <hr class="reviews-divider">

                                <div class="categories-grid">
                                    <div class="category-item">
                                        <span class="cat-label"><i class="bi bi-geo-alt"></i> Posizione</span>
                                        <span class="cat-val">{{
                                            Number(garageStore.currentGarage.mediaposizione).toFixed(1) }}</span>
                                    </div>
                                    <div class="category-item">
                                        <span class="cat-label"><i class="bi bi-tag"></i> Prezzo</span>
                                        <span class="cat-val">{{
                                            Number(garageStore.currentGarage.mediaprezzo).toFixed(1) }}</span>
                                    </div>
                                    <div class="category-item">
                                        <span class="cat-label"><i class="bi bi-stars"></i> Pulizia</span>
                                        <span class="cat-val">{{
                                            Number(garageStore.currentGarage.mediapulizia).toFixed(1) }}</span>
                                    </div>
                                    <div class="category-item">
                                        <span class="cat-label"><i class="bi bi-car-front"></i> Spazio di manovra</span>
                                        <span class="cat-val">{{
                                            Number(garageStore.currentGarage.mediaspazio).toFixed(1) }}</span>
                                    </div>
                                    <div class="category-item">
                                        <span class="cat-label"><i class="bi bi-shield-check"></i> Sicurezza</span>
                                        <span class="cat-val">{{
                                            Number(garageStore.currentGarage.mediasicurezza).toFixed(1) }}</span>
                                    </div>
                                </div>

                                <div class="user-comments-section mt-5 pt-4 border-top">
                                    <div class="reviews-wrapper">
                                        <div class="comments-grid">
                                            <div v-for="(recensione, index) in recensioniPaginate" :key="index"
                                                class="comment-card">
                                                <div class="comment-header">
                                                    <div class="user-avatar">
                                                        <img v-if="recensione.fotoprofilo_url"
                                                            :src="recensione.fotoprofilo_url" alt="User avatar">
                                                        <span v-else>{{ recensione.nome.charAt(0).toUpperCase()
                                                            }}</span>
                                                    </div>

                                                    <div class="user-info">
                                                        <h4 class="user-name">{{ recensione.nome }} {{
                                                            recensione.inizialecognome }}.</h4>
                                                    </div>
                                                </div>

                                                <div class="comment-meta">
                                                    <div class="small-stars">
                                                        <i v-for="star in 5" :key="'s' + star" class="bi"
                                                            :class="star <= Math.round(recensione.votogenerale) ? 'bi-star-fill star--on' : 'bi-star star--off'">
                                                        </i>
                                                    </div>
                                                    <span class="meta-dot">·</span>
                                                    <span class="comment-date">{{
                                                        formattaDataRecensione(recensione.datacreazione) }}</span>
                                                </div>

                                                <p class="comment-text" v-if="recensione.commento">{{
                                                    recensione.commento }}</p>
                                                <p class="comment-text text-muted fst-italic" v-else></p>

                                                <div class="action-slot">
                                                    <button :style="{
                                                        visibility: (
                                                            recensione.commento &&
                                                            (recensione.commento.length > 130 || recensione.commento.split('\n').length > 3)
                                                        ) ? 'visible' : 'hidden'
                                                    }" class="mostra-altro-btn" @click="apriModalCommento(recensione)">
                                                        Leggi tutto
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="pagination-wrapper mt-5 d-flex justify-content-center">
                                            <Pagination compact v-model:paginaCorrente="paginaRecensioniCorrente"
                                                v-model:elementiPerPagina="recensioniPerPagina"
                                                :totaleElementi="garageStore.recensioni.length" />
                                        </div>
                                    </div>
                                </div>

                            </div>

                            <div v-else class="empty-reviews text-center py-5 text-muted">
                                <i class="bi bi-chat-left-dots"
                                    style="font-size: 2.5rem; color: #cbd5e1; display: block; "></i>
                                Nessuna recensione presente al momento.<br>Sii il primo a recensire!
                            </div>

                        </div>
                    </section>
                </div>

                <aside class="card sticky-aside">
                    <div class="card-header">
                        <h2>Orari sosta</h2>
                    </div>
                    <div class="card-body">

                        <div class="form-group">
                            <label>Arrivo</label>
                            <input type="datetime-local" v-model="checkIn" :min="oggiIso">
                        </div>
                        <div class="form-group">
                            <label>Partenza</label>
                            <input type="datetime-local" v-model="checkOut" :min="oggiIso">
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

                            <div class="form-group" v-if="postoSelezionato.isdisabili">
                                <label>Codice Contrassegno CUDE</label>
                                <input type="text" v-model="codiceDisabilita" @input="formattaCude"
                                    placeholder="Es. IT-1234567" required>
                                <small v-if="codiceDisabilita.length > 0 && !isCudeValido" class="error-text">
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
                            <details class="policy-box">
                                <summary class="policy-header">
                                    <i class="bi bi-info-circle-fill"></i>
                                    <strong>Politica di annullamento</strong>
                                </summary>

                                <ul class="policy-list">
                                    <li><strong>Rimborso del 100%</strong> per disdette effettuate con almeno 12 ore di
                                        preavviso, o per ripensamenti entro 15 minuti dalla prenotazione.</li>
                                    <li><strong>Rimborso del 50%</strong> per le cancellazioni effettuate a meno di 12
                                        ore dall'arrivo.</li>
                                    <li><strong>Non rimborsabile</strong> se la sosta è già iniziata.</li>
                                </ul>
                            </details>
                        </div>

                        <button class="btn fill"
                            :disabled="!isMapConfirmed || !postoSelezionato || !targa || !isTargaValida || (postoSelezionato.isdisabili && !isCudeValido) || isPrenotando"
                            @click="gestisciPrenotazione">
                            <span v-if="isPrenotando"><i class="bi bi-hourglass-split"></i> Elaborazione...</span>
                            <span v-else>Prenota ora</span>
                        </button>

                    </div>
                </aside>
            </div>
        </main>

        <!-- MODAL COMMENTO COMPLETO -->
        <Teleport to="body">
            <div v-if="recensioneSelezionata" class="review-overlay" @click.self="chiudiModalCommento">
                <div class="review-modal">

                    <!-- Header modal -->
                    <div class="modal-header-row">
                        <div class="modal-reviewer-info">
                            <div class="user-avatar modal-avatar">
                                <img v-if="recensioneSelezionata.fotoprofilo_url"
                                    :src="recensioneSelezionata.fotoprofilo_url" alt="User avatar">
                                <span v-else>{{ recensioneSelezionata.nome.charAt(0).toUpperCase() }}</span>
                            </div>
                            <div>
                                <p class="modal-title-text">
                                    {{ recensioneSelezionata.nome }} {{ recensioneSelezionata.inizialecognome }}.
                                </p>
                                <div class="modal-stars-row">
                                    <div class="small-stars">
                                        <i v-for="star in 5" :key="star" class="bi"
                                            :class="star <= Math.round(recensioneSelezionata.votogenerale) ? 'bi-star-fill star--on' : 'bi-star star--off'">
                                        </i>
                                    </div>
                                    <span class="meta-dot">·</span>
                                    <span class="comment-date">{{
                                        formattaDataRecensione(recensioneSelezionata.datacreazione) }}</span>
                                </div>
                            </div>
                        </div>
                        <button class="close-btn" @click="chiudiModalCommento" aria-label="Chiudi">
                            <i class="bi bi-x-lg" style="font-size: 0.85rem;"></i>
                        </button>
                    </div>

                    <!-- Body modal: commento scrollabile -->
                    <div class="modal-comment-body">
                        <p class="modal-comment-text">{{ recensioneSelezionata.commento }}</p>
                    </div>

                </div>
            </div>
        </Teleport>

        <div v-if="indiceFotoAttiva !== null" class="photo-modal" @click="chiudiFoto">

            <button class="close-photo-btn" @click.stop="chiudiFoto">
                <i class="bi bi-x-lg"></i>
            </button>

            <!-- Bottone Precedente -->
            <button v-if="fotoGarage.length > 1" class="nav-photo-btn prev-btn" @click.stop="fotoPrecedente">
                <i class="bi bi-chevron-left"></i>
            </button>

            <img :src="fotoGarage[indiceFotoAttiva]" alt="Foto garage ingrandita" @click.stop>

            <!-- Bottone Successivo -->
            <button v-if="fotoGarage.length > 1" class="nav-photo-btn next-btn" @click.stop="fotoSuccessiva">
                <i class="bi bi-chevron-right"></i>
            </button>

        </div>

    </div>
    <Footer />
</template>

<style scoped>
.gallery-section {
    max-width: 1200px;
    margin: 24px auto 0;
    padding: 0 32px;
}

.gallery-track {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding-bottom: 12px;
    scrollbar-width: thin;
}

.gallery-track::-webkit-scrollbar {
    height: 8px;
}

.gallery-track::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 4px;
}

.gallery-img {
    height: 220px;
    width: auto;
    min-width: 280px;
    object-fit: cover;
    border-radius: 12px;
    cursor: pointer;
    transition: opacity 0.2s ease, transform 0.2s ease;
    border: 0.5px solid var(--border-light, #e2e8f0);
}

.gallery-img:hover {
    opacity: 0.9;
    transform: translateY(-2px);
}

.photo-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.9);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(5px);
}

.photo-modal img {
    max-width: 90%;
    max-height: 90vh;
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    object-fit: contain;
}

.close-photo-btn {
    position: absolute;
    top: 24px;
    right: 32px;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: none;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    font-size: 1.2rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    z-index: 10001;
}

.close-photo-btn:hover {
    background: rgba(255, 255, 255, 0.4);
}

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
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
}

.prezzo-label {
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.9);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 2px;
}

.price-line {
    display: flex;
    align-items: center;
    gap: 15px;
}

.v-tipo {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.9);
    font-weight: 500;
}

.prezzo-valore-small {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--white);
    line-height: 1;
    min-width: 65px;
    text-align: right;
}

.prezzo-valore-small span {
    font-size: 0.8rem;
    font-weight: 400;
    opacity: 0.5;
}

.alert {
    max-width: 1200px;
    margin: 16px auto 0;
}

.layout-grid {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 20px;
    max-width: 1200px;
    margin: 20px auto;
    padding: 0 32px 48px;
    align-items: start;
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

.reviews-section {
    width: 100%;
    margin: 0;
}

.reviews-section .card-body {
    padding: 32px;
}

.reviews-top-row {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    gap: 80px;
    margin-bottom: 32px;
    padding: 16px 16px;
    background-color: #FAFAFA;
    border-radius: 10px;
    border: 0.5px solid var(--border-light);
}

.overall-rating-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 150px;
}

.overall-rating-header h2.rating-number {
    font-size: 3.5rem;
    font-weight: 800;
    color: var(--text-dark);
    margin: 0 0 4px 0;
    line-height: 1;
    letter-spacing: -0.05em;
    text-align: center;
}

.average-stars {
    display: flex;
    justify-content: center;
    gap: 6px;
    margin-bottom: 12px;
}

.average-stars i {
    font-size: 2.2rem;
    transition: transform 0.2s;
}

.star--on {
    color: #f59e0b;
    filter: drop-shadow(0 3px 10px rgba(245, 158, 11, 0.45));
}

.star--off {
    color: #dde3ed;
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

.rating-ladder {
    width: 100%;
    max-width: 280px;
    display: flex;
    flex-direction: column;
    gap: 10px;
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

.categories-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    width: 100%;
}

.category-item {
    display: flex;
    flex-direction: column;
    border-left: 1px solid #f1f5f9;
    height: 100%;
    text-align: center;
}

.category-item:first-child {
    border-left: none;
}

.cat-label {
    font-size: 0.85rem;
    color: #64748b;
    line-height: 1.3;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
}

.cat-label i {
    font-size: 1.1rem;
    color: var(--text-dark);
    text-align: center;
}

.cat-val {
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-dark);
    margin-top: auto;
    text-align: center;
}

.user-comments-section {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid #e2e8f0;
}

.comments-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 32px 48px;
    align-content: start;
    height: 100%;
}

.comment-card {
    display: flex;
    flex-direction: column;
    min-width: 0;
    background-color: #fafafa;
    border: 0.5px solid var(--border-light);
    border-radius: 10px;
    padding: 20px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;

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
    margin: 0 0 8px;
    display: -webkit-box;
    line-clamp: 3;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
}


.mostra-altro-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-dark);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
    align-self: flex-start;
    transition: opacity 0.15s;
}

.mostra-altro-btn:hover {
    opacity: 0.6;
}

.special-rates-container {
    margin-top: 6px;
    padding-top: 8px;
    border-top: 1px dashed rgba(255, 255, 255, 0.2);
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.special-line {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 15px;
    width: 100%;
}

.special-line .prezzo-valore-small span {
    opacity: 0.7;
}

.modal-header-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 24px 24px 16px;
    border-bottom: 1px solid #f1f5f9;
    flex-shrink: 0;
}

.modal-reviewer-info {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
}

.modal-avatar {
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

.modal-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.modal-reviewer-info .modal-title-text {
    font-size: 1.1rem;
    margin-bottom: 4px;
}

.modal-stars-row {
    display: flex;
    align-items: center;
    gap: 6px;
}

.modal-comment-body {
    padding: 20px 24px 24px;
    overflow-y: auto;
    flex: 1;
}

.modal-comment-text {
    font-size: 1rem;
    line-height: 1.75;
    color: #334155;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
}

.policy-box {
    background-color: #f0f7ff;
    border: 1px solid #cce3fd;
    border-radius: 8px;
    padding: 12px;
    margin-top: 16px;
    color: var(--primary-blue, #00408A);
}

.policy-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
}

.policy-header i {
    font-size: 1rem;
}

.policy-list {
    margin: 0;
    padding-left: 24px;
    color: #475569;
    font-size: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.policy-list li {
    line-height: 1.4;
}

.policy-list li strong {
    color: var(--text-dark, #333);
}

.pagination-wrapper {
    margin-top: 3rem;
    display: flex;
    justify-content: center;
    width: 100%;
}

.reviews-wrapper {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 625px;
}

.left-column {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
}

.sticky-aside {
    position: sticky;
    top: 100px;
    height: max-content;
}

/* Stili per i bottoni di navigazione della modale */
.nav-photo-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: none;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    z-index: 10001;
}

.nav-photo-btn:hover {
    background: rgba(255, 255, 255, 0.4);
}

.prev-btn {
    left: 32px;
}

.next-btn {
    right: 32px;
}

/* Nascondi i bottoni sui dispositivi mobili molto piccoli per non coprire l'immagine */
@media (max-width: 600px) {
    .nav-photo-btn {
        width: 40px;
        height: 40px;
    }

    .prev-btn {
        left: 16px;
    }

    .next-btn {
        right: 16px;
    }
}
</style>