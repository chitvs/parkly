// Gestisce la logica per la visualizzazione della planimetria del garage.
// Include la gestione della griglia la configurazione
// dei posti auto, l'algoritmo di sizionamento e la conversione
// della mappa visiva in una singola stringa testuale per il database.

import { ref, computed } from 'vue'

export function usePlanimetriaEditor() {

    // Costante che definisce quante celle (w = larghezza, h = altezza) occupa ogni veicolo
    const MAPPA_DIMENSIONI = {
        'MOTO': { w: 1, h: 1 },
        'AUTO': { w: 2, h: 1 },
        'FURGONE': { w: 2, h: 2 }
    }

    // Stati 
    const dimensioniMappa = ref({ righe: 6, colonne: 12 })
    const griglia = ref([])
    const strumentoAttivo = ref(null)
    const postiConfigurati = ref([])
    const nuovoPosto = ref({ codice: '', tipo: 'AUTO', isDisabili: false, isElettrica: false, isCoperto: true })

    // Set contenente i codici dei posti attualmente posizionati fisicamente sulla griglia.
    // 'isRoot' indica l'angolo in alto a sinistra di un veicolo (utile per mezzi più grandi di 1x1).
    const codiciPosizionati = computed(() => {
        const codici = new Set()
        griglia.value.forEach(riga => riga.forEach(cella => {
            if (cella?.isRoot) codici.add(cella.codice)
        }))
        return codici
    })

    // Adatta la lista dei posti configurati al formato richiesto dal componente di anteprima della mappa
    const postiConvertitiPerAnteprima = computed(() =>
        postiConfigurati.value.map(p => ({
            codiceposto: p.codice,
            tipoveicolo: p.tipo,
            iselettrica: p.isElettrica,
            isdisabili: p.isDisabili,
            iscoperto: p.isCoperto,
            is_occupato: false // in anteprima nessun posto è occupato
        }))
    )

    // Genera codici automatici progressivi in base alle spunte e al tipo di veicolo (es. A01, E02, D01)
    const generaCodiceAutomatico = () => {
        let prefisso = nuovoPosto.value.tipo.charAt(0).toUpperCase()

        // Disabili o Elettrico sovrascrivono il prefisso del tipo di veicolo base
        if (nuovoPosto.value.isDisabili) {
            prefisso = 'D'
        } else if (nuovoPosto.value.isElettrica) {
            prefisso = 'E'
        }

        const postiDelTipo = postiConfigurati.value.filter(p => p.codice.startsWith(prefisso))
        let maxNum = 0
        postiDelTipo.forEach(p => {
            const num = parseInt(p.codice.replace(/\D/g, ''), 10)
            if (!isNaN(num) && num > maxNum) maxNum = num
        })
        return `${prefisso}${String(maxNum + 1).padStart(2, '0')}`
    }

    // Compila automaticamente le spunte se l'utente digita manualmente una lettera chiave nel codice
    const autoCompilaPosto = () => {
        const cod = nuovoPosto.value.codice.toUpperCase()
        if (!cod) return

        if (cod.startsWith('M')) nuovoPosto.value.tipo = 'MOTO'
        else if (cod.startsWith('F')) nuovoPosto.value.tipo = 'FURGONE'
        else if (cod.startsWith('A')) nuovoPosto.value.tipo = 'AUTO'

        if (cod.startsWith('E')) {
            nuovoPosto.value.isElettrica = true
            nuovoPosto.value.isDisabili = false
        } else if (cod.startsWith('D')) {
            nuovoPosto.value.isDisabili = true
            nuovoPosto.value.isElettrica = false
        }
    }

    // Salva il posto nell'elenco (palette) e ricorda le spunte attuali per facilitare 
    // l'inserimento multiplo in serie di posti dello stesso tipo.
    const aggiungiPostoConfigurato = () => {
        const cod = nuovoPosto.value.codice.trim().toUpperCase() || generaCodiceAutomatico()

        if (postiConfigurati.value.find(p => p.codice === cod)) {
            return { success: false, error: 'Codice posto già esistente!' }
        }

        postiConfigurati.value.push({
            codice: cod,
            tipo: nuovoPosto.value.tipo,
            isElettrica: nuovoPosto.value.isElettrica,
            isDisabili: nuovoPosto.value.isDisabili,
            isCoperto: nuovoPosto.value.isCoperto
        })

        // Salviamo in memoria lo stato delle spunte per riapplicarlo subito dopo
        const tipoSalvato = nuovoPosto.value.tipo
        const isElettricaSalvata = nuovoPosto.value.isElettrica
        const isDisabiliSalvata = nuovoPosto.value.isDisabili
        const isCopertoSalvato = nuovoPosto.value.isCoperto

        nuovoPosto.value = {
            codice: '',
            tipo: tipoSalvato,
            isDisabili: isDisabiliSalvata,
            isElettrica: isElettricaSalvata,
            isCoperto: isCopertoSalvato
        }

        return { success: true }
    }

    const rimuoviPostoConfigurato = (index) => {
        const cod = postiConfigurati.value[index].codice
        postiConfigurati.value.splice(index, 1)

        // Rimuove fisicamente il posto dalla griglia visiva se era già stato posizionato
        for (let r = 0; r < dimensioniMappa.value.righe; r++) {
            for (let c = 0; c < dimensioniMappa.value.colonne; c++) {
                const cella = griglia.value[r][c]
                if (cella?.codice === cod && cella.isRoot) rimuoviItemIn(r, c)
            }
        }
    }

    // Ricrea la matrice mantenendo i posti già disegnati. Chiamata anche all'init.
    const ridimensionaGriglia = () => {
        const nuova = []
        for (let r = 0; r < dimensioniMappa.value.righe; r++) {
            const riga = []
            for (let c = 0; c < dimensioniMappa.value.colonne; c++) {
                riga.push(griglia.value[r]?.[c] || null)
            }
            nuova.push(riga)
        }
        griglia.value = nuova
    }

    const selezionaStrumento = (posto) => {
        const dim = MAPPA_DIMENSIONI[posto.tipo]
        strumentoAttivo.value = { ...posto, w: dim.w, h: dim.h }
    }

    // Funzione interna: "Svuota" le celle occupate da un veicolo a partire dalla sua cella Root (r, c)
    const rimuoviItemIn = (r, c) => {
        const cella = griglia.value[r][c]
        if (!cella) return

        const rootCella = griglia.value[cella.rootR][cella.rootC]
        for (let i = 0; i < rootCella.h; i++) {
            for (let j = 0; j < rootCella.w; j++) {
                if (griglia.value[cella.rootR + i]?.[cella.rootC + j] !== undefined) {
                    griglia.value[cella.rootR + i][cella.rootC + j] = null
                }
            }
        }
    }

    // Gestisce il click su un quadrato della griglia visiva
    const clickCella = (r, c) => {
        if (strumentoAttivo.value === 'GOMMA') {
            rimuoviItemIn(r, c)
            return { success: true }
        }

        if (!strumentoAttivo.value) return { success: true }

        const p = strumentoAttivo.value

        // Controlli di validazione (collisioni e bordi)
        if (codiciPosizionati.value.has(p.codice)) {
            return { success: false, error: 'Posto già posizionato. Usa la gomma per rimuoverlo prima di spostarlo.' }
        }
        if (r + p.h > dimensioniMappa.value.righe || c + p.w > dimensioniMappa.value.colonne) {
            return { success: false, error: 'Spazio insufficiente: uscirai dai bordi della planimetria.' }
        }

        // Controllo se tutte le celle necessarie sono libere
        for (let i = 0; i < p.h; i++) {
            for (let j = 0; j < p.w; j++) {
                if (griglia.value[r + i][c + j] !== null) {
                    return { success: false, error: 'Spazio occupato da un altro veicolo.' }
                }
            }
        }

        // Posizionamento effettivo: la cella in alto a sinistra diventa 'Root', le altre sono solo ingombro
        for (let i = 0; i < p.h; i++) {
            for (let j = 0; j < p.w; j++) {
                griglia.value[r + i][c + j] = {
                    isRoot: i === 0 && j === 0,
                    codice: p.codice,
                    tipo: p.tipo,
                    w: p.w, h: p.h,
                    rootR: r, rootC: c
                }
            }
        }
        strumentoAttivo.value = null
        return { success: true }
    }

    // Trasforma la matrice visiva in una stringa di testo.
    // Formato: CODICE:WxH separati da trattino. Es. riga: "X:1x1-A01:2x1-X:1x1"
    const stringaMappaGenerata = computed(() => {
        if (!griglia.value.length) return ''
        const righeStr = []
        for (let r = 0; r < dimensioniMappa.value.righe; r++) {
            const celleStr = []
            for (let c = 0; c < dimensioniMappa.value.colonne; c++) {
                const cella = griglia.value[r][c]
                // X:1x1 rappresenta una mattonella vuota
                if (!cella) celleStr.push('X:1x1')
                else if (cella.isRoot) celleStr.push(`${cella.codice}:${cella.w}x${cella.h}`)
            }
            if (celleStr.length > 0) righeStr.push(celleStr.join('-'))
        }
        const mappaFinale = righeStr.join('\n')
        // Evitiamo di restituire stringhe con una mappa di sole 'X' se è completamente vuota
        return mappaFinale.replace(/X:1x1(-X:1x1)*\n/g, '').trim() === 'X:1x1' ? '' : mappaFinale
    })

    // Funzione inversa: parte da una stringa e ricostruisce la matrice visiva 
    // (usata in fase di "Modifica Garage" per ripristinare il lavoro precedente).
    const ricostruisciGriglia = (mappa, righe = 10, colonne = 15) => {
        dimensioniMappa.value = { righe, colonne }
        ridimensionaGriglia()

        if (!mappa) return

        const righeMappa = mappa.split('\n')
        righeMappa.forEach((rigaStr, rIndex) => {
            const tokens = rigaStr.split('-')
            let cIndex = 0
            tokens.forEach(t => {
                let [codice, span] = t.split(':')
                let [w, h] = (span || '1x1').split('x').map(Number)

                if (codice !== 'X') {
                    const pConf = postiConfigurati.value.find(pc => pc.codice === codice)
                    if (pConf) {
                        for (let i = 0; i < h; i++) {
                            for (let j = 0; j < w; j++) {
                                if (griglia.value[rIndex + i]) {
                                    griglia.value[rIndex + i][cIndex + j] = {
                                        isRoot: i === 0 && j === 0,
                                        codice, tipo: pConf.tipo,
                                        w, h, rootR: rIndex, rootC: cIndex
                                    }
                                }
                            }
                        }
                    }
                }
                cIndex += w
            })
        })
    }

    // Costruttore eseguito alla creazione del composable
    ridimensionaGriglia()

    return {
        dimensioniMappa,
        griglia,
        strumentoAttivo,
        postiConfigurati,
        nuovoPosto,
        codiciPosizionati,
        stringaMappaGenerata,
        postiConvertitiPerAnteprima,
        ridimensionaGriglia,
        autoCompilaPosto,
        aggiungiPostoConfigurato,
        rimuoviPostoConfigurato,
        selezionaStrumento,
        clickCella,
        ricostruisciGriglia,
    }
}