import { ChecklistCompilataTurno } from '../types/checklistTypes';
import { formatDateTimeItaly } from './italianTime';

export type StatoRichiestaReintegro = 'Da Evadere' | 'In Lavorazione' | 'Reintegrato';

export interface VoceReintegroSegnalata {
  voceId: string;
  titolo: string;
  categoria: string;
  noteKo?: string;
  critica?: boolean;
  evasa?: boolean;
}

export interface RichiestaReintegroMagazzino {
  id: string;
  checklistId: string;
  mezzoSigla: string;
  mezzoModello?: string;
  tipologiaMezzo?: string;
  volontarioId?: string;
  volontarioNome: string;
  dataOraSegnalazione: string;
  vociSegnalate: VoceReintegroSegnalata[];
  noteGenerali?: string;
  priorita: 'Urgente' | 'Normale';
  stato: StatoRichiestaReintegro;
  gestitaDa?: string;
  dataOraChiusura?: string;
  noteMagazzino?: string;
  createdAt: number;
  updatedAt: number;
}

export const REINTEGRO_MAGAZZINO_STORAGE_KEY = 'CROCE_ORO_RICHIESTE_REINTEGRO_MAGAZZINO_V1';
export const REINTEGRO_MAGAZZINO_UPDATED_AT_KEY = 'CROCE_ORO_RICHIESTE_REINTEGRO_UPDATED_AT';
export const REINTEGRO_MAGAZZINO_EVENT = 'croceoro_reintegro_magazzino_updated';

export function getRichiesteReintegroMagazzino(): RichiestaReintegroMagazzino[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(REINTEGRO_MAGAZZINO_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      : [];
  } catch {
    return [];
  }
}

export function getRichiesteReintegroUpdatedAt(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const n = Number(localStorage.getItem(REINTEGRO_MAGAZZINO_UPDATED_AT_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function salvaRichiesteReintegroMagazzino(
  lista: RichiestaReintegroMagazzino[],
  updatedAt?: number
): { lista: RichiestaReintegroMagazzino[]; updatedAt: number } {
  const ts = typeof updatedAt === 'number' && updatedAt > 0 ? updatedAt : Date.now();
  const clean = (Array.isArray(lista) ? lista : [])
    .slice(0, 250)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(REINTEGRO_MAGAZZINO_STORAGE_KEY, JSON.stringify(clean));
      localStorage.setItem(REINTEGRO_MAGAZZINO_UPDATED_AT_KEY, String(ts));
      window.dispatchEvent(new CustomEvent(REINTEGRO_MAGAZZINO_EVENT));
    } catch {}
  }
  return { lista: clean, updatedAt: ts };
}

export function applicaRichiesteReintegroDaSync(
  incoming?: any[],
  updatedAt?: number
): boolean {
  if (!Array.isArray(incoming)) return false;
  const localTs = getRichiesteReintegroUpdatedAt();
  if (typeof updatedAt === 'number' && updatedAt > 0 && localTs > updatedAt) {
    return false;
  }
  salvaRichiesteReintegroMagazzino(incoming, updatedAt || Date.now());
  return true;
}

/**
 * Crea automaticamente una Richiesta di Reintegro per il Magazzino a partire da una Checklist
 * di Inizio Turno che contiene una o più voci non conformi (mancanti, guaste o in scadenza).
 */
export function creaRichiestaReintegroDaChecklist(
  checklist: ChecklistCompilataTurno
): RichiestaReintegroMagazzino | null {
  if (!checklist || !Array.isArray(checklist.risultati)) return null;
  const nonConformi = checklist.risultati.filter((r) => r && r.conforme === false);
  if (nonConformi.length === 0) return null;

  const esistenti = getRichiesteReintegroMagazzino();
  const giaPresente = esistenti.find((r) => r.checklistId === checklist.id);
  if (giaPresente) return giaPresente;

  const haCritiche = nonConformi.some(
    (r) =>
      Boolean(r.critica) ||
      String(r.categoria || '').toLowerCase().includes('sanitario') ||
      String(r.categoria || '').toLowerCase().includes('elettromedicali') ||
      String(r.titolo || '').toLowerCase().includes('dae') ||
      String(r.titolo || '').toLowerCase().includes('ossigen') ||
      String(r.titolo || '').toLowerCase().includes('estintor')
  );

  const now = Date.now();
  const nuova: RichiestaReintegroMagazzino = {
    id: `reint-${now}-${Math.random().toString(36).slice(2, 6)}`,
    checklistId: checklist.id,
    mezzoSigla: checklist.mezzoSigla || 'Mezzo',
    mezzoModello: checklist.mezzoModello,
    tipologiaMezzo: checklist.tipologiaMezzo,
    volontarioId: checklist.volontarioId,
    volontarioNome: checklist.volontarioNome || 'Equipaggio',
    dataOraSegnalazione: checklist.dataOraCompilazione || formatDateTimeItaly(),
    vociSegnalate: nonConformi.map((r) => ({
      voceId: r.voceId,
      titolo: r.titolo,
      categoria: r.categoria,
      noteKo: r.noteKo,
      critica: Boolean(r.critica),
      evasa: false,
    })),
    noteGenerali: checklist.noteGenerali,
    priorita: haCritiche ? 'Urgente' : 'Normale',
    stato: 'Da Evadere',
    createdAt: now,
    updatedAt: now,
  };

  salvaRichiesteReintegroMagazzino([nuova, ...esistenti], now);
  return nuova;
}
