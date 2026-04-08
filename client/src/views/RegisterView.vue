<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { authStore } from '../store/auth.js' // Importa lo store
import eyeUrl from '../assets/eye-gray.svg'
import eyeClosedUrl from '../assets/eye-closed-gray.svg'

const nome = ref('')
const cognome = ref('')
const cf = ref('')
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
  <div class="register-wrapper">
    <main class="container">
      <div class="row justify-content-center align-items-center min-vh-100">
        <div class="col-12 col-md-8 col-lg-5">
          <div class="register-card">
            <div class="text-center mb-4">
              <img
                src="../assets/Primo_Logo_00408A.svg"
                alt="logo parkly"
                width="100"
                class="mb-3 logo-img"
              />
              <h2 class="fw-bold">Crea il tuo account</h2>
              <p class="text-muted">Unisciti alla community di Parkly</p>
            </div>

            <form @submit.prevent="handleRegister">
              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <input
                    type="text"
                    class="form-control"
                    placeholder="Nome"
                    v-model="nome"
                    required
                  />
                </div>
                <div class="col-md-6">
                  <input
                    type="text"
                    class="form-control"
                    placeholder="Cognome"
                    v-model="cognome"
                    required
                  />
                </div>
              </div>

              <div class="mb-3">
                <input
                  type="text"
                  class="form-control"
                  placeholder="Codice Fiscale (opzionale)"
                  v-model="cf"
                />
              </div>

              <div class="mb-3">
                <input
                  type="email"
                  class="form-control"
                  placeholder="Indirizzo Email"
                  v-model="email"
                  required
                />
              </div>

              <div class="mb-3">
                <input
                  type="tel"
                  class="form-control"
                  placeholder="Telefono (opzionale)"
                  v-model="telefono"
                />
              </div>

              <div class="mb-3">
                <div class="input-group password-group">
                  <input
                    :type="isPasswordVisible1 ? 'text' : 'password'"
                    class="form-control password-field"
                    placeholder="Password"
                    v-model="password"
                    required
                  />
                  <button
                    class="btn toggle-password-btn"
                    type="button"
                    @click="isPasswordVisible1 = !isPasswordVisible1"
                    tabindex="-1"
                  >
                    <img :src="isPasswordVisible1 ? eyeClosedUrl : eyeUrl" class="password-icon" />
                  </button>
                </div>
              </div>

              <div class="mb-4">
                <div class="input-group password-group">
                  <input
                    :type="isPasswordVisible2 ? 'text' : 'password'"
                    class="form-control password-field"
                    placeholder="Ripeti la password"
                    v-model="passwordConfirm"
                    required
                  />
                  <button
                    class="btn toggle-password-btn"
                    type="button"
                    @click="isPasswordVisible2 = !isPasswordVisible2"
                    tabindex="-1"
                  >
                    <img :src="isPasswordVisible2 ? eyeClosedUrl : eyeUrl" class="password-icon" />
                  </button>
                </div>
              </div>

              <div class="d-grid">
                <button type="submit" class="btn btn-primary register-btn">Registrati</button>
              </div>
            </form>

            <div class="text-center mt-4">
              <p class="small text-muted footer-text">
                Effettuando l'accesso accetti i
                <a href="#">Termini e Condizioni</a> e l'
                <a href="#">Informativa sulla Privacy</a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.register-wrapper {
  font-family: 'Inter', sans-serif;
  background: linear-gradient(180deg, #00408a 0%, var(--bg-crema) 100%);
  background-attachment: fixed;
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
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
}

h2 {
  color: #00408a;
  font-size: 26px;
  letter-spacing: -0.5px;
}

.form-control {
  height: 52px;
  border-radius: 12px;
  border: 1px solid #e0e0e0;
  padding: 10px 18px;
  font-size: 15px;
  transition: all 0.2s ease;
}

.form-control:focus {
  border-color: #00408a;
  box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.1);
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
  transition: background-color 0.2s;
}

.register-btn.btn-primary:hover,
.register-btn:hover {
  background-color: #00336e;
  border: none;
}

.register-btn.btn-primary:focus,
.register-btn:focus {
  background-color: #00408a;
  border: none;
  box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.1);
}

.register-btn.btn-primary:active,
.register-btn:active {
  background-color: #00336e !important;
  border: none !important;
  box-shadow: none !important;
}

.footer-text {
  line-height: 1.5;
}

.footer-text a {
  color: #00408a;
  text-decoration: none;
  font-weight: 700;
}

.footer-text a:hover {
  text-decoration: underline;
}

@media (max-width: 576px) {
  .register-card {
    padding: 25px;
    margin: 1rem;
  }
}

.password-group {
  border: 1px solid #dee2e6;
  border-radius: 12px;
  overflow: hidden;
}

.password-group:focus-within {
  border-color: #00408a;
  box-shadow: 0 0 0 3px rgba(0, 64, 138, 0.1);
}

.password-field {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  height: 52px;
}

.toggle-password-btn {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  align-items: center;
}

.password-icon {
  width: 20px;
  height: 20px;
}
</style>
