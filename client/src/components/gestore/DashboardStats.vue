<script setup>
import { ref, computed } from 'vue'
import { Chart as ChartJS, CategoryScale, LinearScale, RadialLinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js'
import { Line, Doughnut, Radar, Bar } from 'vue-chartjs'

import IconGarage from '../../icons/IconGarage.vue'

// Registrazione manuale dei componenti per la libreria Chart.js.
ChartJS.register(CategoryScale, LinearScale, RadialLinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement)

const props = defineProps({
    mieiGarage: { type: Array, required: true },
    storicoPrenotazioni: { type: Array, required: true }
})

// Helper functions per manipolare le date in varianti di YYYY-MM-DD
const formattaPerInputDate = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}
const formattaChiaveData = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Imposta il filtro temporale nativo sull'intero mese in corso
const dataCorrente = new Date()
const primoGiornoMese = new Date(dataCorrente.getFullYear(), dataCorrente.getMonth(), 1)
const ultimoGiornoMese = new Date(dataCorrente.getFullYear(), dataCorrente.getMonth() + 1, 0)

const filtroInizio = ref(formattaPerInputDate(primoGiornoMese))
const filtroFine = ref(formattaPerInputDate(ultimoGiornoMese))

// Flag di UI per variare la disposizione delle tile statistiche in caso di un solo garage 
const isSingoloGarage = computed(() => props.mieiGarage.length === 1)

//Converte le stringhe in input in vere Date JS con limiti orari massimi per comprendere tutto il giorno
const dateRange = computed(() => {
    const inizio = new Date(filtroInizio.value)
    inizio.setHours(0, 0, 0, 0) // Inizia da mezzanotte e un minuto
    const fine = new Date(filtroFine.value)
    fine.setHours(23, 59, 59, 999) // Finisce a mezzanotte meno un minuto
    return { inizio, fine }
})

//Filtra tutte le prenotazioni in base ai limiti decisi sopra
const prenotazioniFiltrate = computed(() => {
    const { inizio, fine } = dateRange.value
    return props.storicoPrenotazioni.filter(p => {
        const dataP = new Date(p.iniziososta)
        return dataP >= inizio && dataP <= fine
    })
})

//Evita di incassare le prenotazioni annullate.
const calcolaIncasso = (prenotazioni) =>
    prenotazioni.filter(p => p.stato !== 'ANNULLATA').reduce((acc, p) => acc + parseFloat(p.prezzototale || 0), 0).toFixed(2)


//Genera in un array i 4 "quadrati numerici" visualizzati in alto nella UI.
//Adatta i titoli a seconda se si possiedono più strutture o una sola.
const kpiData = computed(() => {
    const attive = prenotazioniFiltrate.value.filter(p => p.stato === 'ATTIVA').length
    const incasso = calcolaIncasso(prenotazioniFiltrate.value)
    const inArrivo = prenotazioniFiltrate.value
        .filter(p => p.stato === 'ATTIVA')
        .reduce((acc, p) => acc + parseFloat(p.prezzototale || 0), 0)
        .toFixed(2)

    if (!isSingoloGarage.value) {
        return [
            { id: 1, label: 'Garage Totali', value: props.mieiGarage.length, icon: 'IconGarage', color: 'blue' },
            { id: 2, label: 'Incasso Totale', value: `€ ${incasso}`, icon: 'bi-cash-coin', color: 'green' },
            { id: 3, label: 'In Arrivo', value: `€ ${inArrivo}`, icon: 'bi-clock-history', color: 'amber' },
            { id: 4, label: 'Prenot. Attive', value: attive, icon: 'bi-bookmark-check', color: 'blue' },
        ]
    }

    return [
        { id: 1, label: 'Prenotazioni Tot.', value: prenotazioniFiltrate.value.length, icon: 'bi-journal-check', color: 'blue' },
        { id: 2, label: 'Incasso Generato', value: `€ ${incasso}`, icon: 'bi-cash-coin', color: 'green' },
        { id: 3, label: 'In Arrivo', value: `€ ${inArrivo}`, icon: 'bi-clock-history', color: 'amber' },
        { id: 4, label: 'Prenot. Attive', value: attive, icon: 'bi-car-front', color: 'blue' },
    ]
})

// Mappa globale standard per uniformare la palette dei grafici
const CHART_COLORS = {
    blue: '#00408A', blueAlpha: 'rgba(0, 102, 204, 0.2)',
    darkBlue: '#00408A', green: '#137333',
    greenAlpha: 'rgba(39, 174, 96, 0.2)', red: '#C0392B',
}

const chartOptions = { responsive: true, maintainAspectRatio: false }
const chartOptionsRadar = { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 5, ticks: { stepSize: 1 } } } }

/**
 * Prepara i dati per il Line Chart (Trend Ricavi).
 * Crea una label per OGNI giorno incluso nel filtro temporale (evita buchi nei giorni senza prenotazioni).
 */
const chartDataRevenue = computed(() => {
    const { inizio, fine } = dateRange.value
    const mappaIncassi = {}
    const chiaviOrdinate = []
    const labels = []

    // Costruisce la timeline vuota (x-axis)
    const cursore = new Date(inizio)
    while (cursore <= fine) {
        const chiave = formattaChiaveData(cursore)
        mappaIncassi[chiave] = 0
        chiaviOrdinate.push(chiave)
        labels.push(cursore.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }))
        cursore.setDate(cursore.getDate() + 1)
    }

    // Riempie la timeline accumulando i prezzi
    prenotazioniFiltrate.value.forEach(p => {
        if (p.stato !== 'ANNULLATA') {
            const chiave = formattaChiaveData(new Date(p.iniziososta))
            if (chiave in mappaIncassi) mappaIncassi[chiave] += parseFloat(p.prezzototale || 0)
        }
    })

    return {
        labels,
        datasets: [{
            label: 'Incasso Giornaliero (€)',
            backgroundColor: CHART_COLORS.blueAlpha,
            borderColor: CHART_COLORS.blue,
            data: chiaviOrdinate.map(k => mappaIncassi[k]),
            tension: 0.3, fill: true, // Dona l'effetto "onda fluida"
        }],
    }
})

//Prepara i dati per il Doughnut Chart (Distribuzione stato)
const chartDataStato = computed(() => {
    const conteggio = prenotazioniFiltrate.value.reduce(
        (acc, p) => { if (p.stato in acc) acc[p.stato]++; return acc },
        { ATTIVA: 0, CONCLUSA: 0, ANNULLATA: 0 }
    )
    return {
        labels: ['Attive', 'Concluse', 'Annullate'],
        datasets: [{
            backgroundColor: [CHART_COLORS.green, CHART_COLORS.blue, CHART_COLORS.red],
            data: [conteggio.ATTIVA, conteggio.CONCLUSA, conteggio.ANNULLATA],
        }],
    }
})

//Prepara i dati per il Radar Chart sulle recensioni storiche.
//Fa una media ponderata sulle 5 aree target valutate dagli utenti.
const chartDataRadar = computed(() => {
    const CATEGORIE_RADAR = ['posizione', 'prezzo', 'pulizia', 'spazio', 'sicurezza']
    const garageTarget = props.mieiGarage
    const medie = CATEGORIE_RADAR.map(cat => {
        const somma = garageTarget.reduce((acc, g) => acc + parseFloat(g[`media${cat}`] || 0), 0)
        return garageTarget.length ? somma / garageTarget.length : 0
    })

    return {
        labels: ['Posizione', 'Prezzo', 'Pulizia', 'Spazio', 'Sicurezza'],
        datasets: [{
            label: 'Voto Medio',
            backgroundColor: CHART_COLORS.greenAlpha,
            borderColor: CHART_COLORS.green,
            pointBackgroundColor: CHART_COLORS.green,
            data: medie,
        }],
    }
})

//Grafico a Barre utile solo ai Multi-Proprietari per paragonare gli introiti delle diverse sedi.
const chartDataRevenuePerGarage = computed(() => ({
    labels: props.mieiGarage.map(g => g.nome),
    datasets: [{
        label: 'Incasso per Garage (€)',
        backgroundColor: CHART_COLORS.blue,
        borderRadius: 6,
        data: props.mieiGarage.map(g =>
            prenotazioniFiltrate.value
                .filter(p => Number(p.id_garage) === Number(g.id_garage) && p.stato !== 'ANNULLATA')
                .reduce((acc, p) => acc + parseFloat(p.prezzototale || 0), 0)
        ),
    }],
}))
</script>

<template>
    <section class="vista fade-in centered-container">
        <div class="page-header stats-page-header">
            <div>
                <h1>Dashboard</h1>
                <p class="subtitle">
                    {{ !isSingoloGarage ? 'Panoramica di tutti i tuoi parcheggi' : 'Statistiche di dettaglio del parcheggio' }}
                </p>
            </div>

            <div class="stats-filters">
                <div class="form-group stats-filters__group">
                    <label class="form-label stats-filters__label">Dal</label>
                    <input type="date" class="form-input stats-filters__date" v-model="filtroInizio">
                </div>
                <div class="form-group stats-filters__group">
                    <label class="form-label stats-filters__label">Al</label>
                    <input type="date" class="form-input stats-filters__date" v-model="filtroFine">
                </div>
            </div>
        </div>

        <div class="stats-grid">
            <div v-for="kpi in kpiData" :key="kpi.id" class="stat-card">
                <div :class="['stat-icon', `stat-icon--${kpi.color}`]">
                    <IconGarage v-if="kpi.icon === 'IconGarage'" style="width: 22px; height: 22px;" />
                    <i v-else :class="['bi', kpi.icon]" style="font-size: 1.2rem;"></i>
                </div>
                <div class="stat-body">
                    <span class="stat-label">{{ kpi.label }}</span>
                    <span class="stat-value">{{ kpi.value }}</span>
                </div>
            </div>
        </div>

        <div class="charts-row">
            <div class="chart-card chart-card--wide">
                <div class="chart-header">
                    <h3 class="chart-title">Trend Ricavi</h3>
                    <p v-if="filtroInizio && filtroFine" class="chart-subtitle">
                        Periodo: {{ new Date(filtroInizio).toLocaleDateString('it-IT') }} – {{ new
                            Date(filtroFine).toLocaleDateString('it-IT') }}
                    </p>
                </div>
                <div class="chart-body">
                    <Line v-if="chartDataRevenue.labels.length" :data="chartDataRevenue" :options="chartOptions" />
                    <div v-else class="chart-empty">Seleziona un intervallo di date per visualizzare il trend</div>
                </div>
            </div>

            <div class="chart-card">
                <div class="chart-header">
                    <h3 class="chart-title">Stato Prenotazioni</h3>
                </div>
                <div class="chart-body chart-body--centered">
                    <Doughnut v-if="prenotazioniFiltrate.length" :data="chartDataStato" :options="chartOptions" />
                    <div v-else class="chart-empty">Dati insufficienti</div>
                </div>
            </div>
        </div>

        <div class="charts-row charts-row--single">
            <div class="chart-card chart-card--centered">
                <template v-if="!isSingoloGarage">
                    <div class="chart-header chart-header--center">
                        <h3 class="chart-title">Confronto Incassi per Garage</h3>
                    </div>
                    <div class="chart-body">
                        <Bar v-if="mieiGarage.length" :data="chartDataRevenuePerGarage" :options="chartOptions" />
                        <div v-else class="chart-empty">Nessun garage registrato</div>
                    </div>
                </template>
                <template v-else>
                    <div class="chart-header chart-header--center">
                        <h3 class="chart-title">Qualità Media (Recensioni storiche)</h3>
                    </div>
                    <div class="chart-body">
                        <Radar :data="chartDataRadar" :options="chartOptionsRadar" />
                    </div>
                </template>
            </div>
        </div>
    </section>
</template>

<style scoped>
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

.subtitle {
    font-size: 0.875rem;
    color: #888;
    margin: 0;
}

.stats-page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 16px;
}

.stats-filters {
    display: flex;
    gap: 12px;
    align-items: flex-end;
    flex-wrap: wrap;
}

.stats-filters__group {
    margin-bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.stats-filters__label {
    font-size: 0.65rem;
    font-weight: 600;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.form-input {
    height: 38px;
    border: 0.5px solid #E0E0E0;
    border-radius: 8px;
    padding: 0 14px;
    font-size: 0.9rem;
    color: #222;
    background: #FAFAFA;
    outline: none;
    transition: border-color 0.15s;
}

.form-input:focus {
    border-color: #0066CC;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.08);
}

.stats-filters__select {
    min-width: 200px;
    cursor: pointer;
}

.stats-filters__date {
    width: 180px;
}

/* Cards */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 40px;
}

.stat-card {
    background: #fff;
    border: 0.5px solid #E8E8E8;
    border-radius: 12px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
}

.stat-icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.stat-icon--blue {
    background: #EBF3FF;
    color: #0066CC;
}

.stat-icon--green {
    background: #EAFAF1;
    color: #27AE60;
}

.stat-icon--amber {
    background: #FEF9EE;
    color: #E67E22;
}

.stat-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.stat-label {
    font-size: 0.72rem;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
}

.stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--deep-blue, #00204A);
    letter-spacing: -0.5px;
    line-height: 1;
}

/* Charts */
.charts-row {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 16px;
    margin-bottom: 24px;
}

.charts-row--single {
    grid-template-columns: 1fr;
    justify-items: center;
    margin-bottom: 40px;
}

.chart-card {
    background: #fff;
    border: 0.5px solid #E8E8E8;
    border-radius: 12px;
    padding: 20px;
    width: 100%;
    box-sizing: border-box;
}

.chart-card--centered {
    max-width: 600px;
}

.chart-header {
    margin-bottom: 16px;
}

.chart-header--center {
    text-align: center;
}

.chart-title {
    font-size: 1rem;
    color: #00204A;
    margin: 0;
    font-weight: 600;
}

.chart-subtitle {
    font-size: 0.75rem;
    color: #888;
    margin: 4px 0 0;
}

.chart-body {
    height: 250px;
    position: relative;
}

.chart-body--centered {
    display: flex;
    justify-content: center;
}

.chart-empty {
    display: flex;
    height: 100%;
    align-items: center;
    justify-content: center;
    color: #aaa;
    font-size: 0.85rem;
    text-align: center;
}

@media (max-width: 900px) {
    .stats-grid {
        grid-template-columns: 1fr 1fr;
    }

    .charts-row {
        grid-template-columns: 1fr;
    }
}
</style>