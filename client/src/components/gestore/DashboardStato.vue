<script setup>
import { ref } from 'vue'
import PlanimetriaGarage from '../PlanimetriaGarage.vue'

const props = defineProps({
    mieiGarage: { type: Array, required: true },
    postiPerGarage: { type: Object, required: true },
    occupazioneGarage: { type: Object, required: true },
    allerteStato: { type: Array, required: true }
})

const emit = defineEmits(['verifica-disponibilita', 'manage-posto'])

const localeInizio = ref('')
const localeFine = ref('')

const getOccupancy = (idGarage) => props.occupazioneGarage[idGarage] ?? 0

const onVerifica = () => {
    if (!localeInizio.value || !localeFine.value) {
        alert('Inserisci orario di inizio e di fine!')
        return
    }
    emit('verifica-disponibilita', { inizio: localeInizio.value, fine: localeFine.value })
}
</script>

<template>
    <section class="vista fade-in centered-container">
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
                    <input type="datetime-local" class="form-input" v-model="localeInizio">
                </div>
                <div class="form-group">
                    <label class="form-label">Fine Sosta</label>
                    <input type="datetime-local" class="form-input" v-model="localeFine">
                </div>
            </div>
            <button class="btn-primary" style="margin-top: 16px; width: 100%;" @click="onVerifica">
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
                        <div class="occupancy-fill" :style="{ width: getOccupancy(garage.id_garage) + '%' }"
                            :class="{ 'fill-warn': getOccupancy(garage.id_garage) > 80 }">
                        </div>
                    </div>
                    <span class="occupancy-pct">{{ getOccupancy(garage.id_garage) }}%</span>
                </div>

                <div class="stato-meta">
                    <span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {{ garage.is24h ? 'Aperto 24h' : `${garage.orarioapertura?.substring(0, 5)} -
                        ${garage.orariochiusura?.substring(0,5)}` }}
                    </span>
                    <span>€ {{ garage.tariffabase || garage.tariffaauto }}/h</span>
                </div>

                <div class="planimetria-wrapper">
                    <PlanimetriaGarage :posti="postiPerGarage[garage.id_garage] || []"
                        :mappaTestuale="garage.mappatestuale" :isGestoreMode="true"
                        @manage="$emit('manage-posto', $event)" />
                </div>
            </div>
        </div>

        <div v-if="allerteStato.length > 0" class="section-header" style="margin-top: 32px;">
            <h2>Allerte</h2>
        </div>
        <div v-for="allerta in allerteStato" :key="allerta.id"
            :class="['allerta-card', allerta.tipo === 'warning' ? 'allerta--warn' : 'allerta--danger']">
            <div class="allerta-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path
                        d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            </div>
            <div>
                <p class="allerta-title">{{ allerta.titolo }}</p>
                <p class="allerta-msg">{{ allerta.messaggio }}</p>
            </div>
        </div>

        <div v-if="allerteStato.length === 0 && mieiGarage.length > 0" class="allerta-card allerta--ok"
            style="margin-top: 24px;">
            <div class="allerta-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
            </div>
            <div>
                <p class="allerta-title">Tutto regolare</p>
                <p class="allerta-msg">Tutti i garage operano nei limiti normali.</p>
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

.section-header {
    margin-bottom: 12px;
}

.section-header h2 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--deep-blue, #00204A);
}

/* Form Elements */
.filter-card {
    background: #fff;
    border: 0.5px solid #E8E8E8;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
}

.form-row--2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
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
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
}

.form-input:focus {
    border-color: #0066CC;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.08);
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
    transition: background 0.15s, transform 0.1s;
}

.btn-primary:hover {
    background: #00204A;
    transform: translateY(-1px);
}

/* Grid e Card Garage */
.stato-grid {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.stato-card {
    background: #fff;
    border: 0.5px solid #E8E8E8;
    border-radius: 12px;
    padding: 24px;
    width: 100%;
    box-sizing: border-box;
}

.stato-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
}

.stato-nome {
    font-size: 0.9rem;
    font-weight: 600;
    color: #222;
}

.stato-indirizzo {
    font-size: 0.78rem;
    color: #aaa;
    margin: 0 0 16px;
}

.badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 600;
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

/* Occupazione */
.occupancy-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
}

.occupancy-bar {
    flex: 1;
    height: 6px;
    background: #F0F0F0;
    border-radius: 999px;
    overflow: hidden;
}

.occupancy-fill {
    height: 100%;
    background: #0066CC;
    border-radius: 999px;
    transition: width 0.4s ease;
}

.occupancy-fill.fill-warn {
    background: #E67E22;
}

.occupancy-pct {
    font-size: 0.78rem;
    color: #888;
    font-weight: 600;
    min-width: 34px;
    text-align: right;
}

.stato-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #aaa;
}

.stato-meta span {
    display: flex;
    align-items: center;
    gap: 4px;
}

.planimetria-wrapper {
    margin-top: 16px;
    border-top: 1px solid #f0f0f0;
    padding-top: 12px;
    overflow-x: auto;
}

/* Allerte */
.allerta-card {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 20px 24px;
    border-radius: 12px;
    margin-bottom: 12px;
    border: 0.5px solid transparent;
}

.allerta--ok {
    background: #EAFAF1;
    border-color: #A9DFBF;
}

.allerta--ok .allerta-icon {
    color: #27AE60;
}

.allerta--warn {
    background: #FEF9EE;
    border-color: #FAD7A0;
}

.allerta--warn .allerta-icon {
    color: #E67E22;
}

.allerta--danger {
    background: #FDEDEC;
    border-color: #F1948A;
}

.allerta--danger .allerta-icon {
    color: #C0392B;
}

.allerta-icon {
    display: flex;
    align-items: center;
    margin-top: 1px;
    flex-shrink: 0;
}

.allerta-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: #222;
    margin: 0 0 4px;
}

.allerta-msg {
    font-size: 0.85rem;
    color: #666;
    margin: 0;
    line-height: 1.5;
}

@media (max-width: 900px) {
    .form-row--2col {
        grid-template-columns: 1fr;
    }
}
</style>