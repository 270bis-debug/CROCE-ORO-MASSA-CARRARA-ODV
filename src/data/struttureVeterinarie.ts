export interface StrutturaVeterinaria {
  id: string;
  nome: string;
  indirizzoCompleto: string;
  comune: string;
  regione?: 'Toscana' | 'Liguria';
  h24: boolean;
  tipo: 'clinica' | 'ambulatorio' | 'ospedale';
  telefono?: string;
}

export const STRUTTURE_VETERINARIE: StrutturaVeterinaria[] = [
  // ==========================================
  // 1. SANTO STEFANO DI MAGRA (SP)
  // ==========================================
  {
    id: 'haziel-santo-stefano',
    nome: 'Clinica Veterinaria Haziel (Pronto Soccorso H24)',
    indirizzoCompleto: 'Via Luigi Camaiora 5, 19037 Santo Stefano di Magra SP',
    comune: 'Santo Stefano Magra',
    regione: 'Liguria',
    h24: true,
    tipo: 'clinica',
    telefono: '0187 632345'
  },
  {
    id: 'ghio-santo-stefano',
    nome: 'Ambulatorio Veterinario Dr. Nicola Ghio',
    indirizzoCompleto: 'Via Cisa Sud 476, 19037 Santo Stefano di Magra SP',
    comune: 'Santo Stefano Magra',
    regione: 'Liguria',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0187 630120'
  },

  // ==========================================
  // 2. SARZANA (SP)
  // ==========================================
  {
    id: 'lunense-sarzana',
    nome: 'Ambulatorio Veterinario Lunense',
    indirizzoCompleto: 'Via Variante Cisa 41, 19038 Sarzana SP',
    comune: 'Sarzana',
    regione: 'Liguria',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0187 626574'
  },
  {
    id: 'maggiani-sarzana',
    nome: 'Ambulatorio Veterinario Sarzana (Dr.ssa Laura Maggiani)',
    indirizzoCompleto: 'Via Emiliana 37, 19038 Sarzana SP',
    comune: 'Sarzana',
    regione: 'Liguria',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0187 621415'
  },
  {
    id: 'trinita-sarzana',
    nome: 'Ambulatorio Veterinario La Trinità (Dr. Vigiani - Dr. Galeno)',
    indirizzoCompleto: 'Via Pecorina 6, 19038 Sarzana SP',
    comune: 'Sarzana',
    regione: 'Liguria',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0187 608226'
  },
  {
    id: 'bortolamiol-roffo-sarzana',
    nome: 'Ambulatorio Veterinario Dr. Bortolamiol & Dr. Roffo',
    indirizzoCompleto: 'Via Bradia 12, 19038 Sarzana SP',
    comune: 'Sarzana',
    regione: 'Liguria',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0187 627190'
  },

  // ==========================================
  // 3. LUNI / ORTONOVO (SP)
  // ==========================================
  {
    id: 'pisani-carli-luni',
    nome: 'Centro Veterinario Pisani Carli Chiodo',
    indirizzoCompleto: 'Via Togliatti 8/10, 19034 Luni Mare SP',
    comune: 'Luni',
    regione: 'Liguria',
    h24: false,
    tipo: 'clinica',
    telefono: '0187 661413'
  },
  {
    id: 'tac-luni-mare',
    nome: 'Centro Diagnostico Veterinario Tac Luni Mare',
    indirizzoCompleto: 'Via Giacomo Brodolini 42, 19034 Luni Mare SP',
    comune: 'Luni',
    regione: 'Liguria',
    h24: false,
    tipo: 'clinica',
    telefono: '0187 661620'
  },
  {
    id: 'riccardi-luni',
    nome: 'Studio Veterinario Dr.ssa Stefania Riccardi',
    indirizzoCompleto: 'Via Aurelia 345, 19034 Luni SP',
    comune: 'Luni',
    regione: 'Liguria',
    h24: false,
    tipo: 'ambulatorio'
  },

  // ==========================================
  // 4. CARRARA (MS)
  // ==========================================
  {
    id: 'citta-del-marmo-carrara',
    nome: 'Clinica Veterinaria Città del Marmo (Pronto Soccorso H24)',
    indirizzoCompleto: 'Via Werther Muttini 18, 54033 Marina di Carrara MS',
    comune: 'Carrara',
    regione: 'Toscana',
    h24: true,
    tipo: 'clinica',
    telefono: '0585 788642'
  },
  {
    id: 'anicura-apuana-carrara',
    nome: 'AniCura Clinica Veterinaria Apuana',
    indirizzoCompleto: 'Viale XX Settembre 298 / Via Arezzo 9, 54033 Carrara MS',
    comune: 'Carrara',
    regione: 'Toscana',
    h24: false,
    tipo: 'clinica',
    telefono: '0585 785465'
  },
  {
    id: 'amb-carrara-centro',
    nome: 'Ambulatorio Veterinario Carrara Centro',
    indirizzoCompleto: 'Via Carriona 32, 54033 Carrara MS',
    comune: 'Carrara',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio'
  },
  {
    id: 'amb-betti-carrara',
    nome: 'Ambulatorio Veterinario Dott.ssa Betti',
    indirizzoCompleto: 'Viale XX Settembre 180, 54033 Carrara MS',
    comune: 'Carrara',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio'
  },
  {
    id: 'amb-tognotti-carrara',
    nome: 'Ambulatorio Veterinario Tognotti',
    indirizzoCompleto: 'Via Covetta 56, 54033 Carrara MS',
    comune: 'Carrara',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 857500'
  },
  {
    id: 'amb-dazzi-barone-carrara',
    nome: 'Ambulatorio Veterinario Associato Dazzi & Barone',
    indirizzoCompleto: 'Via Comano 39, 54033 Carrara MS',
    comune: 'Carrara',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 73060'
  },
  {
    id: 'amb-bedini-carrara',
    nome: 'Studio Veterinario Dr. Alessandro Bedini',
    indirizzoCompleto: 'Via dei Mille 116, 54033 Marina di Carrara MS',
    comune: 'Carrara',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 786300'
  },
  {
    id: 'amb-bertanelli-carrara',
    nome: 'Studio Veterinario Dr. Maurizio Bertanelli',
    indirizzoCompleto: 'Viale XX Settembre 74/TER, 54033 Carrara MS',
    comune: 'Carrara',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 845230'
  },
  {
    id: 'amb-perfetti-stoppa-carrara',
    nome: 'Studio Associato Dott. Perfetti & Dott.ssa Stoppa',
    indirizzoCompleto: 'Via Felice Cavallotti 54/B, 54033 Marina di Carrara MS',
    comune: 'Carrara',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 788287'
  },
  {
    id: 'amb-vaccarino-carrara',
    nome: 'Ambulatorio Veterinario Dr. Roberto Vaccarino',
    indirizzoCompleto: 'Via Firenze 15/bis, 54033 Marina di Carrara MS',
    comune: 'Carrara',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 630268'
  },
  {
    id: 'amb-maloni-carrara',
    nome: 'Studio Veterinario Dr.ssa Francesca Angelica Maloni',
    indirizzoCompleto: 'Via Fossola 12, 54033 Carrara MS',
    comune: 'Carrara',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 841235'
  },
  {
    id: 'amb-ricci-carrara',
    nome: 'Ambulatorio Veterinario Dr. Marco Ricci',
    indirizzoCompleto: 'Via Groppoli 8, 54033 Carrara MS',
    comune: 'Carrara',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 70912'
  },
  {
    id: 'amb-vaira-carrara',
    nome: 'Ambulatorio Veterinario Dr. Fabrizio Vaira',
    indirizzoCompleto: 'Via Fiorillo 14, 54033 Carrara MS',
    comune: 'Carrara',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 71420'
  },
  {
    id: 'amb-tognotti-bedini-carrara',
    nome: 'Studio Veterinario Ass. Dr. Tognotti & Dr. Bedini',
    indirizzoCompleto: 'Viale XX Settembre 110, 54033 Avenza, Carrara MS',
    comune: 'Carrara',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 859940'
  },

  // ==========================================
  // 5. MASSA (MS)
  // ==========================================
  {
    id: 'malaspina-massa',
    nome: 'Clinica Veterinaria Malaspina',
    indirizzoCompleto: 'Via Stradella, 57, 54100 Massa MS',
    comune: 'Massa',
    regione: 'Toscana',
    h24: false,
    tipo: 'clinica',
    telefono: '0585 1980108'
  },
  {
    id: 'fruzzetti-massa',
    nome: 'Ambulatorio Veterinario Dr. Roberto Fruzzetti',
    indirizzoCompleto: 'Via Ronchi 48, 54100 Massa MS',
    comune: 'Massa',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 241516'
  },
  {
    id: 'busti-massa',
    nome: 'Ambulatorio Veterinario Dr.ssa Mariacarla Busti',
    indirizzoCompleto: 'Via dei Margini 3, 54100 Massa MS',
    comune: 'Massa',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 810793'
  },
  {
    id: 'amb-massa-centro',
    nome: 'Ambulatorio Veterinario Massa Centro',
    indirizzoCompleto: 'Via Bastioni 14, 54100 Massa MS',
    comune: 'Massa',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio'
  },
  {
    id: 'amb-san-francesco-massa',
    nome: 'Ambulatorio Veterinario San Francesco (Dr. Ricci)',
    indirizzoCompleto: 'Via Verona 5, 54100 Marina di Massa MS',
    comune: 'Massa',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 877854'
  },
  {
    id: 'amb-apuano-massa',
    nome: 'Ambulatorio Veterinario Apuano',
    indirizzoCompleto: 'Via Giosuè Carducci 145, 54100 Massa MS',
    comune: 'Massa',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 250914'
  },
  {
    id: 'amb-santo-sinatti-massa',
    nome: 'Ambulatorio Veterinario Associato Dr. Santo & Dr. Sinatti',
    indirizzoCompleto: 'Via dell\'Acqua 3, 54100 Massa MS',
    comune: 'Massa',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 254549'
  },
  {
    id: 'amb-adreani-beccari-massa',
    nome: 'Ambulatorio Veterinario Adreani & Beccari',
    indirizzoCompleto: 'Via Ferdinando Martini 5, 54100 Massa MS',
    comune: 'Massa',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 488758'
  },
  {
    id: 'amb-rosselli-cuscianna-massa',
    nome: 'Ambulatorio Veterinario Rosselli e Cuscianna',
    indirizzoCompleto: 'Via Quercioli 385, 54100 Massa MS',
    comune: 'Massa',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 256023'
  },
  {
    id: 'amb-tongiani-massa',
    nome: 'Ambulatorio Veterinario Dott.ssa Laura Tongiani',
    indirizzoCompleto: 'Via Democrazia 10, 54100 Massa MS',
    comune: 'Massa',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 41258'
  },
  {
    id: 'amb-nari-massa',
    nome: 'Studio Veterinario Dott. Andrea Nari',
    indirizzoCompleto: 'Via Bastioni 22, 54100 Massa MS',
    comune: 'Massa',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 44521'
  },
  {
    id: 'amb-paolicchi-massa',
    nome: 'Ambulatorio Veterinario Dott. Gabriele Paolicchi',
    indirizzoCompleto: 'Via Giosuè Carducci 145, 54100 Massa MS',
    comune: 'Massa',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '347 3631497'
  },
  {
    id: 'amb-castellotti-massa',
    nome: 'Studio Veterinario Dr. Jean Frank Castellotti',
    indirizzoCompleto: 'Via Cavour 18, 54100 Massa MS',
    comune: 'Massa',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 43210'
  },
  {
    id: 'amb-guadagni-massa',
    nome: 'Studio Veterinario Dr.ssa Francesca Guadagni',
    indirizzoCompleto: 'Via Marina Vecchia 85, 54100 Massa MS',
    comune: 'Massa',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0585 488112'
  },
  {
    id: 'vet-domicilio-massa-carrara',
    nome: 'Servizio Veterinario a Domicilio Dr.ssa De Ambrosis',
    indirizzoCompleto: 'Servizio Domiciliare Massa, Carrara e Versilia',
    comune: 'Massa',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '347 8852904'
  },

  // ==========================================
  // 6. MONTIGNOSO (MS)
  // ==========================================
  {
    id: 'santa-barbara-montignoso',
    nome: 'Ambulatorio Veterinario Santa Barbara (Malaspina)',
    indirizzoCompleto: 'Via Gramsci 42, Cinquale, 54038 Montignoso MS',
    comune: 'Montignoso',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio'
  },
  {
    id: 'amb-montignoso-centro',
    nome: 'Ambulatorio Veterinario Montignoso',
    indirizzoCompleto: 'Via Roma 18, 54038 Montignoso MS',
    comune: 'Montignoso',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio'
  },

  // ==========================================
  // 7. PIETRASANTA (LU)
  // ==========================================
  {
    id: 'portone-pietrasanta',
    nome: 'Clinica Veterinaria Portone di Pietrasanta',
    indirizzoCompleto: 'Via Aurelia Sud 54, 55045 Pietrasanta LU',
    comune: 'Pietrasanta',
    regione: 'Toscana',
    h24: false,
    tipo: 'clinica',
    telefono: '0584 790074'
  },
  {
    id: 'pelliccia-pietrasanta',
    nome: 'Ambulatorio Veterinario Dr. Anacleto Michele Pelliccia',
    indirizzoCompleto: 'Via Sarzanese 114, 55045 Pietrasanta LU',
    comune: 'Pietrasanta',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio'
  },
  {
    id: 'ferrandello-pietrasanta',
    nome: 'Ambulatorio Veterinario Dott. Dagoberto Ferrandello',
    indirizzoCompleto: 'Via Provinciale Vallecchia 45, 55045 Pietrasanta LU',
    comune: 'Pietrasanta',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio'
  },

  // ==========================================
  // 8. FORTE DEI MARMI (LU)
  // ==========================================
  {
    id: 'deguttry-forte',
    nome: 'Ambulatorio Veterinario De Guttry - Bertagna - Cassiodoro',
    indirizzoCompleto: 'Via Amendola 51, 55042 Forte dei Marmi LU',
    comune: 'Forte dei Marmi',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0584 81284'
  },
  {
    id: 'bedini-forte',
    nome: 'Ambulatorio Veterinario Dott.ssa Daniela Bedini',
    indirizzoCompleto: 'Via Mazzini 47/D, 55042 Forte dei Marmi LU',
    comune: 'Forte dei Marmi',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0584 89230'
  },
  {
    id: 'rosselli-forte',
    nome: 'Ambulatorio Veterinario Dott. Rosselli & Dott.ssa Lo Prieno',
    indirizzoCompleto: 'Via Civitali 112, 55042 Forte dei Marmi LU',
    comune: 'Forte dei Marmi',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio'
  },
  {
    id: 'cecchi-forte',
    nome: 'Ambulatorio Veterinario Dott. Cecchi',
    indirizzoCompleto: 'Via Scassicarli 89, 55042 Forte dei Marmi LU',
    comune: 'Forte dei Marmi',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio'
  },
  {
    id: 'ferrandello-forte',
    nome: 'Ambulatorio Veterinario Dott. Ferrandello',
    indirizzoCompleto: 'Via Giovanni Agnelli 118, 55042 Forte dei Marmi LU',
    comune: 'Forte dei Marmi',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio'
  },

  // ==========================================
  // 9. CAMAIORE & LIDO DI CAMAIORE (LU)
  // ==========================================
  {
    id: 'colombo-lido-camaiore',
    nome: 'Clinica Veterinaria Colombo (Pronto Soccorso H24)',
    indirizzoCompleto: 'Viale Cristoforo Colombo 153, 55041 Lido di Camaiore LU',
    comune: 'Camaiore',
    regione: 'Toscana',
    h24: true,
    tipo: 'clinica',
    telefono: '0584 610020'
  },
  {
    id: 'tofanelli-lido-camaiore',
    nome: 'Centro Medico Veterinario Tofanelli',
    indirizzoCompleto: 'Via Martiri di Belfiore 16, 55041 Lido di Camaiore LU',
    comune: 'Camaiore',
    regione: 'Toscana',
    h24: false,
    tipo: 'clinica',
    telefono: '0584 619717'
  },
  {
    id: 'campus-maior-camaiore',
    nome: 'Centro Medico Veterinario Campus Maior',
    indirizzoCompleto: 'Via dello Stadio 31, 55041 Camaiore LU',
    comune: 'Camaiore',
    regione: 'Toscana',
    h24: false,
    tipo: 'clinica'
  },
  {
    id: 'pessina-camaiore',
    nome: 'Ambulatorio Veterinario Dott. Andrea Corrado Pessina',
    indirizzoCompleto: 'Via Giuseppe Garibaldi 22, 55041 Camaiore LU',
    comune: 'Camaiore',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio'
  },

  // ==========================================
  // 10. VIAREGGIO (LU)
  // ==========================================
  {
    id: 'campo-aviazione-viareggio',
    nome: 'Clinica Veterinaria Campo d\'Aviazione (Pronto Soccorso H24)',
    indirizzoCompleto: 'Via Nicola Pisano 26, 55049 Viareggio LU',
    comune: 'Viareggio',
    regione: 'Toscana',
    h24: true,
    tipo: 'clinica',
    telefono: '0584 388166'
  },
  {
    id: 'ancillotti-ercolini-viareggio',
    nome: 'Ambulatorio Veterinario Associato Ancillotti - Ercolini - Puccetti',
    indirizzoCompleto: 'Via Fratti 240, 55049 Viareggio LU',
    comune: 'Viareggio',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0584 52123'
  },
  {
    id: 'vai-pregliasco-viareggio',
    nome: 'Studio Veterinario Associato Vai - Pregliasco',
    indirizzoCompleto: 'Via Ferruccio Parri 4, 55049 Viareggio LU',
    comune: 'Viareggio',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0584 395155'
  },
  {
    id: 'varignano-viareggio',
    nome: 'Ambulatorio Veterinario Varignano',
    indirizzoCompleto: 'Via del Varignano 45, 55049 Viareggio LU',
    comune: 'Viareggio',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio'
  },
  {
    id: 'viareggio-matteotti',
    nome: 'Ambulatorio Veterinario Viareggio',
    indirizzoCompleto: 'Via Giacomo Matteotti 88, 55049 Viareggio LU',
    comune: 'Viareggio',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio'
  },

  // ==========================================
  // 11. SERAVEZZA & QUERCETA (LU)
  // ==========================================
  {
    id: 'ferrandello-seravezza',
    nome: 'Ambulatorio Veterinario Dott. Ferrandello (Reperibilità H24)',
    indirizzoCompleto: 'Via Seravezza 612, 55047 Seravezza LU',
    comune: 'Seravezza',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio',
    telefono: '0584 756187'
  },
  {
    id: 'amb-querceta',
    nome: 'Ambulatorio Veterinario Querceta',
    indirizzoCompleto: 'Via Fratelli Rosselli 191, Querceta, 55047 Seravezza LU',
    comune: 'Seravezza',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio'
  },
  {
    id: 'lucchesi-seravezza',
    nome: 'Studio Medico Veterinario Dott. Riccardo Lucchesi',
    indirizzoCompleto: 'Via Federigi 36, Querceta, 55047 Seravezza LU',
    comune: 'Seravezza',
    regione: 'Toscana',
    h24: false,
    tipo: 'ambulatorio'
  },

  // ====================================================================
  // CLINICHE ED OSPEDALI VETERINARI 24 ORE SU 24 - TUTTA LA TOSCANA (H24)
  // ====================================================================
  {
    id: 'unipi-pisa-h24',
    nome: 'Ospedale Didattico Veterinario UNIPI (Pronto Soccorso H24)',
    indirizzoCompleto: 'Via Livornese lato Darsena snc, 56122 San Piero a Grado, Pisa PI',
    comune: 'Pisa',
    regione: 'Toscana',
    h24: true,
    tipo: 'ospedale',
    telefono: '050 2210100'
  },
  {
    id: 'san-concordio-lucca-h24',
    nome: 'Ospedale Veterinario San Concordio (Pronto Soccorso H24)',
    indirizzoCompleto: 'Via di San Concordio 740, 55100 Lucca LU',
    comune: 'Lucca',
    regione: 'Toscana',
    h24: true,
    tipo: 'ospedale',
    telefono: '0583 582508'
  },
  {
    id: 'lucca-24h',
    nome: 'Clinica Veterinaria Lucca 24H (Pronto Soccorso H24)',
    indirizzoCompleto: 'Via Romana 615/P, 55100 Lucca LU',
    comune: 'Lucca',
    regione: 'Toscana',
    h24: true,
    tipo: 'clinica',
    telefono: '0583 955355'
  },
  {
    id: 'ardenza-livorno-h24',
    nome: 'Ospedale Veterinario Ardenza (Pronto Soccorso H24)',
    indirizzoCompleto: 'Via Mondolfi 148, 57128 Livorno LI',
    comune: 'Livorno',
    regione: 'Toscana',
    h24: true,
    tipo: 'ospedale',
    telefono: '0586 580559'
  },
  {
    id: 'vet-hospital-firenze-h24',
    nome: 'Vet Hospital H24 Firenze (Ospedale Veterinario H24)',
    indirizzoCompleto: 'Via Pistoiese 381, 50145 Firenze FI',
    comune: 'Firenze',
    regione: 'Toscana',
    h24: true,
    tipo: 'ospedale',
    telefono: '055 312000'
  },
  {
    id: 'il-giglio-firenze-h24',
    nome: 'Clinica Veterinaria Il Giglio (Pronto Soccorso H24)',
    indirizzoCompleto: 'Via del Giglio 54, 50019 Sesto Fiorentino FI',
    comune: 'Firenze',
    regione: 'Toscana',
    h24: true,
    tipo: 'clinica',
    telefono: '055 4211101'
  },
  {
    id: 'etruria-siena-h24',
    nome: 'Clinica Veterinaria Etruria 24H (Pronto Soccorso H24)',
    indirizzoCompleto: 'Strada di Cerchiaia 28, 53100 Siena SI',
    comune: 'Siena',
    regione: 'Toscana',
    h24: true,
    tipo: 'clinica',
    telefono: '0577 386000'
  },
  {
    id: 'san-minianimal-pisa-h24',
    nome: 'Clinica Veterinaria San Minianimal (Pronto Soccorso H24)',
    indirizzoCompleto: 'Via Tosco Romagnola Est 528, 56028 San Miniato PI',
    comune: 'San Miniato',
    regione: 'Toscana',
    h24: true,
    tipo: 'clinica',
    telefono: '0571 418181'
  },
  {
    id: 'petvet-livorno-h24',
    nome: 'Clinica Veterinaria PetVet (Pronto Soccorso H24)',
    indirizzoCompleto: 'Via della Principessa 11, 57027 San Vincenzo LI',
    comune: 'San Vincenzo',
    regione: 'Toscana',
    h24: true,
    tipo: 'clinica',
    telefono: '0565 705000'
  },
  {
    id: 'grosseto-vet-h24',
    nome: 'Clinica Veterinaria Aurelia H24 (Grosseto)',
    indirizzoCompleto: 'Via Aurelia Nord 218, 58100 Grosseto GR',
    comune: 'Grosseto',
    regione: 'Toscana',
    h24: true,
    tipo: 'clinica',
    telefono: '0564 456789'
  },
  {
    id: 'valdichiana-arezzo-h24',
    nome: 'Ospedale Veterinario Valdichiana H24 (Arezzo)',
    indirizzoCompleto: 'Via dell\'Olmo 23, 52044 Camucia, Cortona AR',
    comune: 'Arezzo',
    regione: 'Toscana',
    h24: true,
    tipo: 'ospedale',
    telefono: '0575 604900'
  },
  {
    id: 'leonardo-empoli-h24',
    nome: 'Clinica Veterinaria Leonardo H24 (Empoli)',
    indirizzoCompleto: 'Via Cherubini 34, 50053 Sovigliana, Vinci FI',
    comune: 'Empoli',
    regione: 'Toscana',
    h24: true,
    tipo: 'clinica',
    telefono: '0571 501391'
  },

  // ====================================================================
  // CLINICHE ED OSPEDALI VETERINARI 24 ORE SU 24 - TUTTA LA LIGURIA (H24)
  // ====================================================================
  {
    id: 'san-giorgio-genova-h24',
    nome: 'Clinica Veterinaria San Giorgio (Pronto Soccorso H24)',
    indirizzoCompleto: 'Via Privata San Giorgio 1, 16128 Genova GE',
    comune: 'Genova',
    regione: 'Liguria',
    h24: true,
    tipo: 'clinica',
    telefono: '010 5956041'
  },
  {
    id: 'centro-genovese-h24',
    nome: 'Centro Veterinario Genovese (Pronto Soccorso H24)',
    indirizzoCompleto: 'Via Carlo Barabino 115 R, 16129 Genova GE',
    comune: 'Genova',
    regione: 'Liguria',
    h24: true,
    tipo: 'clinica',
    telefono: '010 5959140'
  },
  {
    id: 'segestavet-sestri-h24',
    nome: 'SegestaVet Clinica Veterinaria (Emergenze H24)',
    indirizzoCompleto: 'Via Nazionale 174, 16039 Sestri Levante GE',
    comune: 'Sestri Levante',
    regione: 'Liguria',
    h24: true,
    tipo: 'clinica',
    telefono: '0185 455455'
  },
  {
    id: 'letimbro-savona-h24',
    nome: 'Clinica Veterinaria Letimbro (Pronto Soccorso H24)',
    indirizzoCompleto: 'Via Letimbro 13 R, 17100 Savona SV',
    comune: 'Savona',
    regione: 'Liguria',
    h24: true,
    tipo: 'clinica',
    telefono: '019 804791'
  },
  {
    id: 'riviera-imperia-h24',
    nome: 'Clinica Veterinaria Riviera dei Fiori H24 (Imperia)',
    indirizzoCompleto: 'Via Nazionale 324, 18100 Imperia IM',
    comune: 'Imperia',
    regione: 'Liguria',
    h24: true,
    tipo: 'clinica',
    telefono: '0183 294000'
  },
  {
    id: 'tigullio-chiavari-h24',
    nome: 'Clinica Veterinaria Tigullio H24 (Chiavari)',
    indirizzoCompleto: 'Corso Dante 156, 16043 Chiavari GE',
    comune: 'Chiavari',
    regione: 'Liguria',
    h24: true,
    tipo: 'clinica',
    telefono: '0185 321000'
  },
  {
    id: 'albenga-vet-h24',
    nome: 'Clinica Veterinaria Ingauna H24 (Albenga)',
    indirizzoCompleto: 'Regione Bagnoli 41, 17031 Albenga SV',
    comune: 'Albenga',
    regione: 'Liguria',
    h24: true,
    tipo: 'clinica',
    telefono: '0182 556000'
  }
];
