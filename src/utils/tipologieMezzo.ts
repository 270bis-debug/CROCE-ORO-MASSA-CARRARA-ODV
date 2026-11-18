/**
 * tipologieMezzo.ts
 * Catalogo dinamico e sincronizzato delle Tipologie Mezzo per la flotta Croce Oro Massa Carrara.
 * Collegato in tempo reale con: Flotta Mezzi, Modali Nuovo/Modifica Mezzo, Filtri Flotta/Monitoraggio,
 * Checklist Inizio Turno e archivio storico.
 */

import { useState, useEffect } from 'react';
import { TipologiaMezzoItem } from '../types/adminTypes';

export type { TipologiaMezzoItem };

export const TIPOLOGIE_MEZZO_STORAGE_KEY = 'CROCE_ORO_TIPOLOGIE_MEZZO';
export const TIPOLOGIE_MEZZO_UPDATED_AT_KEY = 'CROCE_ORO_TIPOLOGIE_MEZZO_UPDATED_AT';

export const TIPOLOGIE_MEZZO_DEFAULT: TipologiaMezzoItem[] = [
  {
    id: 'tipo-amb-emergenza',
    nome: 'Ambulanza Emergenza',
    descrizione: 'Ambulanza di soccorso avanzato e urgenza H24 (118 / emergenza veterinaria)',
    flottaDefault: 'vet',
    icona: '🚑',
    predefinita: true,
    dataCreazione: '01/01/2026',
  },
  {
    id: 'tipo-amb-trasporto',
    nome: 'Ambulanza Trasporto',
    descrizione: 'Ambulanza attrezzata per trasporti ordinari, dimissioni e lunghe percorrenze',
    flottaDefault: 'vet',
    icona: '🚐',
    predefinita: true,
    dataCreazione: '01/01/2026',
  },
  {
    id: 'tipo-fuoristrada-4x4',
    nome: 'Fuoristrada 4x4',
    descrizione: 'Veicolo 4x4 operativo Protezione Civile, verricello e interventi fuoristrada',
    flottaDefault: 'pc',
    icona: '🚙',
    predefinita: true,
    dataCreazione: '01/01/2026',
  },
  {
    id: 'tipo-pulmino-disabili',
    nome: 'Pulmino Disabili',
    descrizione: 'Minibus 9 posti con pedana sollevamento carrozzine per trasporto disabili e sociale',
    flottaDefault: 'tutte',
    icona: '♿',
    predefinita: true,
    dataCreazione: '01/01/2026',
  },
  {
    id: 'tipo-furgone-logistico',
    nome: 'Furgone Logistico',
    descrizione: 'Furgone gran volume per logistica, trasporto tende, motopompe e attrezzature',
    flottaDefault: 'pc',
    icona: '🚚',
    predefinita: true,
    dataCreazione: '01/01/2026',
  },
  {
    id: 'tipo-automedica',
    nome: 'Automedica',
    descrizione: 'Veicolo compatto per intervento rapido, trasporto medico/veterinario o supporto agile',
    flottaDefault: 'vet',
    icona: '🚓',
    predefinita: true,
    dataCreazione: '01/01/2026',
  },
];

export function getTipologieMezzoUpdatedAt(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(TIPOLOGIE_MEZZO_UPDATED_AT_KEY);
    const num = raw ? Number(raw) : 0;
    return Number.isFinite(num) && num > 0 ? num : 0;
  } catch {
    return 0;
  }
}

export function touchTipologieMezzoUpdatedAt(ts?: number): number {
  const val = typeof ts === 'number' && Number.isFinite(ts) && ts > 0 ? ts : Date.now();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(TIPOLOGIE_MEZZO_UPDATED_AT_KEY, String(val));
    } catch {}
  }
  return val;
}

function emettiAggiornamentoTipologieLocal(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('croceoro_tipologie_mezzo_updated'));
  } catch {}
}

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (!e.key || e.key === TIPOLOGIE_MEZZO_STORAGE_KEY) {
        emettiAggiornamentoTipologieLocal();
      }
    });
  } catch {}
}

export function normalizzaListaTipologieMezzo(rawList: any[]): TipologiaMezzoItem[] {
  const seenNomi = new Set<string>();
  const out: TipologiaMezzoItem[] = [];
  rawList.forEach((item, idx) => {
    const nome = String(item?.nome || '').trim();
    if (!nome) return;
    const key = nome.toLowerCase();
    if (seenNomi.has(key)) return;
    seenNomi.add(key);
    out.push({
      id: String(item?.id || `tipo-${Date.now()}-${idx}`),
      nome,
      descrizione: item?.descrizione ? String(item.descrizione).trim() : '',
      flottaDefault:
        item?.flottaDefault === 'vet' || item?.flottaDefault === 'pc' || item?.flottaDefault === 'tutte'
          ? item.flottaDefault
          : 'tutte',
      icona: item?.icona ? String(item.icona).trim() : '🚐',
      predefinita: Boolean(item?.predefinita),
      dataCreazione: item?.dataCreazione ? String(item.dataCreazione) : undefined,
    });
  });
  return out;
}

export function getTipologieMezzoCatalogo(): TipologiaMezzoItem[] {
  if (typeof window === 'undefined') return TIPOLOGIE_MEZZO_DEFAULT;
  try {
    const saved = localStorage.getItem(TIPOLOGIE_MEZZO_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizzaListaTipologieMezzo(parsed);
      }
    }
  } catch {}
  return TIPOLOGIE_MEZZO_DEFAULT;
}

export function salvaTipologieMezzoCatalogo(lista: TipologiaMezzoItem[], updatedAt?: number): TipologiaMezzoItem[] {
  const norm = normalizzaListaTipologieMezzo(lista);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(TIPOLOGIE_MEZZO_STORAGE_KEY, JSON.stringify(norm));
    } catch {}
    touchTipologieMezzoUpdatedAt(updatedAt);
    emettiAggiornamentoTipologieLocal();
  }
  return norm;
}

export function applicaTipologieMezzoDaSync(tipologie?: any[], updatedAt?: number): boolean {
  if (!Array.isArray(tipologie) || tipologie.length === 0) return false;
  const localTs = getTipologieMezzoUpdatedAt();
  if (typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt > 0 && localTs > updatedAt) {
    return false;
  }
  salvaTipologieMezzoCatalogo(tipologie, updatedAt || Date.now());
  return true;
}

export function getIconaTipologiaMezzo(nome: string, catalogo?: TipologiaMezzoItem[]): string {
  const list = catalogo || getTipologieMezzoCatalogo();
  const norm = String(nome || '').trim().toLowerCase();
  const match = list.find((t) => t.nome.toLowerCase() === norm);
  if (match?.icona) return match.icona;
  if (norm.includes('ambulanza')) return '🚑';
  if (norm.includes('fuoristrada') || norm.includes('4x4')) return '🚙';
  if (norm.includes('pulmino') || norm.includes('disabili')) return '♿';
  if (norm.includes('furgone') || norm.includes('logistico')) return '🚚';
  if (norm.includes('automedica') || norm.includes('medica')) return '🚓';
  return '🚐';
}

export function useTipologieMezzo(): TipologiaMezzoItem[] {
  const [tipologie, setTipologie] = useState<TipologiaMezzoItem[]>(() => getTipologieMezzoCatalogo());

  useEffect(() => {
    const refresh = () => {
      setTipologie(getTipologieMezzoCatalogo());
    };
    window.addEventListener('croceoro_tipologie_mezzo_updated', refresh);
    return () => {
      window.removeEventListener('croceoro_tipologie_mezzo_updated', refresh);
    };
  }, []);

  return tipologie;
}
