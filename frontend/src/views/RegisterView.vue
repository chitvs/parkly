<script setup>
import { ref } from 'vue'
// Se usi Vue Router per cambiare pagina, importa useRouter
// import { useRouter } from 'vue-router' 

const nome = ref('')
const cognome = ref('')
const cf = ref('')
const email = ref('')
const telefono = ref('')
const password = ref('')
const passwordConfirm = ref('')

// const router = useRouter() // Inizializza il router

const handleRegister = async () => {
  if (password.value !== passwordConfirm.value) {
    alert("Le password non corrispondono!")
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

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.success) {
      alert("Account creato con successo!");
      // In Vue si usa il router invece di window.location
      // router.push('/') 
      window.location.href = "/"; 
    } else {
      alert("Errore: " + (data.error || "Riprova più tardi"));
    }
  } catch (err) {
    console.error("Errore fetch:", err);
    alert("Errore di connessione al server");
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
              <img src="../assets/Primo_Logo_00408A.svg" alt="logo parkly" width="100" class="mb-3 logo-img">
              <h2 class="fw-bold">Crea il tuo account</h2>
              <p class="text-muted">Unisciti alla community di Parkly</p>
            </div>

            <form @submit.prevent="handleRegister">
              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <input type="text" class="form-control" placeholder="Nome" v-model="nome" required>
                </div>
                <div class="col-md-6">
                  <input type="text" class="form-control" placeholder="Cognome" v-model="cognome" required>
                </div>
              </div>

              <div class="mb-3">
                <input type="text" class="form-control" placeholder="Codice Fiscale (opzionale)" v-model="cf">
              </div>

              <div class="mb-3">
                <input type="email" class="form-control" placeholder="Indirizzo Email" v-model="email" required>
              </div>

              <div class="mb-3">
                <input type="tel" class="form-control" placeholder="Telefono (opzionale)" v-model="telefono">
              </div>

              <div class="mb-3">
                <input type="password" class="form-control" placeholder="Password" v-model="password" required>
              </div>

              <div class="mb-4">
                <input type="password" class="form-control" placeholder="Ripeti la password" v-model="passwordConfirm" required>
              </div>

              <div class="d-grid">
                <button type="submit" class="btn btn-primary btn-lg">Registrati</button>
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
/* Import del font */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

.register-wrapper {
  font-family: 'Inter', sans-serif;
  /* Gradient Parkly: dal blu scuro al crema */
  background: linear-gradient(180deg, #00408A 0%, #fffdf2 100%);
  background-attachment: fixed;
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
}

.register-card {
  background: #ffffff;
  border-radius: 24px; /* Arrotondamento moderno */
  border: none;
  padding: 40px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
  margin: 2rem 0;
}

.logo-img {
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
}

h2 {
  color: #00408A;
  font-size: 26px;
  letter-spacing: -0.5px;
}

/* Stilizzazione Input */
.form-control {
  height: 52px;
  border-radius: 12px;
  border: 1px solid #E0E0E0;
  padding: 10px 18px;
  font-size: 15px;
  transition: all 0.2s ease;
}

.form-control:focus {
  border-color: #00408A;
  box-shadow: 0 0 0 4px rgba(0, 64, 138, 0.1);
  outline: none;
}

/* Bottone Parkly */
.btn-primary {
  background-color: #00408A;
  border: none;
  border-radius: 12px;
  height: 55px;
  font-weight: 600;
  font-size: 16px;
  transition: transform 0.2s, background-color 0.2s;
}

.btn-primary:hover {
  background-color: #00336E;
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
}

/* Link footer */
.footer-text {
  line-height: 1.5;
}

.footer-text a {
  color: #00408A;
  text-decoration: none;
  font-weight: 600;
}

.footer-text a:hover {
  text-decoration: underline;
}

/* Responsive adjustments */
@media (max-width: 576px) {
  .register-card {
    padding: 25px;
    margin: 1rem;
  }
}
</style>