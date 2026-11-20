/**
 * tipiTurno.ts
 * Catalogo dinamico e sincronizzato dei Tipi di Turni per il Database Calendario Turni.
 * Ogni Tipo di Turno definisce un nome e una o più mansioni obbligatorie con numero minimo e massimo
 * di volontari richiesti (sia dai 7 ruoli equipaggio standard sia dal catalogo Mansioni & Competenze).
 */

import { useState, useEffect } from 'react';
import { TipoTurnoConfig, MansioneTipoTurno, RuoloTurno } from '../types/adminTypes';
import { getMansioniCatalogo, MansioneOperativa } from './mansioniVolontari';

export type { TipoTurnoConfig, MansioneTipoTurno };

export const TIPI_TURNO_STORAGE_KEY = 'CROCE_ORO_TIPI_TURNO';
export const TIPI_TURNO_UPDATED_AT_KEY = 'CROCE_ORO_TIPI_TURNO_UPDATED_AT';

export interface OpzioneMansioneTurno {
  id: string;
  nome: string;
  emoji: string;
  categoria: string;
  ruoloTurno?: RuoloTurno;
  mansioneCatalogoId?: string;
  descrizione?: string;
  isRuoloBase?: boolean;
}

/**
 * I 7 ruoli equipaggio standard richiesti per la composizione dei tipi di turno.
 */
export const MANSIONI_BASE_EQUIPAGGIO: OpzioneMansioneTurno[] = [
  {
    id: 'ruolo-autista',
    nome: '1. Autista Soccorritore',
    emoji: '🚑',
    categoria: 'Ruoli Equipaggio Base',
    ruoloTurno: 'autista',
    descrizione: 'Conducente del mezzo abilitato alla guida di emergenza o ordinaria',
    isRuoloBase: true,
  },
  {
    id: 'ruolo-caposervizio',
    nome: '2. Caposervizio / Soccorritore Avanzato',
    emoji: '👨‍⚕️',
    categoria: 'Ruoli Equipaggio Base',
    ruoloTurno: 'caposervizio',
    descrizione: 'Responsabile dell\'equipaggio sanitario e gestione protocolli avanzati',
    isRuoloBase: true,
  },
  {
    id: 'ruolo-soccorritore2',
    nome: '3. Secondo Soccorritore',
    emoji: '🧑‍⚕️',
    categoria: 'Ruoli Equipaggio Base',
    ruoloTurno: 'soccorritore2',
    descrizione: 'Secondo soccorritore a bordo del mezzo',
    isRuoloBase: true,
  },
  {
    id: 'ruolo-terzoSoccorritore',
    nome: '4. Terzo Soccorritore',
    emoji: '🧑‍⚕️',
    categoria: 'Ruoli Equipaggio Base',
    ruoloTurno: 'terzoSoccorritore',
    descrizione: 'Terzo soccorritore / supporto operativo a bordo',
    isRuoloBase: true,
  },
  {
    id: 'ruolo-operatoreCentrale',
    nome: '5. Operatore Centrale / Sala Radio',
    emoji: '🎧',
    categoria: 'Ruoli Equipaggio Base',
    ruoloTurno: 'operatoreCentrale',
    descrizione: 'Gestione sala radio, dispatch missioni e coordinamento mezzi',
    isRuoloBase: true,
  },
  {
    id: 'ruolo-centralinista',
    nome: '6. Centralinista',
    emoji: '📞',
    categoria: 'Ruoli Equipaggio Base',
    ruoloTurno: 'centralinista',
    descrizione: 'Risposta telefonica, prenotazione servizi e accoglienza sede',
    isRuoloBase: true,
  },
  {
    id: 'ruolo-osservatore',
    nome: '7. Osservatore (In Formazione / Tirocinante)',
    emoji: '👁️',
    categoria: 'Ruoli Equipaggio Base',
    ruoloTurno: 'osservatore',
    descrizione: 'Volontario in affiancamento formativo o tirocinio pratico',
    isRuoloBase: true,
  },
];

/**
 * Restituisce tutte le mansioni selezionabili per un Tipo di Turno:
 * prima i 7 ruoli equipaggio base, seguiti da tutte le mansioni definite nel database
 * Gestione Volontari -> sottosezione MANSIONI & COMPETENZE.
 */
export function getTutteMansioniDisponibiliPerTipoTurno(
  catalogoCustom?: MansioneOperativa[]
): OpzioneMansioneTurno[] {
  const catalogo = catalogoCustom || getMansioniCatalogo();
  const extra: OpzioneMansioneTurno[] = catalogo.map((m) => ({
    id: `mansione-${m.id}`,
    nome: m.nome,
    emoji: m.badgeEmoji || '🎖️',
    categoria: m.categoria || 'Mansioni & Competenze',
    mansioneCatalogoId: m.id,
    descrizione: m.descrizione,
    isRuoloBase: false,
  }));
  return [...MANSIONI_BASE_EQUIPAGGIO, ...extra];
}

export const TIPI_TURNO_DEFAULT: TipoTurnoConfig[] = [
  {
    id: 'tipo-turno-emergenza-118',
    nome: 'Emergenza 118',
    descrizione: 'Equipaggio standard per servizio di emergenza sanitaria 118',
    icona: '🚑',
    predefinito: true,
    dataCreazione: '01/01/2026',
    mansioniObbligatorie: [
      {
        id: 'ruolo-autista',
        nome: '1. Autista Soccorritore',
        emoji: '🚑',
        ruoloTurno: 'autista',
        categoria: 'Ruoli Equipaggio Base',
        minimo: 1,
        massimo: 1,
      },
      {
        id: 'ruolo-caposervizio',
        nome: '2. Caposervizio / Soccorritore Avanzato',
        emoji: '👨‍⚕️',
        ruoloTurno: 'caposervizio',
        categoria: 'Ruoli Equipaggio Base',
        minimo: 1,
        massimo: 1,
      },
      {
        id: 'ruolo-soccorritore2',
        nome: '3. Secondo Soccorritore',
        emoji: '🧑‍⚕️',
        ruoloTurno: 'soccorritore2',
        categoria: 'Ruoli Equipaggio Base',
        minimo: 1,
        massimo: 2,
      },
    ],
  },
  {
    id: 'tipo-turno-trasporto-ordinario',
    nome: 'Trasporto Sanitario Ordinario',
    descrizione: 'Servizi ordinari, dialisi, dimissioni e accompagnamenti sanitari',
    icona: '🚐',
    predefinito: true,
    dataCreazione: '01/01/2026',
    mansioniObbligatorie: [
      {
        id: 'ruolo-autista',
        nome: '1. Autista Soccorritore',
        emoji: '🚑',
        ruoloTurno: 'autista',
        categoria: 'Ruoli Equipaggio Base',
        minimo: 1,
        massimo: 1,
      },
      {
        id: 'ruolo-soccorritore2',
        nome: '3. Secondo Soccorritore',
        emoji: '🧑‍⚕️',
        ruoloTurno: 'soccorritore2',
        categoria: 'Ruoli Equipaggio Base',
        minimo: 1,
        massimo: 2,
      },
    ],
  },
  {
    id: 'tipo-turno-centrale-operativa',
    nome: 'Sala Operativa / Centrale',
    descrizione: 'Presidio sala radio, dispatch missioni e gestione chiamate',
    icona: '🎧',
    predefinito: true,
    dataCreazione: '01/01/2026',
    mansioniObbligatorie: [
      {
        id: 'ruolo-operatoreCentrale',
        nome: '5. Operatore Centrale / Sala Radio',
        emoji: '🎧',
        ruoloTurno: 'operatoreCentrale',
        categoria: 'Ruoli Equipaggio Base',
        minimo: 1,
        massimo: 2,
      },
      {
        id: 'ruolo-centralinista',
        nome: '6. Centralinista',
        emoji: '📞',
        ruoloTurno: 'centralinista',
        categoria: 'Ruoli Equipaggio Base',
        minimo: 1,
        massimo: 1,
      },
    ],
  },
];

export function getTipiTurnoUpdatedAt(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(TIPI_TURNO_UPDATED_AT_KEY);
    const num = raw ? Number(raw) : 0;
    return Number.isFinite(num) && num > 0 ? num : 0;
  } catch {
    return 0;
  }
}

export function touchTipiTurnoUpdatedAt(ts?: number): number {
  const val = typeof ts === 'number' && Number.isFinite(ts) && ts > 0 ? ts : Date.now();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(TIPI_TURNO_UPDATED_AT_KEY, String(val));
    } catch {}
  }
  return val;
}

function emettiAggiornamentoTipiTurnoLocal(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('croceoro_tipi_turno_updated'));
  } catch {}
}

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (!e.key || e.key === TIPI_TURNO_STORAGE_KEY) {
        emettiAggiornamentoTipiTurnoLocal();
      }
    });
  } catch {}
}

export function normalizzaMansioniTipoTurno(rawList: any[]): MansioneTipoTurno[] {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set<string>();
  const out: MansioneTipoTurno[] = [];
  rawList.forEach((item, idx) => {
    const nome = String(item?.nome || '').trim();
    if (!nome) return;
    const id = String(item?.id || `mans-turno-${idx}-${nome.toLowerCase().replace(/\s+/g, '-')}`);
    if (seen.has(id)) return;
    seen.add(id);
    const minRaw = Number(item?.minimo);
    const maxRaw = Number(item?.massimo);
    const minimo = Number.isFinite(minRaw) && minRaw >= 1 ? Math.floor(minRaw) : 1;
    const massimo = Number.isFinite(maxRaw) && maxRaw >= minimo ? Math.floor(maxRaw) : minimo;
    out.push({
      id,
      nome,
      emoji: item?.emoji ? String(item.emoji).trim() : '🎖️',
      ruoloTurno: item?.ruoloTurno ? (String(item.ruoloTurno) as RuoloTurno) : undefined,
      mansioneCatalogoId: item?.mansioneCatalogoId ? String(item.mansioneCatalogoId) : undefined,
      categoria: item?.categoria ? String(item.categoria).trim() : undefined,
      minimo,
      massimo,
    });
  });
  return out;
}

export function normalizzaListaTipiTurno(rawList: any[]): TipoTurnoConfig[] {
  if (!Array.isArray(rawList)) return [];
  const seenIds = new Set<string>();
  const out: TipoTurnoConfig[] = [];
  rawList.forEach((item, idx) => {
    const nome = String(item?.nome || '').trim();
    if (!nome) return;
    const id = String(item?.id || `tipo-turno-${Date.now()}-${idx}`);
    if (seenIds.has(id)) return;
    seenIds.add(id);
    out.push({
      id,
      nome,
      descrizione: item?.descrizione ? String(item.descrizione).trim() : '',
      icona: item?.icona ? String(item.icona).trim() : '📅',
      mansioniObbligatorie: normalizzaMansioniTipoTurno(item?.mansioniObbligatorie || []),
      predefinito: Boolean(item?.predefinito),
      dataCreazione: item?.dataCreazione ? String(item.dataCreazione) : undefined,
    });
  });
  return out;
}

export function getTipiTurnoCatalogo(): TipoTurnoConfig[] {
  if (typeof window === 'undefined') return TIPI_TURNO_DEFAULT;
  try {
    const saved = localStorage.getItem(TIPI_TURNO_STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return normalizzaListaTipiTurno(parsed);
      }
    }
  } catch {}
  return TIPI_TURNO_DEFAULT;
}

export function salvaTipiTurnoCatalogo(lista: TipoTurnoConfig[], updatedAt?: number): TipoTurnoConfig[] {
  const norm = normalizzaListaTipiTurno(lista);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(TIPI_TURNO_STORAGE_KEY, JSON.stringify(norm));
    } catch {}
    touchTipiTurnoUpdatedAt(updatedAt);
    emettiAggiornamentoTipiTurnoLocal();
  }
  return norm;
}

export function applicaTipiTurnoDaSync(tipi?: any[], updatedAt?: number): boolean {
  if (!Array.isArray(tipi)) return false;
  const localTs = getTipiTurnoUpdatedAt();
  if (typeof updatedAt === 'number' && Number.isFinite(updatedAt) && updatedAt > 0 && localTs > updatedAt) {
    return false;
  }
  salvaTipiTurnoCatalogo(tipi, updatedAt || Date.now());
  return true;
}

export function useTipiTurno(): TipoTurnoConfig[] {
  const [tipi, setTipi] = useState<TipoTurnoConfig[]>(() => getTipiTurnoCatalogo());

  useEffect(() => {
    const refresh = () => {
      setTipi(getTipiTurnoCatalogo());
    };
    window.addEventListener('croceoro_tipi_turno_updated', refresh);
    return () => {
      window.removeEventListener('croceoro_tipi_turno_updated', refresh);
    };
  }, []);

  return tipi;
}
