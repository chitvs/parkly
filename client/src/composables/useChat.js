import { ref, onUnmounted } from 'vue';
import { io } from 'socket.io-client';


const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

let socketInstance = null; // Singleton: una connessione sola per tutta l'app

export function getSocket() {
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

// Chiamato al logout per pulire la connessione
export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

// Composable principale 
export function useChat(idPrenotazione, idDestinatario) {
  const messaggi = ref([]);
  const staCaricando = ref(false);
  const errore = ref(null);
  const socket = getSocket();

  async function caricaStorico() {
    staCaricando.value = true;
    try {
      // L'URL richiede solo idPrenotazione
      const res = await fetch(`${SERVER_URL}/api/messaggi/${idPrenotazione}`, {
        credentials: 'include', //invia cookie sessione
      });
      if (!res.ok) throw new Error('Errore nel caricamento');
      messaggi.value = await res.json();
    } catch (err) {
      errore.value = err.message;
    } finally {
      staCaricando.value = false;
    }
  }

  function inviaMessaggio(testo) {
    if (!testo?.trim()) return;
    socket.emit('invia_messaggio', {
      idDestinatario,
      idPrenotazione, 
      testo: testo.trim(),
    });
  }

  //Filtri socket
  // ── Listener: messaggio in arrivo dal destinatario ────────────────────────
  function onNuovoMessaggio(msg) {
    if (Number(msg.id_prenotazione) === Number(idPrenotazione)) {
      messaggi.value.push(msg);
    }
  }
  // ── Listener: conferma messaggio inviato da noi ───────────────────────────
  function onMessaggioInviato(msg) {
    if (Number(msg.id_prenotazione) === Number(idPrenotazione)) {
      messaggi.value.push(msg);
    }
  }

  socket.on('nuovo_messaggio', onNuovoMessaggio);
  socket.on('messaggio_inviato', onMessaggioInviato);

  onUnmounted(() => {
    socket.off('nuovo_messaggio', onNuovoMessaggio);
    socket.off('messaggio_inviato', onMessaggioInviato);
  });

  caricaStorico();

  return { messaggi, staCaricando, errore, inviaMessaggio };
} 