<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  paginaCorrente:    { type: Number,  required: true },
  elementiPerPagina: { type: Number,  required: true },
  totaleElementi:    { type: Number,  required: true },
  opzioniElementi:   { type: Array,   default: () => [5, 10, 25, 50] },
  compact:           { type: Boolean, default: false }
})

const emit = defineEmits(['update:paginaCorrente', 'update:elementiPerPagina', 'cambio-pagina'])

const totalePagine = computed(() => Math.max(1, Math.ceil(props.totaleElementi / props.elementiPerPagina)))
const rangeInizio  = computed(() => props.totaleElementi === 0 ? 0 : (props.paginaCorrente - 1) * props.elementiPerPagina + 1)
const rangeFine    = computed(() => Math.min(props.paginaCorrente * props.elementiPerPagina, props.totaleElementi))

const cambiaPagina = (pag) => {
  const n = parseInt(pag)
  if (!isNaN(n) && n >= 1 && n <= totalePagine.value && n !== props.paginaCorrente) {
    emit('update:paginaCorrente', n)
    emit('cambio-pagina', n)
  }
}

const cambiaElementi = (e) => {
  emit('update:elementiPerPagina', parseInt(e.target.value))
  emit('update:paginaCorrente', 1)
  emit('cambio-pagina', 1)
}

const paginaVisibili = computed(() => {
  const total = totalePagine.value
  const cur   = props.paginaCorrente
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages = new Set([1, total])
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.add(i)
  const sorted = [...pages].sort((a, b) => a - b)

  const result = []
  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) result.push('...')
    result.push(p)
    prev = p
  }
  return result
})
</script>

<template>
  <div v-if="totaleElementi > 0">

    <div v-if="compact" class="pag-compact">
      <button
        class="pag-compact__btn"
        :disabled="paginaCorrente === 1"
        @click="cambiaPagina(paginaCorrente - 1)"
        aria-label="Pagina precedente"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>

      <span class="pag-compact__info">
        {{ rangeInizio }}–{{ rangeFine }}<span class="pag-compact__of"> / {{ totaleElementi }}</span>
      </span>

      <button
        class="pag-compact__btn"
        :disabled="paginaCorrente === totalePagine"
        @click="cambiaPagina(paginaCorrente + 1)"
        aria-label="Pagina successiva"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>

    <div v-else class="pag-full">

      <div class="pag-full__left">
        <label class="pag-full__label">
          Mostra
          <select class="pag-full__select" :value="elementiPerPagina" @change="cambiaElementi">
            <option v-for="op in opzioniElementi" :key="op" :value="op">{{ op }}</option>
          </select>
          per pagina
        </label>
        <span class="pag-full__counter">
          {{ rangeInizio }}–{{ rangeFine }} di <strong>{{ totaleElementi }}</strong>
        </span>
      </div>

      <div class="pag-full__right">

        <button class="pag-full__btn" :disabled="paginaCorrente === 1" @click="cambiaPagina(1)" title="Prima pagina">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/>
          </svg>
        </button>

        <button class="pag-full__btn" :disabled="paginaCorrente === 1" @click="cambiaPagina(paginaCorrente - 1)" title="Precedente">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <template v-for="(p, i) in paginaVisibili" :key="i">
          <span v-if="p === '...'" class="pag-full__dots">…</span>
          <button
            v-else
            class="pag-full__btn pag-full__btn--num"
            :class="{ 'pag-full__btn--active': p === paginaCorrente }"
            @click="cambiaPagina(p)"
          >{{ p }}</button>
        </template>

        <button class="pag-full__btn" :disabled="paginaCorrente === totalePagine" @click="cambiaPagina(paginaCorrente + 1)" title="Successiva">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <button class="pag-full__btn" :disabled="paginaCorrente === totalePagine" @click="cambiaPagina(totalePagine)" title="Ultima pagina">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>
          </svg>
        </button>

      </div>
    </div>

  </div>
</template>

<style scoped>
.pag-compact {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.pag-compact__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #475569;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  padding: 0;
}

.pag-compact__btn:hover:not(:disabled) {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #0f172a;
}

.pag-compact__btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.pag-compact__info {
  font-size: 0.8rem;
  font-weight: 600;
  color: #334155;
  padding: 0 6px;
  white-space: nowrap;
}

.pag-compact__of {
  color: #94a3b8;
  font-weight: 400;
}

.pag-full {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 16px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, .04);
}

.pag-full__left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.pag-full__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: #64748b;
  white-space: nowrap;
}

.pag-full__select {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 3px 6px;
  font-size: 0.8rem;
  color: #334155;
  background: #f8fafc;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}

.pag-full__select:focus {
  border-color: #00408A;
}

.pag-full__counter {
  font-size: 0.8rem;
  color: #64748b;
  white-space: nowrap;
}

.pag-full__right {
  display: flex;
  align-items: center;
  gap: 3px;
}

.pag-full__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: #475569;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.pag-full__btn:hover:not(:disabled):not(.pag-full__btn--active) {
  background: #f1f5f9;
  color: #0f172a;
}

.pag-full__btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.pag-full__btn--num {
  min-width: 32px;
  font-variant-numeric: tabular-nums;
}

.pag-full__btn--active {
  background: #00408A;
  color: #fff;
  border-color: #00408A;
  font-weight: 700;
  cursor: default;
}

.pag-full__dots {
  color: #94a3b8;
  font-size: 0.85rem;
  padding: 0 2px;
  user-select: none;
}

@media (max-width: 600px) {
  .pag-full {
    justify-content: center;
  }
  .pag-full__left {
    justify-content: center;
    width: 100%;
  }
}
</style>