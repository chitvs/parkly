<script setup>
import { computed } from 'vue'

const props = defineProps({
    filterTipoVeicolo: String,
    maxPrice: Number,
    filter24h: Boolean,
    filterCoperto: Boolean,
    filterElettrico: Boolean,
    filterDisabili: Boolean,
    minHeight: Number,
    raggioKm: { type: Number, default: 2 },
    hasLocation: { type: Boolean, default: false }
})

const emit = defineEmits([
    'update:filterTipoVeicolo',
    'update:maxPrice',
    'update:filter24h',
    'update:filterCoperto',
    'update:filterElettrico',
    'update:filterDisabili',
    'update:minHeight',
    'update:raggioKm'
])

const tipoVeicolo = computed({
    get: () => props.filterTipoVeicolo,
    set: val => emit('update:filterTipoVeicolo', val)
})

const prezzo = computed({
    get: () => props.maxPrice,
    set: val => emit('update:maxPrice', Number(val))
})

const h24 = computed({
    get: () => props.filter24h,
    set: val => emit('update:filter24h', val)
})

const coperto = computed({
    get: () => props.filterCoperto,
    set: val => emit('update:filterCoperto', val)
})

const elettrico = computed({
    get: () => props.filterElettrico,
    set: val => emit('update:filterElettrico', val)
})

const disabili = computed({
    get: () => props.filterDisabili,
    set: val => emit('update:filterDisabili', val)
})

const altezza = computed({
    get: () => props.minHeight,
    set: val => emit('update:minHeight', Number(val))
})

const raggio = computed({
    get: () => props.raggioKm,
    set: val => emit('update:raggioKm', Number(val))
})
</script>

<template>
    <div>
        <div class="filter-group">
            <label>Tipo di veicolo</label>
            <select v-model="tipoVeicolo" class="filter-select">
                <option value="ALL">Tutti</option>
                <option value="AUTO">Auto</option>
                <option value="MOTO">Moto</option>
                <option value="FURGONE">Furgone</option>
            </select>
        </div>

        <hr class="filter-divider">

        <div class="filter-group">
            <label>Prezzo massimo: <strong>€ {{ (prezzo ?? 0).toFixed(2) }}</strong></label>
            <input type="range" v-model.number="prezzo" min="1" max="25" step="0.5" class="slider">
            <div class="range-labels">
                <span>€1</span>
                <span>€25</span>
            </div>
        </div>

        <template v-if="hasLocation">
            <hr class="filter-divider">

            <div class="filter-group">
                <label>Raggio di ricerca: <strong>{{ raggioKm }} km</strong></label>
                <input type="range" v-model.number="raggio" min="0.5" max="10" step="0.5" class="slider">
                <div class="range-labels">
                    <span>0.5 km</span>
                    <span>10 km</span>
                </div>
            </div>
        </template>

        <hr class="filter-divider">

        <div class="filter-group">
            <label><b>Caratteristiche:</b></label>
            <div class="checkbox-list">
                <label class="checkbox-container">
                    <input type="checkbox" v-model="h24">
                    <span> Aperto 24/7</span>
                </label>
                <label class="checkbox-container">
                    <input type="checkbox" v-model="coperto">
                    <span> Posti al coperto</span>
                </label>
                <label class="checkbox-container">
                    <input type="checkbox" v-model="elettrico">
                    <span> Ricarica elettrica</span>
                </label>
                <label class="checkbox-container">
                    <input type="checkbox" v-model="disabili">
                    <span> Accesso disabili</span>
                </label>
            </div>
        </div>

        <hr class="filter-divider">

        <div class="filter-group">
            <label>Altezza minima veicolo</label>
            <select v-model.number="altezza" class="filter-select">
                <option :value="0">Qualsiasi altezza</option>
                <option :value="1.4">Oltre 1.40m</option>
                <option :value="1.6">Oltre 1.60m</option>
                <option :value="1.9">Oltre 1.90m</option>
                <option :value="2.1">Oltre 2.10m</option>
                <option :value="2.3">Oltre 2.30m</option>
                <option :value="2.5">Oltre 2.50m</option>
            </select>
        </div>
    </div>
</template>

<style scoped>
.filter-group {
    margin-bottom: 1rem;
}

.filter-group label {
    display: block;
    font-size: 0.9rem;
    color: #4b5563;
    margin-bottom: 10px;
}

.filter-divider {
    border: 0;
    border-top: 1px solid #e2e8f0;
    margin: 1rem 0;
}

.slider {
    width: 100%;
    accent-color: #00408A;
    cursor: pointer;
}

.range-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 5px;
}

.checkbox-list {
    display: flex;
    flex-direction: column;
}

.checkbox-container {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    cursor: pointer;
    font-size: 0.85rem;
    color: #4b5563;
}

.checkbox-container input {
    width: 16px;
    height: 16px;
    accent-color: #00408A;
    margin: 0;
    transform: translateY(2px);
}

.filter-select {
    width: 100%;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    background-color: #f8fafc;
    font-size: 0.9rem;
    outline: none;
}

.filter-select:focus {
    border-color: #00408A;
}
</style>