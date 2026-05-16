<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useGarageMapGestore } from '../../composables/useGarageMapGestore'
import { usePlanimetriaEditor } from '../../composables/usePlanimetriaEditor'
import PlanimetriaGarage from '../PlanimetriaGarage.vue'
import electricityIcon from '../../assets/electricity.svg'
import handicapIcon from '../../assets/handicap.svg'
import copertoIcon from '../../assets/parcheggio_coperto.svg'

const props = defineProps({
    isEditing: { type: Boolean, default: false },
    garageData: { type: Object, default: null },
    staSalvando: { type: Boolean, default: false }
})

const emit = defineEmits(['save', 'open-info', 'update-photos'])

const { calcolandoCoordinate, loadLeaflet, initMap, calcolaCoordinate } = useGarageMapGestore()
const {
    dimensioniMappa, griglia, strumentoAttivo, postiConfigurati, nuovoPosto,
    codiciPosizionati, stringaMappaGenerata, postiConvertitiPerAnteprima,
    ridimensionaGriglia, autoCompilaPosto, aggiungiPostoConfigurato,
    rimuoviPostoConfigurato, selezionaStrumento, clickCella, ricostruisciGriglia
} = usePlanimetriaEditor()

const localGarage = ref({
    nome: '', descrizione: '', via: '', civico: '', cap: '', citta: '', provincia: '',
    latitudine: null, longitudine: null, tariffabase: null, tariffamoto: null, tariffafurgone: null,
    sovrapprezzoelettrica: null, scontodisabili: null, altezzamassima: null,
    orarioapertura: '08:00', orariochiusura: '20:00', is24h: false
})
const erroriValidazione = ref({})

// Gestione selezione foto
const fotoSelezionate = ref([])
const handleFotoSelezionate = (event) => {
    fotoSelezionate.value = Array.from(event.target.files)
    emit('update-photos', fotoSelezionate.value)
}

onMounted(async () => {
    await loadLeaflet()

    if (props.isEditing && props.garageData) {
        const g = props.garageData
        localGarage.value = {
            ...g,
            tariffabase: g.tariffaauto || g.tariffabase,
            via: g.via || '',
            civico: g.civico || '',
            cap: g.cap || '',
            citta: g.citta || '',
            provincia: g.provincia || '',
            orarioapertura: g.orarioapertura?.substring(0, 5) || '08:00',
            orariochiusura: g.orariochiusura?.substring(0, 5) || '20:00'
        }
        if (g.posti_raw) {
            postiConfigurati.value = g.posti_raw.map(p => ({
                codice: p.codiceposto, tipo: p.tipoveicolo,
                isElettrica: p.iselettrica, isDisabili: p.isdisabili, isCoperto: p.iscoperto
            }))
        }
        ricostruisciGriglia(g.mappatestuale, g.nrighe, g.ncolonne)
    }

    await nextTick()
    initMap('mappa-garage-form', localGarage.value.latitudine, localGarage.value.longitudine, (lat, lng) => {
        localGarage.value.latitudine = lat
        localGarage.value.longitudine = lng
        erroriValidazione.value.coordinate = null
    })
})

const handleCercaZona = async () => {
    const res = await calcolaCoordinate(localGarage.value.via, localGarage.value.civico, localGarage.value.citta, localGarage.value.provincia)
    if (res.success) {
        localGarage.value.latitudine = res.lat
        localGarage.value.longitudine = res.lon
        erroriValidazione.value.coordinate = null
    } else { erroriValidazione.value.coordinate = res.error }
}

const handleAggiungiPosto = () => {
    const res = aggiungiPostoConfigurato()
    if (res && !res.success) alert(res.error)
}

const handleCellaClick = (r, c) => {
    const res = clickCella(r, c)
    if (res && !res.success) alert(res.error)
}

const validaForm = () => {
    const errori = {}
    const g = localGarage.value

    // Validazione indirizzi
    if (!g.nome?.trim()) errori.nome = 'Obbligatorio.'

    if (!g.via?.trim()) {
        errori.via = 'Obbligatorio.'
    } else if (g.via.trim().length < 3) {
        errori.via = 'Inserisci una via valida (min. 3 caratteri).'
    }

    if (!g.civico?.trim()) {
        errori.civico = 'Obbligatorio.'
    }

    if (!g.cap?.trim()) {
        errori.cap = 'Obbligatorio.'
    } else if (!/^\d{5}$/.test(g.cap.trim())) {
        errori.cap = 'Il CAP deve essere di 5 cifre.'
    }

    if (!g.citta?.trim()) {
        errori.citta = 'Obbligatorio.'
    } else if (g.citta.trim().length < 2) {
        errori.citta = 'Inserisci una città valida.'
    }

    if (!g.provincia?.trim()) {
        errori.provincia = 'Obbligatorio.'
    } else if (!/^[A-Z]{2}$/.test(g.provincia.trim())) {
        errori.provincia = 'Deve essere una sigla di 2 lettere (es. RM).'
    }

    if (!g.latitudine || !g.longitudine) errori.coordinate = 'Clicca sulla mappa per catturare le coordinate esatte.'
    
    // Validazione tariffe
    if (!g.tariffabase || g.tariffabase <= 0) errori.tariffabase = 'La tariffa auto è obbligatoria e > 0.'

    const tipiPresenti = new Set()
    let necessitaElettrica = false
    let necessitaDisabili = false
    for (const posto of postiConfigurati.value) {
        tipiPresenti.add(posto.tipo)
        if (posto.isElettrica) necessitaElettrica = true
        if (posto.isDisabili) necessitaDisabili = true
    }

    if (tipiPresenti.has('MOTO') && (!g.tariffamoto || g.tariffamoto <= 0)) errori.tariffamoto = 'Obbligatoria per posti MOTO!'
    if (tipiPresenti.has('FURGONE') && (!g.tariffafurgone || g.tariffafurgone <= 0)) errori.tariffafurgone = 'Obbligatoria per posti FURGONE!'

    if (necessitaElettrica && (g.sovrapprezzoelettrica === null || g.sovrapprezzoelettrica === '')) errori.sovrapprezzoelettrica = 'Imposta un sovrapprezzo (anche 0).'
    else if (g.sovrapprezzoelettrica < 0) errori.sovrapprezzoelettrica = 'Non può essere negativo.'

    if (necessitaDisabili && (g.scontodisabili === null || g.scontodisabili === '')) errori.scontodisabili = 'Imposta uno sconto (anche 0).'
    else if (g.scontodisabili < 0) errori.scontodisabili = 'Non può essere negativo.'

    // Validazione mappa
    if (postiConfigurati.value.length === 0) errori.mappatestuale = 'Devi configurare almeno un posto auto.'
    else if (codiciPosizionati.value.size < postiConfigurati.value.length) errori.mappatestuale = 'Devi posizionare TUTTI i posti creati sulla scacchiera.'

    erroriValidazione.value = errori
    return Object.keys(errori).length === 0
}

const inviaDati = () => {
    if (!validaForm()) return
    emit('save', {
        ...localGarage.value,
        indirizzo: `${localGarage.value.via}, ${localGarage.value.civico}, ${localGarage.value.cap} ${localGarage.value.citta} (${localGarage.value.provincia})`,
        mappatestuale: stringaMappaGenerata.value,
        posti: postiConfigurati.value,
        nrighe: dimensioniMappa.value.righe,
        ncolonne: dimensioniMappa.value.colonne
    })
}
</script>

<template>
    <section class="vista fade-in centered-container">
        <div class="page-header d-flex justify-content-between align-items-center">
            <div>
                <h1 class="d-flex align-items-center gap-3">
                    {{ isEditing ? 'Modifica Garage' : 'Pubblica un Garage' }}
                    <button type="button" class="btn btn-outline-primary rounded-circle info-icon-btn"
                        @click="$emit('open-info')" title="Guida alla pubblicazione">
                        <i class="bi bi-info-lg"></i>
                    </button>
                </h1>
            </div>
        </div>

        <div class="form-card">
            <form @submit.prevent="inviaDati">

                <div class="section-header">
                    <h2>Informazioni Generali e Posizione</h2>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Nome del Garage*</label>
                        <input type="text" :class="['form-input', { 'input-error': erroriValidazione.nome }]"
                            v-model="localGarage.nome" placeholder="Es. Garage Roma Centro">
                        <span v-if="erroriValidazione.nome" class="form-error-text">{{ erroriValidazione.nome }}</span>
                    </div>
                </div>

                <div class="form-row form-row--3col">
                    <div class="form-group" style="grid-column: span 2;">
                        <label class="form-label">Via*</label>
                        <input type="text" :class="['form-input', { 'input-error': erroriValidazione.via }]"
                            v-model="localGarage.via" placeholder="Es. Via Roma">
                        <span v-if="erroriValidazione.via" class="form-error-text">{{ erroriValidazione.via }}</span>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Civico*</label>
                        <input type="text" :class="['form-input', { 'input-error': erroriValidazione.civico }]"
                            v-model="localGarage.civico" placeholder="Es. 10">
                        <span v-if="erroriValidazione.civico" class="form-error-text">{{ erroriValidazione.civico }}</span>
                    </div>
                </div>

                <div class="form-row form-row--3col">
                    <div class="form-group">
                        <label class="form-label">CAP*</label>
                        <!-- Forza solo numeri e massimo 5 caratteri -->
                        <input type="text" :class="['form-input', { 'input-error': erroriValidazione.cap }]"
                            v-model="localGarage.cap" 
                            @input="localGarage.cap = localGarage.cap.replace(/\D/g, '').slice(0, 5)"
                            placeholder="Es. 00100">
                        <span v-if="erroriValidazione.cap" class="form-error-text">{{ erroriValidazione.cap }}</span>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Città*</label>
                        <!-- impedisce l'inserimento di numeri -->
                        <input type="text" :class="['form-input', { 'input-error': erroriValidazione.citta }]"
                            v-model="localGarage.citta" 
                            @input="localGarage.citta = localGarage.citta.replace(/\d/g, '')"
                            placeholder="Es. Roma">
                        <span v-if="erroriValidazione.citta" class="form-error-text">{{ erroriValidazione.citta }}</span>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Provincia (Sigla)*</label>
                        <!-- Forza maiuscolo, solo lettere e massimo 2 caratteri -->
                        <input type="text" :class="['form-input', { 'input-error': erroriValidazione.provincia }]"
                            v-model="localGarage.provincia" 
                            @input="localGarage.provincia = localGarage.provincia.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2)"
                            placeholder="Es. RM">
                        <span v-if="erroriValidazione.provincia" class="form-error-text">{{ erroriValidazione.provincia }}</span>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group" style="flex-direction: row; gap: 10px; align-items: center;">
                        <button type="button" class="btn-secondary" style="padding: 0 20px;" @click="handleCercaZona"
                            :disabled="calcolandoCoordinate">
                            {{ calcolandoCoordinate ? 'Ricerca in corso...' : 'Trova zona sulla mappa' }}
                        </button>
                        <span class="form-hint">Cerca per avvicinarti, poi <strong>clicca sulla mappa</strong> per la
                            precisione massima.</span>
                    </div>
                </div>

                <div class="form-row">
                    <div id="mappa-garage-form"
                        style="height: 350px; width: 100%; border-radius: 8px; border: 1px solid #ccc; z-index: 1;">
                    </div>
                    <span v-if="erroriValidazione.coordinate" class="form-error-text"
                        style="display:block; margin-top:8px;">{{ erroriValidazione.coordinate }}</span>
                </div>

                <div class="form-row form-row--2col">
                    <div class="form-group">
                        <label class="form-label">Latitudine</label>
                        <input type="text" class="form-input" :value="localGarage.latitudine" disabled
                            placeholder="Clicca sulla mappa">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Longitudine</label>
                        <input type="text" class="form-input" :value="localGarage.longitudine" disabled
                            placeholder="Clicca sulla mappa">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Descrizione</label>
                        <input type="text" class="form-input" v-model="localGarage.descrizione"
                            placeholder="Breve descrizione del garage">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Foto del Garage (Max 10)</label>
                        <input 
                            type="file" 
                            multiple 
                            accept="image/*" 
                            class="form-input" 
                            style="padding: 10px;" 
                            @change="handleFotoSelezionate"
                        >
                        <span class="form-hint">Puoi selezionare più immagini contemporaneamente (es. tenendo premuto CTRL o CMD).</span>
                    </div>
                </div>

                <div class="section-header" style="margin-top: 30px;">
                    <h2>Tariffario e Orari</h2>
                </div>
                <div class="form-row form-row--3col">
                    <div class="form-group">
                        <label class="form-label">Tariffa Auto (€/h)*</label>
                        <input type="number" step="0.50" min="0"
                            :class="['form-input', { 'input-error': erroriValidazione.tariffabase }]"
                            v-model="localGarage.tariffabase" placeholder="Es. 2.50">
                        <span v-if="erroriValidazione.tariffabase" class="form-error-text">{{ erroriValidazione.tariffabase }}</span>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tariffa Moto (€/h)</label>
                        <input type="number" step="0.50" min="0"
                            :class="['form-input', { 'input-error': erroriValidazione.tariffamoto }]"
                            v-model="localGarage.tariffamoto" placeholder="Opzionale">
                        <span v-if="erroriValidazione.tariffamoto" class="form-error-text">{{ erroriValidazione.tariffamoto }}</span>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tariffa Furgone (€/h)</label>
                        <input type="number" step="0.50" min="0"
                            :class="['form-input', { 'input-error': erroriValidazione.tariffafurgone }]"
                            v-model="localGarage.tariffafurgone" placeholder="Opzionale">
                        <span v-if="erroriValidazione.tariffafurgone" class="form-error-text">{{ erroriValidazione.tariffafurgone }}</span>
                    </div>
                </div>

                <div class="form-row form-row--3col">
                    <div class="form-group">
                        <label class="form-label">Sovrapprezzo Elettrica (+€/h)</label>
                        <input type="number" step="0.50" min="0"
                            :class="['form-input', { 'input-error': erroriValidazione.sovrapprezzoelettrica }]"
                            v-model="localGarage.sovrapprezzoelettrica" placeholder="Es. 2.00">
                        <span v-if="erroriValidazione.sovrapprezzoelettrica" class="form-error-text">{{ erroriValidazione.sovrapprezzoelettrica }}</span>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Sconto Disabili (-€/h)</label>
                        <input type="number" step="0.50" min="0"
                            :class="['form-input', { 'input-error': erroriValidazione.scontodisabili }]"
                            v-model="localGarage.scontodisabili" placeholder="Es. 1.00">
                        <span v-if="erroriValidazione.scontodisabili" class="form-error-text">{{ erroriValidazione.scontodisabili }}</span>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Altezza Massima (m)</label>
                        <input type="number" step="0.10" min="0" class="form-input" v-model="localGarage.altezzamassima"
                            placeholder="Opzionale">
                    </div>
                </div>

                <div class="form-row form-row--2col">
                    <div class="form-group">
                        <label class="form-label">Orario Apertura</label>
                        <input type="time" class="form-input" v-model="localGarage.orarioapertura"
                            :disabled="localGarage.is24h">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Orario Chiusura</label>
                        <input type="time" class="form-input" v-model="localGarage.orariochiusura"
                            :disabled="localGarage.is24h">
                    </div>
                </div>
                <div class="form-row">
                    <label class="checkbox-label"><input type="checkbox" v-model="localGarage.is24h"
                            class="checkbox-input"> Aperto 24 ore su 24</label>
                </div>

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #E8E8E8;">

                <div class="section-header">
                    <h2>Crea i Posti Auto</h2>
                </div>
                <div class="posto-creator">
                    <div class="form-group">
                        <label class="form-label">Codice</label>
                        <input type="text" class="form-input" v-model="nuovoPosto.codice" placeholder="Es. A01"
                            @input="autoCompilaPosto" @keyup.enter="handleAggiungiPosto">
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
                        <label class="checkbox-label"><input type="checkbox" v-model="nuovoPosto.isElettrica"
                                class="checkbox-input"> Elettrico</label>
                        <label class="checkbox-label"><input type="checkbox" v-model="nuovoPosto.isDisabili"
                                class="checkbox-input"> Disabili</label>
                        <label class="checkbox-label"><input type="checkbox" v-model="nuovoPosto.isCoperto"
                                class="checkbox-input"> Coperto</label>
                    </div>
                    <div class="form-group" style="justify-content: flex-end;">
                        <button type="button" class="btn-secondary" @click="handleAggiungiPosto">+ Aggiungi</button>
                    </div>
                </div>

                <div class="posti-list vertical-grid" v-if="postiConfigurati.length > 0">
                    <div v-for="(posto, index) in postiConfigurati" :key="index" class="posto-card">
                        <div class="posto-info">
                            <span class="posto-codice">{{ posto.codice }}</span>
                            <span class="posto-tipo">{{ posto.tipo }}</span>
                            <div class="posto-icons">
                                <span v-if="posto.isElettrica" title="Elettrica"><img :src="electricityIcon"
                                        class="icon-card"></span>
                                <span v-if="posto.isDisabili" title="Disabili"><img :src="handicapIcon"
                                        class="icon-card"></span>
                                <span v-if="posto.isCoperto" title="Coperto"><img :src="copertoIcon"
                                        class="icon-card"></span>
                            </div>
                        </div>
                        <button type="button" class="btn-rimuovi" @click="rimuoviPostoConfigurato(index)"
                            title="Rimuovi">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                </div>

                <hr style="margin: 30px 0; border: none; border-top: 1px solid #E8E8E8;">

                <div class="section-header">
                    <h2>Disegna la Planimetria</h2>
                </div>
                <div class="form-row form-row--2col">
                    <div class="form-group">
                        <label class="form-label">Larghezza (Unità)</label>
                        <input type="number" class="form-input" v-model.number="dimensioniMappa.colonne"
                            @change="ridimensionaGriglia" min="1" max="30">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Altezza (Unità)</label>
                        <input type="number" class="form-input" v-model.number="dimensioniMappa.righe"
                            @change="ridimensionaGriglia" min="1" max="30">
                    </div>
                </div>

                <div class="d-flex justify-content-center w-100" v-if="postiConfigurati.length > 0">
                    <div class="tavolozza">
                        <span class="tavolozza-label">Strumento attivo:</span>
                        <button type="button" class="tool-btn btn-gomma"
                            :class="{ active: strumentoAttivo === 'GOMMA' }"
                            @click="strumentoAttivo = 'GOMMA'">
                            <i class="bi bi-eraser"></i>
                            Gomma</button>
                        <button type="button" v-for="posto in postiConfigurati" :key="posto.codice" class="tool-btn"
                            :class="[posto.tipo.toLowerCase(), { active: strumentoAttivo?.codice === posto.codice, disabled: codiciPosizionati.has(posto.codice) }]"
                            :disabled="codiciPosizionati.has(posto.codice)" @click="selezionaStrumento(posto)">
                            {{ posto.codice }} ({{ posto.tipo }})
                        </button>
                    </div>
                </div>

                <div class="canvas-wrapper d-flex justify-content-center w-100">
                    <div class="canvas-griglia"
                        :style="{ gridTemplateColumns: `repeat(${dimensioniMappa.colonne}, 35px)` }">
                        <template v-for="(riga, r) in griglia" :key="'r-'+r">
                            <div v-for="(cella, c) in riga" :key="'c-' + r + '-' + c" class="cella-canvas"
                                :class="{ occupata: cella, root: cella?.isRoot }" @click="handleCellaClick(r, c)">
                                <span v-if="cella?.isRoot">{{ cella.codice }}</span>
                                <span v-else-if="!cella" class="cella-empty-dot">·</span>
                            </div>
                        </template>
                    </div>
                </div>

                <div v-if="stringaMappaGenerata" class="anteprima-mappa mt-4">
                    <h4>Anteprima Planimetria</h4>
                    <PlanimetriaGarage :posti="postiConvertitiPerAnteprima" :mappaTestuale="stringaMappaGenerata"
                        :isAnteprima="true" :mostraErrori="false" />
                </div>
                <span v-if="erroriValidazione.mappatestuale" class="form-error-text"
                    style="display:block; margin-top:10px;">{{
                        erroriValidazione.mappatestuale }}</span>

                <div class="form-actions mt-4 pt-4 border-top">
                    <button type="submit" class="btn-primary" :disabled="staSalvando">
                        {{ staSalvando ? 'Salvataggio in corso...' : (isEditing ? 'Salva modifiche' : 'Pubblica Garage')
                        }}
                    </button>
                </div>

            </form>
        </div>
    </section>
</template>

<style scoped>

/* Ripristino esatto del CSS originale della form */
.vista {
    animation: fadeIn 0.25s ease;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(8px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.centered-container {
    max-width: 960px;
    margin: 0 auto;
}

.page-header {
    margin-bottom: 32px;
}

.page-header h1 {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--deep-blue, #00204A);
    letter-spacing: -0.5px;
    margin: 0 0 4px;
}

.section-header {
    margin-bottom: 12px;
}

.section-header h2 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--deep-blue, #00204A);
}

.form-card {
    background: #fff;
    border: 0.5px solid #E8E8E8;
    border-radius: 12px;
    padding: 32px;
}

.form-row {
    margin-bottom: 20px;
}

.form-row--2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
}

.form-row--3col {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.form-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.form-input {
    height: 48px;
    border: 0.5px solid #E0E0E0;
    border-radius: 8px;
    padding: 0 14px;
    font-size: 0.9rem;
    color: #222;
    background: #FAFAFA;
    outline: none;
    font-family: inherit;
    transition: border-color 0.15s, background 0.15s;
    width: 100%;
    box-sizing: border-box;
}

.form-input:focus {
    border-color: #0066CC;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.08);
}

.form-input:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.form-hint {
    font-size: 0.78rem;
    color: #aaa;
}

.checkbox-label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.875rem;
    color: #444;
    cursor: pointer;
}

.checkbox-input {
    width: 16px;
    height: 16px;
    accent-color: #0066CC;
    cursor: pointer;
}

.input-error {
    border-color: #C0392B !important;
    background-color: #FDEDEC !important;
}

.form-error-text {
    color: #C0392B;
    font-size: 0.8rem;
    font-weight: 600;
    margin-top: 4px;
}

.btn-primary {
    background: #0066CC;
    color: #fff;
    border: none;
    border-radius: 8px;
    height: 48px;
    padding: 0 32px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, transform 0.1s;
}

.btn-primary:hover:not(:disabled) {
    background: #00204A;
    transform: translateY(-1px);
}

.btn-primary:disabled {
    background: #ccc;
    cursor: not-allowed;
}

.btn-secondary {
    background: #fff;
    border: 1px solid #0066CC;
    color: #0066CC;
    height: 48px;
    padding: 0 20px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-secondary:hover:not(:disabled) {
    background: #0066CC;
    color: #fff;
}

.info-icon-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-width: 2px;
}

.posto-creator {
    display: grid;
    grid-template-columns: 2fr 2fr 3fr auto;
    gap: 12px;
    align-items: flex-end;
    background: #FAFBFF;
    border: 1px solid #D6E4F0;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 16px;
}

.check-group {
    display: flex;
    flex-direction: row;
    gap: 12px;
    align-items: center;
    padding-bottom: 12px;
}

.posti-list.vertical-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
}

.posto-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #FAFBFF;
    border: 1px solid #D6E4F0;
    border-radius: 8px;
    padding: 12px 16px;
    transition: border-color 0.2s, box-shadow 0.2s;
}

.posto-card:hover {
    border-color: #BADCFF;
    background: #F0F6FF;
}

.posto-info {
    display: flex;
    align-items: center;
    gap: 12px;
}

.posto-codice {
    font-size: 1.05rem;
    font-weight: 700;
    color: #00408A;
    min-width: 40px;
}

.posto-tipo {
    font-size: 0.75rem;
    color: #555;
    font-weight: 600;
    background: #E8E8E8;
    padding: 3px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.posto-icons {
    display: flex;
    gap: 6px;
    font-size: 1rem;
}

.icon-card {
    width: 14px;
    height: 14px;
    margin-right: 5px;
}

.btn-rimuovi {
    background: transparent;
    border: none;
    color: #aaa;
    cursor: pointer;
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all 0.15s ease;
}

.btn-rimuovi:hover {
    background: #FDEDEC;
    color: #C0392B;
}

.tavolozza {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    padding: 12px;
    background: #fdfdfd;
    border: 1px solid #eee;
    border-radius: 8px;
}

.tavolozza-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #666;
    margin-right: 8px;
}

.tool-btn {
    padding: 6px 12px;
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.8rem;
    transition: all 0.2s;
    background: #EBF3FF;
    color: #00408A;
}

.tool-btn:hover {
    filter: brightness(0.95);
}

.tool-btn.active {
    border-color: #00408A;
    box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.2);
}

.tool-btn.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    text-decoration: line-through;
}

.btn-gomma {
    background: #FDEDEC;
    color: #C0392B;
}

.btn-gomma.active {
    border-color: #C0392B;
    box-shadow: 0 0 0 3px rgba(192, 57, 43, 0.2);
}

.canvas-wrapper {
    overflow-x: auto;
    padding-bottom: 10px;
}

.canvas-griglia {
    display: grid;
    gap: 2px;
    width: fit-content;
    background: #e0e0e0;
    border: 2px solid #ccc;
    padding: 2px;
}

.cella-canvas {
    height: 35px;
    background: #FAFAFA;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
    transition: filter 0.1s;
}

.cella-canvas:hover {
    filter: brightness(0.9);
}

.cella-canvas.occupata {
    background: #0066CC;
    color: #fff;
}

.cella-canvas.root {
    font-weight: bold;
    font-size: 0.75rem;
}

.cella-empty-dot {
    color: #ccc;
    font-weight: bold;
}

.anteprima-mappa {
    background: #fff;
    border: 1px solid #E8E8E8;
    padding: 20px;
    border-radius: 8px;
    margin-top: 30px;
    overflow-x: auto;
}

.anteprima-mappa h4 {
    margin: 0 0 16px;
    font-size: 1rem;
    color: #222;
}

@media (max-width: 900px) {

    .form-row--2col,
    .form-row--3col,
    .posto-creator {
        grid-template-columns: 1fr;
    }

    .check-group {
        flex-direction: column;
        align-items: flex-start;
    }
}
</style>