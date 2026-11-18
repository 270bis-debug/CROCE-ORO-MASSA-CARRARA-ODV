import { useState, useEffect } from 'react';
import { getCurrentYearItaly, formatISODateItaly } from './italianTime';

export type TipoMetodoPagamentoCustom = 'entrambi' | 'donazioni' | 'pagamenti';

export interface MetodoPagamentoPersonalizzato {
  id: string;
  nome: string;
  tipo: TipoMetodoPagamentoCustom;
  coordinateODettagli: string;
  intestatario?: string;
  note?: string;
  attivo: boolean;
  dataCreazione?: string;
}

export const METODI_PAGAMENTO_STORAGE_KEY = 'croce_oro_metodi_pagamento_custom_v1';
export const METODI_PAGAMENTO_UPDATED_AT_KEY = 'croce_oro_metodi_pagamento_custom_updated_at';
export const METODI_PAGAMENTO_EVENT_NAME = 'croceoro_metodi_pagamento_updated';

function emettiAggiornamentoLocale(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(METODI_PAGAMENTO_EVENT_NAME));
  } catch {}
}

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (!e.key || e.key === METODI_PAGAMENTO_STORAGE_KEY) {
        emettiAggiornamentoLocale();
      }
    });
  } catch {}
}

export function getMetodiPagamentoCustomUpdatedAt(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(METODI_PAGAMENTO_UPDATED_AT_KEY);
    const num = raw ? Number(raw) : 0;
    return Number.isFinite(num) && num > 0 ? num : 0;
  } catch {
    return 0;
  }
}

export function normalizzaMetodiPagamentoCustom(rawList: any[]): MetodoPagamentoPersonalizzato[] {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set<string>();
  const out: MetodoPagamentoPersonalizzato[] = [];
  rawList.forEach((item, idx) => {
    const nome = String(item?.nome || '').trim();
    if (!nome) return;
    const id = String(item?.id || `mp-${getCurrentYearItaly()}-${idx}`);
    if (seen.has(id)) return;
    seen.add(id);
    const tipoRaw = String(item?.tipo || 'entrambi');
    const tipo: TipoMetodoPagamentoCustom =
      tipoRaw === 'donazioni' || tipoRaw === 'pagamenti' ? tipoRaw : 'entrambi';
    out.push({
      id,
      nome,
      tipo,
      coordinateODettagli: String(item?.coordinateODettagli || '').trim(),
      intestatario: item?.intestatario ? String(item.intestatario).trim() : undefined,
      note: item?.note ? String(item.note).trim() : undefined,
      attivo: item?.attivo !== false,
      dataCreazione: item?.dataCreazione ? String(item.dataCreazione) : formatISODateItaly(),
    });
  });
  return out;
}

export function getMetodiPagamentoCustom(): MetodoPagamentoPersonalizzato[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(METODI_PAGAMENTO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return normalizzaMetodiPagamentoCustom(parsed);
      }
    }
  } catch {}
  return [];
}

export function salvaMetodiPagamentoCustom(
  lista: MetodoPagamentoPersonalizzato[],
  updatedAt?: number,
  skipServerPost: boolean = false
): MetodoPagamentoPersonalizzato[] {
  const norm = normalizzaMetodiPagamentoCustom(lista);
  const ts = typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(METODI_PAGAMENTO_STORAGE_KEY, JSON.stringify(norm));
      localStorage.setItem(METODI_PAGAMENTO_UPDATED_AT_KEY, String(ts));
    } catch {}
    emettiAggiornamentoLocale();
    if (!skipServerPost) {
      fetch('/api/metodi-pagamento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metodi: norm, updatedAt: ts }),
      }).catch(() => {});
    }
  }
  return norm;
}

export function applicaMetodiPagamentoDaSync(metodi?: any[], updatedAt?: number): boolean {
  if (!Array.isArray(metodi)) return false;
  const localTs = getMetodiPagamentoCustomUpdatedAt();
  if (typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt > 0 && localTs > updatedAt) {
    return false;
  }
  salvaMetodiPagamentoCustom(metodi, updatedAt || Date.now(), true);
  return true;
}

export async function sincronizzaMetodiPagamentoDaServer(): Promise<MetodoPagamentoPersonalizzato[]> {
  if (typeof window === 'undefined') return [];
  try {
    const res = await fetch('/api/metodi-pagamento', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.metodi)) {
        applicaMetodiPagamentoDaSync(json.metodi, json.updatedAt);
        return getMetodiPagamentoCustom();
      }
    }
  } catch {}
  return getMetodiPagamentoCustom();
}

export function formattaEtichettaMetodoPagamento(m: MetodoPagamentoPersonalizzato): string {
  return m.coordinateODettagli ? `${m.nome} (${m.coordinateODettagli})` : m.nome;
}

export function useMetodiPagamentoCustom(): MetodoPagamentoPersonalizzato[] {
  const [metodi, setMetodi] = useState<MetodoPagamentoPersonalizzato[]>(() => getMetodiPagamentoCustom());

  useEffect(() => {
    const refresh = () => {
      setMetodi(getMetodiPagamentoCustom());
    };
    window.addEventListener(METODI_PAGAMENTO_EVENT_NAME, refresh);
    return () => {
      window.removeEventListener(METODI_PAGAMENTO_EVENT_NAME, refresh);
    };
  }, []);

  return metodi;
}
