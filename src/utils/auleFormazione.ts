import { useState, useEffect } from 'react';
import {
  AulaFormazione,
  CorsoFormazione,
  LezioneCorso,
  PartecipanteCorso,
} from '../types/adminTypes';
import { formatDateItaly, formatISODateItaly } from './italianTime';

export const AULE_FORMAZIONE_STORAGE_KEY = 'CROCE_ORO_AULE_FORMAZIONE';
export const AULE_FORMAZIONE_UPDATED_AT_KEY = 'CROCE_ORO_AULE_FORMAZIONE_UPDATED_AT';
export const EVENTO_AULE_FORMAZIONE_UPDATED = 'croceoro_aule_formazione_updated';

export const AULE_FORMAZIONE_DEFAULT: AulaFormazione[] = [
  {
    id: 'aula-ronchi-magna',
    codice: 'AULA-01',
    nome: 'Aula Didattica Magna — Sede Ronchi',
    sedeRiferimentoId: 'sede-massa-ronchi',
    sedeRiferimentoNome: 'Sede Legale & Direzione Generale Massa (Ronchi)',
    indirizzo: 'Via Como, 12 Località Ronchi, 54100 Marina di Massa (MS)',
    coordinate: { lat: 43.99419, lng: 10.12367 },
    raggioMetri: 150,
    capienza: 35,
    attiva: true,
    note: 'Aula didattica principale per corsi formativi, seminari PSV e BLSD.',
    dataCreazione: '01/01/2026',
  },
  {
    id: 'aula-lejare-formazione',
    codice: 'AULA-02',
    nome: 'Aula Formazione & Addestramento — Sede Le Jare',
    sedeRiferimentoId: 'sede-massa-lejare',
    sedeRiferimentoNome: 'Sede Operativa H24 & Autoparco Emergenze Massa (Le Jare)',
    indirizzo: 'Via Delle Jare, 9, 54100 Massa (MS)',
    coordinate: { lat: 44.01700, lng: 10.15121 },
    raggioMetri: 150,
    capienza: 25,
    attiva: true,
    note: 'Aula didattica presso sede operativa Le Jare.',
    dataCreazione: '01/01/2026',
  },
  {
    id: 'aula-carrara-fossone',
    codice: 'AULA-03',
    nome: 'Aula Didattica Sezione Carrara (Fossone)',
    sedeRiferimentoId: 'sede-carrara-fossone',
    sedeRiferimentoNome: 'Sezione Territoriale Carrara (Fossone / Monteverde)',
    indirizzo: 'Strada Comunale di Monteverde, 49 Località Fossone, 54033 Carrara (MS)',
    coordinate: { lat: 44.066716, lng: 10.049207 },
    raggioMetri: 150,
    capienza: 25,
    attiva: true,
    dataCreazione: '01/01/2026',
  },
];

export function normalizzaListaAuleFormazione(raw: any[]): AulaFormazione[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: AulaFormazione[] = [];
  raw.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const nome = String(item.nome || '').trim();
    if (!nome) return;
    const id = String(item.id || `aula-${Date.now()}-${idx}`);
    if (seen.has(id)) return;
    seen.add(id);
    const lat = Number(item.coordinate?.lat);
    const lng = Number(item.coordinate?.lng);
    const raggioRaw = Number(item.raggioMetri);
    out.push({
      id,
      nome,
      codice: item.codice ? String(item.codice).trim().toUpperCase() : undefined,
      sedeRiferimentoId: item.sedeRiferimentoId ? String(item.sedeRiferimentoId).trim() : undefined,
      sedeRiferimentoNome: item.sedeRiferimentoNome ? String(item.sedeRiferimentoNome).trim() : undefined,
      indirizzo: String(item.indirizzo || '').trim() || 'Massa-Carrara',
      coordinate: {
        lat: Number.isFinite(lat) ? lat : 43.99419,
        lng: Number.isFinite(lng) ? lng : 10.12367,
      },
      raggioMetri: Number.isFinite(raggioRaw) && raggioRaw >= 20 && raggioRaw <= 1000 ? Math.round(raggioRaw) : 150,
      capienza: Number.isFinite(Number(item.capienza)) && Number(item.capienza) > 0 ? Math.round(Number(item.capienza)) : undefined,
      attiva: typeof item.attiva === 'boolean' ? item.attiva : true,
      note: item.note ? String(item.note).trim() : undefined,
      creataDa: item.creataDa ? String(item.creataDa) : undefined,
      dataCreazione: item.dataCreazione ? String(item.dataCreazione) : undefined,
    });
  });
  return out;
}

export function getAuleFormazioneUpdatedAt(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(AULE_FORMAZIONE_UPDATED_AT_KEY);
    const num = raw ? Number(raw) : 0;
    return Number.isFinite(num) && num > 0 ? num : 0;
  } catch {
    return 0;
  }
}

function touchAuleFormazioneUpdatedAt(ts?: number): number {
  const val = typeof ts === 'number' && Number.isFinite(ts) && ts > 0 ? ts : Date.now();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(AULE_FORMAZIONE_UPDATED_AT_KEY, String(val));
    } catch {}
  }
  return val;
}

export function getAuleFormazioneCatalogo(): AulaFormazione[] {
  if (typeof window === 'undefined') return AULE_FORMAZIONE_DEFAULT;
  try {
    const saved = localStorage.getItem(AULE_FORMAZIONE_STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return normalizzaListaAuleFormazione(parsed);
      }
    }
  } catch {}
  return normalizzaListaAuleFormazione(AULE_FORMAZIONE_DEFAULT);
}

export function salvaAuleFormazioneCatalogo(lista: AulaFormazione[], updatedAt?: number): AulaFormazione[] {
  const norm = normalizzaListaAuleFormazione(lista);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(AULE_FORMAZIONE_STORAGE_KEY, JSON.stringify(norm));
    } catch {}
    touchAuleFormazioneUpdatedAt(updatedAt);
    try {
      window.dispatchEvent(new CustomEvent(EVENTO_AULE_FORMAZIONE_UPDATED));
    } catch {}
  }
  return norm;
}

export function applicaAuleFormazioneDaSync(aule?: any[], updatedAt?: number): boolean {
  if (!Array.isArray(aule)) return false;
  const localTs = getAuleFormazioneUpdatedAt();
  if (typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt > 0 && localTs > updatedAt) {
    return false;
  }
  salvaAuleFormazioneCatalogo(aule, updatedAt || Date.now());
  return true;
}

export function useAuleFormazione(): AulaFormazione[] {
  const [aule, setAule] = useState<AulaFormazione[]>(() => getAuleFormazioneCatalogo());
  useEffect(() => {
    const refresh = () => setAule(getAuleFormazioneCatalogo());
    window.addEventListener(EVENTO_AULE_FORMAZIONE_UPDATED, refresh);
    return () => window.removeEventListener(EVENTO_AULE_FORMAZIONE_UPDATED, refresh);
  }, []);
  return aule;
}

/**
 * Risolve l'aula didattica effettiva (coordinate, raggio, nome e indirizzo) per un corso o una sua lezione.
 */
export function risolviTargetAulaDidattica(
  corso: CorsoFormazione,
  lezione?: LezioneCorso | null,
  auleCatalogo?: AulaFormazione[]
): {
  aulaId?: string;
  nome: string;
  indirizzo: string;
  coordinate: { lat: number; lng: number };
  raggioMetri: number;
  isAulaCertificata: boolean;
} {
  const catalogo = auleCatalogo && auleCatalogo.length > 0 ? auleCatalogo : getAuleFormazioneCatalogo();
  const aulaId = lezione?.aulaFormazioneId || corso.aulaFormazioneId;
  const aulaTrovata = aulaId ? catalogo.find((a) => a.id === aulaId) : undefined;
  if (aulaTrovata) {
    return {
      aulaId: aulaTrovata.id,
      nome: aulaTrovata.nome,
      indirizzo: aulaTrovata.indirizzo,
      coordinate: aulaTrovata.coordinate,
      raggioMetri: aulaTrovata.raggioMetri || 150,
      isAulaCertificata: true,
    };
  }
  const coord = lezione?.coordinate || corso.coordinate || { lat: 43.99419, lng: 10.12367 };
  return {
    aulaId: aulaId || undefined,
    nome: lezione?.aulaFormazioneNome || lezione?.sedeNome || corso.aulaFormazioneNome || corso.sedeCorso || 'Aula Didattica',
    indirizzo: lezione?.indirizzoCompleto || corso.indirizzoCompleto || 'Sede Didattica',
    coordinate: coord,
    raggioMetri: lezione?.raggioMetriTimbratura || corso.raggioMetriTimbratura || 150,
    isAulaCertificata: Boolean(aulaId || lezione?.aulaFormazioneNome || corso.aulaFormazioneNome),
  };
}

/**
 * Trova l'eventuale corso attivo di oggi (o aperto) a cui il volontario è iscritto.
 * Regola: una persona iscritta ad un corso timbra entrata ed uscita sempre e solo nell'aula didattica
 * anche se nello stesso posto è presente un altro luogo timbratura.
 */
export function trovaCorsoIscrittoAttivoOggi(
  corsi: CorsoFormazione[] | undefined,
  volontarioId: string,
  volontarioNome: string,
  oggiIso?: string
): { corso: CorsoFormazione; lezione?: LezioneCorso } | null {
  if (!Array.isArray(corsi) || corsi.length === 0) return null;
  const oggi = oggiIso || formatISODateItaly();
  const nomeNorm = (volontarioNome || '').trim().toLowerCase();

  const corsiIscritto = corsi.filter((c) => {
    if (c.stato === 'Annullato' || c.stato === 'Concluso') return false;
    return (c.iscritti || []).some(
      (p) =>
        (volontarioId && p.volontarioId === volontarioId) ||
        (nomeNorm && (p.volontarioNome || '').trim().toLowerCase() === nomeNorm)
    );
  });

  // 1. Priorità assoluta: lezione calendarizzata esattamente oggi
  for (const c of corsiIscritto) {
    const lezOggi = (c.lezioni || []).find((l) => l.data === oggi);
    if (lezOggi) {
      return { corso: c, lezione: lezOggi };
    }
  }

  // 2. Corso 'In Corso' o nell'intervallo dataInizio..dataFine oggi
  for (const c of corsiIscritto) {
    const inIntervallo = Boolean(c.dataInizio && c.dataFine && oggi >= c.dataInizio && oggi <= c.dataFine);
    if (c.stato === 'In Corso' || inIntervallo) {
      return { corso: c, lezione: c.lezioni?.[0] };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// LINK TIMBRATURA ESTERNI SENZA ACCOUNT (URL, TOKEN & RICONCILIAZIONE)
// ---------------------------------------------------------------------------
export function generaTokenLinkTimbraturaEsterni(corsoId: string): string {
  const cleanId = String(corsoId || 'corso')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-10)
    .toLowerCase();
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
      ? Array.from(crypto.getRandomValues(new Uint8Array(6)))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `crs-${cleanId || 'aula'}-${rand}`.slice(0, 64);
}

export function buildLinkTimbraturaCorsoEsterno(token: string, origin?: string): string {
  const base =
    origin ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://croce-oro-massa-carrarra.vercel.app');
  const cleanBase = base.replace(/\/+$/, '');
  return `${cleanBase}/?view=timbratura-corso&token=${encodeURIComponent(token)}`;
}

export function isDedicatedExternalCourseUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const search = window.location.search || '';
  const hash = window.location.hash || '';
  return search.includes('view=timbratura-corso') || hash.includes('view=timbratura-corso');
}

export function getExternalCourseTokenFromUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const params = new URLSearchParams(window.location.search);
    const direct = (params.get('token') || '').trim();
    if (direct) return direct;
    const hashQueryIdx = window.location.hash.indexOf('?');
    if (hashQueryIdx >= 0) {
      const hashParams = new URLSearchParams(window.location.hash.slice(hashQueryIdx + 1));
      return (hashParams.get('token') || '').trim();
    }
  } catch {}
  return '';
}

export interface TimbraturaEsternoCorsoPayload {
  checkinId: string;
  tokenId: string;
  corsoId: string;
  lezioneId?: string;
  nome: string;
  cognome: string;
  telefono: string;
  tipo: 'entrata' | 'uscita';
  orario: string; // HH:mm:ss
  data: string; // DD/MM/YYYY
  lat: number;
  lng: number;
  distanzaMetri: number;
  aulaNome: string;
}

function normalizzaChiaveEsterno(nome: string, cognome: string, telefono: string): string {
  const telDigits = telefono.replace(/\D+/g, '').slice(-10) || 'notel';
  const slug = `${nome}_${cognome}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  return `ext-${slug || 'ospite'}-${telDigits}`;
}

function parseOrarioSec(hhmmss: string): number {
  const parts = String(hhmmss || '00:00:00')
    .split(':')
    .map((p) => Number(p) || 0);
  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
}

function calcolaDurataSec(inizio: string, fine: string): { minuti: number; oreDecimali: number; testo: string } {
  let diffSec = parseOrarioSec(fine) - parseOrarioSec(inizio);
  if (diffSec < 0) diffSec += 24 * 3600;
  if (diffSec > 20 * 3600) diffSec = 0;
  const minuti = Math.max(0, Math.round(diffSec / 60));
  const oreDecimali = Math.round((diffSec / 3600) * 100) / 100;
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  const testo = `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  return { minuti, oreDecimali, testo };
}

/**
 * Riconcilia una timbratura effettuata da un partecipante esterno (senza account)
 * dentro CorsoFormazione.iscritti, aggiornando ore frequentate ed esito.
 */
export function applicaTimbraturaEsternoSuCorsi(
  corsi: CorsoFormazione[],
  payload: TimbraturaEsternoCorsoPayload
): { corsiAggiornati: CorsoFormazione[]; applicata: boolean } {
  let applicata = false;
  const extId = normalizzaChiaveEsterno(payload.nome, payload.cognome, payload.telefono);
  const nomeCompleto = `${payload.nome.trim()} ${payload.cognome.trim()}`.trim();
  const dataOggi = payload.data || formatDateItaly();
  const orario = payload.orario || '00:00:00';

  const corsiAggiornati = corsi.map((corso) => {
    if (corso.id !== payload.corsoId && corso.linkTimbraturaEsterniToken !== payload.tokenId) {
      return corso;
    }
    applicata = true;
    const iscritti = [...(corso.iscritti || [])];
    const idx = iscritti.findIndex(
      (p) =>
        p.volontarioId === extId ||
        (p.isEsterno &&
          (p.telefonoEsterno || '').replace(/\D+/g, '') === payload.telefono.replace(/\D+/g, '') &&
          (p.volontarioNome || '').trim().toLowerCase() === nomeCompleto.toLowerCase())
    );

    const lezioneCorrente = payload.lezioneId
      ? (corso.lezioni || []).find((l) => l.id === payload.lezioneId)
      : (corso.lezioni || []).find((l) => l.data === formatISODateItaly()) || corso.lezioni?.[0];

    const timbroObj = {
      orario,
      data: dataOggi,
      coordinate: { lat: payload.lat, lng: payload.lng },
      distanzaMetri: payload.distanzaMetri,
      confermata: true,
    };

    let part: PartecipanteCorso =
      idx >= 0
        ? { ...iscritti[idx] }
        : {
            volontarioId: extId,
            volontarioNome: nomeCompleto,
            qualifica: 'Partecipante Esterno',
            oreFrequentate: 0,
            minutiFrequentatiTotali: 0,
            esito: 'In Frequenza',
            tipoAttestato:
              corso.tipologia === 'Seminario PSV' || corso.tipologia === 'Seminario Autisti'
                ? 'partecipazione'
                : 'idoneita',
            isEsterno: true,
            telefonoEsterno: payload.telefono.trim(),
            origineIscrizione: 'link_esterno',
            timbratureLezioni: [],
          };

    part.isEsterno = true;
    part.telefonoEsterno = payload.telefono.trim();
    part.origineIscrizione = 'link_esterno';

    const listLez = [...(part.timbratureLezioni || [])];

    if (lezioneCorrente) {
      const lIdx = listLez.findIndex((tl) => tl.lezioneId === lezioneCorrente.id);
      if (payload.tipo === 'entrata') {
        const entry = {
          lezioneId: lezioneCorrente.id,
          lezioneNumero: lezioneCorrente.numero,
          data: lezioneCorrente.data,
          sedeLezioneNome: payload.aulaNome || lezioneCorrente.sedeNome,
          timbraturaEntrata: timbroObj,
          distanzaEntrataMetri: payload.distanzaMetri,
          oreFrequentate: lIdx >= 0 ? listLez[lIdx].oreFrequentate || 0 : 0,
          minutiFrequentati: lIdx >= 0 ? listLez[lIdx].minutiFrequentati || 0 : 0,
          confermata: true,
        };
        if (lIdx >= 0) listLez[lIdx] = { ...listLez[lIdx], ...entry };
        else listLez.push(entry);
        part.timbraturaEntrata = timbroObj;
      } else {
        const entrataObj = (lIdx >= 0 ? listLez[lIdx]?.timbraturaEntrata : undefined) || part.timbraturaEntrata;
        const orarioEntrataStr =
          entrataObj && typeof entrataObj === 'object'
            ? entrataObj.orario
            : typeof entrataObj === 'string'
            ? entrataObj
            : '';
        const dur = orarioEntrataStr
          ? calcolaDurataSec(orarioEntrataStr, orario)
          : {
              minuti: Math.round((lezioneCorrente.ore || 2) * 60),
              oreDecimali: lezioneCorrente.ore || 2,
              testo: `${lezioneCorrente.ore || 2}h 00m 00s`,
            };
        const updated = {
          ...(lIdx >= 0 ? listLez[lIdx] : {}),
          lezioneId: lezioneCorrente.id,
          lezioneNumero: lezioneCorrente.numero,
          data: lezioneCorrente.data,
          sedeLezioneNome: payload.aulaNome || lezioneCorrente.sedeNome,
          timbraturaUscita: timbroObj,
          distanzaUscitaMetri: payload.distanzaMetri,
          oreFrequentate: dur.oreDecimali,
          minutiFrequentati: dur.minuti,
          oreEMinutiTesto: dur.testo,
          confermata: true,
        };
        if (lIdx >= 0) listLez[lIdx] = updated;
        else listLez.push(updated);
        part.timbraturaUscita = timbroObj;
      }

      part.timbratureLezioni = listLez;
      const totMin = listLez.reduce((s, item) => s + (item.minutiFrequentati || Math.round((item.oreFrequentate || 0) * 60)), 0);
      part.minutiFrequentatiTotali = totMin;
      part.oreFrequentate = Math.round((totMin / 60) * 100) / 100;
      const th = Math.floor(totMin / 60);
      const tm = totMin % 60;
      part.oreEMinutiTesto = `${th}h ${String(tm).padStart(2, '0')}m`;
    } else {
      if (payload.tipo === 'entrata') {
        part.timbraturaEntrata = timbroObj;
      } else {
        part.timbraturaUscita = timbroObj;
        const entrataStr =
          part.timbraturaEntrata && typeof part.timbraturaEntrata === 'object'
            ? part.timbraturaEntrata.orario
            : typeof part.timbraturaEntrata === 'string'
            ? part.timbraturaEntrata
            : '';
        if (entrataStr) {
          const dur = calcolaDurataSec(entrataStr, orario);
          part.minutiFrequentatiTotali = dur.minuti;
          part.oreFrequentate = dur.oreDecimali;
          part.oreEMinutiTesto = dur.testo;
        }
      }
    }

    const oreMinime =
      corso.oreMinimeFrequenza ||
      Math.round(((corso.oreTotali || 1) * (corso.percentualeMinimaPresenza || 80)) / 100);
    if (part.oreFrequentate >= oreMinime && !corso.prevedeEsame) {
      part.esito = 'Idoneo / Superato';
    } else if (part.esito === 'Iscritto') {
      part.esito = 'In Frequenza';
    }

    if (idx >= 0) iscritti[idx] = part;
    else iscritti.push(part);

    return {
      ...corso,
      iscritti,
    };
  });

  return { corsiAggiornati, applicata };
}
