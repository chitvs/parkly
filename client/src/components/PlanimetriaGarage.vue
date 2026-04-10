<script setup>
import { computed } from 'vue';
const props = defineProps({
    posti: { type: Array, default: () => [] },
    mappaTestuale: { type: String, default: '' },
    selectedId: Number,
    isAnteprima: { type: Boolean, default: false }
});

const emit = defineEmits(['select', 'error']);

const getDatiPosto = (codice) => {
    return props.posti.find(p => p.codiceposto === codice);
};

/*
 * parsing della stringa in matrice
 * ogni token è "CODICEPOSTO:COLxROW" oppure "X" per spazio vuoto.
 * 
 * ad es:
 *   PXX:1x1 moto (larga 1 unità, alta 1)
 *   PXX:2x1 auto (larga 2 unità, alta 1)
 *   PXX:2x2 furgone (larga 2 unità, alta 2)
 *   X       spazio/corsia
 *
 * le X di "riempimento" sotto i furgoni "non contano" perchè vengono "mangiate" dallo span del furgone
 */
const matrice = computed(() => {
    if (!props.mappaTestuale) return [];
    return props.mappaTestuale.trim().split('\n').map(riga =>
        riga.split('-').map(token => {
            let codice = token;
            let span = '1x1';

            if (token.includes(':')) {
                [codice, span] = token.split(':');
            }

            const [col, row] = span.split('x').map(Number);
            return { codice, colSpan: col || 1, rowSpan: row || 1 };
        })
    );
});

// numero totale di unità in larghezza
const numUnitaColonne = computed(() => {
    if (matrice.value.length === 0) return {};

    return Math.max(...matrice.value.map(riga =>
        riga.reduce((acc, cella) => acc + cella.colSpan, 0)
    ));
});

// costruzione delle celle nella grid
const celle = computed(() => {
    const risultato = [];
    // occupate[colonnaUnita] = fino a quale riga è occupata da un rowspan
    const occupate = {};

    matrice.value.forEach((riga, r) => {
        let unitaCorrente = 1;

        riga.forEach((cella) => {
            // salta le unità già occupate da rowspan di righe precedenti
            while (occupate[unitaCorrente] > r + 1) {
                unitaCorrente++;
            }

            const { codice, colSpan, rowSpan } = cella;

            if (rowSpan > 1) {
                for (let i = 0; i < colSpan; i++) {
                    occupate[unitaCorrente + i] = r + 1 + rowSpan;
                }
            }

            if (codice === 'X') {
                risultato.push({
                    tipo: 'vuota',
                    key: `vuota-${r}-${unitaCorrente}`,
                    gridRow: r + 1,
                    gridColumn: unitaCorrente,
                    rowSpan,
                    colSpan,
                });
            } else {
                risultato.push({
                    tipo: 'posto',
                    key: `${codice}-${r}-${unitaCorrente}`,
                    codice,
                    posto: getDatiPosto(codice),
                    gridRow: r + 1,
                    gridColumn: unitaCorrente,
                    rowSpan,
                    colSpan,
                });
            }

            unitaCorrente += colSpan;
        });
    });

    return risultato;
});

const gridStyle = computed(() => {
    if (!matrice.value.length) return {};

    // tutte le colonne sono 30px (unità moto).
    // le auto (2x1) e furgoni (2x2) si spanneranno su 2 colonne = 60px + gap.
    const colonneTemplate = Array(numUnitaColonne.value).fill('30px').join(' ');

    // se la riga ha almeno un posto reale 90px, altrimenti 60px
    const righeTemplate = matrice.value.map(riga => {
        const haPostiReali = riga.some(c => c.codice !== 'X');
        return haPostiReali ? '90px' : '60px';
    }).join(' ');

    return {
        display: 'grid',
        gridTemplateColumns: colonneTemplate,
        gridTemplateRows: righeTemplate,
        gap: '4px',
    };
});

const getCellaStyle = (cella) => ({
    gridRow: cella.rowSpan > 1
        ? `${cella.gridRow} / span ${cella.rowSpan}`
        : String(cella.gridRow),
    gridColumn: cella.colSpan > 1
        ? `${cella.gridColumn} / span ${cella.colSpan}`
        : String(cella.gridColumn),
});

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
        emit('error', 'Seleziona prima le date di arrivo e partenza per selezionare un posto.');
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
                <template v-for="cella in celle" :key="cella.key">

                    <div v-if="cella.tipo === 'vuota'" class="strada-vuota" :style="getCellaStyle(cella)">
                    </div>

                    <div v-else class="cella-griglia" :style="getCellaStyle(cella)">
                        <div class="posto" :class="[
                            cella.posto?.tipoveicolo?.toLowerCase() || 'auto',
                            getClassePosto(cella.codice)
                        ]" @click="gestisciClick(cella.codice)">

                            <strong>{{ cella.codice }}</strong>
                            <small v-if="cella.posto">{{ cella.posto.tipoveicolo }}</small>

                            <div class="indicatori" v-if="cella.posto">
                                <span v-if="cella.posto.isdisabili">
                                    <img src="../assets/handicap.svg" class="box-legenda">
                                </span>
                                <span v-if="cella.posto.iselettrica">
                                    <img src="../assets/electricity.svg" class="box-legenda">
                                </span>
                            </div>
                        </div>
                    </div>

                </template>
            </div>
        </div>

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

.moto,
.bici {
    font-size: 0.7rem;
    padding: 4px 2px;
}

.moto small,
.bici small {
    font-size: 0.5rem;
    line-height: 1.1;
}

.moto strong,
.bici strong {
    font-size: 0.7rem;
}

.moto .indicatori img,
.bici .indicatori img {
    width: 10px;
    height: 10px;
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