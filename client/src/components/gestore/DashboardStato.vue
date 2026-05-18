<script setup>
import { ref, computed, onUnmounted, watch } from 'vue'
import { alertStore } from '../../store/alert'
import PlanimetriaGarage from '../PlanimetriaGarage.vue'

// Dati ricevuti dal DB (tramite il padre) per incrociare posti, garage e prenotazioni
const props = defineProps({
    mieiGarage: { type: Array, required: true },
    postiPerGarage: { type: Object, required: true },
    occupazioneGarage: { type: Object, required: true },
    prenotazioni: { type: Array, default: () => [] },
})

const emit = defineEmits(['verifica-disponibilita', 'manage-posto'])

// Costanti che governano lo slider del tempo
const STEP_MIN = 30 // Ogni scatto dello slider fa avanzare l'orologio di 30 minuti
const MAX_HOURS = 48 // Quante ore nel futuro posso vedere
const MAX_STEPS = (MAX_HOURS * 60) / STEP_MIN

const sliderStep = ref(0) // Livello corrente dello slider (0 = adesso)

//Calcola l'oggetto Date() esatto in base a dove si trova la levetta dello slider.
const sliderTime = computed(() => {
    const t = new Date()
    t.setSeconds(0, 0)
    t.setMinutes(t.getMinutes() + sliderStep.value * STEP_MIN)
    return t
})

//Genera la stringa formattata mostrata sopra lo slider ("Oggi · 14:30" o "Adesso").
const sliderLabel = computed(() => {
    const t = sliderTime.value
    const now = new Date()
    const diffH = Math.round((t - now) / 3_600_000)
    const timeStr = t.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    const dateStr = t.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })

    if (sliderStep.value === 0) return `Adesso · ${timeStr}`
    if (diffH < 24) return `${timeStr}  (+${diffH}h)` // Entro le 24 ore mostra "+X ore"
    return `${dateStr} · ${timeStr}` // Oltre, mostra data e orario
})

const isPlaying = ref(false)
let playTimer = null

//Avvia/Ferma l'avanzamento automatico dello slider simulando lo scorrere del tempo.
const togglePlay = () => {
    if (isPlaying.value) {
        clearInterval(playTimer)
        isPlaying.value = false
    } else {
        isPlaying.value = true
        // Scatta in avanti di 1 step ogni 150ms. Se arriva a fine corsa (MAX_STEPS) riparte da 0.
        playTimer = setInterval(() => {
            sliderStep.value = sliderStep.value >= MAX_STEPS ? 0 : sliderStep.value + 1
        }, 150)
    }
}

// Pulizia timer in uscita per evitare memory leak
onUnmounted(() => { if (playTimer) clearInterval(playTimer) })

//Restituisce il totale dei posti configurati in un garage.
const totalePosti = (idGarage) => {
    const list = props.postiPerGarage[idGarage] ?? []
    return list.filter(p => p.isattivo !== false).length || list.length
}

//Analizza l'array di prenotazioni per vedere quante sono contemporaneamente
//ATTIVE nell'istante temporale "ts". Ritorna la percentuale 
const occupazioneAt = (idGarage, ts) => {
    const tot = totalePosti(idGarage)
    if (!tot) return props.occupazioneGarage[idGarage] ?? 0

    const occ = props.prenotazioni.filter(p =>
        Number(p.id_garage) === Number(idGarage) &&
        p.stato === 'ATTIVA' &&
        new Date(p.iniziososta) <= ts && // È già iniziata
        new Date(p.finesosta) > ts       // e non è ancora finita.
    ).length
    return Math.round((occ / tot) * 100)
}

//Mappa l'occupazione per ogni garage legata allo sliderTime.
const occSlider = computed(() => {
    const out = {}
    for (const g of props.mieiGarage) {
        out[g.id_garage] = sliderStep.value === 0
            ? (props.occupazioneGarage[g.id_garage] ?? 0)
            : occupazioneAt(g.id_garage, sliderTime.value)
    }
    return out
})

//Calcola i quante auto entrano / escono all'interno di una finestra temporale (es. 1 ora).
const flussoAt = (idGarage, from, toTs) => ({
    arrivi: props.prenotazioni.filter(p =>
        Number(p.id_garage) === Number(idGarage) && p.stato === 'ATTIVA' &&
        new Date(p.iniziososta) >= from && new Date(p.iniziososta) < toTs
    ).length,
    partenze: props.prenotazioni.filter(p =>
        Number(p.id_garage) === Number(idGarage) && p.stato === 'ATTIVA' &&
        new Date(p.finesosta) >= from && new Date(p.finesosta) < toTs
    ).length,
})

//Fornisce il flusso della PROSSIMA ORA rispetto alla posizione dello slider.
const flussoSlider = computed(() => {
    const from = sliderTime.value
    const to = new Date(from.getTime() + 3_600_000)
    const out = {}
    for (const g of props.mieiGarage) {
        out[g.id_garage] = flussoAt(g.id_garage, from, to)
    }
    return out
})

//Assembla tutti i KPI finali (totali, ingressi, uscite) in un oggetto unico pronto per il template.
const kpiPerGarage = computed(() => {
    const out = {}
    for (const g of props.mieiGarage) {
        const f = flussoSlider.value[g.id_garage]
        const tot = totalePosti(g.id_garage)
        const occupati = Math.round((occSlider.value[g.id_garage] / 100) * tot)

        out[g.id_garage] = {
            arrivi: f.arrivi,
            partenze: f.partenze,
            occupati,
            totPosti: tot
        }
    }
    return out
})

const TIMELINE_SLOTS = 24

//Costruisce l'asse X del grafico orario "Prossime 24 ore", partendo da sliderTime.
const timelineSlots = computed(() => {
    const base = sliderTime.value
    return Array.from({ length: TIMELINE_SLOTS }, (_, i) => {
        const ts = new Date(base.getTime() + i * 3_600_000)
        return {
            label: ts.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
            ts,
        }
    })
})

//Per ogni slot della timeline, calcola l'altezza della barra di occupazione per comporre il grafico in CSS puro.
const timelinePerGarage = computed(() => {
    const out = {}
    for (const g of props.mieiGarage) {
        out[g.id_garage] = timelineSlots.value.map(s => ({
            label: s.label,
            occ: occupazioneAt(g.id_garage, s.ts),
        }))
    }
    return out
})

// Metodi per i colori delle progress-bar in base all'allerta/urgenza
const getOccColor = (pct) => {
    if (pct >= 90) return '#E74C3C'
    if (pct >= 75) return '#E67E22'
    if (pct >= 50) return '#F1C40F'
    return '#27AE60'
}

const getOccClass = (pct) => {
    if (pct >= 90) return 'fill-danger'
    if (pct >= 75) return 'fill-warn'
    if (pct >= 50) return 'fill-attention'
    return ''
}

const planimetriaAperta = ref({})
const filtriDate = ref({})
const mapError = ref({})

// Converte in orario locale per l'input datetime-local HTML5
const formatForDatetimeLocal = (date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
}

const usaDateManuali = ref({})

const isRicercaManualeAttiva = computed(() => {
    return Object.values(usaDateManuali.value).some(stato => stato === true)
})

//Svincola un garage specifico dall'uso dello slider globale. Serve se l'utente vuole usare il calendario fisso ignorando lo slider.
const attivaRicercaManuale = (id) => {
    usaDateManuali.value[id] = true
    if (isPlaying.value) togglePlay() // Blocca l'animazione globale

    const adesso = new Date()
    const traUnOra = new Date(adesso.getTime() + 3_600_000)

    filtriDate.value[id] = {
        inizio: formatForDatetimeLocal(adesso),
        fine: formatForDatetimeLocal(traUnOra)
    }
}

const togglePlanimetria = (id) => {
    planimetriaAperta.value[id] = !planimetriaAperta.value[id]

    if (planimetriaAperta.value[id]) {
        usaDateManuali.value[id] = false

        const start = sliderTime.value;
        const end = new Date(start.getTime() + 3_600_000); // Imposta una permanenza standard di 1h
        filtriDate.value[id] = {
            inizio: formatForDatetimeLocal(start),
            fine: formatForDatetimeLocal(end)
        }

        onVerifica(id)
    }
}

const onVerifica = (id) => {
    const filtro = filtriDate.value[id]
    mapError.value[id] = false
    if (!filtro || !filtro.inizio || !filtro.fine) {
        mapError.value[id] = true
        alertStore.mostra('error', 'Inserisci orario di inizio e fine per aggiornare la mappa.')
        return
    }

    alertStore.pulisci()
    emit('verifica-disponibilita', { inizio: filtro.inizio, fine: filtro.fine })
}

let mapUpdateTimer = null;

// Sincronizza lo stato delle mappe aperte con lo scorrere dello slider globale
watch(sliderTime, (newTime) => {
    clearTimeout(mapUpdateTimer);

    // Aggiorna gli input per tutti i garage aperti
    props.mieiGarage.forEach(garage => {
        const id = garage.id_garage;
        // Salta quelli messi in manuale per non sovrascrivere la scelta utente
        if (planimetriaAperta.value[id] && !usaDateManuali.value[id]) {
            const end = new Date(newTime.getTime() + 3_600_000);
            filtriDate.value[id] = {
                inizio: formatForDatetimeLocal(newTime),
                fine: formatForDatetimeLocal(end)
            };
        }
    });

    // Richiede i nuovi dati al DB per ri-renderizzare le mappe 
    props.mieiGarage.forEach(garage => {
        const id = garage.id_garage;
        if (planimetriaAperta.value[id] && !usaDateManuali.value[id]) {
            onVerifica(id);
        }
    });
});

// Calcola l'occupazione in tempo reale sul frontend per la planimetria
const postiDinamici = computed(() => {
    const mappa = {};
    
    for (const garage of props.mieiGarage) {
        const idG = garage.id_garage;
        const posti = props.postiPerGarage[idG] || [];
        
        // Capisce se stiamo guardando il calendario manuale o lo slider temporale
        const tempoDaEsaminare = (usaDateManuali.value[idG] && filtriDate.value[idG]?.inizio)
            ? new Date(filtriDate.value[idG].inizio)
            : sliderTime.value;

        // Inietta "is_occupato" in ogni singolo posto incrociando i dati
        mappa[idG] = posti.map(posto => {
            const occupatoOra = props.prenotazioni.some(p => {
                const isStessoPosto = Number(p.id_posto) === Number(posto.id_posto);
                const stato = p.stato ? String(p.stato).trim().toUpperCase() : '';
                
                if (!isStessoPosto || (stato !== 'ATTIVA' && stato !== 'CONFERMATA')) return false;
                
                const inizio = new Date(p.iniziososta ? p.iniziososta.replace(' ', 'T') : '');
                const fine = new Date(p.finesosta ? p.finesosta.replace(' ', 'T') : '');
                
                return !isNaN(inizio.getTime()) && inizio <= tempoDaEsaminare && fine > tempoDaEsaminare;
            });
            
            // Restituisce il posto con la sovrascrittura in tempo reale
            return { ...posto, is_occupato: occupatoOra };
        });
    }
    return mappa;
});
</script>

<template>
    <section class="vista fade-in centered-container">

        <div class="page-header">
            <div>
                <h1>Stato Corrente</h1>
                <p class="subtitle">Monitora i flussi dei veicoli e gestisci la manutenzione dei posti.</p>
            </div>
        </div>

        <div class="time-nav-card sticky-nav">
            <div class="time-nav-top">
                <div class="time-display">
                    <span class="time-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                    </span>
                    <span class="time-label">{{ sliderLabel }}</span>
                    <button v-if="sliderStep > 0" class="reset-btn" @click="sliderStep = 0" title="Torna a adesso">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2.5">
                            <polyline points="1 4 1 10 7 10" />
                            <path d="M3.51 15a9 9 0 1 0 .49-4" />
                        </svg>
                        Adesso
                    </button>
                </div>

                <div class="time-nav-actions">
                    <button class="play-btn" :class="{ playing: isPlaying }" @click="togglePlay"
                        :title="isPlaying ? 'Pausa' : 'Riproduci'" :disabled="isRicercaManualeAttiva">
                        <svg v-if="!isPlaying" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                        </svg>
                        {{ isPlaying ? 'Pausa' : 'Play' }}
                    </button>
                </div>
            </div>

            <div class="slider-wrap">
                <span class="slider-edge">Ora</span>
                <input type="range" class="time-slider" :min="0" :max="MAX_STEPS" v-model.number="sliderStep"
                    :disabled="isRicercaManualeAttiva" />
                <span class="slider-edge">+48h</span>
            </div>
        </div>

        <div class="stato-grid">
            <div v-for="garage in mieiGarage" :key="garage.id_garage" class="stato-card">

                <div class="stato-card-header">
                    <div class="stato-card-title">
                        <span class="stato-nome">{{ garage.nome }}</span>
                        <p class="stato-indirizzo">{{ garage.indirizzo }}</p>
                    </div>
                    <span :class="['badge', garage.isattivo ? 'badge--green' : 'badge--red']">
                        {{ garage.isattivo ? 'Attivo' : 'Inattivo' }}
                    </span>
                </div>

                <div class="kpi-row mb-3">
                    <div class="kpi-chip kpi-occ">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                        </svg>
                        <span>{{ kpiPerGarage[garage.id_garage].occupati }}/{{ kpiPerGarage[garage.id_garage].totPosti
                        }} posti occupati</span>
                    </div>
                    <div class="kpi-chip kpi-arrivi">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <polyline points="19 12 12 19 5 12" />
                        </svg>
                        <span>{{ kpiPerGarage[garage.id_garage].arrivi }} arrivi pross. ora</span>
                    </div>
                    <div class="kpi-chip kpi-partenze">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2">
                            <line x1="12" y1="19" x2="12" y2="5" />
                            <polyline points="5 12 12 5 19 12" />
                        </svg>
                        <span>{{ kpiPerGarage[garage.id_garage].partenze }} partenze pross. ora</span>
                    </div>
                </div>

                <div class="occ-section">
                    <div class="occ-label-row">
                        <span class="occ-label">Occupazione</span>
                        <span class="occ-pct" :style="{ color: getOccColor(occSlider[garage.id_garage]) }">
                            {{ occSlider[garage.id_garage] }}%
                        </span>
                    </div>
                    <div class="occupancy-bar">
                        <div class="occupancy-fill" :class="getOccClass(occSlider[garage.id_garage])" :style="{
                            width: occSlider[garage.id_garage] + '%',
                            background: getOccColor(occSlider[garage.id_garage])
                        }" />
                    </div>
                </div>

                <div class="flusso-row">
                    <div class="stato-meta">
                        <span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                            {{ garage.is24h ? 'Aperto 24h' : `${garage.orarioapertura?.substring(0, 5)} –
                            ${garage.orariochiusura?.substring(0, 5)}` }}
                        </span>
                        <span>€ {{ garage.tariffabase || garage.tariffaauto }}/h</span>
                    </div>
                </div>

                <div class="timeline-section">
                    <p class="timeline-title">Prossime 24h — occupazione prevista</p>
                    <div class="timeline-bars">
                        <div v-for="(slot, i) in timelinePerGarage[garage.id_garage]" :key="i" class="timeline-col"
                            :title="`${slot.label}: ${slot.occ}%`">
                            <div class="timeline-bar-track">
                                <div class="timeline-bar-fill" :style="{
                                    height: Math.max(slot.occ, 2) + '%',
                                    background: getOccColor(slot.occ)
                                }">
                                </div>
                            </div>
                            <span v-if="i % 6 === 0" class="timeline-tick">{{ slot.label }}</span>
                        </div>
                    </div>
                </div>

                <div class="planimetria-section">
                    <button class="toggle-plan-btn" @click="togglePlanimetria(garage.id_garage)">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="21" x2="9" y2="9" />
                        </svg>
                        {{ planimetriaAperta[garage.id_garage] ? 'Nascondi planimetria' : 'Mostra planimetria' }}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2"
                            :style="{ transform: planimetriaAperta[garage.id_garage] ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </button>
                    <div v-if="planimetriaAperta[garage.id_garage]" class="planimetria-wrapper">
                        <div class="plan-filter" v-if="planimetriaAperta[garage.id_garage]">

                            <div v-if="!usaDateManuali[garage.id_garage]"
                                class="d-flex justify-content-between align-items-center w-100 px-2">
                                <span style="font-size: 0.85rem; color: #555;">
                                    Stai visualizzando la mappa per: <strong>{{ sliderLabel }}</strong>
                                </span>
                                <button class="toggle-plan-btn" style="text-decoration: underline;"
                                    @click="attivaRicercaManuale(garage.id_garage)">
                                    Cerca data specifica
                                </button>
                            </div>

                            <div v-else class="w-100">
                                <div class="d-flex justify-content-between align-items-center mb-2 px-1">
                                    <span style="font-size: 0.8rem; font-weight: 600;">Ricerca manuale oltre le
                                        48h</span>
                                    <button class="toggle-plan-btn"
                                        @click="usaDateManuali[garage.id_garage] = false; togglePlanimetria(garage.id_garage);">
                                        Torna allo slider
                                    </button>
                                </div>
                                <div class="plan-filter-inputs d-flex gap-2">
                                    <input type="datetime-local" class="form-input form-input--sm"
                                        :class="{ 'is-invalid-input': mapError[garage.id_garage] }"
                                        v-model="filtriDate[garage.id_garage].inizio">
                                    <input type="datetime-local" class="form-input form-input--sm"
                                        :class="{ 'is-invalid-input': mapError[garage.id_garage] }"
                                        v-model="filtriDate[garage.id_garage].fine">
                                    <button class="btn-primary btn-primary--sm"
                                        :disabled="!filtriDate[garage.id_garage].inizio || !filtriDate[garage.id_garage].fine"
                                        @click="onVerifica(garage.id_garage)">
                                        Aggiorna mappa
                                    </button>
                                </div>
                                <div v-if="mapError[garage.id_garage]" class="text-danger small mt-1">Inserisci orario
                                    di inizio e fine.</div>
                            </div>
                        </div>
                        <PlanimetriaGarage :posti="postiDinamici[garage.id_garage] || []"
                            :mappaTestuale="garage.mappatestuale" :isGestoreMode="true"
                            @manage="$emit('manage-posto', $event)" />
                    </div>
                </div>

            </div>
        </div>
    </section>
</template>

<style scoped>
.vista {
    animation: fadeIn 0.25s ease;
}

.centered-container {
    max-width: 960px;
    margin: 0 auto;
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

.page-header {
    margin-bottom: 28px;
}

.page-header h1 {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--deep-blue, #00204A);
    letter-spacing: -0.5px;
    margin: 0 0 4px;
}

.subtitle {
    font-size: 0.875rem;
    color: #888;
    margin: 0;
}

.sticky-nav {
    position: sticky;
    top: 88px;
    z-index: 100;
    box-shadow: 0 10px 30px rgba(0, 32, 74, 0.08);
}

.time-nav-card {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 0.5px solid #E8E8E8;
    border-radius: 14px;
    padding: 20px 24px;
    margin-bottom: 24px;
}

.time-nav-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
}

.time-display {
    display: flex;
    align-items: center;
    gap: 8px;
}

.time-icon {
    color: #0066CC;
    display: flex;
    align-items: center;
}

.time-label {
    font-size: 0.95rem;
    font-weight: 700;
    color: #1a1a2e;
    letter-spacing: -0.2px;
}

.reset-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    background: #F0F6FF;
    color: #0066CC;
    border: none;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
}

.reset-btn:hover {
    background: #D6E8FF;
}

.time-nav-actions {
    display: flex;
    gap: 8px;
}

.play-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #00204A;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 7px 16px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
}

.play-btn:hover {
    background: #0066CC;
}

.play-btn.playing {
    background: #E67E22;
}

.slider-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
}

.slider-edge {
    font-size: 0.72rem;
    color: #aaa;
    font-weight: 600;
    white-space: nowrap;
}

.time-slider {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(to right,
            #0066CC 0%,
            #0066CC calc(var(--v, 0) * 1%),
            #E8E8E8 calc(var(--v, 0) * 1%),
            #E8E8E8 100%);
    outline: none;
    cursor: pointer;
}

.time-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #0066CC;
    border: 3px solid #fff;
    box-shadow: 0 1px 6px rgba(0, 102, 204, 0.35);
    cursor: pointer;
    transition: transform 0.1s;
}

.time-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
}

.kpi-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.kpi-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 600;
    border: 0.5px solid transparent;
}

.kpi-occ {
    background: #F0F6FF;
    color: #0052A3;
    border-color: #C8DEFF;
}

.kpi-arrivi {
    background: #EAFAF1;
    color: #1E8449;
    border-color: #A9DFBF;
}

.kpi-partenze {
    background: #FEF9EE;
    color: #935116;
    border-color: #FAD7A0;
}

.stato-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.stato-card {
    background: #fff;
    border: 0.5px solid #E8E8E8;
    border-radius: 14px;
    padding: 20px 24px;
    box-sizing: border-box;
}

.stato-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 16px;
}

.stato-card-title {
    flex: 1;
    min-width: 0;
}

.stato-nome {
    display: block;
    font-size: 0.95rem;
    font-weight: 700;
    color: #1a1a2e;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.stato-indirizzo {
    font-size: 0.75rem;
    color: #aaa;
    margin: 0;
}

.badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
    flex-shrink: 0;
    margin-left: 12px;
}

.badge--green {
    background: #EAFAF1;
    color: #1E8449;
}

.badge--red {
    background: #FDEDEC;
    color: #C0392B;
}

.occ-section {
    margin-bottom: 12px;
}

.occ-label-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 6px;
}

.occ-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.occ-pct {
    font-size: 0.88rem;
    font-weight: 700;
    transition: color 0.3s;
}

.occupancy-bar {
    height: 8px;
    background: #F0F0F0;
    border-radius: 999px;
    overflow: hidden;
}

.occupancy-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.4s ease, background 0.4s ease;
}

.flusso-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}

.stato-meta {
    display: flex;
    gap: 12px;
    margin-left: auto;
    font-size: 0.72rem;
    color: #aaa;
}

.stato-meta span {
    display: flex;
    align-items: center;
    gap: 4px;
}

.timeline-section {
    margin-bottom: 16px;
    border-top: 1px solid #f4f4f4;
    padding-top: 14px;
}

.timeline-title {
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #aaa;
    margin: 0 0 10px;
}

.timeline-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 56px;
    position: relative;
}

.timeline-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    position: relative;
}

.timeline-bar-track {
    flex: 1;
    width: 100%;
    background: #F4F4F4;
    border-radius: 3px 3px 0 0;
    display: flex;
    align-items: flex-end;
    position: relative;
    overflow: hidden;
}

.timeline-bar-fill {
    width: 100%;
    border-radius: 3px 3px 0 0;
    transition: height 0.3s ease, background 0.3s ease;
}

.timeline-tick {
    font-size: 0.6rem;
    color: #ccc;
    margin-top: 3px;
    white-space: nowrap;
    position: absolute;
    bottom: -14px;
    left: 0;
}

.planimetria-section {
    border-top: 1px solid #f4f4f4;
    padding-top: 12px;
    margin-top: 4px;
}

.toggle-plan-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    font-size: 0.78rem;
    font-weight: 600;
    color: #0066CC;
    cursor: pointer;
    padding: 4px 0;
    transition: color 0.15s;
}

.toggle-plan-btn:hover {
    color: #00204A;
}

.planimetria-wrapper {
    margin-top: 12px;
    overflow-x: auto;
}

.plan-filter {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 14px;
    padding: 12px;
    background: #FAFAFA;
    border-radius: 8px;
    border: 0.5px solid #EFEFEF;
}

.plan-filter-inputs {
    display: flex;
    gap: 8px;
    flex: 1;
    flex-wrap: wrap;
}

.form-input {
    border: 0.5px solid #E0E0E0;
    border-radius: 8px;
    padding: 0 12px;
    font-size: 0.85rem;
    color: #222;
    background: #fff;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
}

.form-input:focus {
    border-color: #0066CC;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.08);
}

.form-input--sm {
    height: 38px;
    flex: 1;
    min-width: 160px;
}

.btn-primary {
    background: #0066CC;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
}

.btn-primary:hover {
    background: #00204A;
}

.btn-primary--sm {
    height: 38px;
    padding: 0 16px;
}

@media (max-width: 600px) {
    .kpi-row {
        gap: 6px;
    }

    .kpi-chip {
        font-size: 0.72rem;
        padding: 5px 10px;
    }

    .flusso-row {
        gap: 8px;
    }

    .stato-meta {
        display: none;
    }

    .time-nav-top {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
    }
}

.time-slider:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    filter: grayscale(100%);
}

.play-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>