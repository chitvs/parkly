<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../store/auth.js'
import eyeUrl from '../assets/eye-gray.svg'
import eyeClosedUrl from '../assets/eye-closed-gray.svg'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'

const nome = ref('')
const cognome = ref('')
const cf = ref('')
const nomeUtente = ref('')
const email = ref('')
const telefono = ref('')
const password = ref('')
const passwordConfirm = ref('')
const isPasswordVisible1 = ref(false)
const isPasswordVisible2 = ref(false)

const router = useRouter()

const handleRegister = async () => {
  if (password.value !== passwordConfirm.value) {
    alert('Le password non corrispondono!')
    return
  }

  const payload = {
    nome: nome.value,
    cognome: cognome.value,
    nomeUtente: nomeUtente.value,
    email: email.value,
    telefono: telefono.value || null,
    password: password.value,
    codiceFiscale: cf.value || null,
  }

  const data = await authStore.register(payload)

  if (data.success) {
    console.log('Registrazione e login automatico riusciti')
    alert('Registrazione avvenuta con successo.')
    router.push('/')
  } else {
    alert(data.error || 'Errore durante la registrazione')
  }
}
</script>

<template>
  <div class="page-wrapper">
    <Header />

    <main class="register-main">
      <div class="container py-5">
        <div class="row justify-content-center">
          <div class="col-12 col-md-10 col-lg-8 col-xl-6">
            <div class="register-card">
              <!-- Header della card -->
              <div class="text-center mb-4">
                <router-link to="/">
                  <img
                    src="../assets/Primo_Logo_00408A.svg"
                    alt="logo parkly"
                    width="110"
                    class="mb-3 logo-img"
                  />
                </router-link>
                <h2 class="fw-bold title-text">Crea il tuo account</h2>
                <p class="text-muted subtitle-text">Unisciti alla community di Parkly ed esplora le migliori opzioni di parcheggio.</p>
              </div>

              <!-- Divisore -->
              <hr class="custom-divider mb-4">

              <form @submit.prevent="handleRegister">
                <!-- Dati Personali -->
                <h6 class="section-title mb-3"><span class="badge section-badge me-2">1</span> Dati Personali</h6>
                
                <div class="row g-3 mb-3">
                  <div class="col-md-6">
                    <div class="form-floating">
                      <input type="text" class="form-control custom-input" id="nome" placeholder="Nome" v-model="nome" required />
                      <label for="nome">Nome</label>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-floating">
                      <input type="text" class="form-control custom-input" id="cognome" placeholder="Cognome" v-model="cognome" required />
                      <label for="cognome">Cognome</label>
                    </div>
                  </div>
                </div>

                <div class="row g-3 mb-4">
                  <div class="col-md-6">
                    <div class="form-floating">
                      <input type="text" class="form-control custom-input" id="cf" placeholder="Codice Fiscale" v-model="cf" />
                      <label for="cf">Codice Fiscale (opzionale)</label>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-floating">
                      <input type="tel" class="form-control custom-input" id="telefono" placeholder="Telefono" v-model="telefono" />
                      <label for="telefono">Telefono (opzionale)</label>
                    </div>
                  </div>
                </div>

                <!-- Dati Account -->
                <h6 class="section-title mb-3 mt-4"><span class="badge section-badge me-2">2</span> Dati Account</h6>

                <div class="row g-3 mb-3">
                  <div class="col-md-6">
                    <div class="form-floating">
                      <input type="text" class="form-control custom-input" id="nomeUtente" placeholder="Nome Utente" v-model="nomeUtente" required />
                      <label for="nomeUtente">Nome Utente</label>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-floating">
                      <input type="email" class="form-control custom-input" id="email" placeholder="Indirizzo Email" v-model="email" required />
                      <label for="email">Indirizzo Email</label>
                    </div>
                  </div>
                </div>

                <div class="row g-3 mb-4">
                  <div class="col-md-6">
                    <div class="form-floating position-relative">
                      <input :type="isPasswordVisible1 ? 'text' : 'password'" class="form-control custom-input pe-5" id="password" placeholder="Password" v-model="password" required />
                      <label for="password">Password</label>
                      <button class="btn toggle-password-btn" type="button" @click="isPasswordVisible1 = !isPasswordVisible1" tabindex="-1">
                        <img :src="isPasswordVisible1 ? eyeClosedUrl : eyeUrl" class="password-icon" />
                      </button>
                    </div>
                  </div>
                  <div class="col-md-6">
                    <div class="form-floating position-relative">
                      <input :type="isPasswordVisible2 ? 'text' : 'password'" class="form-control custom-input pe-5" id="passwordConfirm" placeholder="Ripeti Password" v-model="passwordConfirm" required />
                      <label for="passwordConfirm">Ripeti Password</label>
                      <button class="btn toggle-password-btn" type="button" @click="isPasswordVisible2 = !isPasswordVisible2" tabindex="-1">
                        <img :src="isPasswordVisible2 ? eyeClosedUrl : eyeUrl" class="password-icon" />
                      </button>
                    </div>
                  </div>
                </div>

                <div class="d-grid mt-4 pt-2">
                  <button type="submit" class="btn btn-primary register-btn">
                    Crea Account
                  </button>
                </div>
              </form>

              <div class="text-center mt-4 pt-3 border-top">
                <p class="small text-muted footer-text mb-2">
                  Hai già un account? 
                  <a href="#" @click.prevent="$router.push('/')" class="fw-bold login-link">Torna alla Home per accedere</a>
                </p>
                <p class="small text-muted footer-text mb-0">
                  Effettuando la registrazione accetti i
                  <a href="#">Termini e Condizioni</a> e l'
                  <a href="#">Informativa sulla Privacy</a>
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
  height: 58px;
  font-size: 15px;
}

.custom-input:focus {
  border-color: #00408a;
  box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.1);
  background-color: #ffffff;
  outline: none;
}

.form-floating > label {
  color: #64748b;
  padding-left: 1rem;
}

.form-floating > .form-control:focus ~ label,
.form-floating > .form-control:not(:placeholder-shown) ~ label {
  color: #00408a;
  font-weight: 500;
  opacity: 0.9;
}

.toggle-password-btn {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  z-index: 10;
  padding: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.toggle-password-btn:hover {
  background-color: rgba(0, 0, 0, 0.05) !important;
}

.password-icon {
  width: 20px;
  height: 20px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.toggle-password-btn:hover .password-icon {
  opacity: 0.9;
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
    font-size: 16px; /* evita zoom automatico su iOS */
  }
}
</style>
