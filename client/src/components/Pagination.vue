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

  const result = []
  const half    = 2
  let winStart  = Math.max(2, cur - half)
  let winEnd    = Math.min(total - 1, cur + half)

  if (winEnd - winStart < 4) {
    if (winStart === 2) winEnd   = Math.min(total - 1, winStart + 4)
    else                winStart = Math.max(2, winEnd - 4)
  }

  result.push(1)
  if (winStart > 2) result.push('...')
  for (let i = winStart; i <= winEnd; i++) result.push(i)
  if (winEnd < total - 1) result.push('...')
  result.push(total)

  return result
})
</script>

<template>
  <div v-if="totaleElementi > 0">

    <div v-if="compact" class="pag-compact">
      <button
        class="pag-compact__btn"
        :disabled="paginaCorrente <= 1"
        @click="cambiaPagina(Math.max(1, paginaCorrente - 5))"
        aria-label="-5 Pagine"
        title="Indietro di 5 pagine"
      >
        <img src="../assets/chevron-left-double.svg" class="icon" alt="-5 Pagine">
      </button>

      <button
        class="pag-compact__btn"
        :disabled="paginaCorrente === 1"
        @click="cambiaPagina(paginaCorrente - 1)"
        aria-label="Pagina precedente"
        title="Precedente"
      >
        <img src="../assets/chevron-left.svg" class="icon" alt="Precedente">
      </button>

      <span class="pag-compact__info">
        {{ rangeInizio }}-{{ rangeFine }}<span class="pag-compact__of"> / {{ totaleElementi }}</span>
      </span>

      <button
        class="pag-compact__btn"
        :disabled="paginaCorrente === totalePagine"
        @click="cambiaPagina(paginaCorrente + 1)"
        aria-label="Pagina successiva"
        title="Successiva"
      >
        <img src="../assets/chevron-right.svg" class="icon" alt="Successiva">
      </button>

      <button
        class="pag-compact__btn"
        :disabled="paginaCorrente >= totalePagine"
        @click="cambiaPagina(Math.min(totalePagine, paginaCorrente + 5))"
        aria-label="+5 Pagine"
        title="Avanti di 5 pagine"
      >
        <img src="../assets/chevron-right-double.svg" class="icon" alt="+5 Pagine">
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
          {{ rangeInizio }}-{{ rangeFine }} di <strong>{{ totaleElementi }}</strong>
        </span>
      </div>

      <div class="pag-full__right">

        <button class="pag-full__btn" :disabled="paginaCorrente <= 1" @click="cambiaPagina(Math.max(1, paginaCorrente - 5))" title="Indietro di 5 pagine">
          <img src="../assets/chevron-left-double.svg" class="icon" alt="-5 Pagine">
        </button>

        <button class="pag-full__btn" :disabled="paginaCorrente === 1" @click="cambiaPagina(paginaCorrente - 1)" title="Precedente">
          <img src="../assets/chevron-left.svg" class="icon" alt="Precedente">
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
          <img src="../assets/chevron-right.svg" class="icon" alt="Successiva">
        </button>

        <button class="pag-full__btn" :disabled="paginaCorrente >= totalePagine" @click="cambiaPagina(Math.min(totalePagine, paginaCorrente + 5))" title="Avanti di 5 pagine">
          <img src="../assets/chevron-right-double.svg" class="icon" alt="+5 Pagine">
        </button>

      </div>
    </div>

  </div>
</template>

<style scoped>
.pag-compact {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap; 
  justify-content: center;
}

.pag-compact__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
  color: #4b5563;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
}

.pag-compact__btn:hover:not(:disabled) {
  background: #e2e8f0;
  border-color: #00408A;
  color: #00408A;
}

.pag-compact__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pag-compact__info {
  font-size: 0.9rem;
  color: #4b5563;
  padding: 0 8px;
  white-space: nowrap;
  display: inline-block;
  min-width: 90px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.pag-compact__of {
  color: #94a3b8;
}

.pag-full {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px 16px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
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
  gap: 8px;
  font-size: 0.9rem;
  color: #4b5563;
  white-space: nowrap;
}

.pag-full__select {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.9rem;
  color: #4b5563;
  background-color: #f8fafc;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
}

.pag-full__select:focus {
  border-color: #00408A;
}

.pag-full__counter {
  font-size: 0.9rem;
  color: #4b5563;
  white-space: nowrap;
}

.pag-full__right {
  display: flex;
  align-items: center;
  flex-wrap: wrap; 
  justify-content: center;
  gap: 4px;
}

.pag-full__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #4b5563;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.pag-full__btn:hover:not(:disabled):not(.pag-full__btn--active) {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #00408A;
}

.pag-full__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pag-full__btn--num {
  min-width: 32px;
  font-variant-numeric: tabular-nums;
}

.pag-full__btn--active {
  background: #00408A;
  color: #ffffff;
  border-color: #00408A;
  font-weight: 600;
  cursor: default;
}

.pag-full__dots {
  color: #94a3b8;
  font-size: 0.9rem;
  padding: 0 4px;
  user-select: none;
}

.icon {
  width: 16px;
  height: 16px;
}

@media (max-width: 600px) {
  .pag-full {
    flex-direction: column;
    justify-content: center;
    padding: 16px 12px;
  }
  .pag-full__left {
    justify-content: center;
    width: 100%;
  }
  .pag-full__right {
    width: 100%;
    margin-top: 4px;
  }
}
</style>