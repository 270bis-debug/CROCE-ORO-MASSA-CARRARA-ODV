/**
 * rubricaNumeriUtiliStore.ts
 * Archivio persistente e sincronizzato in tempo reale dei Numeri Utili di Emergenza,
 * Forze dell'Ordine, Enti Istituzionali e Interni Associazione.
 * Tutti gli elementi usano ID immutabili così rinomine o modifiche successive
 * mantengono intatti collegamenti, filtri e sincronizzazione.
 */

import { useEffect, useState } from 'react';

export interface VoceRubricaUtile {
  id: string;
  nome: string;
  numero: string;
  note?: string;
}

export interface CategoriaRubricaUtile {
  id: string;
  categoria: string;
  voci: VoceRubricaUtile[];
}

export const RUBRICA_NUMERI_STORAGE_KEY = 'CROCE_ORO_RUBRICA_NUMERI_UTILI_V1';
export const RUBRICA_NUMERI_UPDATED_AT_KEY = 'CROCE_ORO_RUBRICA_NUMERI_UTILI_UPDATED_AT';

export const RUBRICA_CONTATTI_DEFAULT: CategoriaRubricaUtile[] = [
  {
    id: 'rub-cat-nue',
    categoria: '🚨 Emergenze Nazionali (NUE)',
    voci: [
      { id: 'rub-v-112', nome: 'Numero Unico Europeo (NUE)', numero: '112' },
      { id: 'rub-v-118', nome: 'Emergenza Sanitaria', numero: '118' },
      { id: 'rub-v-115', nome: 'Vigili del Fuoco (Soccorso Tecnico)', numero: '115' },
      { id: 'rub-v-113', nome: 'Polizia di Stato', numero: '113' },
    ],
  },
  {
    id: 'rub-cat-ffoo',
    categoria: "🚓 Forze dell'Ordine & Polizia Locale",
    voci: [
      { id: 'rub-v-questura', nome: 'Questura Massa (Centrale Operativa)', numero: '0585494782' },
      { id: 'rub-v-commissariato', nome: 'Commissariato Carrara', numero: '0585766351' },
      { id: 'rub-v-carabinieri', nome: 'Carabinieri Massa (Centrale Operativa)', numero: '05854951' },
      { id: 'rub-v-pl-massa', nome: 'Polizia Locale Massa', numero: '058543560' },
      { id: 'rub-v-pl-carrara', nome: 'Polizia Locale Carrara', numero: '058570000' },
    ],
  },
  {
    id: 'rub-cat-coc',
    categoria: '🏛️ C.O.C. Massa (Centro Operativo Comunale)',
    voci: [
      { id: 'rub-v-coc-1', nome: 'C.O.C. Massa (Centrale Operativa)', numero: '0585812465' },
      { id: 'rub-v-coc-2', nome: 'C.O.C. Massa (Centrale Operativa 2)', numero: '0585489420' },
      { id: 'rub-v-coc-3', nome: 'C.O.C. Massa (Segnalazioni dei cittadini)', numero: '0585490249' },
    ],
  },
  {
    id: 'rub-cat-interni',
    categoria: '🚑 Interni Croce Oro Massa Carrara',
    voci: [
      { id: 'rub-v-reperibile', nome: 'Reperibile Associazione', numero: '3518130878' },
      { id: 'rub-v-presidente', nome: 'Telefono di Servizio Presidente', numero: '3667024146' },
      { id: 'rub-v-logistica', nome: 'Unità Logistica T4615', numero: '3517984414' },
    ],
  },
];

export function normalizzaRubricaNumeriUtili(raw: any): CategoriaRubricaUtile[] {
  if (!Array.isArray(raw)) return RUBRICA_CONTATTI_DEFAULT;
  const out: CategoriaRubricaUtile[] = [];
  const seenCatIds = new Set<string>();

  raw.forEach((cat, cIdx) => {
    const titolo = String(cat?.categoria || '').trim();
    if (!titolo) return;
    let catId = String(cat?.id || `rub-cat-${cIdx}-${Date.now()}`);
    if (seenCatIds.has(catId)) catId = `${catId}-${cIdx}`;
    seenCatIds.add(catId);

    const voci: VoceRubricaUtile[] = [];
    const seenVoceIds = new Set<string>();
    const rawVoci = Array.isArray(cat?.voci) ? cat.voci : [];
    rawVoci.forEach((v: any, vIdx: number) => {
      const nome = String(v?.nome || '').trim();
      const numero = String(v?.numero || '').trim();
      if (!nome || !numero) return;
      let vId = String(v?.id || `rub-v-${cIdx}-${vIdx}-${Date.now()}`);
      if (seenVoceIds.has(vId)) vId = `${vId}-${vIdx}`;
      seenVoceIds.add(vId);
      voci.push({
        id: vId,
        nome,
        numero,
        note: v?.note ? String(v.note).trim() : undefined,
      });
    });

    out.push({
      id: catId,
      categoria: titolo,
      voci,
    });
  });

  return out;
}

export function getRubricaNumeriUtiliUpdatedAt(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(RUBRICA_NUMERI_UPDATED_AT_KEY);
    const num = raw ? Number(raw) : 0;
    return Number.isFinite(num) && num > 0 ? num : 0;
  } catch {
    return 0;
  }
}

export function touchRubricaNumeriUtiliUpdatedAt(ts?: number): number {
  const val = typeof ts === 'number' && Number.isFinite(ts) && ts > 0 ? ts : Date.now();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(RUBRICA_NUMERI_UPDATED_AT_KEY, String(val));
    } catch {}
  }
  return val;
}

function emettiAggiornamentoRubricaLocal(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('croceoro_rubrica_numeri_updated'));
  } catch {}
}

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (!e.key || e.key === RUBRICA_NUMERI_STORAGE_KEY) {
        emettiAggiornamentoRubricaLocal();
      }
    });
  } catch {}
}

export function getRubricaNumeriUtili(): CategoriaRubricaUtile[] {
  if (typeof window === 'undefined') return RUBRICA_CONTATTI_DEFAULT;
  try {
    const raw = localStorage.getItem(RUBRICA_NUMERI_STORAGE_KEY);
    if (!raw) return RUBRICA_CONTATTI_DEFAULT;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return normalizzaRubricaNumeriUtili(parsed);
    }
  } catch {}
  return RUBRICA_CONTATTI_DEFAULT;
}

export function salvaRubricaNumeriUtili(
  lista: CategoriaRubricaUtile[],
  dispatch = true,
  updatedAt?: number
): CategoriaRubricaUtile[] {
  const clean = normalizzaRubricaNumeriUtili(lista);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(RUBRICA_NUMERI_STORAGE_KEY, JSON.stringify(clean));
      touchRubricaNumeriUtiliUpdatedAt(updatedAt);
      if (dispatch) emettiAggiornamentoRubricaLocal();
    } catch {}
  }
  return clean;
}

export function ripristinaRubricaNumeriUtiliDefault(): CategoriaRubricaUtile[] {
  return salvaRubricaNumeriUtili(RUBRICA_CONTATTI_DEFAULT, true);
}

export function applicaRubricaNumeriUtiliDaSync(
  lista?: any[] | null,
  updatedAt?: number
): boolean {
  if (typeof window === 'undefined') return false;
  if (!Array.isArray(lista)) return false;
  const incomingTs = typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : 0;
  const localTs = getRubricaNumeriUtiliUpdatedAt();
  if (incomingTs > 0 && localTs > incomingTs) {
    return false;
  }
  salvaRubricaNumeriUtili(lista, true, incomingTs > 0 ? incomingTs : undefined);
  return true;
}

export async function sincronizzaRubricaNumeriUtiliDaServer(): Promise<CategoriaRubricaUtile[]> {
  try {
    const res = await fetch('/api/rubrica-numeri-utili');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.rubrica)) {
        applicaRubricaNumeriUtiliDaSync(data.rubrica, data?.updatedAt || Date.now());
      }
    }
  } catch {}
  return getRubricaNumeriUtili();
}

export function useRubricaNumeriUtili(): CategoriaRubricaUtile[] {
  const [rubrica, setRubrica] = useState<CategoriaRubricaUtile[]>(() => getRubricaNumeriUtili());

  useEffect(() => {
    const refresh = () => setRubrica(getRubricaNumeriUtili());
    window.addEventListener('croceoro_rubrica_numeri_updated', refresh as EventListener);
    return () => {
      window.removeEventListener('croceoro_rubrica_numeri_updated', refresh as EventListener);
    };
  }, []);

  return rubrica;
}
