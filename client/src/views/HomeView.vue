<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'
import SearchBar from '../components/SearchBar.vue'
import 'bootstrap-icons/font/bootstrap-icons.css'

const router = useRouter()

const searchLocation = ref('')
const checkIn = ref('')
const checkOut = ref('')

const randomGarages = ref([])

onMounted(() => {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual'
    }
    setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }, 10)
    
    fetchRandomGarages()
})

const fetchRandomGarages = async () => {
    try {
        const response = await fetch('/api/garage')
        const data = await response.json()

        if (data.success && data.garage && data.garage.length > 0) {
            const shuffled = data.garage.sort(() => 0.5 - Math.random())
            const selected = shuffled.slice(0, 8)

            randomGarages.value = selected.map(g => ({
                id: g.id_garage,
                nome: g.nome,
                indirizzo: g.indirizzo,
                tariffa: Number(g.tariffabase || 0).toFixed(2)
            }))
        }
    } catch (error) {
        console.error("Errore nel caricamento dei garage in evidenza:", error)
    }
}

const handleSearch = () => {
    router.push({
        name: 'garage',
        query: {
            location: searchLocation.value,
            checkIn: checkIn.value,
            checkOut: checkOut.value
        }
    })
}

const goToGarage = (id) => {
    router.push(`/garage/${id}`) 
}

const steps = [
    { num: '01', icon: 'bi-geo-alt', title: 'Cerca', desc: 'Inserisci la destinazione e l\'orario. Vedi tutti i garage disponibili su mappa.' },
    { num: '02', icon: 'bi-grid-3x3-gap', title: 'Scegli il posto', desc: 'Seleziona un garage e dalla planimetria interattiva il posto più adatto al tuo veicolo.' },
    { num: '03', icon: 'bi-wallet2', title: 'Paga', desc: 'Addebito sul tuo portafoglio Parkly.' },
    { num: '04', icon: 'bi-patch-check', title: 'Parcheggia', desc: 'Il posto è tuo. Ricevi il ticket, entra e parti tranquillo.' },
]

const features = [
    { icon: 'bi-map', title: 'Mappa interattiva', desc: 'Visualizza garage e disponibilità in tempo reale, filtrabili per tipo veicolo e servizi.' },
    { icon: 'bi-lightning-charge', title: 'Prenotazione immediata', desc: 'Lock atomico sul posto: nessun doppio booking. Il tuo posto è garantito.' },
    { icon: 'bi-credit-card', title: 'Portafoglio integrato', desc: 'Ricarica tra 5€ e 1000€. Ogni transazione registrata, rimborsi automatici.' },
    { icon: 'bi-chat-dots', title: 'Chat con il gestore', desc: 'Messaggistica in tempo reale via Socket.IO, privata per ogni prenotazione.' },
    { icon: 'bi-ev-station', title: 'Ricarica elettrica', desc: 'Filtra i garage con colonnine EV. Parcheggi e ricarichi allo stesso tempo.' },
    { icon: 'bi-shield-check', title: 'Recensioni verificate', desc: 'Solo prenotazioni completate possono generare una recensione.' },
]
</script>

<template>
    <div class="home-wrapper">
        <Header />

        <main class="main-content">

            <section class="hero-header">
                <div class="hero-text">
                    <h1>Sostare non è mai stato così <span class="highlight">semplice</span>.</h1>
                    <p>La piattaforma intelligente per prenotare il tuo posto auto con semplicità, chiarezza e velocità.</p>
                </div>
            </section>

            <section class="search-container">
                <SearchBar v-model:location="searchLocation" v-model:checkIn="checkIn" v-model:checkOut="checkOut"
                    :showSubmitButton="true" @search="handleSearch" />
            </section>

            <section class="how">
                <div class="section-inner">
                    <p class="eyebrow">Come funziona</p>
                    <h2 class="section-title">Dalla ricerca al posto.</h2>
                    <div class="steps-grid">
                        <div class="step" v-for="s in steps" :key="s.num">
                            <div class="step-num">{{ s.num }}</div>
                            <i :class="`bi ${s.icon} step-icon`"></i>
                            <h3>{{ s.title }}</h3>
                            <p>{{ s.desc }}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section class="features">
                <div class="section-inner">
                    <p class="eyebrow">Perché Parkly</p>
                    <h2 class="section-title">Le nostre funzionalità.</h2>
                    <div class="features-grid">
                        <div class="feat" v-for="f in features" :key="f.title">
                            <div class="feat-icon-wrap"><i :class="`bi ${f.icon}`"></i></div>
                            <h3>{{ f.title }}</h3>
                            <p>{{ f.desc }}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section class="gallery-section" v-if="randomGarages.length > 0">
                <div class="section-inner">
                    <p class="eyebrow">Esplora</p>
                    <h2 class="section-title">I nostri garage in evidenza.</h2>
                
                    <div class="gallery-scroll-container">
                        <div class="gallery-track">
                            <div class="garage-card" v-for="g in randomGarages" :key="g.id" @click="goToGarage(g.id)">
                                <div class="garage-img-placeholder">
                                    <i class="bi bi-car-front-fill"></i>
                                </div>
                                <div class="garage-info">
                                    <h4>{{ g.nome }}</h4>
                                    <p class="garage-addr"><i class="bi bi-geo-alt"></i> {{ g.indirizzo }}</p>
                                    <p class="garage-price">Da <strong>{{ g.tariffa }}€</strong> / ora</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div class="cta-wrap">
                <div class="cta">
                    <div class="cta-text">
                        <h2>Hai un garage? Mettilo a reddito.</h2>
                        <p>Pubblica i tuoi posti su Parkly. Dashboard con occupazione in tempo reale, statistiche
                            mensili, pagamenti automatici.</p>
                    </div>
                    <RouterLink to="/diventa-gestore" class="cta-btn">Diventa gestore →</RouterLink>
                </div>
            </div>

        </main>

        <Footer />
    </div>
</template>

<style scoped>
.home-wrapper {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-color: #ffffff;
    font-family: 'Inter', -apple-system, sans-serif;
}

.main-content {
    flex: 1;
}

.hero-header {
    position: relative;
    background-color: #001D3D;
    background: radial-gradient(circle at center, #002d5e 0%, #001D3D 100%);
    color: #ffffff;
    padding: 6rem 2rem 10rem 2rem;
    text-align: center;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
}

.hero-text {
    position: relative;
    z-index: 2;
    max-width: 820px;
}

.hero-text h1 {
    font-size: clamp(2.4rem, 5.5vw, 3.6rem);
    font-weight: 700;
    margin-bottom: 1rem;
    line-height: 1.1;
    letter-spacing: -0.04em;
}

.highlight {
    color: #60a5fa;
}

.hero-text p {
    font-size: 1.1rem;
    color: rgba(255, 255, 255, 0.6);
    max-width: 600px;
    margin: 0 auto;
    line-height: 1.6;
}

.search-container {
    max-width: 1050px;
    margin: 0 auto;
    padding: 0 1rem;
    margin-top: -4.5rem;
    position: relative;
    z-index: 10;
}

.section-inner {
    max-width: 1050px;
    margin: 0 auto;
    padding: 0 1rem;
}

.eyebrow {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #00408a;
    margin-bottom: 10px;
}

.section-title {
    font-size: clamp(1.8rem, 3.5vw, 2.5rem);
    font-weight: 700;
    color: #080808;
    margin-bottom: 40px;
    letter-spacing: -0.03em;
}

.how {
    padding: 80px 0;
}

.steps-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
}

.step {
    background: #f8fafc;
    padding: 30px;
    border-radius: 16px;
}

.step-num {
    font-size: 11px;
    font-weight: 700;
    color: #00408a;
    opacity: 0.5;
    margin-bottom: 16px;
}

.step-icon {
    font-size: 26px;
    color: #00408a;
    margin-bottom: 16px;
    display: block;
}

.step h3 {
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 8px;
}

.step p {
    font-size: 13px;
    color: #64748b;
    line-height: 1.6;
}

.features {
    padding: 0 0 60px 0;
}

.features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
}

.feat {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    padding: 30px;
    border-radius: 16px;
}

.feat-icon-wrap {
    width: 40px;
    height: 40px;
    background: #eff6ff;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #00408a;
    font-size: 20px;
    margin-bottom: 16px;
}

.feat h3 {
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 8px;
}

.feat p {
    font-size: 13px;
    color: #64748b;
    line-height: 1.6;
}

.gallery-section {
    padding: 20px 0 80px 0;
}

.gallery-scroll-container {
    width: 100%;
    overflow-x: auto;
    padding: 10px 0 40px 0; 
    scroll-behavior: smooth;
    -ms-overflow-style: none;
    scrollbar-width: none;
    scroll-snap-type: x mandatory;
}

.gallery-scroll-container::-webkit-scrollbar {
    display: none;
}

.gallery-track {
    display: flex;
    gap: 1.5rem;
}

.garage-card {
    width: 280px;
    flex-shrink: 0; 
    background: #ffffff;
    border: 1px solid #cbd5e1; 
    border-radius: 16px;
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s;
    cursor: pointer;
    scroll-snap-align: start; 
}

.garage-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 25px rgba(0,0,0,0.08);
}

.garage-img-placeholder {
    height: 160px;
    background: #eef2f6;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    font-size: 2rem;
    border-bottom: 1px solid #cbd5e1; 
}

.garage-info {
    padding: 16px 20px;
}

.garage-info h4 {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 6px;
    color: #0f172a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.garage-addr {
    font-size: 13px;
    color: #64748b;
    margin-bottom: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.garage-price {
    font-size: 14px;
    color: #00408a;
}

.cta-wrap {
    padding: 0 1rem 80px;
}

.cta {
    max-width: 1050px;
    margin: 0 auto;
    background: linear-gradient(135deg, #001D3D 0%, #00408a 100%);
    border-radius: 24px;
    padding: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 40px;
    box-shadow: 0 20px 40px rgba(0, 29, 61, 0.15);
}

.cta-text h2 {
    color: #ffffff;
    font-size: 1.8rem;
    font-weight: 700;
    margin-bottom: 10px;
}

.cta-text p {
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    max-width: 500px;
    line-height: 1.5;
}

.cta-btn {
    background: #ffffff;
    color: #00408a;
    padding: 14px 28px;
    border-radius: 12px;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    transition: 0.2s;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.cta-btn:hover {
    background: #f8fafc;
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0,0,0,0.15);
}

@media (max-width: 900px) {
    .steps-grid,
    .features-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    .cta {
        flex-direction: column;
        text-align: center;
        padding: 40px 24px;
    }
}

@media (max-width: 600px) {
    .steps-grid,
    .features-grid {
        grid-template-columns: 1fr;
    }
}
</style>