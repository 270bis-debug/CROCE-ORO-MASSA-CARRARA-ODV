/**
 * tipiTurno.ts
 * Catalogo dinamico e sincronizzato dei Tipi di Turni per il Database Calendario Turni.
 * Ogni Tipo di Turno definisce un nome e una o più mansioni con numero minimo (>= 0) e massimo
 * di volontari previsti (sia dai ruoli equipaggio base sia dal catalogo Mansioni & Competenze).
 * Se minimo = 0, la mansione è facoltativa e non blocca la copertura del turno.
 */

import { useState, useEffect } from 'react';
import { TipoTurnoConfig, MansioneTipoTurno, RuoloTurno, TurnoSedeOperativa } from '../types/adminTypes';
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
 * Ruoli equipaggio standard selezionabili nei Tipi di Turno.
 * NOTA: "Caposervizio / Soccorritore Avanzato" NON è una mansione:
 * il Capo Servizio è un badge assegnabile a qualsiasi volontario presente nel turno, indipendentemente dalla mansione.
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
    id: 'ruolo-soccorritore2',
    nome: '2. Secondo Soccorritore',
    emoji: '🧑‍⚕️',
    categoria: 'Ruoli Equipaggio Base',
    ruoloTurno: 'soccorritore2',
    descrizione: 'Secondo soccorritore a bordo del mezzo',
    isRuoloBase: true,
  },
  {
    id: 'ruolo-terzoSoccorritore',
    nome: '3. Terzo Soccorritore',
    emoji: '🧑‍⚕️',
    categoria: 'Ruoli Equipaggio Base',
    ruoloTurno: 'terzoSoccorritore',
    descrizione: 'Terzo soccorritore / supporto operativo a bordo',
    isRuoloBase: true,
  },
  {
    id: 'ruolo-operatoreCentrale',
    nome: '4. Operatore Centrale / Sala Radio',
    emoji: '🎧',
    categoria: 'Ruoli Equipaggio Base',
    ruoloTurno: 'operatoreCentrale',
    descrizione: 'Gestione sala radio, dispatch missioni e coordinamento mezzi',
    isRuoloBase: true,
  },
  {
    id: 'ruolo-centralinista',
    nome: '5. Centralinista',
    emoji: '📞',
    categoria: 'Ruoli Equipaggio Base',
    ruoloTurno: 'centralinista',
    descrizione: 'Risposta telefonica, prenotazione servizi e accoglienza sede',
    isRuoloBase: true,
  },
  {
    id: 'ruolo-osservatore',
    nome: '6. Osservatore (In Formazione / Tirocinante)',
    emoji: '👁️',
    categoria: 'Ruoli Equipaggio Base',
    ruoloTurno: 'osservatore',
    descrizione: 'Volontario in affiancamento formativo o tirocinio pratico',
    isRuoloBase: true,
  },
];

function isMansioneCaposervizioVietata(id?: string, nome?: string, ruoloTurno?: string): boolean {
  const idLow = String(id || '').toLowerCase();
  const nomeLow = String(nome || '').toLowerCase();
  const ruoloLow = String(ruoloTurno || '').toLowerCase();
  return (
    idLow === 'ruolo-caposervizio' ||
    idLow === 'mansione-socc-avanzato' ||
    ruoloLow === 'caposervizio' ||
    nomeLow.includes('caposervizio') ||
    nomeLow.includes('capo servizio')
  );
}

/**
 * Restituisce tutte le mansioni selezionabili per un Tipo di Turno:
 * prima i ruoli equipaggio base, seguiti da tutte le mansioni definite nel database
 * Gestione Volontari -> sottosezione MANSIONI & COMPETENZE (escluso Caposervizio che è un badge, non una mansione).
 */
export function getTutteMansioniDisponibiliPerTipoTurno(
  catalogoCustom?: MansioneOperativa[]
): OpzioneMansioneTurno[] {
  const catalogo = catalogoCustom || getMansioniCatalogo();
  const extra: OpzioneMansioneTurno[] = catalogo
    .filter((m) => !isMansioneCaposervizioVietata(m.id, m.nome))
    .map((m) => ({
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
        id: 'ruolo-soccorritore2',
        nome: '2. Secondo Soccorritore',
        emoji: '🧑‍⚕️',
        ruoloTurno: 'soccorritore2',
        categoria: 'Ruoli Equipaggio Base',
        minimo: 1,
        massimo: 2,
      },
      {
        id: 'ruolo-terzoSoccorritore',
        nome: '3. Terzo Soccorritore',
        emoji: '🧑‍⚕️',
        ruoloTurno: 'terzoSoccorritore',
        categoria: 'Ruoli Equipaggio Base',
        minimo: 0,
        massimo: 1,
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
        nome: '2. Secondo Soccorritore',
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
        nome: '4. Operatore Centrale / Sala Radio',
        emoji: '🎧',
        ruoloTurno: 'operatoreCentrale',
        categoria: 'Ruoli Equipaggio Base',
        minimo: 1,
        massimo: 2,
      },
      {
        id: 'ruolo-centralinista',
        nome: '5. Centralinista',
        emoji: '📞',
        ruoloTurno: 'centralinista',
        categoria: 'Ruoli Equipaggio Base',
        minimo: 0,
        massimo: 1,
      },
    ],
  },
];

/**
 * Restituisce il volontario che detiene il badge di Capo Servizio per il turno.
 */
export function getCapoServizioTurno(
  turno?: Partial<TurnoSedeOperativa> | null
): { id: string; nome: string } | undefined {
  if (!turno) return undefined;
  if (turno.capoServizioBadge?.id || turno.capoServizioBadge?.nome) {
    return turno.capoServizioBadge;
  }
  if (turno.caposervizio?.id || turno.caposervizio?.nome) {
    return turno.caposervizio;
  }
  return undefined;
}

/**
 * Restituisce l'elenco univoco di tutti i volontari assegnati e segnati nel turno,
 * indipendentemente dalla mansione ricoperta.
 */
export function getVolontariAssegnatiTurno(
  turno?: Partial<TurnoSedeOperativa> | null
): Array<{ id: string; nome: string; ruoloLabel: string; ruoloKey: RuoloTurno }> {
  if (!turno) return [];
  const entries: Array<{ slot?: { id: string; nome: string }; ruoloLabel: string; ruoloKey: RuoloTurno }> = [
    { slot: turno.autista, ruoloLabel: 'Autista Soccorritore', ruoloKey: 'autista' },
    { slot: turno.soccorritore2, ruoloLabel: 'Secondo Soccorritore', ruoloKey: 'soccorritore2' },
    { slot: turno.terzoSoccorritore, ruoloLabel: 'Terzo Soccorritore', ruoloKey: 'terzoSoccorritore' },
    { slot: turno.operatoreCentrale, ruoloLabel: 'Operatore Centrale', ruoloKey: 'operatoreCentrale' },
    { slot: turno.centralinista, ruoloLabel: 'Centralinista', ruoloKey: 'centralinista' },
    { slot: turno.osservatore, ruoloLabel: 'Osservatore', ruoloKey: 'osservatore' },
    { slot: turno.caposervizio, ruoloLabel: 'Equipaggio', ruoloKey: 'caposervizio' },
  ];

  const seen = new Set<string>();
  const out: Array<{ id: string; nome: string; ruoloLabel: string; ruoloKey: RuoloTurno }> = [];
  for (const e of entries) {
    if (!e.slot || (!e.slot.id && !e.slot.nome)) continue;
    const key = e.slot.id || e.slot.nome.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: e.slot.id,
      nome: e.slot.nome,
      ruoloLabel: e.ruoloLabel,
      ruoloKey: e.ruoloKey,
    });
  }
  return out;
}

/**
 * Conta quanti volontari assegnati nel turno coprono una determinata mansione richiesta.
 */
function contaAssegnatiPerMansione(
  turno: Partial<TurnoSedeOperativa>,
  m: MansioneTipoTurno
): number {
  const ruolo = m.ruoloTurno;
  if (ruolo === 'autista') return turno.autista ? 1 : 0;
  if (ruolo === 'soccorritore2') {
    return (turno.soccorritore2 ? 1 : 0) + (turno.terzoSoccorritore ? 1 : 0);
  }
  if (ruolo === 'terzoSoccorritore') return turno.terzoSoccorritore ? 1 : 0;
  if (ruolo === 'operatoreCentrale') return turno.operatoreCentrale ? 1 : 0;
  if (ruolo === 'centralinista') return turno.centralinista ? 1 : 0;
  if (ruolo === 'osservatore') return turno.osservatore ? 1 : 0;

  // Per mansioni custom dal catalogo Gestione Volontari: verifica per nome/ruolo o numero volontari assegnati
  const nomeLow = (m.nome || '').toLowerCase();
  if (nomeLow.includes('autist')) return turno.autista ? 1 : 0;
  if (nomeLow.includes('centralin')) return turno.centralinista ? 1 : 0;
  if (nomeLow.includes('centrale') || nomeLow.includes('radio')) return turno.operatoreCentrale ? 1 : 0;
  if (nomeLow.includes('osservat') || nomeLow.includes('tirocin')) return turno.osservatore ? 1 : 0;
  if (nomeLow.includes('soccorrit') || nomeLow.includes('barell')) {
    return (turno.soccorritore2 ? 1 : 0) + (turno.terzoSoccorritore ? 1 : 0);
  }

  // Fallback generico: usa il totale dei volontari assegnati al turno
  return getVolontariAssegnatiTurno(turno).length;
}

/**
 * Calcola lo stato di copertura di un turno tenendo conto delle mansioni del Tipo di Turno:
 * - Se una mansione ha minimo === 0, NON è obbligatoria: anche con 0 persone assegnate in quella mansione,
 *   se tutte le altre mansioni obbligatorie (minimo > 0) sono coperte, il turno è considerato 'Coperto'.
 */
export function calcolaCoperturaTurno(
  turno: Partial<TurnoSedeOperativa>
): TurnoSedeOperativa['statoCopertura'] {
  const assegnati = getVolontariAssegnatiTurno(turno);
  const totaleAssegnati = assegnati.length;

  const richieste = Array.isArray(turno.mansioniRichieste)
    ? turno.mansioniRichieste.filter((m) => !isMansioneCaposervizioVietata(m.id, m.nome, m.ruoloTurno))
    : [];

  if (richieste.length > 0) {
    const obbligatorie = richieste.filter((m) => (typeof m.minimo === 'number' ? m.minimo : 0) > 0);
    if (obbligatorie.length === 0) {
      // Tutte le mansioni hanno minimo 0 (nessuna obbligatoria): turno coperto appena c'è almeno un volontario (o anche 0 se configurato senza obblighi)
      return totaleAssegnati > 0 ? 'Coperto' : 'Scoperto';
    }
    const tutteObbligatorieCoperte = obbligatorie.every(
      (m) => contaAssegnatiPerMansione(turno, m) >= m.minimo
    );
    if (tutteObbligatorieCoperte) return 'Coperto';
    if (totaleAssegnati > 0) return 'Parziale';
    return 'Scoperto';
  }

  // Fallback per turni storici senza tipoTurno/mansioniRichieste
  if (turno.autista && turno.soccorritore2) return 'Coperto';
  if (totaleAssegnati > 0) return 'Parziale';
  return 'Scoperto';
}

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
    if (isMansioneCaposervizioVietata(id, nome, item?.ruoloTurno)) return;
    if (seen.has(id)) return;
    seen.add(id);
    const minRaw = Number(item?.minimo);
    const maxRaw = Number(item?.massimo);
    const minimo = Number.isFinite(minRaw) && minRaw >= 0 ? Math.floor(minRaw) : 0;
    const minMaxFloor = Math.max(1, minimo);
    const massimo = Number.isFinite(maxRaw) && maxRaw >= minMaxFloor ? Math.floor(maxRaw) : minMaxFloor;
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
