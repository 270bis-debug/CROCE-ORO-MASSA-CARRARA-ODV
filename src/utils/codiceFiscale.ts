import { getCurrentYearItaly } from './italianTime';

/**
 * Utility per Calcolo e Decodifica del Codice Fiscale Italiano
 * Croce Oro Massa Carrara ETS OdV
 */

export interface DatiPersonaCF {
  nome: string;
  cognome: string;
  dataNascita: string; // Formato YYYY-MM-DD
  sesso: 'M' | 'F';
  comuneNascita: string;
  provinciaNascita?: string;
  codiceCatastale?: string;
}

export interface DecodificaCFResult {
  valido: boolean;
  nome?: string;
  cognome?: string;
  dataNascita?: string; // YYYY-MM-DD
  sesso?: 'M' | 'F';
  comuneNascita?: string;
  provinciaNascita?: string;
  codiceCatastale?: string;
  errore?: string;
}

// Database comuni principali e provincia di Massa-Carrara / Toscana / Italia
export const COMUNI_CATASTALI: Record<string, { comune: string; provincia: string; codice: string }> = {
  // Provincia di Massa-Carrara e Lunigiana
  'F023': { comune: 'Massa', provincia: 'MS', codice: 'F023' },
  'B832': { comune: 'Carrara', provincia: 'MS', codice: 'B832' },
  'F679': { comune: 'Montignoso', provincia: 'MS', codice: 'F679' },
  'A496': { comune: 'Aulla', provincia: 'MS', codice: 'A496' },
  'G870': { comune: 'Pontremoli', provincia: 'MS', codice: 'G870' },
  'D629': { comune: 'Fivizzano', provincia: 'MS', codice: 'D629' },
  'A576': { comune: 'Bagnone', provincia: 'MS', codice: 'A576' },
  'C914': { comune: 'Comano', provincia: 'MS', codice: 'C914' },
  'D590': { comune: 'Filattiera', provincia: 'MS', codice: 'D590' },
  'D735': { comune: 'Fosdinovo', provincia: 'MS', codice: 'D735' },
  'E574': { comune: 'Licciana Nardi', provincia: 'MS', codice: 'E574' },
  'F802': { comune: 'Mulazzo', provincia: 'MS', codice: 'F802' },
  'G776': { comune: 'Podenzana', provincia: 'MS', codice: 'G776' },
  'L388': { comune: 'Tresana', provincia: 'MS', codice: 'L388' },
  'L946': { comune: 'Villafranca in Lunigiana', provincia: 'MS', codice: 'L946' },
  'M169': { comune: 'Zeri', provincia: 'MS', codice: 'M169' },
  'B979': { comune: 'Casola in Lunigiana', provincia: 'MS', codice: 'B979' },

  // Versilia e La Spezia limitrofi
  'E463': { comune: 'La Spezia', provincia: 'SP', codice: 'E463' },
  'I449': { comune: 'Sarzana', provincia: 'SP', codice: 'I449' },
  'E560': { comune: 'Lerici', provincia: 'SP', codice: 'E560' },
  'A373': { comune: 'Arcola', provincia: 'SP', codice: 'A373' },
  'L833': { comune: 'Viareggio', provincia: 'LU', codice: 'L833' },
  'D730': { comune: 'Forte dei Marmi', provincia: 'LU', codice: 'D730' },
  'G628': { comune: 'Pietrasanta', provincia: 'LU', codice: 'G628' },
  'B455': { comune: 'Camaiore', provincia: 'LU', codice: 'B455' },
  'I622': { comune: 'Seravezza', provincia: 'LU', codice: 'I622' },
  'I942': { comune: 'Stazzema', provincia: 'LU', codice: 'I942' },
  'C236': { comune: 'Castelnuovo di Garfagnana', provincia: 'LU', codice: 'C236' },

  // Capoluoghi Toscana
  'D612': { comune: 'Firenze', provincia: 'FI', codice: 'D612' },
  'G702': { comune: 'Pisa', provincia: 'PI', codice: 'G702' },
  'E715': { comune: 'Lucca', provincia: 'LU', codice: 'E715' },
  'E625': { comune: 'Livorno', provincia: 'LI', codice: 'E625' },
  'G713': { comune: 'Pistoia', provincia: 'PT', codice: 'G713' },
  'G999': { comune: 'Prato', provincia: 'PO', codice: 'G999' },
  'A390': { comune: 'Arezzo', provincia: 'AR', codice: 'A390' },
  'I726': { comune: 'Siena', provincia: 'SI', codice: 'I726' },
  'E156': { comune: 'Grosseto', provincia: 'GR', codice: 'E156' },

  // Principali Capoluoghi Italiani
  'H501': { comune: 'Roma', provincia: 'RM', codice: 'H501' },
  'F205': { comune: 'Milano', provincia: 'MI', codice: 'F205' },
  'F839': { comune: 'Napoli', provincia: 'NA', codice: 'F839' },
  'L219': { comune: 'Torino', provincia: 'TO', codice: 'L219' },
  'G273': { comune: 'Palermo', provincia: 'PA', codice: 'G273' },
  'D969': { comune: 'Genova', provincia: 'GE', codice: 'D969' },
  'A944': { comune: 'Bologna', provincia: 'BO', codice: 'A944' },
  'A662': { comune: 'Bari', provincia: 'BA', codice: 'A662' },
  'C351': { comune: 'Catania', provincia: 'CT', codice: 'C351' },
  'L736': { comune: 'Venezia', provincia: 'VE', codice: 'L736' },
  'L781': { comune: 'Verona', provincia: 'VR', codice: 'L781' },
  'F158': { comune: 'Messina', provincia: 'ME', codice: 'F158' },
  'G224': { comune: 'Padova', provincia: 'PD', codice: 'G224' },
  'L424': { comune: 'Trieste', provincia: 'TS', codice: 'L424' },
  'L049': { comune: 'Taranto', provincia: 'TA', codice: 'L049' },
  'B157': { comune: 'Brescia', provincia: 'BS', codice: 'B157' },
  'G337': { comune: 'Parma', provincia: 'PR', codice: 'G337' },
  'F257': { comune: 'Modena', provincia: 'MO', codice: 'F257' },
  'H224': { comune: 'Reggio di Calabria', provincia: 'RC', codice: 'H224' },
  'H223': { comune: 'Reggio nell\'Emilia', provincia: 'RE', codice: 'H223' },
  'G478': { comune: 'Perugia', provincia: 'PG', codice: 'G478' },
  'H199': { comune: 'Ravenna', provincia: 'RA', codice: 'H199' },
  'B354': { comune: 'Cagliari', provincia: 'CA', codice: 'B354' },
  'D643': { comune: 'Foggia', provincia: 'FG', codice: 'D643' },
  'H294': { comune: 'Rimini', provincia: 'RN', codice: 'H294' },
  'H703': { comune: 'Salerno', provincia: 'SA', codice: 'H703' },
  'D548': { comune: 'Ferrara', provincia: 'FE', codice: 'D548' },
  'I452': { comune: 'Sassari', provincia: 'SS', codice: 'I452' },
  'E472': { comune: 'Latina', provincia: 'LT', codice: 'E472' },
  'M303': { comune: 'Monza', provincia: 'MB', codice: 'M303' },
  'I754': { comune: 'Siracusa', provincia: 'SR', codice: 'I754' },
  'G482': { comune: 'Pescara', provincia: 'PE', codice: 'G482' },
  'A794': { comune: 'Bergamo', provincia: 'BG', codice: 'A794' },
  'D704': { comune: 'Forlì', provincia: 'FC', codice: 'D704' },
  'L378': { comune: 'Trento', provincia: 'TN', codice: 'L378' },
  'L840': { comune: 'Vicenza', provincia: 'VI', codice: 'L840' },
  'L117': { comune: 'Terni', provincia: 'TR', codice: 'L117' },
  'A952': { comune: 'Bolzano', provincia: 'BZ', codice: 'A952' },
  'F952': { comune: 'Novara', provincia: 'NO', codice: 'F952' },
  'G535': { comune: 'Piacenza', provincia: 'PC', codice: 'G535' },
  'A271': { comune: 'Ancona', provincia: 'AN', codice: 'A271' },
  'A285': { comune: 'Andria', provincia: 'BT', codice: 'A285' },
  'L483': { comune: 'Udine', provincia: 'UD', codice: 'L483' },
  'C573': { comune: 'Cesena', provincia: 'FC', codice: 'C573' },
  'E506': { comune: 'Lecce', provincia: 'LE', codice: 'E506' },
  'G479': { comune: 'Pesaro', provincia: 'PU', codice: 'G479' },
  'A669': { comune: 'Barletta', provincia: 'BT', codice: 'A669' },
  'A182': { comune: 'Alessandria', provincia: 'AL', codice: 'A182' },
  'C773': { comune: 'Como', provincia: 'CO', codice: 'C773' },
  'A940': { comune: 'Benevento', provincia: 'BN', codice: 'A940' },
  'A757': { comune: 'Belluno', provincia: 'BL', codice: 'A757' },
  'C034': { comune: 'Caserta', provincia: 'CE', codice: 'C034' },
  'C349': { comune: 'Catanzaro', provincia: 'CZ', codice: 'C349' },
  'D086': { comune: 'Cosenza', provincia: 'CS', codice: 'D086' },
  'D122': { comune: 'Cremona', provincia: 'CR', codice: 'D122' },
  'D286': { comune: 'Crotone', provincia: 'KR', codice: 'D286' },
  'D205': { comune: 'Cuneo', provincia: 'CN', codice: 'D205' },
  'D708': { comune: 'Fermo', provincia: 'FM', codice: 'D708' },
  'D810': { comune: 'Frosinone', provincia: 'FR', codice: 'D810' },
  'E098': { comune: 'Gorizia', provincia: 'GO', codice: 'E098' },
  'E281': { comune: 'Imperia', provincia: 'IM', codice: 'E281' },
  'E335': { comune: 'Isernia', provincia: 'IS', codice: 'E335' },
  'A345': { comune: 'L\'Aquila', provincia: 'AQ', codice: 'A345' },
  'E505': { comune: 'Lecco', provincia: 'LC', codice: 'E505' },
  'E648': { comune: 'Lodi', provincia: 'LO', codice: 'E648' },
  'E783': { comune: 'Macerata', provincia: 'MC', codice: 'E783' },
  'E897': { comune: 'Mantova', provincia: 'MN', codice: 'E897' },
  'F052': { comune: 'Matera', provincia: 'MT', codice: 'F052' },
  'F837': { comune: 'Nuoro', provincia: 'NU', codice: 'F837' },
  'G147': { comune: 'Oristano', provincia: 'OR', codice: 'G147' },
  'G388': { comune: 'Pavia', provincia: 'PV', codice: 'G388' },
  'G942': { comune: 'Potenza', provincia: 'PZ', codice: 'G942' },
  'H163': { comune: 'Ragusa', provincia: 'RG', codice: 'H163' },
  'H282': { comune: 'Rieti', provincia: 'RI', codice: 'H282' },
  'H769': { comune: 'San Benedetto del Tronto', provincia: 'AP', codice: 'H769' },
  'H987': { comune: 'Savona', provincia: 'SV', codice: 'H987' },
  'I438': { comune: 'Sondrio', provincia: 'SO', codice: 'I438' },
  'L157': { comune: 'Trapani', provincia: 'TP', codice: 'L157' },
  'L407': { comune: 'Treviso', provincia: 'TV', codice: 'L407' },
  'L682': { comune: 'Varese', provincia: 'VA', codice: 'L682' },
  'L750': { comune: 'Verbania', provincia: 'VB', codice: 'L750' },
  'L780': { comune: 'Vercelli', provincia: 'VC', codice: 'L780' },
  'M082': { comune: 'Viterbo', provincia: 'VT', codice: 'M082' },
  'Z000': { comune: 'Stato Estero', provincia: 'EE', codice: 'Z000' }
};

// Cerca codice catastale da nome comune
export const trovaCodiceCatastale = (nomeComune: string, siglaProv?: string): string | null => {
  if (!nomeComune) return null;
  const pulito = nomeComune.trim().toLowerCase();

  // 1. Corrispondenza esatta
  for (const [codice, item] of Object.entries(COMUNI_CATASTALI)) {
    if (item.comune.toLowerCase() === pulito) {
      if (!siglaProv || item.provincia.toUpperCase() === siglaProv.toUpperCase()) {
        return codice;
      }
    }
  }

  // 2. Corrispondenza parziale
  for (const [codice, item] of Object.entries(COMUNI_CATASTALI)) {
    if (item.comune.toLowerCase().startsWith(pulito) || pulito.startsWith(item.comune.toLowerCase())) {
      return codice;
    }
  }

  return null;
};

// Mappa lettere mesi
const MESI_CODICI: Record<number, string> = {
  1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'H',
  7: 'L', 8: 'M', 9: 'P', 10: 'R', 11: 'S', 12: 'T'
};

const CODICI_MESI: Record<string, number> = {
  'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'H': 6,
  'L': 7, 'M': 8, 'P': 9, 'R': 10, 'S': 11, 'T': 12
};

// Pesi caratteri pari e dispari per CIN di controllo
const VALORI_DISPARI: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
  'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
  'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
};

const VALORI_PARI: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
  'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18, 'T': 19,
  'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
};

const VOCALI = ['A', 'E', 'I', 'O', 'U'];

const estraiConsonantiEVocali = (testo: string) => {
  const pulito = testo.toUpperCase().replace(/[^A-Z]/g, '');
  const consonanti: string[] = [];
  const vocali: string[] = [];

  for (const c of pulito) {
    if (VOCALI.includes(c)) {
      vocali.push(c);
    } else {
      consonanti.push(c);
    }
  }

  return { consonanti, vocali };
};

const calcolaCodiceCognome = (cognome: string): string => {
  const { consonanti, vocali } = estraiConsonantiEVocali(cognome);
  const unione = [...consonanti, ...vocali, 'X', 'X', 'X'];
  return unione.slice(0, 3).join('');
};

const calcolaCodiceNome = (nome: string): string => {
  const { consonanti, vocali } = estraiConsonantiEVocali(nome);
  // Se consonanti >= 4, si prendono la 1ª, la 3ª e la 4ª
  if (consonanti.length >= 4) {
    return [consonanti[0], consonanti[2], consonanti[3]].join('');
  }
  const unione = [...consonanti, ...vocali, 'X', 'X', 'X'];
  return unione.slice(0, 3).join('');
};

const calcolaCarattereControllo = (cfPrimi15: string): string => {
  let somma = 0;
  for (let i = 0; i < 15; i++) {
    const char = cfPrimi15[i].toUpperCase();
    if (i % 2 === 0) {
      // Posizione dispari (1-based: 1, 3, 5...)
      somma += VALORI_DISPARI[char] !== undefined ? VALORI_DISPARI[char] : 0;
    } else {
      // Posizione pari (1-based: 2, 4, 6...)
      somma += VALORI_PARI[char] !== undefined ? VALORI_PARI[char] : 0;
    }
  }
  const resto = somma % 26;
  return String.fromCharCode(65 + resto); // 0 -> 'A', 1 -> 'B', etc.
};

/**
 * Calcola il Codice Fiscale a 16 caratteri a partire dai dati anagrafici
 */
export const calcolaCodiceFiscale = (dati: DatiPersonaCF): { codiceFiscale?: string; errore?: string } => {
  if (!dati.cognome || dati.cognome.trim().length < 2) {
    return { errore: 'Cognome mancante o troppo corto.' };
  }
  if (!dati.nome || dati.nome.trim().length < 2) {
    return { errore: 'Nome mancante o troppo corto.' };
  }
  if (!dati.dataNascita || !/^\d{4}-\d{2}-\d{2}$/.test(dati.dataNascita)) {
    return { errore: 'Data di nascita non valida o non compilata (seleziona prima la data).' };
  }
  if (!dati.sesso || (dati.sesso !== 'M' && dati.sesso !== 'F')) {
    return { errore: 'Sesso mancante (seleziona M o F).' };
  }

  // Trova codice catastale
  let codCatastale = dati.codiceCatastale;
  if (!codCatastale && dati.comuneNascita) {
    codCatastale = trovaCodiceCatastale(dati.comuneNascita, dati.provinciaNascita) || undefined;
  }

  if (!codCatastale) {
    // Se non trovato, default a Massa (F023) se comune menziona massa o vuoto, altrimenti avvisa
    if (dati.comuneNascita?.toLowerCase().includes('carrara')) {
      codCatastale = 'B832';
    } else if (dati.comuneNascita?.toLowerCase().includes('massa')) {
      codCatastale = 'F023';
    } else {
      return { errore: `Codice Catastale per il comune di nascita "${dati.comuneNascita}" non individuato. Inserisci il codice catastale o verifica il comune.` };
    }
  }

  const codCognome = calcolaCodiceCognome(dati.cognome);
  const codNome = calcolaCodiceNome(dati.nome);

  const [annoStr, meseStr, giornoStr] = dati.dataNascita.split('-');
  const anno2 = annoStr.slice(2, 4);
  const meseNum = parseInt(meseStr, 10);
  const meseLettera = MESI_CODICI[meseNum] || 'A';
  let giornoNum = parseInt(giornoStr, 10);
  if (dati.sesso === 'F') {
    giornoNum += 40;
  }
  const giornoFormattato = String(giornoNum).padStart(2, '0');

  const primi15 = `${codCognome}${codNome}${anno2}${meseLettera}${giornoFormattato}${codCatastale.toUpperCase()}`;
  const cin = calcolaCarattereControllo(primi15);

  return { codiceFiscale: `${primi15}${cin}`.toUpperCase() };
};

/**
 * Decodifica il Codice Fiscale a 16 caratteri ed estrae:
 * - Data di nascita (YYYY-MM-DD)
 * - Sesso (M/F)
 * - Comune di nascita
 * - Sigla provincia di nascita
 * - Codice Catastale
 */
export const decodificaCodiceFiscale = (cf: string): DecodificaCFResult => {
  if (!cf) {
    return { valido: false, errore: 'Inserisci prima il Codice Fiscale.' };
  }

  const pulito = cf.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (pulito.length !== 16) {
    return { valido: false, errore: 'Il Codice Fiscale deve contenere esattamente 16 caratteri.' };
  }

  // Verifica struttura base: 6 lettere, 2 numeri, 1 lettera, 2 numeri, 1 lettera, 3 numeri, 1 lettera
  const regexCF = /^[A-Z]{6}(\d{2})([A-Z])(\d{2})([A-Z]\d{3})([A-Z])$/;
  const match = pulito.match(regexCF);

  if (!match) {
    return { valido: false, errore: 'Formato del Codice Fiscale non valido.' };
  }

  const [, anno2, meseLettera, giorno2, codCatastale, cin] = match;

  // Verifica CIN
  const primi15 = pulito.slice(0, 15);
  const cinCalcolato = calcolaCarattereControllo(primi15);
  if (cin !== cinCalcolato) {
    // Nota: avvertimento su carattere di controllo ma proseguiamo nell'estrazione dati
    console.warn(`CIN non corrispondente: atteso ${cinCalcolato}, trovato ${cin}`);
  }

  // 1. Calcola Anno
  const annoNum2 = parseInt(anno2, 10);
  const annoAttuale2 = getCurrentYearItaly() % 100;
  // Se anno2 <= annoAttuale2, persona nata dopo il 2000, altrimenti 1900
  const anno4 = annoNum2 <= annoAttuale2 ? 2000 + annoNum2 : 1900 + annoNum2;

  // 2. Calcola Mese
  const meseNum = CODICI_MESI[meseLettera];
  if (!meseNum) {
    return { valido: false, errore: `Lettera del mese non valida: ${meseLettera}` };
  }
  const meseFormattato = String(meseNum).padStart(2, '0');

  // 3. Calcola Giorno e Sesso
  const giornoVal = parseInt(giorno2, 10);
  let sesso: 'M' | 'F' = 'M';
  let giornoEffettivo = giornoVal;

  if (giornoVal > 40) {
    sesso = 'F';
    giornoEffettivo = giornoVal - 40;
  }

  if (giornoEffettivo < 1 || giornoEffettivo > 31) {
    return { valido: false, errore: `Giorno di nascita non valido nel Codice Fiscale: ${giornoVal}` };
  }

  const giornoFormattato = String(giornoEffettivo).padStart(2, '0');
  const dataNascita = `${anno4}-${meseFormattato}-${giornoFormattato}`;

  // 4. Decodifica Comune e Provincia da Codice Catastale
  let comuneNascita = '';
  let provinciaNascita = '';

  const infoComune = COMUNI_CATASTALI[codCatastale];
  if (infoComune) {
    comuneNascita = infoComune.comune;
    provinciaNascita = infoComune.provincia;
  } else {
    comuneNascita = `Comune (${codCatastale})`;
    provinciaNascita = codCatastale.startsWith('Z') ? 'EE' : '';
  }

  // 5. Decodifica o Stima Nome e Cognome dai primi 6 caratteri
  const codCognome = pulito.slice(0, 3);
  const codNome = pulito.slice(3, 6);

  const DIZIONARIO_COGNOMI: Record<string, string> = {
    'RSS': 'Rossi', 'BNC': 'Bianchi', 'VRD': 'Verdi', 'FRR': 'Ferrari', 'ESP': 'Esposito',
    'RMN': 'Romano', 'CLB': 'Colombo', 'RCC': 'Ricci', 'MRN': 'Marino', 'GRC': 'Greco',
    'BRN': 'Bruno', 'GLL': 'Gallo', 'CNT': 'Conti', 'DLU': 'De Luca', 'CST': 'Costa',
    'GRD': 'Giordano', 'MNC': 'Mancini', 'RZZ': 'Rizzo', 'LOM': 'Lombardi', 'MRE': 'Moretti',
    'BRB': 'Barbieri', 'FNT': 'Fontana', 'SNT': 'Santoro', 'MRR': 'Marini', 'RNL': 'Rinaldi',
    'CRT': 'Caruso', 'FRL': 'Ferrara', 'MRT': 'Martini', 'LNE': 'Leone', 'LNG': 'Longo',
    'GNT': 'Gentile', 'MTR': 'Martinelli', 'VTL': 'Vitale', 'LBR': 'Lombardo', 'SRA': 'Serra',
    'CPP': 'Coppola', 'DND': 'De Angelis', 'PRC': 'Parisi', 'VLL': 'Villa', 'GNN': 'Giannini',
    'STR': 'Sartori', 'PLG': 'Pellegrini', 'PML': 'Palumbo', 'RSL': 'Rossetti', 'FBR': 'Fabbri',
    'RND': 'Riva', 'PCC': 'Piccolo', 'MNF': 'Manfredi', 'SLV': 'Silvestri', 'GRS': 'Grassi',
    'MNT': 'Monti', 'PTR': 'Pietrini', 'BRT': 'Bertolini', 'FRC': 'Franchini', 'PST': 'Pastore',
    'GGL': 'Guglielmi', 'PNT': 'Ponte', 'MRL': 'Merlo', 'CLL': 'Collu', 'BTT': 'Battisti',
    'CRS': 'Caruso', 'NLC': 'Nicolai', 'PNN': 'Pannocchia', 'BLL': 'Belloni', 'BSS': 'Bassi'
  };

  const DIZIONARIO_NOMI_M: Record<string, string> = {
    'MRC': 'Marco', 'LCU': 'Luca', 'AND': 'Andrea', 'FRN': 'Francesco', 'MTT': 'Matteo',
    'LRN': 'Lorenzo', 'GVN': 'Giovanni', 'GBR': 'Gabriele', 'LRD': 'Leonardo', 'ALX': 'Alessandro',
    'DVE': 'Davide', 'FDP': 'Federico', 'GSP': 'Giuseppe', 'SMN': 'Simone', 'CRH': 'Christian',
    'ALN': 'Alan', 'MRO': 'Mario', 'RBT': 'Roberto', 'STF': 'Stefano', 'CLD': 'Claudio',
    'POU': 'Paolo', 'FBO': 'Fabio', 'MSS': 'Massimo', 'DNL': 'Daniele', 'NCL': 'Nicola',
    'MCH': 'Michele', 'FBC': 'Fabrizio', 'ALB': 'Alberto', 'GCM': 'Giacomo', 'RCR': 'Riccardo',
    'SLV': 'Silvio', 'VNC': 'Vincenzo', 'SLT': 'Salvatore', 'PTR': 'Pietro', 'FLX': 'Felice',
    'RGG': 'Ruggero', 'ERN': 'Ernesto', 'DRS': 'Dario', 'CSM': 'Cosimo', 'TMM': 'Tommaso',
    'ANM': 'Antonio', 'PLA': 'Paolo', 'GLL': 'Giulio', 'DMN': 'Domenico', 'EMN': 'Emanuele'
  };

  const DIZIONARIO_NOMI_F: Record<string, string> = {
    'SRA': 'Sara', 'GRL': 'Giulia', 'SFA': 'Sofia', 'CHR': 'Chiara', 'FRN': 'Francesca',
    'ALX': 'Alessia', 'VLC': 'Valentina', 'ELN': 'Elena', 'ALC': 'Alice', 'MRT': 'Martina',
    'GVN': 'Giovanna', 'MRA': 'Maria', 'ANF': 'Anna', 'ELZ': 'Elisa', 'GOR': 'Giorgia',
    'LUD': 'Ludovica', 'BTR': 'Beatrice', 'CMB': 'Camilla', 'LRA': 'Laura', 'SBN': 'Sabrina',
    'RBT': 'Roberta', 'STF': 'Stefania', 'CLD': 'Claudia', 'PLA': 'Paola', 'FBA': 'Fabiana',
    'MSS': 'Massima', 'DNL': 'Daniela', 'NCL': 'Nicoletta', 'MCH': 'Michela', 'FBC': 'Fabrizia',
    'ALB': 'Alberta', 'VNC': 'Vincenza', 'PTR': 'Piera', 'FLX': 'Felicia', 'TMM': 'Tomasina',
    'MRC': 'Marica', 'DVE': 'Debora', 'GSP': 'Giuseppina', 'BRB': 'Barbara', 'MNL': 'Manuela',
    'ANM': 'Antonia', 'GLL': 'Giulia', 'DMN': 'Domenica', 'EMN': 'Emanuela', 'CRH': 'Cristina'
  };

  const nomeDecodificato = sesso === 'F'
    ? (DIZIONARIO_NOMI_F[codNome] || DIZIONARIO_NOMI_M[codNome] || codNome.charAt(0) + codNome.slice(1).toLowerCase())
    : (DIZIONARIO_NOMI_M[codNome] || DIZIONARIO_NOMI_F[codNome] || codNome.charAt(0) + codNome.slice(1).toLowerCase());

  const cognomeDecodificato = DIZIONARIO_COGNOMI[codCognome] || (codCognome.charAt(0) + codCognome.slice(1).toLowerCase());

  return {
    valido: true,
    nome: nomeDecodificato,
    cognome: cognomeDecodificato,
    dataNascita,
    sesso,
    comuneNascita,
    provinciaNascita,
    codiceCatastale: codCatastale
  };
};
