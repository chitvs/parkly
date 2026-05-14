<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { authStore } from '../store/auth.js'
import Header from '../components/Header.vue'
import Footer from '../components/Footer.vue'
import SearchBar from '../components/SearchBar.vue'
import 'bootstrap-icons/font/bootstrap-icons.css'

const router = useRouter()
const searchLocation = ref('')
const checkIn = ref('')
const checkOut = ref('')
const randomGarages = ref([])
const scrollContainer = ref(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(true)

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
            // limite di 8 garage
            const selected = shuffled.slice(0, 8)

            randomGarages.value = selected.map(g => ({
                id: g.id_garage,
                nome: g.nome,
                indirizzo: g.indirizzo,
                tariffa: Number(g.tariffabase || 0).toFixed(2),
                immagine: (g.foto_urls && g.foto_urls.length > 0) ? g.foto_urls[0] : 
                          (g.Foto_URLs && g.Foto_URLs.length > 0) ? g.Foto_URLs[0] : null
            }))

            await nextTick()
            checkScrollBounds()
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

const goQuick = (loc) => {
    router.push({ name: 'garage', query: { location: loc } })
}

const scrollGallery = (direction) => {
    if (!scrollContainer.value) return

    const container = scrollContainer.value
    const card = container.querySelector('.garage-card-wrapper')

    if (!card) return

    const cardWidth = card.offsetWidth

    container.scrollBy({
        left: direction === 'right' ? cardWidth : -cardWidth,
        behavior: 'smooth'
    })
}

const checkScrollBounds = () => {
    if (!scrollContainer.value) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value;
    
    canScrollLeft.value = scrollLeft > 2; 
    canScrollRight.value = Math.ceil(scrollLeft + clientWidth) < scrollWidth - 2;
}

const quickSearches = [
    { label: 'Termini', location: 'Stazione Termini' },
    { label: 'Colosseo', location: 'Colosseo' },
    { label: 'Vaticano', location: 'Vaticano' },
    { label: 'Fiumicino', location: 'Aeroporto Fiumicino' },
    { label: 'Trastevere', location: 'Trastevere' },
]

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
                <div class="quick-searches">
                    <span class="quick-label">Cerca vicino a:</span>
                    <button v-for="q in quickSearches" :key="q.label" class="quick-chip" @click="goQuick(q.location)">{{
                        q.label }}</button>
                </div>
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
                    <div class="gallery-header">
                        <div>
                            <p class="eyebrow">Esplora</p>
                            <h2 class="section-title" style="margin-bottom: 0;">I nostri garage in evidenza.</h2>
                        </div>
                        <div class="gallery-nav">
                            <button class="nav-btn" @click="scrollGallery('left')" :disabled="!canScrollLeft"
                                aria-label="Scorri a sinistra">
                                <i class="bi bi-chevron-left"></i>
                            </button>
                            <button class="nav-btn" @click="scrollGallery('right')" :disabled="!canScrollRight"
                                aria-label="Scorri a destra">
                                <i class="bi bi-chevron-right"></i>
                            </button>
                        </div>
                    </div>

                    <div class="gallery-scroll-container" ref="scrollContainer" @scroll="checkScrollBounds">
                        <div class="garage-card-wrapper" v-for="g in randomGarages" :key="g.id">
                            <div class="garage-card" @click="goToGarage(g.id)">
                                <div class="garage-img-placeholder">
                                    <img v-if="g.immagine" :src="g.immagine" :alt="g.nome" class="garage-img" />
                                    <i v-else class="bi bi-car-front-fill"></i>
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

            <div class="cta-wrap" v-if="authStore.utente?.ruolo !== 'GESTORE'">
                <div class="cta">
                    <div class="cta-text">
                        <h2>Hai un garage? Lavora con noi.</h2>
                        <p>Pubblica i tuoi posti su Parkly. Dashboard con occupazione in tempo reale, statistiche
                            mensili, pagamenti automatici.</p>
                    </div>
                    <RouterLink to="/diventa-gestore" class="cta-btn">Diventa gestore</RouterLink>
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

.quick-searches {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
    padding: 0 4px;
}

.quick-label {
    font-size: 12px;
    color: #94a3b8;
    font-weight: 500;
}

.quick-chip {
    background: #f0f4ff;
    border: 1px solid #dbe8ff;
    color: #00408a;
    font-size: 12px;
    font-weight: 600;
    padding: 5px 14px;
    border-radius: 20px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.18s;
}

.quick-chip:hover {
    background: #00408a;
    color: #fff;
    border-color: #00408a;
    transform: translateY(-1px);
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

.gallery-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 30px;
    gap: 1rem;
}

.gallery-nav {
    display: flex;
    gap: 10px;
    padding-bottom: 5px;
}

.nav-btn {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #00408a;
    font-size: 1.2rem;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}

.nav-btn:hover:not(:disabled) {
    background: #eff6ff;
    border-color: #00408a;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.05);
}

.nav-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: #f8fafc;
    border-color: #e2e8f0;
    color: #94a3b8;
    box-shadow: none;
    transform: none;
}

.gallery-scroll-container {
    position: relative;
    display: flex;
    gap: 24px;

    padding-bottom: 20px;
    overflow-x: auto;

    scroll-snap-type: x proximity;
    scroll-behavior: smooth;
    overscroll-behavior-x: contain;

    -ms-overflow-style: none;
    scrollbar-width: none;
}

.gallery-scroll-container::-webkit-scrollbar {
    display: none;
}

.garage-card-wrapper {
    flex: 0 0 calc((100% - 72px) / 4);
    max-width: calc((100% - 72px) / 4);
    scroll-snap-align: start;
}

.garage-card {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 16px;
    overflow: hidden;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    cursor: pointer;
    box-sizing: border-box;
}

.garage-card:hover {
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
    overflow: hidden;
}

.garage-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.garage-info {
    padding: 16px 16px;
}

.garage-info h4 {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
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

    .garage-card-wrapper {
        flex: 0 0 calc((100% - 24px) / 2);
        max-width: calc((100% - 24px) / 2);
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

    .garage-card-wrapper {
        flex: 0 0 85%;
        max-width: 85%;
    }

    .gallery-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .gallery-nav {
        align-self: flex-end;
    }
}
</style>