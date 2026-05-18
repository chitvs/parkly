<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { authStore } from '@/store/auth';
import { useChat } from '@/composables/useChat';

const emit = defineEmits(['chiudi']);

// Props passate dal componente padre 
const props = defineProps({
  idPrenotazione: { type: Number, required: true },
  idDestinatario: { type: Number, required: true },
  nomeDestinatario: { type: String, default: 'Utente' },
  ruoloDestinatario: { type: String, default: '' },
});

const aperta = ref(true); // Stato della tendina del popup
const testo = ref(''); // Modello per l'input testuale
const listaRef = ref(null); // Riferimento al div che contiene i messaggi nel DOM



// Controlla se il messaggio stampato nel ciclo v-for è stato inviato dall'utente corrente.
//  Usa l'AuthStore per fare il match tra l'ID mittente e l'ID dell'utente loggato.

const isMioMessaggio = (idMittente) => {
  if (!idMittente || !authStore.utente?.id) return false;
  return Number(idMittente) === Number(authStore.utente?.id);
};


// Inizializza il composable delegandogli la logica Socket/API (recupero array messaggi, stato di carico, funzione di invio)
const {
  messaggi,
  staCaricando,
  errore,
  inviaMessaggio,
} = useChat(props.idPrenotazione, props.idDestinatario);


const inizialeDestinatario = computed(() =>
  props.nomeDestinatario?.charAt(0).toUpperCase() || '?'
);

// --- GESTIONE DELLO SCROLL ---


// Sposta la barra di scorrimento della chat fino in fondo per visualizzare gli ultimi messaggi.
// Usa nextTick() per garantire che Vue abbia prima finito di renderizzare l'HTML aggiornato.
function scrollInFondo() {
  nextTick(() => {
    if (listaRef.value) {
      listaRef.value.scrollTop = listaRef.value.scrollHeight;
    }
  });
}

// Ogni volta che l'array "messaggi" cambia (es. arriva un nuovo messaggio via web-socket o API), esegue lo scroll automatico
// deep:true forza Vue a tracciare ogni singola modifica annidata all'interno di "messaggi"; 
// senza avrebbe riconosciuto solo un cambiamento se TUTTO l'array fosse cambiato
watch(messaggi, scrollInFondo, { deep: true });

// Quando l'utente clicca l'icona "▾" per aprire la tendina, riallinea lo scroll in fondo
watch(aperta, (val) => {
  if (val) {
    scrollInFondo();
  }
});

// --- AZIONI ---

//Se l'input non è vuoto, delega l'invio al composable useChat e resetta la textarea.
function invia() {
  if (!testo.value.trim()) return;
  inviaMessaggio(testo.value);
  testo.value = ''; // Pulisce l'input dopo l'invio
}


// --- Date e Ora --- 

//Converte un timestamp completo in un formato di solo orario "HH:MM".
function soloOra(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}


//  Valuta se inserire il "divisore giornaliero" sopra il messaggio in fase di renderizzazione.
//  Comparando la data del messaggio corrente con quella del messaggio precedente.
//   msg = L'oggetto del messaggio corrente nel v-for.
//   index = L'indice corrente del v-for.

function mostraSeparatoreData(msg, index) {
  if (index === 0) return true; // Mostra sempre il separatore sul primo messaggio
  const prevMsg = messaggi.value[index - 1];
  if (!prevMsg || !prevMsg.datainvio || !msg.datainvio) return false;

  const dataPrecedente = new Date(prevMsg.datainvio);
  const dataCorrente = new Date(msg.datainvio);

  // Restituisce true se anno, mese o giorno sono diversi
  return dataPrecedente.getFullYear() !== dataCorrente.getFullYear() ||
    dataPrecedente.getMonth() !== dataCorrente.getMonth() ||
    dataPrecedente.getDate() !== dataCorrente.getDate();
}


// Genera l'etichetta testuale da stampare nel separatore della data.
// Riconosce i giorni relativi ("Oggi", "Ieri"), altrimenti ritorna la data estesa.
// ts = Il timestamp di cui generare l'etichetta.
function etichettaGiorno(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const oggi = new Date();
  const ieri = new Date(oggi);
  ieri.setDate(oggi.getDate() - 1);

  // Helper interno per formattare una data da confrontare facilmente (DD/MM/YYYY)
  const formatta = (dateObj) => dateObj.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (formatta(d) === formatta(oggi)) return 'Oggi';
  if (formatta(d) === formatta(ieri)) return 'Ieri';

  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
}
</script>

<template>
  <section class="chatbox" :class="{ 'chatbox--aperta': aperta }">
    <div class="chatbox__header">
      <button class="chatbox__header-toggle" @click="aperta = !aperta">
        <div class="chatbox__header-info">
          <span class="chatbox__avatar">{{ inizialeDestinatario }}</span>
          <div>
            <p class="chatbox__nome">{{ nomeDestinatario }}</p>
            <p class="chatbox__ruolo">{{ ruoloDestinatario }}</p>
          </div>
        </div>
        <span class="chatbox__toggle-icon">{{ aperta ? '▾' : '▴' }}</span>
      </button>
      <button class="chatbox__chiudi-btn" @click.stop="emit('chiudi')" title="Chiudi chat">✕</button>
    </div>

    <transition name="slide">
      <div v-if="aperta" class="chatbox__body">

        <div v-if="staCaricando" class="chatbox__stato">
          Caricamento messaggi...
        </div>

        <div v-else-if="errore" class="chatbox__stato chatbox__stato--errore">
          ⚠ {{ errore }}
        </div>

        <div v-else ref="listaRef" class="chatbox__lista">
          <div v-if="messaggi.length === 0" class="chatbox__vuota">
            Nessun messaggio ancora. Scrivi per primo!
          </div>

          <template v-for="(msg, i) in messaggi" :key="msg.id_messaggio || i">

            <div v-if="mostraSeparatoreData(msg, i)" class="chatbox__separatore">
              <span>{{ etichettaGiorno(msg.datainvio) }}</span>
            </div>

            <div class="chatbox__msg"
              :class="isMioMessaggio(msg.id_mittente) ? 'chatbox__msg--mio' : 'chatbox__msg--loro'">
              <p class="chatbox__testo">{{ msg.testo }}</p>
              <span class="chatbox__ora">{{ soloOra(msg.datainvio) }}</span>
            </div>

          </template>

        </div>

        <div class="chatbox__input-area">
          <textarea v-model="testo" class="chatbox__input" placeholder="Scrivi un messaggio..." rows="1"
            @keydown.enter.exact.prevent="invia" @input="onInput" />
          <button class="chatbox__invia" :disabled="!testo.trim()" @click="invia">
            ➤
          </button>
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
/* -- Variabili e Contenitore -- */

.chatbox {
  --c-primary: #00408A;
  /* Blu Parkly */
  --c-primary-dark: #003070;
  /* Blu scuro per l'hover, in linea con i bottoni */
  --c-bg: #ffffff;
  --c-surface: #f8fafc;
  /* Allineato al grigetto chiaro dei modali */
  --c-border: #e2e8f0;
  --c-text: #0f172a;
  --c-muted: #64748b;
  --c-mio: #e6f0fa;
  /* Un azzurro molto più delicato per le bolle chat */
  --c-loro: #ffffff;
  --c-mio-text: #00408A;
  --radius: 16px;
  /* Aumentato leggermente per riprendere lo stile arrotondato dei componenti */

  border: 1px solid var(--c-border);
  border-radius: var(--radius);
  background: var(--c-bg);
  box-shadow: 0 10px 30px rgba(0, 64, 138, 0.15);
  /* Ombra più morbida e in tema "blu" */
  overflow: hidden;
  font-family: 'Inter', -apple-system, sans-serif;

}

/* Quando è abbassato, l'header ha più respiro */
.chatbox:not(.chatbox--aperta) .chatbox__header-toggle {
  padding-top: 0.75rem;
  padding-bottom: 0.75rem;
}

.chatbox:not(.chatbox--aperta) .chatbox__avatar {
  width: 2rem;
  height: 2rem;
  font-size: 0.9rem;
}

.chatbox:not(.chatbox--aperta) .chatbox__nome {
  font-size: 1rem;
}

.chatbox:not(.chatbox--aperta) .chatbox__ruolo {
  font-size: 0.8rem;
}

/* ── Header ── */
.chatbox__header {
  width: 100%;
  display: flex;
  align-items: stretch;
  background: var(--c-primary);
  color: white;
}

/* Zona toggle: prende tutto lo spazio tranne la X */
.chatbox__header-toggle {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 0.75rem 0.875rem 1.25rem;
  background: transparent;
  color: white;
  border: none;
  cursor: pointer;
  transition: background 0.2s;
  gap: 0.5rem;
}

.chatbox__header-toggle:hover {
  background: rgba(0, 0, 0, 0.12);
}

/* Pulsante X chiudi */
.chatbox__chiudi-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.75);
  font-size: 1rem;
  padding: 0 1rem;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  display: flex;
  align-items: center;
  border-left: 1px solid rgba(255, 255, 255, 0.15);
}

.chatbox__chiudi-btn:hover {
  color: white;
  background: rgba(255, 0, 0, 0.25);
}

.chatbox__header-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.chatbox__avatar {
  width: 2.25rem;
  height: 2.25rem;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  flex-shrink: 0;
}

.chatbox__nome {
  font-weight: 600;
  font-size: 0.95rem;
  margin: 0;
  text-align: left;
}

.chatbox__ruolo {
  font-size: 0.75rem;
  opacity: 0.8;
  margin: 0;
  text-align: left;
}


/* -- Stati di Caricamento ed Errore -- */
.chatbox__stato {
  height: 320px;
  /* Stessa altezza della lista messaggi per evitare sbalzi */
  padding: 2rem;
  text-align: center;
  color: var(--c-muted);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: var(--c-surface);
}

.chatbox__stato--errore {
  color: #ef4444;
}

/* -- Lista messaggi -- */
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
  background: rgba(255, 255, 255, 0.7);
  padding: 8px 16px;
  border-radius: 12px;
}

/* ── Singolo messaggio ── */
.chatbox__msg {
  max-width: 75%;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.4rem 0.6rem 0.2rem 0.6rem;
  border-radius: 8px;
  position: relative;
  box-shadow: 0 1px 2px rgba(15, 76, 129, 0.08);
  /* Ombra fredda */
}

.chatbox__msg--mio {
  align-self: flex-end;
  background: var(--c-mio);
  border-top-right-radius: 0;
}

.chatbox__msg--loro {
  align-self: flex-start;
  background: var(--c-loro);
  border-top-left-radius: 0;
  border: 1px solid #e2e8f0;
  /* Leggerissimo bordo per staccarlo dallo sfondo */
}

.chatbox__testo {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.3;
  word-break: break-word;
  padding-bottom: 0.2rem;
}

.chatbox__msg--mio .chatbox__testo {
  color: var(--c-mio-text);
}

.chatbox__msg--loro .chatbox__testo {
  color: var(--c-text);
}

.chatbox__ora {
  font-size: 0.65rem;
  align-self: flex-end;
  line-height: 1;
}

.chatbox__msg--mio .chatbox__ora {
  color: #7ba2c7;
  /* Azzurro per l'orario sui propri messaggi */
}

.chatbox__msg--loro .chatbox__ora {
  color: var(--c-muted);
}

/* ── Separatore data ── */
.chatbox__separatore {
  display: flex;
  justify-content: center;
  margin: 0.75rem 0;
}

.chatbox__separatore span {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--c-primary);
  /* Data in blu */
  background: #e6f0fa;
  /* Sfondo etichetta in blu chiarissimo */
  padding: 4px 12px;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(15, 76, 129, 0.05);
}

/* -- Input area e Animazioni -- */
.chatbox__input-area {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--c-bg);
  border-top: 1px solid var(--c-border);
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
  max-height: 120px;
  overflow-y: auto;
}

.chatbox__input:focus {
  border-color: var(--c-primary);
}

.chatbox__invia {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  background: var(--c-primary);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s, background 0.2s;
  flex-shrink: 0;
}

.chatbox__invia:hover:not(:disabled) {
  transform: scale(1.07);
  background: var(--c-primary-dark);
}

.chatbox__invia:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}


@keyframes bounce {

  0%,
  60%,
  100% {
    transform: translateY(0);
  }

  30% {
    transform: translateY(-6px);
  }
}

.slide-enter-active,
.slide-leave-active {
  transition: max-height 0.3s ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
}

.slide-enter-to,
.slide-leave-from {
  max-height: 500px;
}
</style>