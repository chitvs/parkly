<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../store/auth.js'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'

const router = useRouter()
const isLoading = ref(false)
const errorMessage = ref('')

const confirmUpgrade = async () => {
    isLoading.value = true
    errorMessage.value = ''

    const result = await authStore.upgradeToGestore()

    if (result.success) {
        router.replace('/')
    } else {
        errorMessage.value = result.error
    }

    isLoading.value = false
}
</script>

<template>
    <div class="page-wrapper">
        <Header />

        <main class="main-content d-flex align-items-center justify-content-center">
            <div class="centered-container text-center" style="max-width: 600px; width: 100%;">

                <div class="page-header mb-4">
                    <h1>Diventa Gestore</h1>
                    <p class="subtitle mt-2" style="font-size: 1.1rem;">
                        Sblocca le funzionalità avanzate di Parkly. Aggiungi i tuoi garage, gestisci le prenotazioni e
                        monitora i tuoi guadagni.
                    </p>
                </div>

                <div v-if="errorMessage" class="alert error mb-4">
                    {{ errorMessage }}
                </div>

                <div class="form-card text-center p-5">
                    <div class="mb-4">
                        <img src="../assets/LogoParklyBlu.svg" style="height: 70px; width: auto;">
                    </div>
                    <h3 class="mb-4" style="color: var(--deep-blue, #00204A); font-weight:700;">Sei pronto a iniziare?</h3>
                    <br>
                    <button @click="confirmUpgrade" class="btn-primary w-100" style="height: 52px; font-size: 1.1rem;"
                        :disabled="isLoading">
                        <span v-if="isLoading" class="spinner-border spinner-border-sm me-2" role="status"
                            aria-hidden="true"></span>
                        Conferma e diventa Gestore
                    </button>

                    <p class="text-muted mb-4 mt-3" style="font-size: 0.95rem;">
                        L'operazione di upgrade è immediata. Potrai subito iniziare a inserire i tuoi parcheggi e
                        ricevere prenotazioni.
                    </p>

                    
                </div>

            </div>
        </main>

        <Footer />
    </div>
</template>

<style scoped>
.page-wrapper {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-color: var(--bg-light, #F5F5F3);
    font-family: 'Inter', -apple-system, sans-serif;
}

.main-content {
    flex: 1;
    padding: 40px 20px;
}

.page-header h1 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--deep-blue, #00204A);
    margin-bottom: 8px;
}

.subtitle {
    color: #666;
}

.form-card {
    background: #fff;
    border: 0.5px solid #E8E8E8;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.03);
}

.alert {
    text-align: left;
}

.btn-primary {
    background: #00408A;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
}

.btn-primary:hover:not(:disabled) {
    background: #00204A;
    transform: translateY(-1px);
}

.btn-primary:disabled {
    background: #ccc;
    cursor: not-allowed;
}
</style>