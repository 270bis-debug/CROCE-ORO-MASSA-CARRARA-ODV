/**
 * tipiTurno.ts
 * Catalogo dinamico e sincronizzato dei Tipi di Turni per il Database Calendario Turni.
 * I Ruoli Equipaggio combaciano SEMPRE con il catalogo "Mansioni & Competenze" del Database Gestione Volontari:
 * ogni creazione, modifica o rinomina in Mansioni & Competenze si riflette automaticamente nei Tipi di Turni e nei Turni.
 * Se minimo = 0, la mansione è facoltativa e non blocca la copertura del turno.
 */

import { useState, useEffect } from 'react';
import { TipoTurnoConfig, MansioneTipoTurno, RuoloTurno, TurnoSedeOperativa } from '../types/adminTypes';
import {
  getLabelRuoloEquipaggioLive,
  getMansioneCatalogoPerRuoloTurno,
  getMansioniCatalogo,
  MansioneOperativa,
} from './mansioniVolontari';

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

const LEGACY_RUOLO_ID_TO_CATALOGO_ID: Record<string, { catalogoId: string; ruoloTurno: RuoloTurno }> = {
  'ruolo-autista': { catalogoId: 'mansione-autista-118', ruoloTurno: 'autista' },
  'ruolo-soccorritore2': { catalogoId: 'mansione-socc-base', ruoloTurno: 'soccorritore2' },
  'ruolo-terzosoccorritore': { catalogoId: 'mansione-barelliere', ruoloTurno: 'terzoSoccorritore' },
  'ruolo-operatorecentrale': { catalogoId: 'mansione-op-centrale', ruoloTurno: 'operatoreCentrale' },
  'ruolo-centralinista': { catalogoId: 'mansione-centralinista', ruoloTurno: 'centralinista' },
  'ruolo-osservatore': { catalogoId: 'mansione-osservatore', ruoloTurno: 'osservatore' },
};

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
 * Associa una mansione del catalogo Gestione Volontari allo slot equipaggio compatibile.
 */
export function inferisciRuoloTurnoDaMansione(m: Pick<MansioneOperativa, 'id' | 'nome'>): RuoloTurno | undefined {
  const idLow = String(m.id || '').toLowerCase();
  const nomeLow = String(m.nome || '').toLowerCase();
  if (idLow === 'mansione-autista-118' || idLow === 'mansione-autista-ordinario' || nomeLow.includes('autist')) {
    return 'autista';
  }
  if (idLow === 'mansione-op-centrale' || nomeLow.includes('centrale') || nomeLow.includes('sala radio')) {
    return 'operatoreCentrale';
  }
  if (idLow === 'mansione-centralinista' || nomeLow.includes('centralin')) {
    return 'centralinista';
  }
  if (idLow === 'mansione-osservatore' || nomeLow.includes('osservat') || nomeLow.includes('tirocin')) {
    return 'osservatore';
  }
  if (idLow === 'mansione-barelliere' || nomeLow.includes('barell') || nomeLow.includes('terzo soccorrit')) {
    return 'terzoSoccorritore';
  }
  if (idLow === 'mansione-socc-base' || nomeLow.includes('soccorrit')) {
    return 'soccorritore2';
  }
  return undefined;
}

/**
 * Restituisce TUTTI i Ruoli Equipaggio selezionabili per un Tipo di Turno,
 * combaciando ESATTAMENTE con Mansioni & Competenze (Database Gestione Volontari).
 * Esclude "Caposervizio" poiché è un badge assegnabile a qualsiasi volontario del turno, non una mansione.
 */
export function getTutteMansioniDisponibiliPerTipoTurno(
  catalogoCustom?: MansioneOperativa[]
): OpzioneMansioneTurno[] {
  const catalogo = catalogoCustom || getMansioniCatalogo();
  return catalogo
    .filter((m) => !isMansioneCaposervizioVietata(m.id, m.nome))
    .map((m) => {
      const ruoloTurno = inferisciRuoloTurnoDaMansione(m);
      return {
        id: m.id,
        nome: m.nome,
        emoji: m.badgeEmoji || '🎖️',
        categoria: m.categoria || 'Mansioni & Competenze',
        ruoloTurno,
        mansioneCatalogoId: m.id,
        descrizione: m.descrizione,
        isRuoloBase: Boolean(ruoloTurno),
      };
    });
}

/**
 * Trova la mansione live nel catalogo Mansioni & Competenze corrispondente a una voce di MansioneTipoTurno
 * (gestisce sia ID diretti, sia mansioneCatalogoId, sia vecchi prefissi 'mansione-...', sia legacy 'ruolo-...').
 */
function trovaMansioneCatalogoPerVoceTipoTurno(
  item: Partial<MansioneTipoTurno>,
  catalogo: MansioneOperativa[]
): MansioneOperativa | undefined {
  const candidates = new Set<string>();
  const rawId = String(item.id || '').trim();
  const catId = String(item.mansioneCatalogoId || '').trim();
  if (catId) candidates.add(catId);
  if (rawId) {
    candidates.add(rawId);
    if (rawId.startsWith('mansione-mansione-')) {
      candidates.add(rawId.slice('mansione-'.length));
    }
    const legacy = LEGACY_RUOLO_ID_TO_CATALOGO_ID[rawId.toLowerCase()];
    if (legacy) candidates.add(legacy.catalogoId);
  }

  for (const cid of candidates) {
    const found = catalogo.find((m) => m.id === cid);
    if (found) return found;
  }

  // Fallback per nome esatto (case-insensitive)
  const nomeLow = String(item.nome || '').trim().toLowerCase();
  if (nomeLow) {
    const byName = catalogo.find((m) => m.nome.trim().toLowerCase() === nomeLow);
    if (byName) return byName;
  }

  // Fallback per ruoloTurno legacy
  if (item.ruoloTurno) {
    const byRole = getMansioneCatalogoPerRuoloTurno(item.ruoloTurno, catalogo);
    if (byRole) return byRole;
  }

  return undefined;
}

/**
 * Allinea un elenco di MansioneTipoTurno con i nomi, le icone e le categorie LIVE
 * presenti in Mansioni & Competenze (Database Gestione Volontari).
 */
export function risolviMansioniTipoTurnoLive(
  mansioni: MansioneTipoTurno[],
  catalogoCustom?: MansioneOperativa[]
): MansioneTipoTurno[] {
  if (!Array.isArray(mansioni) || mansioni.length === 0) return [];
  const catalogo = catalogoCustom || getMansioniCatalogo();
  const seen = new Set<string>();
  const out: MansioneTipoTurno[] = [];

  for (const item of mansioni) {
    if (isMansioneCaposervizioVietata(item.id, item.nome, item.ruoloTurno)) continue;
    const matched = trovaMansioneCatalogoPerVoceTipoTurno(item, catalogo);
    const resolvedId = matched ? matched.id : item.mansioneCatalogoId || item.id;
    if (seen.has(resolvedId)) continue;
    seen.add(resolvedId);

    out.push({
      ...item,
      id: resolvedId,
      mansioneCatalogoId: matched ? matched.id : item.mansioneCatalogoId,
      nome: matched ? matched.nome : item.nome,
      emoji: matched ? matched.badgeEmoji || item.emoji || '🎖️' : item.emoji || '🎖️',
      categoria: matched ? matched.categoria || item.categoria : item.categoria,
      ruoloTurno: item.ruoloTurno || (matched ? inferisciRuoloTurnoDaMansione(matched) : undefined),
    });
  }

  return out;
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
        id: 'mansione-autista-118',
        mansioneCatalogoId: 'mansione-autista-118',
        nome: 'Autista Soccorritore 118',
        emoji: '🚑',
        ruoloTurno: 'autista',
        categoria: 'Emergenza 118',
        minimo: 1,
        massimo: 1,
      },
      {
        id: 'mansione-socc-base',
        mansioneCatalogoId: 'mansione-socc-base',
        nome: 'Soccorritore Base',
        emoji: '🧑‍⚕️',
        ruoloTurno: 'soccorritore2',
        categoria: 'Emergenza 118',
        minimo: 1,
        massimo: 2,
      },
      {
        id: 'mansione-barelliere',
        mansioneCatalogoId: 'mansione-barelliere',
        nome: 'Barelliere / Accompagnatore Sanitario',
        emoji: '🤝',
        ruoloTurno: 'terzoSoccorritore',
        categoria: 'Ordinario & Sociale',
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
        id: 'mansione-autista-ordinario',
        mansioneCatalogoId: 'mansione-autista-ordinario',
        nome: 'Autista Mezzi Ordinari / Pulmino',
        emoji: '🚐',
        ruoloTurno: 'autista',
        categoria: 'Ordinario & Sociale',
        minimo: 1,
        massimo: 1,
      },
      {
        id: 'mansione-socc-base',
        mansioneCatalogoId: 'mansione-socc-base',
        nome: 'Soccorritore Base',
        emoji: '🧑‍⚕️',
        ruoloTurno: 'soccorritore2',
        categoria: 'Emergenza 118',
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
        id: 'mansione-op-centrale',
        mansioneCatalogoId: 'mansione-op-centrale',
        nome: 'Operatore di Centrale Operativa',
        emoji: '🎧',
        ruoloTurno: 'operatoreCentrale',
        categoria: 'Centrale & TLC',
        minimo: 1,
        massimo: 2,
      },
      {
        id: 'mansione-centralinista',
        mansioneCatalogoId: 'mansione-centralinista',
        nome: 'Centralinista & Accoglienza',
        emoji: '📞',
        ruoloTurno: 'centralinista',
        categoria: 'Centrale & TLC',
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
 * indipendentemente dalla mansione ricoperta, con etichette ruolo allineate a Mansioni & Competenze.
 */
export function getVolontariAssegnatiTurno(
  turno?: Partial<TurnoSedeOperativa> | null,
  catalogoCustom?: MansioneOperativa[]
): Array<{ id: string; nome: string; ruoloLabel: string; ruoloKey: RuoloTurno }> {
  if (!turno) return [];
  const catalogo = catalogoCustom || getMansioniCatalogo();
  const entries: Array<{ slot?: { id: string; nome: string }; ruoloLabel: string; ruoloKey: RuoloTurno }> = [
    { slot: turno.autista, ruoloLabel: getLabelRuoloEquipaggioLive('autista', catalogo).nome, ruoloKey: 'autista' },
    { slot: turno.soccorritore2, ruoloLabel: getLabelRuoloEquipaggioLive('soccorritore2', catalogo).nome, ruoloKey: 'soccorritore2' },
    { slot: turno.terzoSoccorritore, ruoloLabel: getLabelRuoloEquipaggioLive('terzoSoccorritore', catalogo).nome, ruoloKey: 'terzoSoccorritore' },
    { slot: turno.operatoreCentrale, ruoloLabel: getLabelRuoloEquipaggioLive('operatoreCentrale', catalogo).nome, ruoloKey: 'operatoreCentrale' },
    { slot: turno.centralinista, ruoloLabel: getLabelRuoloEquipaggioLive('centralinista', catalogo).nome, ruoloKey: 'centralinista' },
    { slot: turno.osservatore, ruoloLabel: getLabelRuoloEquipaggioLive('osservatore', catalogo).nome, ruoloKey: 'osservatore' },
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

export function normalizzaMansioniTipoTurno(
  rawList: any[],
  catalogoCustom?: MansioneOperativa[]
): MansioneTipoTurno[] {
  if (!Array.isArray(rawList)) return [];
  const catalogo = catalogoCustom || getMansioniCatalogo();
  const seen = new Set<string>();
  const out: MansioneTipoTurno[] = [];
  rawList.forEach((item, idx) => {
    const nomeRaw = String(item?.nome || '').trim();
    if (!nomeRaw) return;
    const rawId = String(item?.id || `mans-turno-${idx}-${nomeRaw.toLowerCase().replace(/\s+/g, '-')}`);
    if (isMansioneCaposervizioVietata(rawId, nomeRaw, item?.ruoloTurno)) return;

    const matched = trovaMansioneCatalogoPerVoceTipoTurno(
      {
        id: rawId,
        nome: nomeRaw,
        mansioneCatalogoId: item?.mansioneCatalogoId ? String(item.mansioneCatalogoId) : undefined,
        ruoloTurno: item?.ruoloTurno ? (String(item.ruoloTurno) as RuoloTurno) : undefined,
      },
      catalogo
    );

    const id = matched ? matched.id : rawId;
    if (seen.has(id)) return;
    seen.add(id);

    const minRaw = Number(item?.minimo);
    const maxRaw = Number(item?.massimo);
    const minimo = Number.isFinite(minRaw) && minRaw >= 0 ? Math.floor(minRaw) : 0;
    const minMaxFloor = Math.max(1, minimo);
    const massimo = Number.isFinite(maxRaw) && maxRaw >= minMaxFloor ? Math.floor(maxRaw) : minMaxFloor;

    out.push({
      id,
      nome: matched ? matched.nome : nomeRaw,
      emoji: matched
        ? matched.badgeEmoji || (item?.emoji ? String(item.emoji).trim() : '🎖️')
        : item?.emoji
        ? String(item.emoji).trim()
        : '🎖️',
      ruoloTurno: item?.ruoloTurno
        ? (String(item.ruoloTurno) as RuoloTurno)
        : matched
        ? inferisciRuoloTurnoDaMansione(matched)
        : undefined,
      mansioneCatalogoId: matched
        ? matched.id
        : item?.mansioneCatalogoId
        ? String(item.mansioneCatalogoId)
        : undefined,
      categoria: matched
        ? matched.categoria
        : item?.categoria
        ? String(item.categoria).trim()
        : undefined,
      minimo,
      massimo,
    });
  });
  return out;
}

export function normalizzaListaTipiTurno(rawList: any[], catalogoCustom?: MansioneOperativa[]): TipoTurnoConfig[] {
  if (!Array.isArray(rawList)) return [];
  const catalogo = catalogoCustom || getMansioniCatalogo();
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
      mansioniObbligatorie: normalizzaMansioniTipoTurno(item?.mansioniObbligatorie || [], catalogo),
      predefinito: Boolean(item?.predefinito),
      dataCreazione: item?.dataCreazione ? String(item.dataCreazione) : undefined,
    });
  });
  return out;
}

export function getTipiTurnoCatalogo(catalogoCustom?: MansioneOperativa[]): TipoTurnoConfig[] {
  const catalogo = catalogoCustom || getMansioniCatalogo();
  if (typeof window === 'undefined') return normalizzaListaTipiTurno(TIPI_TURNO_DEFAULT, catalogo);
  try {
    const saved = localStorage.getItem(TIPI_TURNO_STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return normalizzaListaTipiTurno(parsed, catalogo);
      }
    }
  } catch {}
  return normalizzaListaTipiTurno(TIPI_TURNO_DEFAULT, catalogo);
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

function matchesRenamedMansione(
  entry: MansioneTipoTurno,
  vecchioNomeLow: string,
  mansioneId?: string
): boolean {
  if (mansioneId) {
    if (entry.id === mansioneId || entry.mansioneCatalogoId === mansioneId) return true;
    if (entry.id === `mansione-${mansioneId}`) return true;
    const legacy = LEGACY_RUOLO_ID_TO_CATALOGO_ID[String(entry.id || '').toLowerCase()];
    if (legacy && legacy.catalogoId === mansioneId) return true;
  }
  if (vecchioNomeLow && String(entry.nome || '').trim().toLowerCase() === vecchioNomeLow) {
    return true;
  }
  return false;
}

/**
 * Aggiorna automaticamente tutti i Tipi di Turno quando una mansione del catalogo Mansioni & Competenze
 * viene rinominata o modificata (nome, emoji o categoria).
 */
export function aggiornaTipiTurnoDopoModificaMansione(
  vecchioNome: string,
  nuovoNome: string,
  mansioneId?: string,
  nuovaEmoji?: string,
  nuovaCategoria?: string
): { aggiornati: TipoTurnoConfig[]; modificato: boolean } {
  const attuali = getTipiTurnoCatalogo();
  const vecchioLow = (vecchioNome || '').trim().toLowerCase();
  const nuovoPulito = (nuovoNome || '').trim();
  if (!nuovoPulito && !nuovaEmoji && !nuovaCategoria) {
    return { aggiornati: attuali, modificato: false };
  }

  let modificato = false;
  const aggiornati = attuali.map((tipo) => {
    let tipoMod = false;
    const nuoveMansioni = tipo.mansioniObbligatorie.map((m) => {
      if (!matchesRenamedMansione(m, vecchioLow, mansioneId)) return m;
      const nextNome = nuovoPulito || m.nome;
      const nextEmoji = nuovaEmoji !== undefined ? nuovaEmoji : m.emoji;
      const nextCat = nuovaCategoria !== undefined ? nuovaCategoria : m.categoria;
      const nextId = mansioneId || m.id;
      const nextCatId = mansioneId || m.mansioneCatalogoId;
      if (
        m.nome !== nextNome ||
        m.emoji !== nextEmoji ||
        m.categoria !== nextCat ||
        m.id !== nextId ||
        m.mansioneCatalogoId !== nextCatId
      ) {
        tipoMod = true;
        modificato = true;
        return {
          ...m,
          id: nextId,
          mansioneCatalogoId: nextCatId,
          nome: nextNome,
          emoji: nextEmoji,
          categoria: nextCat,
        };
      }
      return m;
    });
    return tipoMod ? { ...tipo, mansioniObbligatorie: nuoveMansioni } : tipo;
  });

  if (modificato) {
    const salvati = salvaTipiTurnoCatalogo(aggiornati);
    return { aggiornati: salvati, modificato: true };
  }
  return { aggiornati: attuali, modificato: false };
}

/**
 * Aggiorna automaticamente TUTTI i Turni (passati, presenti e futuri) quando una mansione
 * viene rinominata o modificata (mansioniRichieste + candidature.qualificaVolontario).
 */
export function aggiornaTurniDopoModificaMansione(
  turni: TurnoSedeOperativa[],
  vecchioNome: string,
  nuovoNome: string,
  mansioneId?: string,
  nuovaEmoji?: string,
  nuovaCategoria?: string
): { aggiornati: TurnoSedeOperativa[]; modificato: boolean } {
  if (!Array.isArray(turni) || turni.length === 0) return { aggiornati: turni, modificato: false };
  const vecchioLow = (vecchioNome || '').trim().toLowerCase();
  const nuovoPulito = (nuovoNome || '').trim();
  let modificato = false;

  const aggiornati = turni.map((t) => {
    let turnoMod = false;
    let nextRichieste = t.mansioniRichieste;
    if (Array.isArray(t.mansioniRichieste) && t.mansioniRichieste.length > 0) {
      nextRichieste = t.mansioniRichieste.map((m) => {
        if (!matchesRenamedMansione(m, vecchioLow, mansioneId)) return m;
        const nextNome = nuovoPulito || m.nome;
        const nextEmoji = nuovaEmoji !== undefined ? nuovaEmoji : m.emoji;
        const nextCat = nuovaCategoria !== undefined ? nuovaCategoria : m.categoria;
        const nextId = mansioneId || m.id;
        const nextCatId = mansioneId || m.mansioneCatalogoId;
        if (
          m.nome !== nextNome ||
          m.emoji !== nextEmoji ||
          m.categoria !== nextCat ||
          m.id !== nextId ||
          m.mansioneCatalogoId !== nextCatId
        ) {
          turnoMod = true;
          modificato = true;
          return {
            ...m,
            id: nextId,
            mansioneCatalogoId: nextCatId,
            nome: nextNome,
            emoji: nextEmoji,
            categoria: nextCat,
          };
        }
        return m;
      });
    }

    let nextRichiesteIscrizione = t.richiesteIscrizione;
    if (vecchioLow && nuovoPulito && vecchioLow !== nuovoPulito.toLowerCase() && Array.isArray(t.richiesteIscrizione)) {
      nextRichiesteIscrizione = t.richiesteIscrizione.map((c) => {
        if (c.qualificaVolontario && c.qualificaVolontario.trim().toLowerCase() === vecchioLow) {
          turnoMod = true;
          modificato = true;
          return { ...c, qualificaVolontario: nuovoPulito };
        }
        return c;
      });
    }

    return turnoMod
      ? {
          ...t,
          ...(nextRichieste !== t.mansioniRichieste ? { mansioniRichieste: nextRichieste } : {}),
          ...(nextRichiesteIscrizione !== t.richiesteIscrizione ? { richiesteIscrizione: nextRichiesteIscrizione } : {}),
        }
      : t;
  });

  return { aggiornati, modificato };
}

export function useTipiTurno(): TipoTurnoConfig[] {
  const [tipi, setTipi] = useState<TipoTurnoConfig[]>(() => getTipiTurnoCatalogo());

  useEffect(() => {
    const refresh = () => {
      setTipi(getTipiTurnoCatalogo());
    };
    window.addEventListener('croceoro_tipi_turno_updated', refresh);
    window.addEventListener('croceoro_mansioni_updated', refresh);
    return () => {
      window.removeEventListener('croceoro_tipi_turno_updated', refresh);
      window.removeEventListener('croceoro_mansioni_updated', refresh);
    };
  }, []);

  return tipi;
}
