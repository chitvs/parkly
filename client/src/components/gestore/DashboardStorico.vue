<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import Pagination from '../Pagination.vue'

const props = defineProps({
    prenotazioni: {
        type: Array,
        required: true,
        default: () => []
    }
})

defineEmits(['apri-chat'])

const formatData = (iso) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
        + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

const statoBadge = (stato) =>
    stato === 'ATTIVA' ? 'badge--green' : stato === 'ANNULLATA' ? 'badge--red' : 'badge--gray'

// Logica paginazione
const paginaCorrente = ref(1)
const elementiPerPagina = ref(5)

const prenotazioniPaginate = computed(() => {
    const inizio = (paginaCorrente.value - 1) * elementiPerPagina.value
    return props.prenotazioni.slice(inizio, inizio + elementiPerPagina.value)
})

const scrollInAlto = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(() => props.prenotazioni, () => {
    paginaCorrente.value = 1
}, { deep: true })


const tableCardRef = ref(null)
const containerWidth = ref('100%')

const colWidths = [150, 200, 110, 130, 130, 90, 110, 115]
const spazioTotaleColonne = colWidths.reduce((acc, curr) => acc + curr, 0);
let resizeObserver = null

const calcolaLarghezzaScatti = () => {
    if (!tableCardRef.value || !tableCardRef.value.parentElement) return
    
    const spazioDisponibile = tableCardRef.value.parentElement.clientWidth
    let larghezzaOttimale = 0

    for (const width of colWidths) {
        if (larghezzaOttimale + width <= spazioDisponibile) {
            larghezzaOttimale += width
        } else {
            break 
        }
    }

    if (spazioDisponibile >= spazioTotaleColonne || larghezzaOttimale === 0) {
        containerWidth.value = '100%'
    } else {
        containerWidth.value = `${larghezzaOttimale}px`
    }
}

onMounted(() => {
    if (tableCardRef.value && tableCardRef.value.parentElement) {
        resizeObserver = new ResizeObserver(() => {
            calcolaLarghezzaScatti()
        })
        resizeObserver.observe(tableCardRef.value.parentElement)
    }
    calcolaLarghezzaScatti()
})

onUnmounted(() => {
    if (resizeObserver) resizeObserver.disconnect()
})
</script>

<template>
    <section class="vista fade-in centered-container">
        <div class="page-header">
            <div>
                <h1>Storico Prenotazioni</h1>
                <p class="subtitle">Tutte le prenotazioni dei tuoi garage</p>
            </div>
        </div>

        <div class="table-card" ref="tableCardRef" :style="{ width: containerWidth }">
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
                    <tr v-for="p in prenotazioniPaginate" :key="p.id_prenotazione">
                        <td><span class="targa-badge">{{ p.codiceprenotazione }}</span></td>
                        <td class="td-bold">{{ p.nome_garage }}</td>
                        <td><span class="targa-badge">{{ p.targa }}</span></td>
                        <td class="td-muted">{{ formatData(p.iniziososta) }}</td>
                        <td class="td-muted">{{ formatData(p.finesosta) }}</td>
                        <td class="td-bold td-blue">€ {{ p.prezzototale }}</td>
                        <td><span :class="['badge', statoBadge(p.stato)]">{{ p.stato }}</span></td>
                        <td>
                            <button :style="{ visibility: p.stato === 'ATTIVA' ? 'visible' : 'hidden' }" @click="$emit('apri-chat', p)" class="btn-chat"
                                title="Scrivi al cliente">
                                <span v-if="p.nonletti > 0" class="chat-notification-dot"></span>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                Scrivi
                            </button>
                        </td>
                    </tr>
                    <tr v-if="prenotazioni.length === 0">
                        <td colspan="8" class="td-empty">Nessuna prenotazione trovata.</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="pagination-container mt-4" v-if="prenotazioni.length > 0">
            <Pagination 
                v-model:paginaCorrente="paginaCorrente" 
                v-model:elementiPerPagina="elementiPerPagina"
                :totaleElementi="prenotazioni.length" 
                @cambio-pagina="scrollInAlto"
            />
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
    width: 100%;
    box-sizing: border-box;
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

.table-card {
    background: #fff;
    border: 0.5px solid #E8E8E8;
    border-radius: 12px;
    overflow-x: auto; 
    overflow-y: hidden; 
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    transition: width 0.1s ease-out; 
}

.parkly-table {
    width: max-content;
    min-width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    table-layout: fixed;
}

.parkly-table th:nth-child(1) { width: 150px; }  /* Codice */
.parkly-table th:nth-child(2) { width: 200px; }  /* Garage */
.parkly-table th:nth-child(3) { width: 110px; }  /* Targa */
.parkly-table th:nth-child(4) { width: 130px; }  /* Inizio */
.parkly-table th:nth-child(5) { width: 130px; }  /* Fine */
.parkly-table th:nth-child(6) { width: 90px;  }  /* Importo */
.parkly-table th:nth-child(7) { width: 110px; }  /* Stato */
.parkly-table th:nth-child(8) { width: 115px; }  /* Chat */

.parkly-table thead tr {
    background: #FAFAFA;
    border-bottom: 0.5px solid #EFEFEF;
}

.parkly-table th,
.parkly-table td {
    scroll-snap-align: start;
}

.parkly-table th {
    padding: 12px 16px;
    text-align: left;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #aaa;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.parkly-table tbody tr {
    border-bottom: 0.5px solid #F5F5F5;
    transition: background 0.1s;
}

.parkly-table tbody tr:last-child {
    border-bottom: none;
}

.parkly-table tbody tr:hover {
    background: #FAFBFF;
}

.parkly-table td {
    padding: 14px 16px;
    color: #444;
}

.parkly-table td:nth-child(2) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.td-muted {
    color: #bbb;
    font-size: 0.8rem;
}

.td-bold {
    font-weight: 600;
    color: #222;
}

.td-blue {
    color: #0066CC;
}

.td-empty {
    text-align: center;
    padding: 40px;
    color: #ccc;
    font-size: 0.85rem;
}

/* Badges */
.badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.badge--green {
    background: #EAFAF1;
    color: #1E8449;
}

.badge--red {
    background: #FDEDEC;
    color: #C0392B;
}

.badge--gray {
    background: #F0F0F0;
    color: #888;
}

.targa-badge {
    display: inline-block;
    background: #F5F5F5;
    border: 0.5px solid #E0E0E0;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 0.78rem;
    font-weight: 600;
    font-family: 'Courier New', monospace;
    color: #444;
    letter-spacing: 0.06em;
}

/* Bottoni Chat */
.btn-chat {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    border: 0.5px solid #0066CC;
    border-radius: 6px;
    background: #EBF3FF;
    color: #0066CC;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
}

.btn-chat:hover {
    background: #0066CC;
    color: #fff;
}

.chat-notification-dot {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 10px;
    height: 10px;
    background: #E74C3C;
    border-radius: 50%;
    border: 2px solid #fff;
}

.mt-4 {
    margin-top: 1.5rem;
}
</style>