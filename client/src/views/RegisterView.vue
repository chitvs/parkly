<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import eyeUrl from '../icons/eye-open.svg'
import eyeClosedUrl from '../icons/eye-closed.svg'

import { authStore } from '../store/auth.js'
import { alertStore } from '../store/alert.js'

import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'

// Variabili reattive per tutti i campi del modulo di registrazione
const nome = ref('')
const cognome = ref('')
const cf = ref('')
const nomeUtente = ref('')
const email = ref('')
const telefono = ref('')
const password = ref('')
const passwordConfirm = ref('')

// Variabili di stato per controllare la visibilità delle due password
const isPasswordVisible1 = ref(false)
const isPasswordVisible2 = ref(false)

// Flag per visualizzare i messaggi di errore sulle password
const passwordError = ref(false)

const router = useRouter()

// Funzione asincrona chiamata alla sottomissione del form di registrazione
const handleRegister = async () => {
    // Reset degli errori prima di ogni nuovo tentativo
    passwordError.value = false
    alertStore.pulisci()

    // Validazione base: Controllo campi obbligatori vuoti o contenenti solo spazi
    if (!nome.value.trim() || !cognome.value.trim() || !nomeUtente.value.trim() || !email.value.trim() || !password.value) {
        alertStore.mostra('error', "Compila tutti i campi obbligatori.")
        return
    }

    // Validazione Password: le due password inserite devono essere identiche
    if (password.value !== passwordConfirm.value) {
        passwordError.value = true
        return
    }

    // Validazione Password: lunghezza minima di sicurezza
    if (password.value.length < 5) {
        alertStore.mostra('error', "La password deve contenere almeno 5 caratteri.")
        return
    }

    // Validazione Codice Fiscale (se fornito, dato che è opzionale)
    if (cf.value && cf.value.trim()) {
        // Regex per il formato standard italiano del Codice Fiscale
        const cfRegex = /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/i;
        if (!cfRegex.test(cf.value.trim())) {
            alertStore.mostra('error', "Il formato del Codice Fiscale non è valido")
            return
        }
    }

    // Validazione Telefono (se fornito)
    if (telefono.value && telefono.value.trim()) {
        // Rimuove eventuali spazi o trattini per il controllo regex
        const telPulito = telefono.value.trim().replace(/[\s-]/g, '')
        // Accetta prefissi internazionali opzionali e richiede da 9 a 10 cifre
        const telRegex = /^(\+39|0039)?\d{9,10}$/;
        if (!telRegex.test(telPulito) || telPulito.length > 15) {
            alertStore.mostra('error', "Il numero di telefono non è valido. Inserisci un numero di 9 o 10 cifre.")
            return
        }
    }

    // Creazione del payload da inviare al server. Vengono formattati e puliti i dati.
    const payload = {
        nome: nome.value.trim(),
        cognome: cognome.value.trim(),
        nomeUtente: nomeUtente.value.trim(),
        email: email.value.trim(),
        telefono: telefono.value.trim() || null,
        password: password.value,
        codiceFiscale: cf.value.trim().toUpperCase() || null, // Forza il CF in maiuscolo
    }

    // Chiamata all'API di registrazione tramite lo store
    const data = await authStore.register(payload)

    if (data.success) {
        console.log('Registrazione e login automatico riusciti')
        alertStore.mostra('success', 'Registrazione avvenuta con successo. Benvenuto su Parkly!')

        // Attendiamo un secondo e mezzo per dare tempo all'utente di leggere il messaggio di successo prima del redirect
        setTimeout(() => {
            router.push('/')
        }, 1500)
    } else {
        // Mostra il messaggio di errore proveniente dal backend (es. email già in uso)
        alertStore.mostra('error', data.error || 'Errore durante la registrazione')
    }
}
</script>

<template>
    <div class="page-wrapper">
        <Header />

        <main class="register-main">
            <!-- Sezione hero blu -->
            <div class="register-hero">
                <h1 class="hero-title">Crea il tuo account</h1>
                <p class="hero-sub">Unisciti alla community di Parkly ed esplora le migliori opzioni di parcheggio.</p>
            </div>

            <!-- Card sovrapposta -->
            <div class="container register-card-container">
                <div class="row justify-content-center">
                    <div class="col-12 col-md-10 col-lg-8 col-xl-6">
                        <div class="register-card">
                            <!-- Logo nella card -->
                            <div class="text-center mb-4">
                                <router-link to="/">
                                    <img src="../assets/LogoParklyBlu.svg" alt="logo parkly" width="90"
                                        class="mb-2 logo-img" />
                                </router-link>
                            </div>

                            <!-- Divisore -->
                            <hr class="custom-divider mb-4" />

                            <form @submit.prevent="handleRegister">
                                <!-- Dati Personali -->
                                <h6 class="section-title mb-3"><span class="badge section-badge me-2">1</span> Dati
                                    Personali</h6>

                                <div class="row g-3 mb-3">
                                    <div class="col-md-6">
                                        <input type="text" class="form-control custom-input" id="nome"
                                            placeholder="Nome" v-model="nome" required />
                                    </div>
                                    <div class="col-md-6">
                                        <input type="text" class="form-control custom-input" id="cognome"
                                            placeholder="Cognome" v-model="cognome" required />
                                    </div>
                                </div>

                                <div class="row g-3 mb-4">
                                    <div class="col-md-6">
                                        <input type="text" class="form-control custom-input text-uppercase" id="cf"
                                            placeholder="Codice Fiscale (opzionale)" v-model="cf" maxlength="16" />
                                    </div>
                                    <div class="col-md-6">
                                        <input type="tel" class="form-control custom-input" id="telefono"
                                            placeholder="Telefono (opzionale)" v-model="telefono" maxlength="15" />
                                    </div>
                                </div>

                                <!-- Dati Account -->
                                <h6 class="section-title mb-3 mt-4"><span class="badge section-badge me-2">2</span> Dati
                                    Account</h6>

                                <div class="row g-3 mb-3">
                                    <div class="col-md-6">
                                        <input type="text" class="form-control custom-input" id="nomeUtente"
                                            placeholder="Nome Utente" v-model="nomeUtente" required />
                                    </div>
                                    <div class="col-md-6">
                                        <input type="email" class="form-control custom-input" id="email"
                                            placeholder="Indirizzo Email" v-model="email" required />
                                    </div>
                                </div>

                                <div class="row g-3 mb-4">
                                    <div class="col-md-6">
                                        <div class="input-group password-group"
                                            :class="{ 'is-invalid-group': passwordError }">
                                            <input :type="isPasswordVisible1 ? 'text' : 'password'"
                                                class="form-control password-field custom-input" id="password"
                                                placeholder="Password" v-model="password" required />
                                            <button class="btn toggle-password-btn" type="button"
                                                @click="isPasswordVisible1 = !isPasswordVisible1" tabindex="-1">
                                                <img :src="isPasswordVisible1 ? eyeClosedUrl : eyeUrl"
                                                    class="password-icon" alt="Toggle Password" />
                                            </button>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="input-group password-group"
                                            :class="{ 'is-invalid-group': passwordError }">
                                            <input :type="isPasswordVisible2 ? 'text' : 'password'"
                                                class="form-control password-field custom-input" id="passwordConfirm"
                                                placeholder="Ripeti Password" v-model="passwordConfirm" required />
                                            <button class="btn toggle-password-btn" type="button"
                                                @click="isPasswordVisible2 = !isPasswordVisible2" tabindex="-1">
                                                <img :src="isPasswordVisible2 ? eyeClosedUrl : eyeUrl"
                                                    class="password-icon" alt="Toggle Password" />
                                            </button>
                                        </div>
                                    </div>
                                    <div v-if="passwordError" class="col-12 mt-1">
                                        <small class="text-danger ms-1">Le password non corrispondono!</small>
                                    </div>
                                </div>

                                <div class="d-grid mt-4 pt-2">
                                    <button type="submit" class="btn btn-primary register-btn">
                                        Crea Account
                                    </button>
                                </div>
                            </form>

                            <div class="text-center mt-4 pt-3 border-top">
                                <p class="small text-muted footer-text mb-0">
                                    Effettuando la registrazione accetti i Termini e Condizioni e l'Informativa sulla
                                    Privacy di Parkly.
                                </p>
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
.page-wrapper {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}

.register-main {
    flex: 1;
    background: #ffffff;
}

.register-hero {
    background: radial-gradient(circle at center, #002d5e 0%, #001D3D 100%);
    color: #ffffff;
    text-align: center;
    padding: 3rem 2rem 16rem;
}

.hero-title {
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    margin-bottom: 0.6rem;
}

.hero-sub {
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.65);
    max-width: 480px;
    margin: 0 auto;
    line-height: 1.6;
}

.register-card-container {
    margin-top: -14rem;
    position: relative;
    z-index: 10;
    padding-bottom: 3rem;
}

.register-card {
    background: var(--white);
    border-radius: 24px;
    border: none;
    padding: 40px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    margin: 2rem 0;
}

.logo-img {
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    transition: transform 0.3s ease;
}

.logo-img:hover {
    transform: scale(1.05);
}

.title-text {
    color: #00408a;
    font-size: 26px;
    letter-spacing: -0.5px;
    margin-bottom: 8px;
}

.subtitle-text {
    font-size: 0.95rem;
}

.custom-divider {
    border-color: #e2e8f0;
    opacity: 1;
}

.section-title {
    color: #1e293b;
    font-weight: 600;
    font-size: 1.05rem;
    display: flex;
    align-items: center;
}

.section-badge {
    background-color: rgba(0, 64, 138, 0.1);
    color: #00408a;
    font-size: 0.85rem;
    padding: 0.4em 0.6em;
    border-radius: 8px;
}

.custom-input {
    border-radius: 12px;
    border: 1px solid #e0e0e0;
    background-color: #f8fafc;
    transition: all 0.2s ease;
    height: 52px;
    font-size: 15px;
    padding: 10px 18px;
}

.custom-input:focus {
    border-color: #00408a;
    box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.1);
    background-color: #ffffff;
    outline: none;
}

.register-btn.btn-primary,
.register-btn {
    background-color: #00408a;
    border: none;
    height: 52px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1.1rem;
    color: white;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 64, 138, 0.2);
}

.register-btn:hover {
    background-color: #00336e;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 64, 138, 0.3);
}

.register-btn:active {
    background-color: #00224a !important;
    transform: translateY(0);
}

.footer-text {
    line-height: 1.6;
}

.footer-text a,
.login-link {
    color: #00408a;
    text-decoration: none;
    font-weight: 600;
    transition: color 0.2s;
}

.footer-text a:hover,
.login-link:hover {
    text-decoration: underline;
    color: #00224a;
}

.password-group {
    position: relative;
}

.password-field {
    padding-right: 45px;
}

.toggle-password-btn {
    position: absolute;
    right: 5px;
    top: 50%;
    transform: translateY(-50%);
    border: none;
    background: transparent;
    padding: 5px;
    z-index: 10;
    cursor: pointer;
}

.toggle-password-btn:focus {
    box-shadow: none;
    outline: none;
}

.is-invalid-group .custom-input {
    border-color: #dc3545;
}

@media (max-width: 768px) {
    .register-card {
        padding: 25px 20px;
        margin: 1rem 0;
        border-radius: 20px;
    }

    .title-text {
        font-size: 22px;
    }

    .custom-input {
        font-size: 16px;
    }
}
</style>