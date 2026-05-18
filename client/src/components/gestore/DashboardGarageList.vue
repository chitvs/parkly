<script setup>
import { ref, computed, watch } from 'vue'
import { RouterLink } from 'vue-router'
import Pagination from '../Pagination.vue'

const props = defineProps({
    mieiGarage: {
        type: Array,
        required: true
    }
})

defineEmits(['modifica', 'toggle-stato'])

// Logica paginazione
const paginaCorrente = ref(1)
const elementiPerPagina = ref(5)

const mieiGaragePaginati = computed(() => {
    const inizio = (paginaCorrente.value - 1) * elementiPerPagina.value
    return props.mieiGarage.slice(inizio, inizio + elementiPerPagina.value)
})

const scrollInAlto = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
}

watch(() => props.mieiGarage, () => {
    paginaCorrente.value = 1
}, { deep: true })
</script>

<template>
    <section class="vista fade-in centered-container">
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
                        <th style="width: 50px;">#</th>
                        <th>Nome Garage</th>
                        <th>Indirizzo</th>
                        <th style="width: 160px; text-align: center;">Stato</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(garage, index) in mieiGaragePaginati" :key="garage.id_garage">
                        <td class="td-muted">{{ index + 1 + (paginaCorrente - 1) * elementiPerPagina }}</td>

                        <td class="td-bold">
                            <div class="d-flex align-items-center gap-2">
                                <RouterLink :to="`/garage/${garage.id_garage}`" class="garage-link">
                                    {{ garage.nome }}
                                </RouterLink>
                                <button @click="$emit('modifica', garage)" class="btn-edit-small"
                                    title="Modifica Garage">
                                    <i class="bi bi-pencil-square"></i>
                                </button>
                            </div>
                        </td>

                        <td class="td-muted">{{ garage.indirizzo }}</td>

                        <td>
                            <label class="status-container" style="cursor: pointer;"
                                :title="garage.isattivo ? 'Disattiva garage' : 'Attiva garage'">
                                <span class="status-text" :class="{ 'status-text--active': garage.isattivo }">
                                    {{ garage.isattivo ? 'Attivo' : 'Disattivo' }}
                                </span>
                                <div class="toggle-switch">
                                    <input type="checkbox" :checked="garage.isattivo"
                                        @click.prevent="$emit('toggle-stato', garage)">
                                    <span class="slider round"></span>
                                </div>
                            </label>
                        </td>
                    </tr>
                    <tr v-if="mieiGarage.length === 0">
                        <td colspan="4" class="td-empty">Nessun garage trovato.</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="pagination-container mt-4" v-if="mieiGarage.length > 0">
            <Pagination v-model:paginaCorrente="paginaCorrente" v-model:elementiPerPagina="elementiPerPagina"
                :totaleElementi="mieiGarage.length" @cambio-pagina="scrollInAlto" />
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
    font-size: 1.8rem;
    font-weight: 700;
    color: var(--deep-blue, #00204A);
    letter-spacing: -0.5px;
    margin: 0 0 4px;
    font-family: 'Inter', sans-serif;
}

.subtitle {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
}

.table-card {
    background: #fff;
    border: 0.5px solid #E8E8E8;
    border-radius: 12px;
    overflow: hidden;
}

.parkly-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
}

.parkly-table thead tr {
    background: #FAFAFA;
    border-bottom: 0.5px solid #EFEFEF;
}

.parkly-table th {
    padding: 12px 20px;
    text-align: left;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #aaa;
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
    padding: 14px 20px;
    color: #444;
}

.td-muted {
    color: #bbb;
    font-size: 0.8rem;
}

.td-bold {
    font-weight: 600;
    color: #222;
}

.td-empty {
    text-align: center;
    padding: 40px;
    color: #ccc;
    font-size: 0.85rem;
}

.garage-link {
    color: #0066CC;
    text-decoration: none;
    font-weight: 600;
    transition: color 0.15s;
}

.garage-link:hover {
    color: #00204A;
    text-decoration: underline;
}

.btn-edit-small {
    background: none;
    border: none;
    color: #0066CC;
    cursor: pointer;
    padding: 4px;
    font-size: 1.1rem;
    display: flex;
    transition: color 0.2s;
}

.btn-edit-small:hover {
    color: #00204A;
}

/* --- Layout Contenitore Stato --- */
.status-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
}

.status-text {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #C0392B;
    /* Rosso per disattivo */
    min-width: 75px;
    /* Larghezza fissa per evitare scatti della tabella */
    text-align: right;
    transition: color 0.25s ease;
}

.status-text--active {
    color: #1E8449;
    /* Verde per attivo */
}

/* --- CSS Per il Toggle Switch --- */
.toggle-switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
}

.toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #FDEDEC;
    border: 1px solid #E74C3C;
    transition: .25s;
}

.slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 2px;
    bottom: 2px;
    background-color: #E74C3C;
    transition: .25s;
}

input:checked+.slider {
    background-color: #EAFAF1;
    border-color: #2ecc71;
}

input:checked+.slider:before {
    transform: translateX(20px);
    background-color: #2ecc71;
}

.slider.round {
    border-radius: 24px;
}

.slider.round:before {
    border-radius: 50%;
}

.mt-4 {
    margin-top: 1.5rem;
}
</style>