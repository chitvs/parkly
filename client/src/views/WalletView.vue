<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { authStore } from '../store/auth.js'
import { walletStore } from '../store/wallet.js'
import Header from '../components/Header.vue' 
import Footer from '../components/Footer.vue'

const saldoAttuale = computed(() => {
  return parseFloat(authStore.utente?.saldo || 0)
})
const isLoading = ref(false)
const transazioni = ref([])
const isLoadingTransazioni = ref(false)

const formRicarica = reactive({
  titolare: '',
  numeroCarta: '',
  scadenza: '',
  cvv: '',
  importo: null
})

const fetchTransazioni = async () => {
  isLoadingTransazioni.value = true
  try {
    const response = await walletStore.getTransazioni()
    
    if (response.success && response.data) {
      transazioni.value = response.data.map(tx => ({
        ...tx,
        importo: parseFloat(tx.importo)
      }))
    } else {
      transazioni.value = []
    }
  } catch (error) {
    console.error("Errore nel recupero delle transazioni:", error)
  } finally {
    isLoadingTransazioni.value = false
  }
}

onMounted(async () => {
  await fetchTransazioni()
})

const formattaNumeroCarta = () => {
  let val = formRicarica.numeroCarta.replace(/\D/g, '')
  val = val.replace(/(.{4})/g, '$1 ').trim()
  formRicarica.numeroCarta = val.substring(0, 19)
}

const formattaScadenza = () => {
  let val = formRicarica.scadenza.replace(/\D/g, '')
  if (val.length > 2) {
    val = val.substring(0, 2) + '/' + val.substring(2, 4)
  }
  formRicarica.scadenza = val.substring(0, 5)
}

const formattaCVV = () => {
  formRicarica.cvv = formRicarica.cvv.replace(/\D/g, '').substring(0, 4)
}

const formattaValuta = (valore) => {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(valore)
}

const formattaData = (dataString) => {
  const opzioni = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
  return new Date(dataString).toLocaleDateString('it-IT', opzioni)
}

const handleRicarica = async () => {
  if (formRicarica.importo <= 0 || formRicarica.importo < 5) {
    alert("L'importo minimo per la ricarica è di 5,00 €.")
    return
  }

  isLoading.value = true

  try {
    // 3. USIAMO IL WALLET STORE PER LA RICARICA
    const response = await walletStore.ricaricaSaldo({ 
      importo: parseFloat(formRicarica.importo) 
    })

    if (response.success) {
      saldoAttuale.value = parseFloat(response.nuovoSaldo)
      alert(`Ricarica di ${formattaValuta(formRicarica.importo)} effettuata con successo!`)
      
      formRicarica.titolare = ''
      formRicarica.numeroCarta = ''
      formRicarica.scadenza = ''
      formRicarica.cvv = ''
      formRicarica.importo = null

      await fetchTransazioni()
    } else {
      alert(response.error || "Errore durante la ricarica. Verifica i dati.")
    }
  } catch (error) {
    alert("Errore imprevisto di rete.")
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="page-wrapper">
    <Header />

    <main class="container py-5 flex-grow-1">
      <div class="row justify-content-center mb-4">
        <div class="col-12 col-lg-8">
          <h2 class="fw-bold mb-1 title-color text-center">Il tuo Portafoglio</h2>
          <p class="text-muted mb-4 text-center">Gestisci il tuo saldo e visualizza le tue attività</p>

          <div class="balance-card mb-4 text-center shadow-sm">
            <h5 class="text-white opacity-75 mb-1">Saldo Disponibile</h5>
            <h1 class="display-4 fw-bold text-white mb-0">{{ formattaValuta(saldoAttuale) }}</h1>
          </div>
        </div>
      </div>

      <div class="row justify-content-center g-4">
        
        <div class="col-12 col-lg-5">
          <div class="card border-0 shadow-sm ricarica-card h-100">
            <div class="card-body p-4">
              <h4 class="fw-bold mb-4 title-color border-bottom pb-3">Ricarica Saldo</h4>
              
              <form @submit.prevent="handleRicarica">
                
                <div class="mb-4 bg-light p-3 rounded-3 border">
                  <label class="form-label fw-bold text-primary-dark">Importo da ricaricare (€)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="5" 
                    max="1000"
                    class="form-control form-control-lg amount-input" 
                    v-model="formRicarica.importo" 
                    placeholder="es. 50.00"
                    required
                  >
                  <small class="text-muted">Importo minimo: 5,00 €</small>
                </div>

                <h6 class="fw-semibold mb-3">Dati Carta (Simulazione)</h6>

                <div class="mb-3">
                  <input type="text" class="form-control" v-model="formRicarica.titolare" placeholder="Titolare della Carta" required>
                </div>

                <div class="mb-3">
                  <input 
                    type="text" 
                    class="form-control font-monospace" 
                    v-model="formRicarica.numeroCarta" 
                    @input="formattaNumeroCarta"
                    placeholder="0000 0000 0000 0000" 
                    pattern="[\d\s]{19}"
                    required
                  >
                </div>

                <div class="row g-2 mb-4">
                  <div class="col-6">
                    <input 
                      type="text" 
                      class="form-control text-center font-monospace" 
                      v-model="formRicarica.scadenza" 
                      @input="formattaScadenza"
                      placeholder="MM/YY" 
                      pattern="(0[1-9]|1[0-2])\/[0-9]{2}"
                      required
                    >
                  </div>
                  <div class="col-6">
                    <input 
                      type="text" 
                      class="form-control text-center font-monospace" 
                      v-model="formRicarica.cvv" 
                      @input="formattaCVV"
                      placeholder="CVV" 
                      pattern="[0-9]{3,4}"
                      required
                    >
                  </div>
                </div>

                <div class="d-grid mt-2">
                  <button type="submit" class="btn btn-primary btn-lg" :disabled="isLoading">
                    <span v-if="isLoading" class="spinner-border spinner-border-sm me-2"></span>
                    <span v-else>Conferma Ricarica</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-5">
          <div class="card border-0 shadow-sm ricarica-card h-100">
            <div class="card-body p-4 d-flex flex-column">
              <h4 class="fw-bold mb-4 title-color border-bottom pb-3">Attività Recenti</h4>
              
              <div v-if="isLoadingTransazioni" class="text-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="text-muted mt-2">Caricamento transazioni...</p>
              </div>

              <div v-else-if="transazioni.length === 0" class="text-center py-5 text-muted">
                Nessuna transazione recente.
              </div>

              <div v-else class="transaction-list flex-grow-1 overflow-auto" style="max-height: 400px;">
                <div 
                  v-for="tx in transazioni" 
                  :key="tx.id" 
                  class="transaction-item d-flex justify-content-between align-items-center p-3 mb-2 rounded border"
                >
                  <div class="d-flex align-items-center gap-3">
                    <div 
                      class="icon-box rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                      :class="tx.importo > 0 ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'"
                      style="width: 40px; height: 40px;"
                    >
                      <span v-if="tx.importo > 0">↓</span>
                      <span v-else>↑</span>
                    </div>
                    
                    <div>
                      <h6 class="mb-0 fw-semibold text-truncate" style="max-width: 200px;">{{ tx.descrizione }}</h6>
                      <small class="text-muted">{{ formattaData(tx.data) }}</small>
                    </div>
                  </div>

                  <div 
                    class="fw-bold text-end flex-shrink-0 ms-2"
                    :class="tx.importo > 0 ? 'text-success' : 'text-danger'"
                  >
                    {{ tx.importo > 0 ? '+' : '' }}{{ formattaValuta(tx.importo) }}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </main>

    <Footer />
  </div>
</template>

<style scoped>
.page-wrapper { display: flex; flex-direction: column; min-height: 100vh; background-color: #f8f9fa; }
.title-color { color: var(--primary-blue, #00408A); letter-spacing: -0.5px; }
.text-primary-dark { color: #002d62; }
.form-label { font-size: 14px; color: #495057; margin-bottom: 6px; }

/* Stile Input Condiviso */
.form-control {
  height: 52px; border-radius: 12px; border: 1px solid #E0E0E0;
  padding: 10px 18px; font-size: 15px; transition: all 0.2s ease; background-color: #ffffff;
}
.form-control:focus { border-color: var(--primary-blue, #00408A); box-shadow: 0 0 0 4px rgba(0, 64, 138, 0.1); outline: none; }

.amount-input {
  font-size: 1.25rem;
  font-weight: bold;
  color: #00408A;
  border-color: #ced4da;
}

.font-monospace {
  font-family: 'Courier New', Courier, monospace;
  letter-spacing: 1px;
}

/* Stile Bottoni */
.btn-primary {
  background-color: var(--primary-blue, #00408A); border: none; border-radius: 12px; height: 55px; font-weight: 600; font-size: 16px; transition: all 0.2s;
}
.btn-primary:hover:not(:disabled) { background-color: #00336E; transform: translateY(-1px); }
.btn-primary:active:not(:disabled) { transform: translateY(0); }
.btn-primary:disabled { background-color: #cccccc; cursor: not-allowed; opacity: 0.7; }

/* Custom Component Styles */
.ricarica-card {
  border-radius: 20px;
}

.balance-card {
  background: linear-gradient(135deg, #00408A 0%, #007bff 100%);
  border-radius: 20px;
  padding: 2.5rem 2rem;
  position: relative;
  overflow: hidden;
}

/* Effetto riflesso sulla carta del saldo */
.balance-card::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: rgba(255, 255, 255, 0.1);
  transform: rotate(30deg);
  pointer-events: none;
}

.transaction-list::-webkit-scrollbar {
  width: 6px;
}
.transaction-list::-webkit-scrollbar-track {
  background: #f1f1f1; 
  border-radius: 4px;
}
.transaction-list::-webkit-scrollbar-thumb {
  background: #ccc; 
  border-radius: 4px;
}
.transaction-list::-webkit-scrollbar-thumb:hover {
  background: #999; 
}

.transaction-item {
  background-color: #fff;
  transition: background-color 0.2s;
}
.transaction-item:hover {
  background-color: #f8f9fa;
}

/* Fallback per le classi colorate se Bootstrap non le fornisce */
.bg-success-subtle { background-color: #d1e7dd; }
.text-success { color: #0f5132 !important; }
.bg-danger-subtle { background-color: #f8d7da; }
.text-danger { color: #842029 !important; }
</style>