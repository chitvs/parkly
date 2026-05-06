import { ref, onUnmounted } from 'vue';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

/*SINGLETON SOCKET: Indipendentemente da quante volte chiamiamo getSocket()
  nei vari componenti, useremo sempre la stessa identica connessione */
let socketInstance = null; 

export function getSocket() {
  if (!socketInstance) {
    // Inizializza la connessione solo se non esiste ancora
    socketInstance = io(SERVER_URL, {
      withCredentials: true, // Invia il cookie di sessione per l'autenticazione
      autoConnect: true,
    });

    socketInstance.on('connect_error', (err) => {
      console.error('[Chat] Errore connessione socket:', err.message);
    });
  }
  return socketInstance;
}

// Da chiamare al momento del logout per pulire la connessione
export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

 // Gestisce lo stato e la logica di una singola conversazione.
export function useChat(idPrenotazione, idDestinatario) {
  // Stati reattivi per l'interfaccia
  const messaggi = ref([]);
  const staCaricando = ref(false);
  const errore = ref(null);
  // Recuperiamo l'unica istanza del socket disponibile
  const socket = getSocket();

  async function caricaStorico() {
    staCaricando.value = true;
    try {
      // Chiamata REST API per recuperare i vecchi messaggi dal database
      const res = await fetch(`${SERVER_URL}/api/messaggi/${idPrenotazione}`, {
        credentials: 'include', //invia cookie sessione 
      });
      if (!res.ok) throw new Error('Errore nel caricamento dello storico');
      messaggi.value = await res.json();
    } catch (err) {
      errore.value = err.message;
    } finally {
      staCaricando.value = false;
    }
  }


  function inviaMessaggio(testo) {
    if (!testo?.trim()) return; // Evita l'invio di messaggi vuoti
    
    // Emette l'evento al backend Node.js
    socket.emit('invia_messaggio', {
      idDestinatario,
      idPrenotazione, 
      testo: testo.trim(),
    });
  }

  //Filtri socket
  
  // Quando l'altro utente ci scrive
  function onNuovoMessaggio(msg) {
    // Controllo di sicurezza: aggiungiamo il messaggio solo se appartiene alla chat che stiamo visualizzando
    if (Number(msg.id_prenotazione) === Number(idPrenotazione)) {
      messaggi.value.push(msg);
    }
  }
  
  // Quando il nostro messaggio viene salvato con successo dal server
  function onMessaggioInviato(msg) {
    if (Number(msg.id_prenotazione) === Number(idPrenotazione)) {
      messaggi.value.push(msg);
    }
  }

  // Iscrizione agli eventi Socket
  socket.on('nuovo_messaggio', onNuovoMessaggio);
  socket.on('messaggio_inviato', onMessaggioInviato);

  /*Quando il componente che usa questo composable viene distrutto (es. chiudo il popup),
  dobbiamo rimuovere i listener per evitare memory leaks.*/
  onUnmounted(() => {
    socket.off('nuovo_messaggio', onNuovoMessaggio);
    socket.off('messaggio_inviato', onMessaggioInviato);
  });

  // Appena il composable viene invocato, carica automaticamente la cronologia
  caricaStorico();

  return { messaggi, staCaricando, errore, inviaMessaggio };
}