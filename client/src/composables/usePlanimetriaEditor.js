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

    // Genera codici automatici
    const generaCodiceAutomatico = (tipo) => {
        const prefisso = tipo.charAt(0).toUpperCase()
        const postiDelTipo = postiConfigurati.value.filter(p => p.tipo === tipo)
        let maxNum = 0
        postiDelTipo.forEach(p => {
            const num = parseInt(p.codice.replace(/\D/g, ''), 10)
            if (!isNaN(num) && num > maxNum) maxNum = num
        })
        return `${prefisso}${String(maxNum + 1).padStart(2, '0')}`
    }

    const autoCompilaPosto = () => {
        const cod = nuovoPosto.value.codice.toUpperCase()
        if (!cod) return
        if (cod.startsWith('M')) nuovoPosto.value.tipo = 'MOTO'
        else if (cod.startsWith('F')) nuovoPosto.value.tipo = 'FURGONE'
        else nuovoPosto.value.tipo = 'AUTO'
        nuovoPosto.value.isElettrica = cod.startsWith('E')
        nuovoPosto.value.isDisabili = cod.startsWith('D')
    }

    const aggiungiPostoConfigurato = () => {
        const cod = nuovoPosto.value.codice.trim().toUpperCase() || generaCodiceAutomatico(nuovoPosto.value.tipo)
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
        const tipoCorrente = nuovoPosto.value.tipo
        nuovoPosto.value = { codice: '', tipo: tipoCorrente, isDisabili: false, isElettrica: false, isCoperto: true }
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