<script setup>
// cervello del sito 
import { RouterLink } from 'vue-router'
</script>

<template>
  <footer class="main-footer">
    <div class="footer-content">
        <!-- Footer Brand contiene il nome del sito -->   
      <div class="footer-brand">
        <h3 class="brand-name">Parkly</h3>

<!-- qua possiamo mettere uno slogan o un qualcosa di simile -->
      </div>
      <div class="footer-links">
        <h4>Esplora</h4>
        <ul>
          <li><RouterLink to="/">Home</RouterLink></li>
          <li><RouterLink to="/garage">Mappa Garage</RouterLink></li>
          <li><RouterLink to="/login">Accedi / Registrati</RouterLink></li>
        </ul>
      </div>
      <div class="footer-legal">
        <h4>Info</h4>
        <ul>
            <!-- Questi link li ho messi per farli il più simile a booking -->
          <li><a href="#">Privacy Policy</a></li>
          <li><a href="#">Termini di Servizio</a></li>
          <li><a href="#">Supporto</a></li>
        </ul>
      </div>
    </div>
    <!-- Footer Bottom -->
    <div class="footer-bottom">
      <p>&copy; 2026 Parkly. Tutti i diritti riservati.</p>
    </div>
  </footer>
</template>

<style scoped>

.main-footer {
  background-color: #2c3e50;
  color: #ecf0f1;
  padding: 3rem 5% 1rem;
  font-family: 'Inter', 'Segoe UI', sans-serif;
  margin-top: auto; 
}
/* Footer Content = per lo smartphone */
.footer-content {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 2rem;
  margin-bottom: 2rem;
}
.footer-brand, .footer-links, .footer-legal {
  flex: 1;
  min-width: 200px;
}
.brand-name {
  color: #2e3ecc;
  font-size: 1.8rem;
  margin-bottom: 0.5rem;
}
.brand-slogan {
  color: #bdc3c7;
  font-size: 0.95rem;
}
/* */
h4 {
  color: #ffffff;
  margin-bottom: 1rem;
  font-size: 1.1rem;
}
/*serve a creare le liste*/
ul {
  list-style: none;
  padding: 0;
}
/*Il tag <li> (List Item) rappresenta la singola riga*/
ul li {
  margin-bottom: 0.5rem;
}
ul a {
  color: #bdc3c7;
  text-decoration: none;
  transition: color 0.3s ease;
}
ul a:hover {
  color: #2e3ecc;
}
.footer-bottom {
  text-align: center;
  padding-top: 1.5rem;
  border-top: 1px solid #34495e;
  color: #7f8c8d;
  font-size: 0.85rem;
}
</style>