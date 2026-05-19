<script setup>
import { computed } from 'vue';

const props = defineProps({
    posti: { type: Array, default: () => [] }, // Dati effettivi estratti dal DB per ogni posto
    mappaTestuale: { type: String, default: '' }, // Stringa "ASCII-art" per la disposizione
    selectedId: Number, // ID del posto cliccato dall'utente
    isAnteprima: { type: Boolean, default: false }, // Se true, l'utente sta solo guardando la mappa prima di inserire le date
    mostraErrori: { type: Boolean, default: true },
    isGestoreMode: { type: Boolean, default: false } // Cambia l'aspetto e i permessi di click (per il pannello admin)
});

const emit = defineEmits(['select', 'error', 'manage']);


// Funzione helper per recuperare i dettagli completi del DB (es. tipo veicolo, stato) basandosi sul codice identificativo del posto.
// codice = Il codice univoco stampato sulla mappa (es. "P01").
const getDatiPosto = (codice) => {
    return props.posti.find(p => p.codiceposto === codice);
};


// PARSING DELLA STRINGA ASCII IN MATRICE 
// Trasforma una stringa testuale con in un array 2D.
// Il formato dei token è: `CODICE:COLONNE x RIGHE`.
// Se manca la dimensione, il default è 1x1. "X" rappresenta strada/muro vuoto.
const matrice = computed(() => {
    if (!props.mappaTestuale) return [];

    // Divide per riga e per blocco
    return props.mappaTestuale.trim().split('\n').map(riga =>
        riga.split('-').map(token => {
            let codice = token;
            let span = '1x1';

            // Estrae la dimensione (colSpan x rowSpan) se presente
            if (token.includes(':')) {
                [codice, span] = token.split(':');
            }

            const [col, row] = span.split('x').map(Number);
            return { codice, colSpan: col || 1, rowSpan: row || 1 };
        })
    );
});

//Calcola il numero totale di unità in larghezza.
const numUnitaColonne = computed(() => {
    if (matrice.value.length === 0) return {};

    return Math.max(...matrice.value.map(riga =>
        riga.reduce((acc, cella) => acc + cella.colSpan, 0)
    ));
});

// Questo computed genera la lista di div finali da disegnare sulla mappa.
// Risolve i "buchi" creati da veicoli molto grandi (come i furgoni 2x2) che si espandono 
// su più righe. Usa l'oggetto `occupate` per tenere traccia delle celle già occupate.
const celle = computed(() => {
    const risultato = [];
    const occupate = {};

    matrice.value.forEach((riga, r) => {
        let unitaCorrente = 1;

        riga.forEach((cella) => {
            // Se questa coordinata è stata coperta da un veicolo grosso della riga precedente, skippiamo in avanti
            while (occupate[unitaCorrente] > r + 1) {
                unitaCorrente++;
            }

            const { codice, colSpan, rowSpan } = cella;

            // Se questo è un veicolo che scende verso il basso, segnamo le colonne sottostanti come "occupate"
            if (rowSpan > 1) {
                for (let i = 0; i < colSpan; i++) {
                    occupate[unitaCorrente + i] = r + 1 + rowSpan;
                }
            }

            // Aggiungiamo l'oggetto alla lista finale
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
                    posto: getDatiPosto(codice), // Lega il dato visuale ai dati del database
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


// Applica dinamicamente regole CSS Grid al container padre.
// Imposta una colonna fissa di 30px per unità.
// Se una riga contiene solo asfalto vuoto ('X'), la fa più stretta (60px), altrimenti alta (90px).
const gridStyle = computed(() => {
    if (!matrice.value.length) return {};

    const colonneTemplate = Array(numUnitaColonne.value).fill('30px').join(' ');

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

// Genera lo stile che dice a ciascun div dove espandersi nella griglia.
const getCellaStyle = (cella) => ({
    gridRow: cella.rowSpan > 1
        ? `${cella.gridRow} / span ${cella.rowSpan}`
        : String(cella.gridRow),
    gridColumn: cella.colSpan > 1
        ? `${cella.gridColumn} / span ${cella.colSpan}`
        : String(cella.gridColumn),
});


// Valuta lo stato visivo di un posto (colorazione e classi) in base alle regole di business.
// codice = Il codice del posto.
const getClassePosto = (codice) => {
    if (props.isAnteprima) return 'anteprima';

    const posto = getDatiPosto(codice);
    if (!posto) return 'non-configurato'; // Errore: mappa e db non sono allineati

    // Se sono loggato come proprietario del garage vedo colori diversi (es. quelli in manutenzione)
    if (props.isGestoreMode) {
        if (posto.is_in_manutenzione) return 'manutenzione';
        if (posto.is_occupato) return 'occupato';
        return 'gestione-attivo';
    }

    // Modalità cliente normale
    if (props.selectedId === posto.id_posto) return 'selezionato';
    if (posto.is_occupato) return 'occupato';
    return 'libero';
};


// Reagisce al click su un parcheggio specifico.
// Filtra i click non validi (es. posto già occupato, date mancanti in anteprima).
const gestisciClick = (codice) => {
    // Blocco se mancano date
    if (props.isAnteprima) {
        emit('error', 'Seleziona prima le date di arrivo e partenza per selezionare un posto.');
        return;
    }

    const posto = getDatiPosto(codice);

    // Se è il gestore a cliccare, si emette un evento per aprire il popup di modifica/manutenzione
    if (props.isGestoreMode) {
        if (posto) emit('manage', posto);
        return;
    }

    // Se è il cliente e il posto è libero, lo seleziona per prenotarlo
    if (posto && !posto.is_occupato) {
        emit('select', posto);
    }
};
</script>

<template>
    <div class="planimetria" :data-gestore="isGestoreMode">

        <div class="legenda-container">
            <div class="legenda">
                <span class="box-legenda bianco"></span>Libero
                <span class="box-legenda grigio-scuro"></span>Occupato
                <template v-if="isGestoreMode">
                    <span class="box-legenda arancione-tratteggio"></span>Manutenzione
                </template>
                <span class="box-legenda blu"></span> Selezionato
                <span><img src="../assets/handicap.svg" class="box-legenda"></span>Disabili
                <span><img src="../assets/electricity.svg" class="box-legenda"></span>Ricarica elettrica
            </div>
        </div>

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

        <div v-if="isAnteprima && mostraErrori" class="avviso-anteprima">
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

.box-legenda.arancione-tratteggio {
    background: #fff4e6;
    border: 2px dashed #ff922b;
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

.planimetria[data-gestore="true"] .occupato {
    cursor: pointer;
}

.planimetria[data-gestore="true"] .occupato:hover {
    filter: brightness(0.95);
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

.gestione-attivo {
    background: #e8f5e9;
    border: 2px dashed #28a745;
    color: #28a745;
    cursor: pointer;
}

.gestione-attivo:hover {
    background: #c8e6c9;
}

.manutenzione {
    background: #fff4e6;
    border: 2px dashed #ff922b !important;
    color: #ff922b !important;
    cursor: pointer;
}

.manutenzione:hover {
    background: #ffe8cc;
}

.manutenzione strong::after {
    font-size: 0.7rem;
}
</style>