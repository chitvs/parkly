<template>
  <section class="chatbox" :class="{ 'chatbox--aperta': aperta }">
    <!-- ── Header ── -->
    <button class="chatbox__header" @click="aperta = !aperta">
      <div class="chatbox__header-info">
        <span class="chatbox__avatar">{{ inizialeDestinatario }}</span>
        <div>
          <p class="chatbox__nome">{{ nomeDestinatario }}</p>
          <p class="chatbox__ruolo">{{ ruoloDestinatario }}</p>
        </div>
      </div>
      <div class="chatbox__header-right">
        <span v-if="nonLetti > 0" class="chatbox__badge">{{ nonLetti }}</span>
        <span class="chatbox__toggle-icon">{{ aperta ? '▾' : '▸' }}</span>
      </div>
    </button>

    <!-- ── Corpo chat ── -->
    <transition name="slide">
      <div v-if="aperta" class="chatbox__body">
        <!-- Caricamento -->
        <div v-if="staCaricando" class="chatbox__stato">
          <span class="chatbox__spinner"></span> Caricamento messaggi...
        </div>

        <!-- Errore -->
        <div v-else-if="errore" class="chatbox__stato chatbox__stato--errore">
          ⚠ {{ errore }}
        </div>

        <!-- Messaggi -->
        <div v-else ref="listaRef" class="chatbox__lista">
          <div v-if="messaggi.length === 0" class="chatbox__vuota">
            Nessun messaggio ancora. Scrivi per primo!
          </div>

          <template v-for="msg in messaggi" :key="msg.id_messaggio">
            <div
              class="chatbox__msg"
              :class="msg.id_mittente === idUtenteCorrente
                ? 'chatbox__msg--mio'
                : 'chatbox__msg--loro'"
            >
              <p class="chatbox__testo">{{ msg.testo }}</p>
              <span class="chatbox__ora">{{ formattaData(msg.datainvio) }}</span>
            </div>
          </template>

          <!-- "Sta scrivendo..." -->
          <div v-if="destinatarioStaScrivendo" class="chatbox__scrivendo">
            <span></span><span></span><span></span>
          </div>
        </div>

        <!-- Input -->
        <div class="chatbox__input-area">
          <textarea
            ref="inputRef"
            v-model="testo"
            class="chatbox__input"
            placeholder="Scrivi un messaggio..."
            rows="1"
            @keydown.enter.exact.prevent="invia"
            @input="onInput"
          />
          <button
            class="chatbox__invia"
            :disabled="!testo.trim()"
            @click="invia"
          >
            ➤
          </button>
        </div>
      </div>
    </transition>
  </section>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useChat } from '@/composables/useChat';

// ─── Props ────────────────────────────────────────────────────────────────────
const props = defineProps({
  idGarage: { type: Number, required: true },
  idDestinatario: { type: Number, required: true },
  nomeDestinatario: { type: String, default: 'Utente' },
  ruoloDestinatario: { type: String, default: '' }, // es. "Gestore" o "Cliente"
});

// ─── Stato ────────────────────────────────────────────────────────────────────

const idUtenteCorrente = computed(() => authStore.utente?.id_utente);

const aperta = ref(true);
const testo = ref('');
const listaRef = ref(null);
const inputRef = ref(null);

// ─── Chat composable ─────────────────────────────────────────────────────────
const {
  messaggi,
  staCaricando,
  errore,
  destinatarioStaScrivendo,
  inviaMessaggio,
  segnalaScrittura,
} = useChat(props.idGarage, props.idDestinatario);

// ─── Badge messaggi non letti ────────────────────────────────────────────────
const nonLetti = computed(() =>
  messaggi.value.filter(
    (m) => m.id_destinatario === idUtenteCorrente.value && !m.letto
  ).length
);

// ─── Iniziale avatar ─────────────────────────────────────────────────────────
const inizialeDestinatario = computed(() =>
  props.nomeDestinatario?.charAt(0).toUpperCase() || '?'
);

// ─── Scroll automatico in fondo ──────────────────────────────────────────────
function scrollInFondo() {
  nextTick(() => {
    if (listaRef.value) {
      listaRef.value.scrollTop = listaRef.value.scrollHeight;
    }
  });
}

watch(messaggi, scrollInFondo, { deep: true });
watch(aperta, (val) => { if (val) scrollInFondo(); });

// ─── Invio ────────────────────────────────────────────────────────────────────
function invia() {
  if (!testo.value.trim()) return;
  inviaMessaggio(testo.value);
  testo.value = '';
}

// ─── Segnala scrittura (throttled) ────────────────────────────────────────────
let scrittura_timer = null;
function onInput() {
  if (!scrittura_timer) {
    segnalaScrittura();
    scrittura_timer = setTimeout(() => { scrittura_timer = null; }, 1500);
  }
}

// ─── Utilità data ─────────────────────────────────────────────────────────────
function formattaData(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
/* ── Variabili ── */
.chatbox {
  --c-primary: #2563eb;
  --c-primary-dark: #1d4ed8;
  --c-bg: #ffffff;
  --c-surface: #f1f5f9;
  --c-border: #e2e8f0;
  --c-text: #0f172a;
  --c-muted: #64748b;
  --c-mio: #2563eb;
  --c-loro: #e2e8f0;
  --radius: 12px;

  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  background: var(--c-bg);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  margin-top: 1.5rem;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

/* ── Header ── */
.chatbox__header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.25rem;
  background: var(--c-primary);
  color: white;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
}
.chatbox__header:hover { background: var(--c-primary-dark); }

.chatbox__header-info { display: flex; align-items: center; gap: 0.75rem; }

.chatbox__avatar {
  width: 2.25rem;
  height: 2.25rem;
  background: rgba(255,255,255,0.25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
}

.chatbox__nome { font-weight: 600; font-size: 0.95rem; margin: 0; }
.chatbox__ruolo { font-size: 0.75rem; opacity: 0.8; margin: 0; }

.chatbox__header-right { display: flex; align-items: center; gap: 0.5rem; }

.chatbox__badge {
  background: #ef4444;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  min-width: 1.25rem;
  height: 1.25rem;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.3rem;
}

.chatbox__toggle-icon { font-size: 1rem; opacity: 0.9; }

/* ── Body ── */
.chatbox__body { display: flex; flex-direction: column; }

.chatbox__stato {
  padding: 2rem;
  text-align: center;
  color: var(--c-muted);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.chatbox__stato--errore { color: #ef4444; }

/* ── Lista messaggi ── */
.chatbox__lista {
  height: 320px;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: var(--c-surface);
  scroll-behavior: smooth;
}

.chatbox__vuota {
  text-align: center;
  color: var(--c-muted);
  font-size: 0.875rem;
  margin: auto;
}

/* ── Singolo messaggio ── */
.chatbox__msg {
  max-width: 72%;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.chatbox__msg--mio {
  align-self: flex-end;
  align-items: flex-end;
}
.chatbox__msg--loro {
  align-self: flex-start;
  align-items: flex-start;
}

.chatbox__testo {
  margin: 0;
  padding: 0.6rem 0.9rem;
  border-radius: 18px;
  font-size: 0.9rem;
  line-height: 1.45;
  word-break: break-word;
}
.chatbox__msg--mio .chatbox__testo {
  background: var(--c-mio);
  color: white;
  border-bottom-right-radius: 4px;
}
.chatbox__msg--loro .chatbox__testo {
  background: white;
  color: var(--c-text);
  border: 1px solid var(--c-border);
  border-bottom-left-radius: 4px;
}

.chatbox__ora {
  font-size: 0.7rem;
  color: var(--c-muted);
  padding: 0 0.25rem;
}

/* ── Sta scrivendo ── */
.chatbox__scrivendo {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid var(--c-border);
  border-radius: 18px;
  border-bottom-left-radius: 4px;
  align-self: flex-start;
  width: fit-content;
}
.chatbox__scrivendo span {
  width: 7px;
  height: 7px;
  background: var(--c-muted);
  border-radius: 50%;
  animation: bounce 1.2s infinite ease-in-out;
}
.chatbox__scrivendo span:nth-child(2) { animation-delay: 0.2s; }
.chatbox__scrivendo span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}

/* ── Input area ── */
.chatbox__input-area {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--c-border);
  background: var(--c-bg);
}

.chatbox__input {
  flex: 1;
  resize: none;
  border: 1px solid var(--c-border);
  border-radius: 20px;
  padding: 0.55rem 1rem;
  font-size: 0.9rem;
  font-family: inherit;
  color: var(--c-text);
  outline: none;
  transition: border-color 0.2s;
  max-height: 120px;
  overflow-y: auto;
  line-height: 1.4;
}
.chatbox__input:focus { border-color: var(--c-primary); }

.chatbox__invia {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--c-primary);
  color: white;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.1s;
  flex-shrink: 0;
}
.chatbox__invia:hover:not(:disabled) {
  background: var(--c-primary-dark);
  transform: scale(1.07);
}
.chatbox__invia:disabled { background: var(--c-border); cursor: not-allowed; }

/* ── Spinner ── */
.chatbox__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--c-border);
  border-top-color: var(--c-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Transizione apertura/chiusura ── */
.slide-enter-active,
.slide-leave-active { transition: max-height 0.3s ease, opacity 0.25s ease; overflow: hidden; }
.slide-enter-from,
.slide-leave-to { max-height: 0; opacity: 0; }
.slide-enter-to,
.slide-leave-from { max-height: 500px; opacity: 1; }
</style>