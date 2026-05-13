<script setup>
import { RouterLink } from 'vue-router'

defineProps({
    mieiGarage: {
        type: Array,
        required: true
    }
})

defineEmits(['modifica'])
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
                        <td class="td-bold" style="color: #0066CC;">€ {{ garage.tariffabase || garage.tariffaauto ||
                            '0.00' }}</td>
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
</template>

<style scoped>
/* Stili estratti dal componente principale per renderlo indipendente */
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
</style>