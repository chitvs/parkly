<script setup>
import { computed } from 'vue';
const props = defineProps({
    posti: { type: Array, default: () => [] },
    mappaTestuale: { type: String, default: '' },
    selectedId: Number,
    isAnteprima: { type: Boolean, default: false }
});

const emit = defineEmits(['select']);

// Parsing della stringa in matrice
const matrice = computed(() => {
    if (!props.mappaTestuale) return [];
    return props.mappaTestuale.trim().split('\n').map(riga => riga.split('-'));
});

// Appiattisce la matrice per darla in pasto al v-for
const griglia = computed(() => matrice.value.flat());

const gridStyle = computed(() => {
    if (matrice.value.length === 0) return {};

    const numRighe = matrice.value.length;
    const numColonne = matrice.value[0].length;

    let colonneTemplate = [];
    for (let c = 0; c < numColonne; c++) {
        const colonnaHaPosto = matrice.value.some(riga => riga[c] !== 'X');
        colonneTemplate.push(colonnaHaPosto ? '60px' : '20px');
    }

    let righeTemplate = [];
    for (let r = 0; r < numRighe; r++) {
        const rigaHaPosto = matrice.value[r].some(cella => cella !== 'X');
        righeTemplate.push(rigaHaPosto ? '90px' : '30px');
    }

    return {
        display: 'grid',
        gridTemplateColumns: colonneTemplate.join(' '),
        gridTemplateRows: righeTemplate.join(' '),
        gap: '4px'
    };
});

// Helper per recuperare i dati completi dal database tramite il codice testuale
const getDatiPosto = (codice) => {
    return props.posti.find(p => p.codiceposto === codice);
};

const getClassePosto = (codice) => {
    if (props.isAnteprima) return 'anteprima';

    const posto = getDatiPosto(codice);
    if (!posto) return 'non-configurato'; // se sta nella stringa ma non nel DB lancio un errore
    if (props.selectedId === posto.id_posto) return 'selezionato';
    if (posto.is_occupato) return 'occupato';
    return 'libero';
};

const gestisciClick = (codice) => {
    if (props.isAnteprima) {
        alert("Seleziona prima le date!");
        return;
    }

    const posto = getDatiPosto(codice);
    if (posto && !posto.is_occupato) {
        emit('select', posto);
    }
};
</script>

<template>
    <div class="planimetria">

        <!-- Legenda -->
        <div class="legenda-container">
            <div class="legenda">
                <span class="box-legenda bianco"></span>Libero
                <span class="box-legenda grigio-scuro"></span>Occupato
                <span class="box-legenda blu"></span> Selezionato
                <span><img src="../assets/handicap.svg" class="box-legenda"></span>Disabili
                <span><img src="../assets/electricity.svg" class="box-legenda"></span>Ricarica elettrica
            </div>
        </div>

        <!-- Traduzione della planimetria ASCII in una CSS grid -->
        <div class="mappa-container">
            <div v-if="!mappaTestuale" class="no-data">Nessuna mappa testuale definita per questo garage.</div>

            <div v-else class="grid-vanilla" :style="gridStyle">
                <div v-for="(cella, index) in griglia" :key="index" class="cella-griglia">

                    <div v-if="cella === 'X'" class="strada-vuota"></div>

                    <div v-else class="posto" :class="[
                        getDatiPosto(cella)?.tipoveicolo?.toLowerCase() || 'auto',
                        getClassePosto(cella)
                    ]" @click="gestisciClick(cella)">

                        <strong>{{ cella }}</strong>
                        <small v-if="getDatiPosto(cella)">{{ getDatiPosto(cella).tipoveicolo }}</small>

                        <div class="indicatori" v-if="getDatiPosto(cella)">
                            <span v-if="getDatiPosto(cella).isdisabili"><img src="../assets/handicap.svg"
                                    class="box-legenda"></span>
                            <span v-if="getDatiPosto(cella).iselettrica"><img src="../assets/electricity.svg"
                                    class="box-legenda"></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Alert di anteprima, se non sono inserite date/orari -->
        <div v-if="isAnteprima" class="avviso-anteprima">
            Inserisci gli orari per vedere i posti liberi.
        </div>

    </div>
</template>

<style scoped>
.avviso-anteprima {
    background: #fff3cd;
    color: #856404;
    padding: 10px;
    border: 1px solid #ffeeba;
    text-align: center;
}

.planimetria {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.legenda {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    font-size: 0.8rem;
    color: #555;
}

.legenda>span {
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
}

.box-legenda {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    display: inline-block;
    border: 2px solid #ccc;
}

img.box-legenda {
    border: none;
}

.box-legenda.bianco {
    background: white;
    border-color: #28a745;
}

.box-legenda.grigio-scuro {
    background: #e0e0e0;
}

.box-legenda.blu {
    background: #00408A;
    border-color: #042571;
}

.mappa-container {
    overflow-x: auto;
    padding: 20px;
    background: #fdfdfd;
    border: 1px solid #eee;
}

.no-data {
    text-align: center;
    color: #999;
}

.grid-vanilla {
    margin: 0 auto;
    width: fit-content;
}

.strada-vuota {
    width: 100%;
    height: 100%;
}

.cella-griglia {
    display: flex;
    align-items: center;
    justify-content: center;
}

.posto {
    position: relative;
    width: 100%;
    height: 100%;
    border: 1px solid #ccc;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    user-select: none;
    font-size: 0.85rem;
    box-sizing: border-box;
    padding: 10px 5px;
    text-align: center;
}

.posto small {
    font-size: 0.6rem;
    color: #666;
    text-align: center;
}

.indicatori {
    position: absolute;
    bottom: 4px;
    right: 4px;
    display: flex;
    gap: 3px;
}

.indicatori img {
    width: 14px;
    height: 14px;
    display: block;
    object-fit: contain;
}

.camper,
.furgone {
    transform: scale(1.15);
    z-index: 1;
    border-width: 2px;
    border-color: #888;
}

.moto,
.bici {
    transform: scale(0.85);
}

.anteprima {
    background: #f9f9f9;
}

.libero {
    background: white;
    border: 2px solid #28a745;
    color: #28a745;
    cursor: pointer;
}

.libero:hover {
    background: #e8f5e9;
}

.occupato {
    background: #e9ecef;
    border: 1px solid #ced4da;
    color: #adb5bd;
    cursor: not-allowed;
}

.selezionato {
    background: #00408A !important;
    color: white !important;
    border-color: #042571 !important;
}

.selezionato small {
    color: rgba(255, 255, 255, 0.6);
}

.selezionato .indicatori img {
    filter: brightness(0) invert(1);
}

.non-configurato {
    background: red;
    opacity: 0.3;
    cursor: not-allowed;
}
</style>