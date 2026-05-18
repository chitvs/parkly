import { ref, computed } from 'vue'

export function usePlanimetriaEditor() {
    const MAPPA_DIMENSIONI = {
        'MOTO': { w: 1, h: 1 },
        'AUTO': { w: 2, h: 1 },
        'FURGONE': { w: 2, h: 2 }
    }

    const dimensioniMappa = ref({ righe: 6, colonne: 12 })
    const griglia = ref([])
    const strumentoAttivo = ref(null)
    const postiConfigurati = ref([])
    const nuovoPosto = ref({ codice: '', tipo: 'AUTO', isDisabili: false, isElettrica: false, isCoperto: true })

    // 1. Inizializza o ridimensiona la griglia
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

    // Set con i codici dei posti attualmente posizionati sulla griglia
    const codiciPosizionati = computed(() => {
        const codici = new Set()
        griglia.value.forEach(riga => riga.forEach(cella => { if (cella?.isRoot) codici.add(cella.codice) }))
        return codici
    })

    // Genera codici automatici in base alle spunte e al tipo
    const generaCodiceAutomatico = () => {
        let prefisso = nuovoPosto.value.tipo.charAt(0).toUpperCase()
        
        // Se è disabili o elettrico, il prefisso diventa D o E (sovrascrivendo A/M/F)
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

    // Compila automaticamente le opzioni se l'utente scrive a mano il codice
    const autoCompilaPosto = () => {
        const cod = nuovoPosto.value.codice.toUpperCase()
        if (!cod) return
        
        if (cod.startsWith('M')) nuovoPosto.value.tipo = 'MOTO'
        else if (cod.startsWith('F')) nuovoPosto.value.tipo = 'FURGONE'
        else if (cod.startsWith('A')) nuovoPosto.value.tipo = 'AUTO'
        
        // Se scrive a mano E o D, attiva in automatico le spunte
        if (cod.startsWith('E')) {
            nuovoPosto.value.isElettrica = true
            nuovoPosto.value.isDisabili = false
        } else if (cod.startsWith('D')) {
            nuovoPosto.value.isDisabili = true
            nuovoPosto.value.isElettrica = false
        }
    }

    // Aggiunge il posto e ricorda le selezioni per il prossimo
    const aggiungiPostoConfigurato = () => {
        // Se il campo è vuoto, usa il generatore automatico (es. E01, D01, ecc.)
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
        
        // Salviamo in memoria lo stato delle spunte appena confermate
        const tipoSalvato = nuovoPosto.value.tipo
        const isElettricaSalvata = nuovoPosto.value.isElettrica
        const isDisabiliSalvata = nuovoPosto.value.isDisabili
        const isCopertoSalvato = nuovoPosto.value.isCoperto
        
        // Ripristiniamo la variabile 'nuovoPosto' mantenendo però le spunte
        nuovoPosto.value = { 
            codice: '', 
            tipo: tipoSalvato, 
            isDisabili: isDisabiliSalvata, 
            isElettrica: isElettricaSalvata, 
            isCoperto: isCopertoSalvato 
        }
        
        return { success: true }
    }

    const selezionaStrumento = (posto) => {
        const dim = MAPPA_DIMENSIONI[posto.tipo]
        strumentoAttivo.value = { ...posto, w: dim.w, h: dim.h }
    }

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

    const rimuoviPostoConfigurato = (index) => {
        const cod = postiConfigurati.value[index].codice
        postiConfigurati.value.splice(index, 1)
        for (let r = 0; r < dimensioniMappa.value.righe; r++) {
            for (let c = 0; c < dimensioniMappa.value.colonne; c++) {
                const cella = griglia.value[r][c]
                if (cella?.codice === cod && cella.isRoot) rimuoviItemIn(r, c)
            }
        }
    }

    const clickCella = (r, c) => {
        if (strumentoAttivo.value === 'GOMMA') {
            rimuoviItemIn(r, c)
            return { success: true }
        }

        if (!strumentoAttivo.value) return { success: true }

        const p = strumentoAttivo.value

        if (codiciPosizionati.value.has(p.codice)) {
            return { success: false, error: 'Posto già posizionato. Usa la gomma per rimuoverlo prima di spostarlo.' }
        }
        if (r + p.h > dimensioniMappa.value.righe || c + p.w > dimensioniMappa.value.colonne) {
            return { success: false, error: 'Spazio insufficiente: uscirai dai bordi della planimetria.' }
        }

        for (let i = 0; i < p.h; i++) {
            for (let j = 0; j < p.w; j++) {
                if (griglia.value[r + i][c + j] !== null) {
                    return { success: false, error: 'Spazio occupato da un altro veicolo.' }
                }
            }
        }

        for (let i = 0; i < p.h; i++) {
            for (let j = 0; j < p.w; j++) {
                griglia.value[r + i][c + j] = {
                    isRoot: i === 0 && j === 0,
                    codice: p.codice, tipo: p.tipo,
                    w: p.w, h: p.h, rootR: r, rootC: c
                }
            }
        }
        strumentoAttivo.value = null
        return { success: true }
    }

    // 2. Output
    const stringaMappaGenerata = computed(() => {
        if (!griglia.value.length) return ''
        const righeStr = []
        for (let r = 0; r < dimensioniMappa.value.righe; r++) {
            const celleStr = []
            for (let c = 0; c < dimensioniMappa.value.colonne; c++) {
                const cella = griglia.value[r][c]
                if (!cella) celleStr.push('X:1x1')
                else if (cella.isRoot) celleStr.push(`${cella.codice}:${cella.w}x${cella.h}`)
            }
            if (celleStr.length > 0) righeStr.push(celleStr.join('-'))
        }
        const mappaFinale = righeStr.join('\n')
        return mappaFinale.replace(/X:1x1(-X:1x1)*\n/g, '').trim() === 'X:1x1' ? '' : mappaFinale
    })

    const postiConvertitiPerAnteprima = computed(() =>
        postiConfigurati.value.map(p => ({
            codiceposto: p.codice, tipoveicolo: p.tipo,
            iselettrica: p.isElettrica, isdisabili: p.isDisabili,
            iscoperto: p.isCoperto, is_occupato: false
        }))
    )

    // 3. Parser inverso (per caricare una mappa esistente in fase di modifica)
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

    // 4. Utility reset
    const svuotaPlanimetria = () => {
        postiConfigurati.value = []
        nuovoPosto.value = { codice: '', tipo: 'AUTO', isDisabili: false, isElettrica: false, isCoperto: true }
        strumentoAttivo.value = null
        dimensioniMappa.value = { righe: 6, colonne: 12 }
        ridimensionaGriglia()
    }

    // Costruttore
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
        svuotaPlanimetria
    }
}