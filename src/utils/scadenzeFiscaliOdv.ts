import { useState, useEffect } from 'react';
import {
  ScadenzaFiscaleODV,
  ConfigScadenzeFiscaliODV,
  StatoScadenzaFiscale,
  CategoriaScadenzaFiscaleODV,
} from '../types/adminTypes';
import { formatISODateItaly, getCurrentYearItaly } from './italianTime';

export const SCADENZE_FISCALI_STORAGE_KEY = 'CROCE_ORO_SCADENZE_FISCALI_ODV';
export const SCADENZE_FISCALI_CONFIG_KEY = 'CROCE_ORO_SCADENZE_FISCALI_CONFIG';
export const SCADENZE_FISCALI_UPDATED_AT_KEY = 'CROCE_ORO_SCADENZE_FISCALI_UPDATED_AT';
export const EVENTO_SCADENZE_FISCALI_UPDATED = 'croceoro_scadenze_fiscali_updated';

export const DEFAULT_CONFIG_SCADENZE_FISCALI: ConfigScadenzeFiscaliODV = {
  giorniPreavvisoDefault: [60, 30, 15],
  destinatariDefault: ['presidente', 'tesoriere', 'segretario'],
};

function prossimaDataAnnuale(mese: number, giorno: number, baseIso?: string): string {
  const oggi = baseIso || formatISODateItaly();
  const annoCorrente = Number(oggi.slice(0, 4)) || getCurrentYearItaly();
  const candidata = `${annoCorrente}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
  if (candidata >= oggi) return candidata;
  return `${annoCorrente + 1}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

function prossimoSediciDelMese(baseIso?: string): string {
  const oggi = baseIso || formatISODateItaly();
  const [y, m, d] = oggi.split('-').map(Number);
  if (!y || !m || !d) return `${getCurrentYearItaly()}-01-16`;
  if (d <= 16) {
    return `${y}-${String(m).padStart(2, '0')}-16`;
  }
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  return `${nextY}-${String(nextM).padStart(2, '0')}-16`;
}

/**
 * Calendario predefinito delle principali scadenze economiche, fiscali e RUNTS
 * per le Organizzazioni di Volontariato (ODV / ETS - D.Lgs. 117/2017 e L. 124/2017).
 */
export function creaScadenzeFiscaliOdvDefault(baseIso?: string): ScadenzaFiscaleODV[] {
  const ref = baseIso || formatISODateItaly();
  return [
    {
      id: 'odv-scad-cu-16-marzo',
      titolo: 'Certificazione Unica (CU) Dipendenti e Collaboratori',
      descrizione:
        'Invio telematico all\'Agenzia delle Entrate e consegna della Certificazione Unica (CU) ai percipienti (dipendenti, collaboratori o lavoratori autonomi occasionali).',
      categoria: 'Dipendenti & Collaboratori',
      dataScadenza: prossimaDataAnnuale(3, 16, ref),
      ricorrenzaAnnuale: true,
      attiva: true,
      stato: 'Aperta',
      riferimentoNormativo: 'DPR 322/1998 — Adempimenti sostituti d\'imposta',
      predefinita: true,
    },
    {
      id: 'odv-scad-5permille-10-aprile',
      titolo: 'Domanda Accreditamento 5 per Mille (Nuove Iscrizioni / Variazioni)',
      descrizione:
        'Termine ordinario per la domanda telematica di accreditamento al riparto del 5 per Mille tramite portale RUNTS (se non già presenti nell\'elenco permanente) e verifica IBAN.',
      categoria: '5 per Mille',
      dataScadenza: prossimaDataAnnuale(4, 10, ref),
      ricorrenzaAnnuale: true,
      attiva: true,
      stato: 'Aperta',
      riferimentoNormativo: 'DPCM 23 luglio 2020 — Riparto 5 per Mille ETS/ODV',
      predefinita: true,
    },
    {
      id: 'odv-scad-bilancio-assemblea-30-aprile',
      titolo: 'Approvazione Bilancio / Rendiconto per Cassa (Mod. D) in Assemblea (entro 120 gg)',
      descrizione:
        'Convocazione Assemblea dei Soci per approvazione del Bilancio di esercizio o Rendiconto per Cassa (Mod. D per entrate entro soglia di legge) relativo all\'anno precedente.',
      categoria: 'RUNTS & Bilancio',
      dataScadenza: prossimaDataAnnuale(4, 30, ref),
      ricorrenzaAnnuale: true,
      attiva: true,
      stato: 'Aperta',
      riferimentoNormativo: 'D.Lgs. 117/2017 Art. 13 — Codice del Terzo Settore',
      predefinita: true,
    },
    {
      id: 'odv-scad-raccolte-fondi-30-aprile',
      titolo: 'Rendiconto Raccolte Pubbliche di Fondi Occasionali',
      descrizione:
        'Predisposizione e approvazione dei rendiconti specifici (con relazione illustrativa) per ogni raccolta pubblica occasionale di fondi effettuata nell\'esercizio precedente (entro 4 mesi dalla chiusura).',
      categoria: 'RUNTS & Bilancio',
      dataScadenza: prossimaDataAnnuale(4, 30, ref),
      ricorrenzaAnnuale: true,
      attiva: true,
      stato: 'Aperta',
      riferimentoNormativo: 'D.Lgs. 117/2017 Art. 7 e Art. 87 c. 6',
      predefinita: true,
    },
    {
      id: 'odv-scad-lipe-1trim-31-maggio',
      titolo: 'LIPE — Liquidazione Periodica IVA (1° Trimestre)',
      descrizione:
        'Trasmissione telematica della Comunicazione Liquidazioni Periodiche IVA relativa al 1° trimestre (obbligatoria solo per ODV titolari di Partita IVA con attività commerciali).',
      categoria: 'Fiscale & Tributi',
      dataScadenza: prossimaDataAnnuale(5, 31, ref),
      ricorrenzaAnnuale: true,
      attiva: false,
      stato: 'Aperta',
      riferimentoNormativo: 'Art. 21-bis D.L. 78/2010 (solo ODV con P.IVA)',
      note: 'Disattivata di default: attivarla se l\'ODV è soggetta a liquidazioni periodiche IVA.',
      predefinita: true,
    },
    {
      id: 'odv-scad-imu-acconto-16-giugno',
      titolo: 'IMU — Acconto Immobili Non Esenti',
      descrizione:
        'Versamento prima rata/acconto IMU per eventuali immobili posseduti dall\'ODV non rientranti nelle esenzioni per attività istituzionali non commerciali.',
      categoria: 'Fiscale & Tributi',
      dataScadenza: prossimaDataAnnuale(6, 16, ref),
      ricorrenzaAnnuale: true,
      attiva: false,
      stato: 'Aperta',
      riferimentoNormativo: 'L. 160/2019 — Verifica esenzione immobili ETS/ODV',
      note: 'Attivare solo in presenza di immobili non esenti da IMU.',
      predefinita: true,
    },
    {
      id: 'odv-scad-deposito-runts-30-giugno',
      titolo: 'Deposito Telematico Bilancio / Rendiconto sul Portale RUNTS (entro 180 gg)',
      descrizione:
        'Deposito obbligatorio nel Registro Unico Nazionale del Terzo Settore (RUNTS) del Bilancio d\'esercizio o Rendiconto per Cassa (Mod. D) e dei rendiconti di raccolta fondi entro 180 giorni dalla chiusura dell\'esercizio.',
      categoria: 'RUNTS & Bilancio',
      dataScadenza: prossimaDataAnnuale(6, 30, ref),
      ricorrenzaAnnuale: true,
      attiva: true,
      stato: 'Aperta',
      riferimentoNormativo: 'D.Lgs. 117/2017 Art. 48 c. 3 — Deposito RUNTS',
      predefinita: true,
    },
    {
      id: 'odv-scad-aggiornamento-runts-30-giugno',
      titolo: 'Aggiornamento Annuale Soci, Volontari e Lavoratori su RUNTS',
      descrizione:
        'Comunicazione telematica sul portale RUNTS del numero aggiornato di associati, volontari iscritti nel registro e lavoratori dipendenti/parasubordinati al 31 dicembre dell\'anno precedente.',
      categoria: 'RUNTS & Bilancio',
      dataScadenza: prossimaDataAnnuale(6, 30, ref),
      ricorrenzaAnnuale: true,
      attiva: true,
      stato: 'Aperta',
      riferimentoNormativo: 'DM 106/2020 Art. 20 — Aggiornamento annuale RUNTS',
      predefinita: true,
    },
    {
      id: 'odv-scad-trasparenza-l124-30-giugno',
      titolo: 'Pubblicazione Trasparenza Contributi Pubblici > 10.000 € (Legge 124/2017)',
      descrizione:
        'Pubblicazione online (sul sito associativo o pagina istituzionale) dell\'elenco dettagliato di contributi, sovvenzioni e vantaggi economici ricevuti da Pubbliche Amministrazioni nell\'anno precedente se complessivamente pari o superiori a 10.000 €.',
      categoria: 'Trasparenza',
      dataScadenza: prossimaDataAnnuale(6, 30, ref),
      ricorrenzaAnnuale: true,
      attiva: true,
      stato: 'Aperta',
      riferimentoNormativo: 'Legge 124/2017 Art. 1 commi 125-129',
      predefinita: true,
    },
    {
      id: 'odv-scad-5permille-tardiva-30-settembre',
      titolo: 'Iscrizione Tardiva 5 per Mille (Remissione in Bonis)',
      descrizione:
        'Ultimo termine utile per l\'accreditamento tardivo al 5 per Mille tramite remissione in bonis (con versamento della sanzione minima tramite F24 ELIDE).',
      categoria: '5 per Mille',
      dataScadenza: prossimaDataAnnuale(9, 30, ref),
      ricorrenzaAnnuale: true,
      attiva: false,
      stato: 'Aperta',
      riferimentoNormativo: 'D.L. 16/2012 Art. 2 — Remissione in bonis 5x1000',
      note: 'Attivare solo se non si è perfezionata l\'iscrizione entro il 10 aprile.',
      predefinita: true,
    },
    {
      id: 'odv-scad-5permille-rendiconto-30-settembre',
      titolo: 'Rendicontazione Quote 5 per Mille Percepite (entro 12 mesi dall\'incasso)',
      descrizione:
        'Redazione del rendiconto e della relazione illustrativa sull\'impiego delle somme del 5 per Mille entro 12 mesi dalla data di effettiva percezione (con trasmissione telematica al Ministero se quota >= 20.000 €).',
      categoria: '5 per Mille',
      dataScadenza: prossimaDataAnnuale(9, 30, ref),
      ricorrenzaAnnuale: true,
      attiva: true,
      stato: 'Aperta',
      riferimentoNormativo: 'DPCM 23 luglio 2020 Art. 16 — Rendiconto 5x1000',
      note: 'Personalizzare la data in base al giorno effettivo di accredito del contributo sul conto corrente.',
      predefinita: true,
    },
    {
      id: 'odv-scad-modello-770-31-ottobre',
      titolo: 'Modello 770 — Dichiarazione Sostituti d\'Imposta',
      descrizione:
        'Trasmissione telematica del Modello 770 per le ritenute operate nell\'anno precedente su redditi di lavoro dipendente, collaborazioni o prestazioni autonome.',
      categoria: 'Dipendenti & Collaboratori',
      dataScadenza: prossimaDataAnnuale(10, 31, ref),
      ricorrenzaAnnuale: true,
      attiva: false,
      stato: 'Aperta',
      riferimentoNormativo: 'DPR 322/1998 Art. 4 (se l\'ODV ha erogato compensi con ritenuta)',
      predefinita: true,
    },
    {
      id: 'odv-scad-modello-enc-31-ottobre',
      titolo: 'Dichiarazione dei Redditi Modello ENC (Enti Non Commerciali) e IRAP',
      descrizione:
        'Presentazione telematica del Modello Redditi ENC (ed eventuale dichiarazione IRAP) per gli enti tenuti alla dichiarazione di redditi commerciali, fondiari o diversi.',
      categoria: 'Fiscale & Tributi',
      dataScadenza: prossimaDataAnnuale(10, 31, ref),
      ricorrenzaAnnuale: true,
      attiva: true,
      stato: 'Aperta',
      riferimentoNormativo: 'TUIR / DPR 322/1998 — Enti Non Commerciali',
      predefinita: true,
    },
    {
      id: 'odv-scad-acconto-ires-irap-30-novembre',
      titolo: 'Secondo Acconto IRES / IRAP e LIPE 3° Trimestre',
      descrizione:
        'Versamento del secondo o unico acconto IRES/IRAP (per eventuali attività commerciali imponibili) e invio LIPE 3° trimestre per enti con Partita IVA.',
      categoria: 'Fiscale & Tributi',
      dataScadenza: prossimaDataAnnuale(11, 30, ref),
      ricorrenzaAnnuale: true,
      attiva: false,
      stato: 'Aperta',
      riferimentoNormativo: 'Scadenziario Fiscale Agenzia delle Entrate (se applicabile)',
      predefinita: true,
    },
    {
      id: 'odv-scad-imu-saldo-16-dicembre',
      titolo: 'IMU — Saldo Immobili Non Esenti',
      descrizione:
        'Versamento saldo IMU annuale per eventuali immobili posseduti non esenti ai sensi della disciplina ETS/ODV.',
      categoria: 'Fiscale & Tributi',
      dataScadenza: prossimaDataAnnuale(12, 16, ref),
      ricorrenzaAnnuale: true,
      attiva: false,
      stato: 'Aperta',
      riferimentoNormativo: 'L. 160/2019 — Saldo IMU annuale',
      predefinita: true,
    },
    {
      id: 'odv-scad-versamenti-mensili-16',
      titolo: 'Versamenti Periodici Mensili (F24 Ritenute, Contributi INPS, IVA)',
      descrizione:
        'Scadenza ricorrente del 16 di ogni mese per versamento ritenute su dipendenti/collaboratori, contributi INPS del mese precedente ed eventuale liquidazione IVA.',
      categoria: 'Dipendenti & Collaboratori',
      dataScadenza: prossimoSediciDelMese(ref),
      ricorrenzaAnnuale: false,
      attiva: false,
      stato: 'Aperta',
      riferimentoNormativo: 'D.Lgs. 241/1997 — Scadenza F24 giorno 16 del mese',
      note: 'Attivare se l\'ODV effettua versamenti F24 mensili (dipendenti/collaboratori o P.IVA).',
      predefinita: true,
    },
    {
      id: 'odv-scad-chiusura-esercizio-31-dicembre',
      titolo: 'Chiusura Esercizio Sociale, Registro Volontari e Verifica Assicurazione ODV',
      descrizione:
        'Chiusura dell\'esercizio contabile annuale, verifica dell\'aggiornamento del Registro Volontari (obbligatorio ex art. 17 D.Lgs. 117/2017) e rinnovo/verifica polizze assicurative infortuni, malattie e RCT volontari.',
      categoria: 'RUNTS & Bilancio',
      dataScadenza: prossimaDataAnnuale(12, 31, ref),
      ricorrenzaAnnuale: true,
      attiva: true,
      stato: 'Aperta',
      riferimentoNormativo: 'D.Lgs. 117/2017 Art. 17 e Art. 18 (Assicurazione obbligatoria)',
      predefinita: true,
    },
  ];
}

export function normalizzaGiorniPreavviso(raw?: unknown): number[] {
  if (!Array.isArray(raw)) return [60, 30, 15];
  const nums = Array.from(
    new Set(
      raw
        .map((n) => Math.floor(Number(n)))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 365)
    )
  ).sort((a, b) => b - a);
  return nums.length > 0 ? nums : [60, 30, 15];
}

export function normalizzaListaScadenzeFiscali(raw: any[]): ScadenzaFiscaleODV[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const validStati: StatoScadenzaFiscale[] = ['Aperta', 'Chiusa', 'Annullata'];
  const validCat: CategoriaScadenzaFiscaleODV[] = [
    'RUNTS & Bilancio',
    '5 per Mille',
    'Trasparenza',
    'Fiscale & Tributi',
    'Dipendenti & Collaboratori',
    'Altro',
  ];
  const out: ScadenzaFiscaleODV[] = [];
  raw.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const titolo = String(item.titolo || '').trim();
    const dataScadenza = String(item.dataScadenza || '').trim();
    if (!titolo || !/^\d{4}-\d{2}-\d{2}$/.test(dataScadenza)) return;
    const id = String(item.id || `odv-scad-${Date.now()}-${idx}`);
    if (seen.has(id)) return;
    seen.add(id);
    const stato: StatoScadenzaFiscale = validStati.includes(item.stato) ? item.stato : 'Aperta';
    const categoria: CategoriaScadenzaFiscaleODV = validCat.includes(item.categoria)
      ? item.categoria
      : 'Altro';
    out.push({
      id,
      titolo,
      descrizione: String(item.descrizione || '').trim(),
      categoria,
      dataScadenza,
      ricorrenzaAnnuale: Boolean(item.ricorrenzaAnnuale),
      attiva: typeof item.attiva === 'boolean' ? item.attiva : true,
      stato,
      giorniPreavvisoCustom:
        Array.isArray(item.giorniPreavvisoCustom) && item.giorniPreavvisoCustom.length > 0
          ? normalizzaGiorniPreavviso(item.giorniPreavvisoCustom)
          : undefined,
      riferimentoNormativo: item.riferimentoNormativo ? String(item.riferimentoNormativo).trim() : undefined,
      note: item.note ? String(item.note).trim() : undefined,
      notificheInviate:
        item.notificheInviate && typeof item.notificheInviate === 'object' && !Array.isArray(item.notificheInviate)
          ? { ...item.notificheInviate }
          : undefined,
      predefinita: Boolean(item.predefinita),
      creataDa: item.creataDa ? String(item.creataDa) : undefined,
      aggiornataIl: item.aggiornataIl ? String(item.aggiornataIl) : undefined,
    });
  });
  return out.sort((a, b) => a.dataScadenza.localeCompare(b.dataScadenza));
}

export function normalizzaConfigScadenzeFiscali(raw?: any): ConfigScadenzeFiscaliODV {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_CONFIG_SCADENZE_FISCALI };
  }
  const destRaw = Array.isArray(raw.destinatariDefault) ? raw.destinatariDefault : ['presidente', 'tesoriere', 'segretario'];
  const allowedDest = new Set(['presidente', 'tesoriere', 'segretario']);
  const dest = destRaw.filter((d: any) => allowedDest.has(d)) as Array<'presidente' | 'tesoriere' | 'segretario'>;
  return {
    giorniPreavvisoDefault: normalizzaGiorniPreavviso(raw.giorniPreavvisoDefault),
    destinatariDefault: dest.length > 0 ? dest : ['presidente', 'tesoriere', 'segretario'],
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : undefined,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined,
  };
}

export function getScadenzeFiscaliUpdatedAt(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(SCADENZE_FISCALI_UPDATED_AT_KEY);
    const num = raw ? Number(raw) : 0;
    return Number.isFinite(num) && num > 0 ? num : 0;
  } catch {
    return 0;
  }
}

function touchScadenzeFiscaliUpdatedAt(ts?: number): number {
  const val = typeof ts === 'number' && Number.isFinite(ts) && ts > 0 ? ts : Date.now();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SCADENZE_FISCALI_UPDATED_AT_KEY, String(val));
    } catch {}
  }
  return val;
}

export function getScadenzeFiscaliOdv(): ScadenzaFiscaleODV[] {
  if (typeof window === 'undefined') return creaScadenzeFiscaliOdvDefault();
  try {
    const raw = localStorage.getItem(SCADENZE_FISCALI_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return normalizzaListaScadenzeFiscali(parsed);
      }
    }
  } catch {}
  const defaults = creaScadenzeFiscaliOdvDefault();
  try {
    localStorage.setItem(SCADENZE_FISCALI_STORAGE_KEY, JSON.stringify(defaults));
  } catch {}
  return defaults;
}

export function getConfigScadenzeFiscaliOdv(): ConfigScadenzeFiscaliODV {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG_SCADENZE_FISCALI };
  try {
    const raw = localStorage.getItem(SCADENZE_FISCALI_CONFIG_KEY);
    if (raw) {
      return normalizzaConfigScadenzeFiscali(JSON.parse(raw));
    }
  } catch {}
  return { ...DEFAULT_CONFIG_SCADENZE_FISCALI };
}

export function salvaScadenzeFiscaliOdv(
  lista: ScadenzaFiscaleODV[],
  config?: ConfigScadenzeFiscaliODV,
  updatedAt?: number
): { lista: ScadenzaFiscaleODV[]; config: ConfigScadenzeFiscaliODV } {
  const normLista = normalizzaListaScadenzeFiscali(lista);
  const normConfig = config ? normalizzaConfigScadenzeFiscali(config) : getConfigScadenzeFiscaliOdv();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SCADENZE_FISCALI_STORAGE_KEY, JSON.stringify(normLista));
      localStorage.setItem(SCADENZE_FISCALI_CONFIG_KEY, JSON.stringify(normConfig));
    } catch {}
    touchScadenzeFiscaliUpdatedAt(updatedAt);
    try {
      window.dispatchEvent(new CustomEvent(EVENTO_SCADENZE_FISCALI_UPDATED));
    } catch {}
  }
  return { lista: normLista, config: normConfig };
}

export function applicaScadenzeFiscaliDaSync(
  lista?: any[],
  config?: any,
  updatedAt?: number
): boolean {
  if (!Array.isArray(lista) && !config) return false;
  const localTs = getScadenzeFiscaliUpdatedAt();
  if (typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt > 0 && localTs > updatedAt) {
    return false;
  }
  const currentLista = Array.isArray(lista) ? lista : getScadenzeFiscaliOdv();
  const currentConfig = config ? normalizzaConfigScadenzeFiscali(config) : getConfigScadenzeFiscaliOdv();
  salvaScadenzeFiscaliOdv(currentLista, currentConfig, updatedAt || Date.now());
  return true;
}

export function useScadenzeFiscaliOdv(): {
  scadenze: ScadenzaFiscaleODV[];
  config: ConfigScadenzeFiscaliODV;
} {
  const [state, setState] = useState(() => ({
    scadenze: getScadenzeFiscaliOdv(),
    config: getConfigScadenzeFiscaliOdv(),
  }));

  useEffect(() => {
    const refresh = () => {
      setState({
        scadenze: getScadenzeFiscaliOdv(),
        config: getConfigScadenzeFiscaliOdv(),
      });
    };
    window.addEventListener(EVENTO_SCADENZE_FISCALI_UPDATED, refresh);
    return () => window.removeEventListener(EVENTO_SCADENZE_FISCALI_UPDATED, refresh);
  }, []);

  return state;
}

export function calcolaGiorniAllaScadenza(dataIso: string, oggiIso?: string): number {
  const ref = oggiIso || formatISODateItaly();
  const [y1, m1, d1] = ref.split('-').map(Number);
  const [y2, m2, d2] = dataIso.split('-').map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 9999;
  const t1 = Date.UTC(y1, m1 - 1, d1, 12, 0, 0);
  const t2 = Date.UTC(y2, m2 - 1, d2, 12, 0, 0);
  return Math.round((t2 - t1) / 86400000);
}

export interface DestinatarioScadenzaFiscale {
  id: string;
  nome: string;
  ruolo: 'Presidente' | 'Tesoriere' | 'Segretario';
  email: string;
}

export function risolviDestinatariScadenzeFiscali(
  volontari: Array<{
    id: string;
    nome: string;
    cognome: string;
    email?: string;
    emailNotifiche?: string;
    caricaConsiglioDirettivo?: string;
    qualifica?: string;
  }>
): DestinatarioScadenzaFiscale[] {
  const out: DestinatarioScadenzaFiscale[] = [];
  const seen = new Set<string>();
  for (const v of volontari || []) {
    const carica = `${v.caricaConsiglioDirettivo || ''} ${v.qualifica || ''}`.toLowerCase();
    let ruolo: DestinatarioScadenzaFiscale['ruolo'] | null = null;
    if (carica.includes('presidente') && !carica.includes('vicepresidente')) {
      ruolo = 'Presidente';
    } else if (carica.includes('tesorier')) {
      ruolo = 'Tesoriere';
    } else if (carica.includes('segretar')) {
      ruolo = 'Segretario';
    }
    if (!ruolo) continue;
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    const email = (v.emailNotifiche || v.email || '').trim();
    out.push({
      id: v.id,
      nome: `${v.nome} ${v.cognome}`.trim(),
      ruolo,
      email,
    });
  }
  return out;
}

export function isUtenteTesoriereOAdmin(
  utente?: {
    isAdmin?: boolean;
    pin?: string;
    caricaConsiglioDirettivo?: string;
    qualifica?: string;
  } | null
): boolean {
  if (!utente) return false;
  if (utente.isAdmin || utente.pin === '4451') return true;
  const carica = `${utente.caricaConsiglioDirettivo || ''} ${utente.qualifica || ''}`.toLowerCase();
  return carica.includes('tesorier');
}

export async function inviaEmailPromemoriaScadenzaFiscale(params: {
  scadenza: ScadenzaFiscaleODV;
  giorniMancanti: number;
  sogliaGiorni: number;
  destinatari: DestinatarioScadenzaFiscale[];
  cloudLog?: Record<string, string>;
  apiBase?: string;
  force?: boolean;
}): Promise<{
  ok: boolean;
  inviate: number;
  alreadySent?: boolean;
  promemoriaScadenzeFiscaliInviate?: Record<string, string>;
}> {
  const emails = Array.from(
    new Set(
      params.destinatari
        .map((d) => d.email.trim().toLowerCase())
        .filter((e) => e.includes('@'))
    )
  );
  if (emails.length === 0) return { ok: false, inviate: 0 };
  const base = (params.apiBase || '').replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/api/notifica-scadenza-fiscale-odv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scadenza: {
          id: params.scadenza.id,
          titolo: params.scadenza.titolo,
          descrizione: params.scadenza.descrizione,
          categoria: params.scadenza.categoria,
          dataScadenza: params.scadenza.dataScadenza,
          stato: params.scadenza.stato,
          riferimentoNormativo: params.scadenza.riferimentoNormativo || '',
          note: params.scadenza.note || '',
        },
        giorniMancanti: params.giorniMancanti,
        sogliaGiorni: params.sogliaGiorni,
        destinatari: params.destinatari.map((d) => `${d.nome} (${d.ruolo})`),
        destinatariEmails: emails,
        cloudLog: params.cloudLog,
        force: Boolean(params.force),
      }),
    });
    const json = await res.json().catch(() => ({}));
    return {
      ok: Boolean(json.success),
      inviate: json.alreadySent ? 0 : Number(json.countInviate || (json.success ? emails.length : 0)),
      alreadySent: Boolean(json.alreadySent),
      promemoriaScadenzeFiscaliInviate: json.promemoriaScadenzeFiscaliInviate,
    };
  } catch {
    return { ok: false, inviate: 0 };
  }
}
