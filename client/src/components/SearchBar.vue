<script setup>
import { ref } from 'vue'
import { strategic_places } from '../constants/places.js'

const props = defineProps({
    location: { type: String, default: '' },
    checkIn: { type: String, default: '' },
    checkOut: { type: String, default: '' },
    showSubmitButton: { type: Boolean, default: false },
    simple: { type: Boolean, default: false },
    placeholder: { type: String, default: 'Cerca un punto di interesse...' }
})

const emit = defineEmits(['update:location', 'update:checkIn', 'update:checkOut', 'search', 'suggestion-selected'])

const suggestions = ref([])
const showSuggestions = ref(false)

const handleSearchInput = (e) => {
    const value = e.target.value
    emit('update:location', value)

    const query = value.toLowerCase().trim()
    if (query.length < 2) {
        suggestions.value = []
        showSuggestions.value = false
        return
    }

    suggestions.value = strategic_places.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.synonyms.some(s => s.toLowerCase().includes(query))
    ).map(p => ({
        name: p.name,
        lat: p.coords.lat,
        lon: p.coords.lng
    }))
    showSuggestions.value = suggestions.value.length > 0
}

const selectSuggestion = (place) => {
    emit('update:location', place.name)
    showSuggestions.value = false
    emit('suggestion-selected', place)
}

const handleBlur = () => {
    showSuggestions.value = false
}
</script>

<template>
    <div :class="['search-box', { 'simple-mode': simple }]">
        <div class="input-group location-group" style="position: relative;">
            <div class="icon">
                <img src="../assets/magnifying_glass.svg" class="icon-card" alt="Pin" />
            </div>

            <div class="fields">
                <label v-if="!simple">Dove vuoi parcheggiare?</label>
                <input type="text" :value="location" @input="handleSearchInput" @blur="handleBlur"
                    @focus="showSuggestions = suggestions.length > 0" :placeholder="placeholder" autocomplete="off"
                    required>
            </div>

            <ul v-if="showSuggestions" class="autocomplete-dropdown">
                <li v-for="(sug, idx) in suggestions" :key="idx" @mousedown.prevent="selectSuggestion(sug)">
                    <span class="icon-spacer"></span>
                    <span class="sug-text">{{ sug.name }}</span>
                </li>
            </ul>
        </div>

        <template v-if="!simple">
            <div class="input-group">
                <label>Check-in</label>
                <input type="datetime-local" :value="checkIn" @input="$emit('update:checkIn', $event.target.value)"
                    required>
            </div>
            <div class="input-group">
                <label>Check-out</label>
                <input type="datetime-local" :value="checkOut" @input="$emit('update:checkOut', $event.target.value)"
                    required>
            </div>
            <button v-if="showSubmitButton" @click="$emit('search')" type="button" class="search-btn">Cerca</button>
        </template>
    </div>
</template>

<style scoped>
.search-box {
    display: flex;
    background: #ffffff;
    padding: 0.8rem;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    gap: 12px;
    width: 100%;
}

.input-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0.5rem 1rem;
    background: #ffffff;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    transition: all 0.3s;
}

.input-group:focus-within {
    border-color: #00408A;
    box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.1);
}

.location-group {
    flex: 1.8;
    flex-direction: row;
    align-items: center;
    gap: 12px;
}

.location-group .fields {
    display: flex;
    flex-direction: column;
    flex: 1;
}

.input-group label {
    font-size: 0.7rem;
    font-weight: 800;
    color: #00408A;
    text-transform: uppercase;
    margin-bottom: 2px;
}

.input-group input {
    border: none;
    outline: none;
    font-size: 1rem;
    width: 100%;
    color: #1e293b;
    font-family: inherit;
}

.icon-card {
    width: 14px;
    height: 14px;
}

.autocomplete-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    padding: 0;
    list-style: none;
    max-height: 250px;
    overflow-y: auto;
    z-index: 1000;
}

.autocomplete-dropdown li {
    padding: 12px 1rem;
    border-bottom: 1px solid #f1f5f9;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: background 0.2s;
    font-size: 0.95rem;
    font-weight: 500;
    color: #1e293b;
}

.autocomplete-dropdown li:hover {
    background-color: #f8fafc;
    color: #00408A;
}

.sug-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.icon-spacer {
    width: 14px;
    height: 14px;
    display: inline-block;
    flex-shrink: 0;
}

.search-btn {
    background-color: #00408A;
    color: white;
    border: none;
    font-size: 1.2rem;
    font-weight: bold;
    padding: 0 2.5rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.search-btn:hover {
    background-color: #002E5C;
    transform: translateY(-2px);
}

.simple-mode.search-box {
    padding: 0 !important;
    margin: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    border: none !important;
}

.simple-mode .input-group {
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    box-shadow: none !important;
    background: transparent !important;
    min-height: unset !important;
}

.simple-mode .fields {
    padding: 0 !important;
    margin: 0 !important;
    justify-content: center;
}

.simple-mode input {
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    background: transparent !important;
    line-height: 1.2 !important;
}

@media (max-width: 900px) {
    .search-box {
        flex-direction: column;
        padding: 0.5rem;
        gap: 5px;
    }

    .input-group {
        border-radius: 6px;
    }

    .search-btn {
        padding: 1.2rem;
    }
}
</style>