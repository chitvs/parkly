// Usa sessione cookie (niente JWT), coerente con il resto del progetto

import { ref, onUnmounted } from 'vue';
import { io } from 'socket.io-client';


const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

let socketInstance = null; // Singleton: una connessione sola per tutta l'app

function getSocket() {
  if (!socketInstance) {
    socketInstance = io(SERVER_URL, {
      withCredentials: true, // invia il cookie di sessione automaticamente
      autoConnect: true,
    });

    socketInstance.on('connect_error', (err) => {
      console.error('[Chat] Errore connessione socket:', err.message);
    });
  }
  return socketInstance;
}

// Chiama questo al logout per pulire la connessione
export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

// ─── Composable principale ────────────────────────────────────────────────────
export function useChat(idGarage, idDestinatario) {
  

  const messaggi = ref([]);
  const staCaricando = ref(false);
  const errore = ref(null);
  const destinatarioStaScrivendo = ref(false);

  let scrittura_timeout = null;

  const socket = getSocket();

  // ── Carica storico via REST ───────────────────────────────────────────────
  async function caricaStorico() {
    staCaricando.value = true;
    errore.value = null;
    try {
      const res = await fetch(`${SERVER_URL}/api/messaggi/${idGarage}`, {
        credentials: 'include', // invia cookie sessione
      });
      if (!res.ok) throw new Error('Errore nel caricamento dei messaggi');
      messaggi.value = await res.json();
    } catch (err) {
      errore.value = err.message;
    } finally {
      staCaricando.value = false;
    }
  }

  // ── Invia messaggio via socket ────────────────────────────────────────────
  function inviaMessaggio(testo) {
    if (!testo?.trim()) return;
    socket.emit('invia_messaggio', {
      idDestinatario,
      idGarage,
      testo: testo.trim(),
    });
  }

  // ── Segnala "sta scrivendo" ───────────────────────────────────────────────
  function segnalaScrittura() {
    socket.emit('sta_scrivendo', { idDestinatario, idGarage });
  }

  // ── Listener: messaggio in arrivo dal destinatario ────────────────────────
  function onNuovoMessaggio(msg) {
    if (
      parseInt(msg.id_garage) === parseInt(idGarage) &&
      (parseInt(msg.id_mittente) === parseInt(idDestinatario) ||
        parseInt(msg.id_destinatario) === parseInt(idDestinatario))
    ) {
      messaggi.value.push(msg);
    }
  }

  // ── Listener: conferma messaggio inviato da noi ───────────────────────────
  function onMessaggioInviato(msg) {
    if (parseInt(msg.id_garage) === parseInt(idGarage)) {
      messaggi.value.push(msg);
    }
  }

  // ── Listener: destinatario sta scrivendo ─────────────────────────────────
  function onStaScrivendo({ idMittente, idGarage: gId }) {
    if (
      parseInt(idMittente) === parseInt(idDestinatario) &&
      parseInt(gId) === parseInt(idGarage)
    ) {
      destinatarioStaScrivendo.value = true;
      clearTimeout(scrittura_timeout);
      scrittura_timeout = setTimeout(() => {
        destinatarioStaScrivendo.value = false;
      }, 2500);
    }
  }

  socket.on('nuovo_messaggio', onNuovoMessaggio);
  socket.on('messaggio_inviato', onMessaggioInviato);
  socket.on('utente_sta_scrivendo', onStaScrivendo);

  onUnmounted(() => {
    socket.off('nuovo_messaggio', onNuovoMessaggio);
    socket.off('messaggio_inviato', onMessaggioInviato);
    socket.off('utente_sta_scrivendo', onStaScrivendo);
    clearTimeout(scrittura_timeout);
  });

  caricaStorico();

  return {
    messaggi,
    staCaricando,
    errore,
    destinatarioStaScrivendo,
    inviaMessaggio,
    segnalaScrittura,
    caricaStorico,
  };
}