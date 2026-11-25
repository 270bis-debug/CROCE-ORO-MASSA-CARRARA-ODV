import { useState, useEffect } from 'react';

export interface MetodoPagamentoCarburante {
  id: string;
  nome: string;
  codiceCarta?: string;
  descrizione?: string;
  mezzoSiglaAssegnato?: string;
  attivo: boolean;
  predefinito?: boolean;
  ordine: number;
  updatedAt?: number;
}

export const METODI_PAGAMENTO_CARBURANTE_STORAGE_KEY = 'CROCE_ORO_METODI_PAGAMENTO_CARBURANTE_V1';
export const METODI_PAGAMENTO_CARBURANTE_UPDATED_AT_KEY = 'CROCE_ORO_METODI_PAGAMENTO_CARBURANTE_UPDATED_AT';
export const METODI_PAGAMENTO_CARBURANTE_UPDATED_EVENT = 'croceoro_metodi_pagamento_carburante_updated';

export const METODI_PAGAMENTO_CARBURANTE_DEFAULT: MetodoPagamentoCarburante[] = [
  {
    id: 'mpc-eni',
    nome: 'Carta Carburante Eni',
    descrizione: 'Carta carburante associativa circuito Eni Live / Multicard',
    attivo: true,
    predefinito: true,
    ordine: 0,
  },
  {
    id: 'mpc-q8',
    nome: 'Carta Carburante Q8',
    descrizione: 'Carta carburante associativa circuito Q8 CartissimaQ8',
    attivo: true,
    predefinito: false,
    ordine: 1,
  },
  {
    id: 'mpc-bancomat',
    nome: 'Bancomat',
    descrizione: 'Carta di debito / Bancomat conto associativo',
    attivo: true,
    predefinito: false,
    ordine: 2,
  },
  {
    id: 'mpc-contanti',
    nome: 'Cassa Contanti',
    descrizione: 'Anticipo cassa sede o rimborso con scontrino',
    attivo: true,
    predefinito: false,
    ordine: 3,
  },
  {
    id: 'mpc-altro',
    nome: 'Altro',
    descrizione: 'Altra modalità di pagamento (specificare nelle note)',
    attivo: true,
    predefinito: false,
    ordine: 4,
  },
];

function emettiAggiornamentoLocale(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(METODI_PAGAMENTO_CARBURANTE_UPDATED_EVENT));
  } catch {}
}

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (!e.key || e.key === METODI_PAGAMENTO_CARBURANTE_STORAGE_KEY) {
        emettiAggiornamentoLocale();
      }
    });
  } catch {}
}

export function normalizzaMetodiPagamentoCarburante(rawList: any[]): MetodoPagamentoCarburante[] {
  if (!Array.isArray(rawList)) return [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const out: MetodoPagamentoCarburante[] = [];

  rawList.forEach((item, idx) => {
    const nome = String(item?.nome || '').trim();
    if (!nome) return;
    const nameKey = nome.toLowerCase();
    if (seenNames.has(nameKey)) return;
    seenNames.add(nameKey);

    let id = String(item?.id || `mpc-${idx}-${nameKey.replace(/[^a-z0-9]/g, '').slice(0, 12)}`).trim();
    if (!id || seenIds.has(id)) {
      id = `mpc-${Date.now()}-${idx}`;
    }
    seenIds.add(id);

    out.push({
      id,
      nome,
      codiceCarta: item?.codiceCarta ? String(item.codiceCarta).trim() : undefined,
      descrizione: item?.descrizione ? String(item.descrizione).trim() : undefined,
      mezzoSiglaAssegnato: item?.mezzoSiglaAssegnato ? String(item.mezzoSiglaAssegnato).trim() : undefined,
      attivo: item?.attivo !== false,
      predefinito: Boolean(item?.predefinito),
      ordine: typeof item?.ordine === 'number' && Number.isFinite(item.ordine) ? item.ordine : idx,
      updatedAt: typeof item?.updatedAt === 'number' && Number.isFinite(item.updatedAt) ? item.updatedAt : undefined,
    });
  });

  out.sort((a, b) => a.ordine - b.ordine);

  // Garantisce ordine pulito 0..N-1 e al massimo un solo predefinito (tra gli attivi, se presenti)
  let hasDefault = false;
  const cleaned = out.map((m, i) => {
    const isDef = Boolean(m.predefinito && m.attivo && !hasDefault);
    if (isDef) hasDefault = true;
    return { ...m, ordine: i, predefinito: isDef };
  });

  if (!hasDefault && cleaned.length > 0) {
    const firstActiveIdx = cleaned.findIndex((m) => m.attivo);
    if (firstActiveIdx >= 0) {
      cleaned[firstActiveIdx] = { ...cleaned[firstActiveIdx], predefinito: true };
    }
  }

  return cleaned;
}

export function getMetodiPagamentoCarburanteUpdatedAt(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(METODI_PAGAMENTO_CARBURANTE_UPDATED_AT_KEY);
    const num = raw ? Number(raw) : 0;
    return Number.isFinite(num) && num > 0 ? num : 0;
  } catch {
    return 0;
  }
}

export function getMetodiPagamentoCarburante(): MetodoPagamentoCarburante[] {
  if (typeof window === 'undefined') return METODI_PAGAMENTO_CARBURANTE_DEFAULT;
  try {
    const raw = localStorage.getItem(METODI_PAGAMENTO_CARBURANTE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const norm = normalizzaMetodiPagamentoCarburante(parsed);
        if (norm.length > 0) return norm;
      }
    }
  } catch {}
  return METODI_PAGAMENTO_CARBURANTE_DEFAULT.map((m) => ({ ...m }));
}

export function getMetodiPagamentoCarburanteAttivi(lista?: MetodoPagamentoCarburante[]): MetodoPagamentoCarburante[] {
  const source = lista ?? getMetodiPagamentoCarburante();
  const attivi = source.filter((m) => m.attivo);
  return attivi.length > 0 ? attivi : source;
}

export function getMetodoPagamentoCarburantePredefinito(lista?: MetodoPagamentoCarburante[]): string {
  const attivi = getMetodiPagamentoCarburanteAttivi(lista);
  const def = attivi.find((m) => m.predefinito) || attivi[0];
  return def?.nome || 'Carta Carburante Eni';
}

export function getMetodoOggettoPerMezzo(
  mezzoSigla?: string,
  lista?: MetodoPagamentoCarburante[]
): MetodoPagamentoCarburante | undefined {
  const siglaNorm = String(mezzoSigla || '').trim().toLowerCase();
  if (!siglaNorm) return undefined;
  const attivi = getMetodiPagamentoCarburanteAttivi(lista);
  return attivi.find(
    (m) => m.mezzoSiglaAssegnato && m.mezzoSiglaAssegnato.trim().toLowerCase() === siglaNorm
  );
}

export function getMetodoPagamentoCarburantePerMezzo(
  mezzoSigla?: string,
  lista?: MetodoPagamentoCarburante[]
): string {
  const assegnato = getMetodoOggettoPerMezzo(mezzoSigla, lista);
  if (assegnato) return assegnato.nome;
  return getMetodoPagamentoCarburantePredefinito(lista);
}

export function salvaMetodiPagamentoCarburante(
  lista: MetodoPagamentoCarburante[],
  updatedAt?: number
): { lista: MetodoPagamentoCarburante[]; updatedAt: number } {
  const ts = typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now();
  const norm = normalizzaMetodiPagamentoCarburante(lista).map((m) => ({
    ...m,
    updatedAt: m.updatedAt || ts,
  }));
  const finalList = norm.length > 0 ? norm : METODI_PAGAMENTO_CARBURANTE_DEFAULT.map((m) => ({ ...m, updatedAt: ts }));

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(METODI_PAGAMENTO_CARBURANTE_STORAGE_KEY, JSON.stringify(finalList));
      localStorage.setItem(METODI_PAGAMENTO_CARBURANTE_UPDATED_AT_KEY, String(ts));
    } catch {}
    emettiAggiornamentoLocale();
  }

  return { lista: finalList, updatedAt: ts };
}

export function mergeMetodiPagamentoCarburanteCloud(
  remoteList?: any[],
  remoteUpdatedAt?: number
): { lista: MetodoPagamentoCarburante[]; updatedAt: number } {
  const localTs = getMetodiPagamentoCarburanteUpdatedAt();
  const incomingTs =
    typeof remoteUpdatedAt === 'number' && Number.isFinite(remoteUpdatedAt) && remoteUpdatedAt > 0
      ? remoteUpdatedAt
      : 0;

  if (!Array.isArray(remoteList) || remoteList.length === 0) {
    return { lista: getMetodiPagamentoCarburante(), updatedAt: localTs };
  }

  if (localTs > 0 && incomingTs > 0 && localTs > incomingTs) {
    return { lista: getMetodiPagamentoCarburante(), updatedAt: localTs };
  }

  const saved = salvaMetodiPagamentoCarburante(remoteList, incomingTs || Date.now());
  return saved;
}

export function useMetodiPagamentoCarburante(): MetodoPagamentoCarburante[] {
  const [metodi, setMetodi] = useState<MetodoPagamentoCarburante[]>(() => getMetodiPagamentoCarburante());

  useEffect(() => {
    const refresh = () => {
      setMetodi(getMetodiPagamentoCarburante());
    };
    window.addEventListener(METODI_PAGAMENTO_CARBURANTE_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(METODI_PAGAMENTO_CARBURANTE_UPDATED_EVENT, refresh);
    };
  }, []);

  return metodi;
}
