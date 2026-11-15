// Gestione Tesseramento, Quote Sociali, Ricevute Sequenziali e Cariche Direttivo
// Croce Oro Massa Carrara ETS OdV
import { getCurrentYearItaly, getItalianDateParts } from '../utils/italianTime';

export type CaricaConsiglioDirettivo =
  | 'Presidente / Legale Rappresentante'
  | 'Vicepresidente'
  | 'Tesoriere'
  | 'Segretario'
  | 'Consigliere'
  | 'Presidente'
  | 'Vice Presidente'
  | 'Tesoriera'
  | 'Membro del Direttivo'
  | 'Nessuna';

export const CARICHE_DIRETTIVO_DISPONIBILI: CaricaConsiglioDirettivo[] = [
  'Nessuna',
  'Presidente / Legale Rappresentante',
  'Vicepresidente',
  'Tesoriere',
  'Segretario',
  'Consigliere'
];

export const QUOTA_TESSERA_VOLONTARIO = 5.0; // € 5,00 per volontari
export const QUOTA_TESSERA_OPERATORE = 10.0; // € 10,00 per operatori centrale

export const DICITURA_ESENZIONE_BOLLO =
  "Documento esente da imposta di bollo ai sensi dell'art. 82, comma 5, del D.Lgs. n. 117/2017";

export interface RicevutaTesseramento {
  id: string;
  numeroProgressivo: number; // 1, 2, 3...
  annoRiferimento: number; // es. 2026
  numeroRicevutaFormattato: string; // es. "01/2026"
  dataEmissione: string; // YYYY-MM-DD
  importo: number; // 5.00, 10.00 oppure 0.00
  esenteQuotaPrimoAnno?: boolean; // Se iscritto a Ott/Nov/Dic anno prec.
  dicituraFiscale: string;
  socioId: string;
  nomeSocio: string;
  cognomeSocio: string;
  codiceFiscaleSocio?: string;
  indirizzoResidenzaSocio?: string;
  qualificaSocio: string;
  caricaDirettivoSocio?: string;
  numeroTessera?: string;
  // Dati Tesoriera che firma il documento
  tesorieraNome?: string;
  tesorieraCarica?: string;
  tesorieraFirmaBase64?: string;
}

export interface DatiTesseramento {
  numeroTessera?: string; // Es. "TO-01" o "TV-101"
  dataPrimaIscrizione?: string; // YYYY-MM-DD
  annoRiferimento: number; // Anno corrente del tesseramento (es. 2026)
  rinnovata: boolean; // True se l'amministratore ha spuntato il rinnovo
  dataRinnovo?: string; // YYYY-MM-DD
  numeroRicevuta?: number; // Progressivo numerico sequenziale
  numeroRicevutaFormattato?: string; // Es. "01/2026"
  importoVersato?: number; // Quota effettivamente versata (es. 5.00, 10.00 o 0.00)
  copertaDaIscrizioneFineAnnoPrec?: boolean; // Iscritto a Ott/Nov/Dic anno precedente
  timbroCartaceoEseguito?: boolean; // Flag se l'amministratore ha apposto il timbro sulla tessera cartacea
  dataTimbroCartaceo?: string;
  note?: string;
  ricevutaAttuale?: RicevutaTesseramento;
  storicoRicevute?: RicevutaTesseramento[];
}

/**
 * Verifica se la persona ha effettuato la prima iscrizione nei mesi di
 * Ottobre (10), Novembre (11) o Dicembre (12) dell'anno precedente all'anno in corso.
 * In tal caso la quota dell'anno in corso è già compresa e va solo apposto il timbro cartaceo.
 */
export function haIscrizioneOttNovDicAnnoPrecedente(
  dataPrimaIscrizioneStr?: string,
  annoCorrente: number = getCurrentYearItaly()
): boolean {
  if (!dataPrimaIscrizioneStr) return false;
  const match = dataPrimaIscrizioneStr.trim();
  if (!match) return false;

  let annoIscrizione: number | null = null;
  let meseIscrizione: number | null = null;

  const isoMatch = match.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    annoIscrizione = parseInt(isoMatch[1], 10);
    meseIscrizione = parseInt(isoMatch[2], 10);
  } else {
    const itMatch = match.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (itMatch) {
      meseIscrizione = parseInt(itMatch[2], 10);
      annoIscrizione = parseInt(itMatch[3], 10);
    } else {
      const data = new Date(match);
      if (!isNaN(data.getTime())) {
        const itParts = getItalianDateParts(data);
        annoIscrizione = itParts.year;
        meseIscrizione = itParts.month;
      }
    }
  }

  if (annoIscrizione === null || meseIscrizione === null) return false;

  // Anno precedente e mese 10, 11 o 12
  return annoIscrizione === annoCorrente - 1 && (meseIscrizione === 10 || meseIscrizione === 11 || meseIscrizione === 12);
}

/**
 * Calcola l'importo dovuto per il rinnovo tessera dell'anno in corso:
 * - 0 € se iscritto per la prima volta a Ott/Nov/Dic dell'anno precedente
 * - 10 € se Operatore di Centrale
 * - 5 € se Volontario
 */
export function calcolaImportoDovutoTesseramento(
  isOperatoreCentrale: boolean,
  dataPrimaIscrizioneStr?: string,
  annoCorrente: number = getCurrentYearItaly()
): {
  importo: number;
  esentePerFineAnno: boolean;
  motivoEsclusione?: string;
} {
  if (haIscrizioneOttNovDicAnnoPrecedente(dataPrimaIscrizioneStr, annoCorrente)) {
    return {
      importo: 0,
      esentePerFineAnno: true,
      motivoEsclusione: `Iscrizione iniziale effettuata a fine anno ${annoCorrente - 1} (Ott/Nov/Dic): quota ${annoCorrente} già coperta, da apporre solo il timbro cartaceo senza richiedere somma.`
    };
  }

  const importo = isOperatoreCentrale ? QUOTA_TESSERA_OPERATORE : QUOTA_TESSERA_VOLONTARIO;
  return {
    importo,
    esentePerFineAnno: false
  };
}

/**
 * Calcola lo stato del rinnovo per l'anno di riferimento (es. 2026):
 * A gennaio va rinnovata e si ha tempo fino ad aprile.
 */
export function calcolaStatoPeriodoRinnovo(
  tesseramento?: DatiTesseramento,
  annoCorrente: number = getCurrentYearItaly()
): {
  stato: 'rinnovata' | 'in_corso' | 'scaduta' | 'non_iscritta';
  label: string;
  colore: 'emerald' | 'amber' | 'rose' | 'slate';
  dettaglio: string;
} {
  const oggiIt = getItalianDateParts();
  const meseOggi = oggiIt.month; // 1-12
  const annoOggi = oggiIt.year;

  if (!tesseramento || !tesseramento.numeroTessera) {
    return {
      stato: 'non_iscritta',
      label: 'Tessera Non Attiva',
      colore: 'slate',
      dettaglio: 'Socio non ancora registrato al libro soci/tesseramento.'
    };
  }

  if (tesseramento.rinnovata && tesseramento.annoRiferimento === annoCorrente) {
    return {
      stato: 'rinnovata',
      label: `Rinnovata ${annoCorrente} ✓`,
      colore: 'emerald',
      dettaglio: `Tessera in regola per l'anno ${annoCorrente}${tesseramento.dataRinnovo ? ` (rinnovata il ${tesseramento.dataRinnovo})` : ''}.`
    };
  }

  // Se siamo nell'anno corrente ma non è ancora rinnovata:
  if (annoOggi === annoCorrente) {
    if (meseOggi <= 4) {
      // Gennaio - Aprile: finestra ordinaria di rinnovo
      return {
        stato: 'in_corso',
        label: 'Rinnovo in Corso (Scad. 30 Apr)',
        colore: 'amber',
        dettaglio: `Finestra di rinnovo annuale aperta fino al 30 Aprile ${annoCorrente}. Quota da versare.`
      };
    } else {
      // Da Maggio in poi
      return {
        stato: 'scaduta',
        label: `Rinnovo Scaduto (${annoCorrente})`,
        colore: 'rose',
        dettaglio: `Termine del 30 Aprile ${annoCorrente} superato. Tessera non ancora rinnovata.`
      };
    }
  }

  return {
    stato: 'scaduta',
    label: `Da Rinnovare (${annoCorrente})`,
    colore: 'amber',
    dettaglio: `Tessera da rinnovare per l'anno sociale ${annoCorrente}.`
  };
}

/**
 * Calcola il prossimo numero progressivo sequenziale per le ricevute dell'anno specificato.
 */
export function calcolaProssimoNumeroRicevuta(
  volontari: Array<{ tesseramento?: DatiTesseramento }>,
  anno: number = getCurrentYearItaly()
): number {
  let maxNum = 0;

  volontari.forEach((v) => {
    const tess = v.tesseramento;
    if (tess) {
      if (tess.annoRiferimento === anno && tess.numeroRicevuta && tess.numeroRicevuta > maxNum) {
        maxNum = tess.numeroRicevuta;
      }
      if (tess.storicoRicevute) {
        tess.storicoRicevute.forEach((r) => {
          if (r.annoRiferimento === anno && r.numeroProgressivo > maxNum) {
            maxNum = r.numeroProgressivo;
          }
        });
      }
    }
  });

  return maxNum + 1;
}

/**
 * Formatta il numero di ricevuta sequenziale (es. "01/2026", "02/2026", ...)
 */
export function formattaNumeroRicevuta(numero: number, anno: number): string {
  const numPadded = numero < 10 ? `0${numero}` : `${numero}`;
  return `${numPadded}/${anno}`;
}

/**
 * Data limite per l'inserimento puramente manuale del numero di tessera: 31 Ottobre 2026.
 * Fino al 31/10/2026 l'amministratore inserisce a mano i numeri di tessera per i soci già approvati.
 * Dopo tale data, il numero viene calcolato in automatico prendendo l'ultimo progressivo emesso + 1,
 * con possibilità di spuntare la casella per forzarne manualmente uno nuovo se necessario.
 */
export const DATA_LIMITE_MANUALE_TESSERE = '2026-10-31';

export function isPeriodoInserimentoManualeTessere(dataConfronto: Date = new Date()): boolean {
  // 31 Ottobre 2026 ore 23:59:59 (Mese 9 in JS è Ottobre)
  const dataLimite = new Date(2026, 9, 31, 23, 59, 59);
  return dataConfronto.getTime() <= dataLimite.getTime();
}

export interface RisultatoProssimaTessera {
  prossimoNumeroTessera: string;
  ultimaTesseraEmessa: string;
  progressivoNumero: number;
  prefisso: string;
  isOperatore: boolean;
}

/**
 * Trova l'ultima tessera emessa manualmente o registrata nel database e calcola il progressivo successivo (+1).
 * Gestisce sia volontari operativi (prefisso es. "TV-101", "VOL-101", "101")
 * che operatori di centrale (prefisso es. "TO-01", "OP-01").
 */
export function calcolaProssimoNumeroTessera(
  volontari: Array<{
    profiloCentrale?: boolean;
    qualifica?: string;
    matricola?: string;
    tesseramento?: DatiTesseramento;
  }>,
  isOperatore: boolean = false
): RisultatoProssimaTessera {
  let maxProg = 0;
  let ultimaTessera = '';
  let prefissoRilevato = isOperatore ? 'TO-' : 'TV-';
  let padDigits = isOperatore ? 2 : 3;

  volontari.forEach((v) => {
    const isOpVol = !!v.profiloCentrale || v.qualifica === 'Operatore Centrale';
    if (isOpVol !== isOperatore) {
      // Separa la numerazione volontari da quella operatori se differenziata
      return;
    }

    // Ispeziona numeroTessera dal tesseramento o dalla matricola
    const candidati = [
      v.tesseramento?.numeroTessera,
      v.tesseramento?.ricevutaAttuale?.numeroTessera,
      v.matricola
    ].filter(Boolean) as string[];

    candidati.forEach((str) => {
      const match = str.match(/^(.*?)(\d+)$/);
      if (match) {
        const prefisso = match[1];
        const num = parseInt(match[2], 10);
        if (!isNaN(num) && num > maxProg) {
          maxProg = num;
          ultimaTessera = str;
          if (prefisso) prefissoRilevato = prefisso;
          padDigits = Math.max(padDigits, match[2].length);
        }
      }
    });
  });

  // Se nessun volontario trovato o numeri non identificati, imposta base predefinita
  if (maxProg === 0) {
    if (isOperatore) {
      maxProg = 1;
      ultimaTessera = 'TO-01';
      return {
        prossimoNumeroTessera: 'TO-02',
        ultimaTesseraEmessa: ultimaTessera,
        progressivoNumero: 2,
        prefisso: 'TO-',
        isOperatore: true
      };
    } else {
      maxProg = 104;
      ultimaTessera = 'TV-104';
      return {
        prossimoNumeroTessera: 'TV-105',
        ultimaTesseraEmessa: ultimaTessera,
        progressivoNumero: 105,
        prefisso: 'TV-',
        isOperatore: false
      };
    }
  }

  const proxProg = maxProg + 1;
  const proxString = `${prefissoRilevato}${String(proxProg).padStart(padDigits, '0')}`;

  return {
    prossimoNumeroTessera: proxString,
    ultimaTesseraEmessa: ultimaTessera || `${prefissoRilevato}${maxProg}`,
    progressivoNumero: proxProg,
    prefisso: prefissoRilevato,
    isOperatore
  };
}
