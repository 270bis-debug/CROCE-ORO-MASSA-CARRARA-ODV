// Gestione Domanda Iscrizione, Consensi Privacy, Informazioni Sanitarie e Genitore/Tutore
// Croce Oro Massa Carrara ETS OdV
import { formatISODateItaly } from '../utils/italianTime';

export type GruppoSanguigno =
  | 'A+'
  | 'A-'
  | 'B+'
  | 'B-'
  | 'AB+'
  | 'AB-'
  | '0+'
  | '0-'
  | 'Non noto';

export const GRUPPI_SANGUIGNI: GruppoSanguigno[] = [
  'A+',
  'A-',
  'B+',
  'B-',
  'AB+',
  'AB-',
  '0+',
  '0-',
  'Non noto'
];

export interface DatiDomandaIscrizione {
  // 1. INFORMAZIONI SANITARIE
  gruppoSanguigno?: GruppoSanguigno;
  antitetanicaUltimaDose?: string; // YYYY-MM-DD o data
  antitetanicaScadenza?: string; // YYYY-MM-DD
  limitazioniSicurezza?: string; // Informazioni o limitazioni rilevanti

  // 2. DICHIARAZIONI DEL RICHIEDENTE
  dataRichiesta?: string;
  luogoRichiesta?: string;

  // 3. DICHIARAZIONE GENITORE / TUTORE (PER MINORENNI)
  richiedenteMinorenne?: boolean;
  genitoreNomeCognome?: string;
  genitoreRecapiti?: string; // Telefono ed e-mail
  genitoreLuogoData?: string;

  // 4. INFORMATIVA PRIVACY
  presaVisionePrivacy?: boolean;

  // 5. CONSENSO TRATTAMENTO DATI SANITARI
  consensoDatiSanitari?: 'acconsento' | 'non_acconsento';

  // 6. CONSENSO FOTO E VIDEO
  consensoFotoSito?: boolean;
  consensoFotoSocial?: boolean;
  consensoFotoVolantini?: boolean;
  consensoFotoComunicazioniInterne?: boolean;
  consensoFotoNessuno?: boolean;

  // 7. PARTE RISERVATA ALL'ASSOCIAZIONE
  domandaRicevutaIl?: string;
  esitoDomanda?: 'Accolta' | 'Non accolta' | 'In attesa';
  organoCompetente?: string;
  deliberaNumero?: string;
  deliberaData?: string;
  numeroTessera?: string; // Numero di tessera del socio/volontario o operatore di centrale
  forzaturaNumeroTessera?: boolean; // Flag se forzato manualmente dall'amministratore
  numeroIscrizioneLibroSoci?: string;
  quotaVersata?: number;
  esenteQuota?: boolean;
  motivoEsenzione?: 'Benemerito' | 'Giovane' | 'LPU / MAP' | 'Onorario' | string;
  annotazioniAssociazione?: string;
  responsabileNome?: string;
}

export function creaDatiDomandaIscrizionePredefiniti(): DatiDomandaIscrizione {
  const oggi = formatISODateItaly();
  return {
    gruppoSanguigno: 'Non noto',
    antitetanicaUltimaDose: '',
    antitetanicaScadenza: '',
    limitazioniSicurezza: '',
    dataRichiesta: oggi,
    luogoRichiesta: 'Massa Carrara (MS)',
    richiedenteMinorenne: false,
    genitoreNomeCognome: '',
    genitoreRecapiti: '',
    genitoreLuogoData: `Massa Carrara, ${oggi}`,
    presaVisionePrivacy: true,
    consensoDatiSanitari: 'acconsento',
    consensoFotoSito: true,
    consensoFotoSocial: true,
    consensoFotoVolantini: true,
    consensoFotoComunicazioniInterne: true,
    consensoFotoNessuno: false,
    domandaRicevutaIl: oggi,
    esitoDomanda: 'Accolta',
    organoCompetente: 'Consiglio Direttivo',
    deliberaNumero: 'DEL-2026/01',
    deliberaData: oggi,
    numeroTessera: '',
    forzaturaNumeroTessera: false,
    numeroIscrizioneLibroSoci: '',
    quotaVersata: 5.0,
    esenteQuota: false,
    motivoEsenzione: 'Benemerito',
    annotazioniAssociazione: 'Domanda formalizzata con verifica documenti d\'identità e adempimenti RUNTS.',
    responsabileNome: 'Presidente / Legale Rappresentante'
  };
}
