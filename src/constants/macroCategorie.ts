export type MacroCategoriaId =
  | 'centrale'
  | 'volontari'
  | 'mezzi'
  | 'contabilita'
  | 'formazione'
  | 'magazzino'
  | 'sedi'
  | 'turni'
  | 'bacheca'
  | 'contatti';

export interface InfoMacroCategoria {
  id: MacroCategoriaId;
  numero: string;
  titolo: string;
  sottotitolo: string;
  descrizione: string;
  icona: string; // emoji icon
}

export const LISTA_MACRO_CATEGORIE: InfoMacroCategoria[] = [
  {
    id: 'centrale',
    numero: '1',
    titolo: 'Operatore Centrale',
    sottotitolo: 'Gestione Missioni & Flotta Live',
    descrizione: 'Creazione e dispatch schede missione, tracciamento GPS flotta e comunicazioni radio.',
    icona: '🎧'
  },
  {
    id: 'volontari',
    numero: '2',
    titolo: 'Database Volontari',
    sottotitolo: 'Anagrafiche, Gruppi & Timbrature',
    descrizione: 'Gestione anagrafiche, assegnazione gruppi alle sezioni, vestiario, PIN e presenze.',
    icona: '👥'
  },
  {
    id: 'mezzi',
    numero: '3',
    titolo: 'Database Mezzi & Flotta',
    sottotitolo: 'Autoparco, Manutenzioni & Ricambi',
    descrizione: 'Stato mezzi, inserimento e modifica manutenzioni con officine, dotazioni e ricambi.',
    icona: '🚑'
  },
  {
    id: 'contabilita',
    numero: '4',
    titolo: 'Contabilità & Tesseramento',
    sottotitolo: 'Donazioni, Ricevute & Note Debito',
    descrizione: 'Registro donazioni, quote sociali annuali soci, ricevute fiscali ed emissione note di debito.',
    icona: '💶'
  },
  {
    id: 'formazione',
    numero: '5',
    titolo: 'Formazione & Corsi',
    sottotitolo: 'Piano Formativo, Sedi GPS & Brevetti',
    descrizione: 'Programmazione corsi per sezioni, timbrature GPS presenze, percentuali frequenza e attestati.',
    icona: '🎓'
  },
  {
    id: 'magazzino',
    numero: '6',
    titolo: 'Magazzino Vestiario & DPI',
    sottotitolo: 'Scorte Divise & Attrezzature H24',
    descrizione: 'Carico e scarico divise e DPI da fornitori, radio portatili, lettori microchip e presidi.',
    icona: '📦'
  },
  {
    id: 'sedi',
    numero: '7',
    titolo: 'Sedi Associative & Territoriali',
    sottotitolo: 'Mappa, Recapiti & Dotazioni',
    descrizione: 'Anagrafica sedi operative e territoriali, referenti H24 e inventario dotazioni di sede.',
    icona: '🏢'
  },
  {
    id: 'turni',
    numero: '8',
    titolo: 'Calendario Turni Sedi Operative',
    sottotitolo: 'Pianificazione & Reperibilità',
    descrizione: 'Programmazione turni per sede, ruoli a bordo, monitoraggio coperture e tabellone.',
    icona: '📅'
  },
  {
    id: 'bacheca',
    numero: '9',
    titolo: 'Bacheca di Sezione',
    sottotitolo: 'Circolari & Avvisi Ufficiali',
    descrizione: 'Pubblicazione avvisi, ordini di servizio e comunicazioni ufficiali ai volontari.',
    icona: '📢'
  },
  {
    id: 'contatti',
    numero: '10',
    titolo: 'Contatti Fornitori / Clienti / Ecc.',
    sottotitolo: 'Fornitori, Officine & Donatori',
    descrizione: 'Anagrafiche complete fornitori DPI e ricambi, officine meccaniche autorizzate, enti debitori e donatori da interventi.',
    icona: '📇'
  }
];

export const TUTTE_LE_MACRO_CATEGORIE: MacroCategoriaId[] = LISTA_MACRO_CATEGORIE.map((c) => c.id);

export interface InfoSottosezioneDatabase {
  id: string; // ID tecnico immutabile della sottosezione
  numero: string;
  titoloDefault: string;
  descrizione?: string;
  adminOnly?: boolean; // Solo amministratore (es. gestione permessi accesso database)
}

export const SOTTOSEZIONI_PER_DATABASE: Record<MacroCategoriaId, InfoSottosezioneDatabase[]> = {
  centrale: [
    { id: 'missioni', numero: '1', titoloDefault: 'Invio Schede & Missioni', descrizione: 'Compilazione scheda intervento, dispatch e stato mezzi' },
    { id: 'giornale_bordo', numero: '2', titoloDefault: 'Giornale di Bordo & Brogliaccio', descrizione: 'Registro eventi di sala operativa e consegne' },
  ],
  volontari: [
    { id: 'anagrafiche', numero: '1', titoloDefault: 'Anagrafiche Volontari' },
    { id: 'vestiario', numero: '2', titoloDefault: 'Vestiario & DPI Personale' },
    { id: 'pin', numero: '3', titoloDefault: 'Gestione PIN & Sicurezza', adminOnly: true },
    { id: 'domande', numero: '4', titoloDefault: 'Domande Ammissione' },
    { id: 'timbrature', numero: '5', titoloDefault: 'Registro Timbrature' },
    { id: 'gruppi', numero: '6', titoloDefault: 'Gruppi & Sezioni Territoriali' },
    { id: 'mansioni', numero: '7', titoloDefault: 'Mansioni & Competenze' },
    { id: 'permessi_database', numero: '8', titoloDefault: 'Accesso Database & Permessi', adminOnly: true },
  ],
  mezzi: [
    { id: 'flotta', numero: '1', titoloDefault: 'Flotta Mezzi' },
    { id: 'manutenzione', numero: '2', titoloDefault: 'Manutenzione Mezzi & Tagliandi' },
    { id: 'dotazione', numero: '3', titoloDefault: 'Dotazione Mezzi' },
    { id: 'magazzinoMezzi', numero: '4', titoloDefault: 'Magazzino Mezzi (Ricambi)' },
    { id: 'consumi', numero: '5', titoloDefault: 'Consumi & Costo KM' },
    { id: 'checklist', numero: '6', titoloDefault: 'Checklist Inizio Turno' },
    { id: 'tipologie', numero: '7', titoloDefault: 'Tipologia Mezzo' },
    { id: 'monitoraggio', numero: '8', titoloDefault: 'Monitoraggio Flotta & Grafici' },
  ],
  contabilita: [
    { id: 'donazioni', numero: '1', titoloDefault: 'Servizi con Donazioni' },
    { id: 'tesseramento', numero: '2', titoloDefault: 'Tesseramento Annuale & Ricevute' },
    { id: 'noteDebito', numero: '3', titoloDefault: 'Note di Debito' },
    { id: 'commercialista', numero: '4', titoloDefault: 'Prospetto Commercialista' },
    { id: 'costiServizio', numero: '5', titoloDefault: 'Costi di Servizio & Preventivi' },
    { id: 'contiCorrenti', numero: '6', titoloDefault: 'Coordinate Bancarie & Postali' },
    { id: 'altreEntrateUscite', numero: '7', titoloDefault: 'Altre Entrate / Uscite' },
    { id: 'costiGestione', numero: '8', titoloDefault: 'Costi di Gestione' },
    { id: 'ricevute', numero: '9', titoloDefault: 'Emissione Ricevute' },
  ],
  formazione: [
    { id: 'corsi', numero: '1', titoloDefault: 'Catalogo Corsi & Piano Formativo' },
    { id: 'iscritti', numero: '2', titoloDefault: 'Iscrizioni & Registro Presenze' },
    { id: 'scadenziario', numero: '3', titoloDefault: 'Scadenziario Brevetti & Attestati' },
    { id: 'modelli_pdf', numero: '4', titoloDefault: 'Modelli PDF Prestampati & Matricole' },
  ],
  magazzino: [
    { id: 'vestiario', numero: '1', titoloDefault: 'Magazzino Vestiario & DPI' },
    { id: 'attrezzature', numero: '2', titoloDefault: 'Attrezzature & Presidi' },
    { id: 'movimenti', numero: '3', titoloDefault: 'Registro Movimentazioni' },
  ],
  sedi: [
    { id: 'elenco', numero: '1', titoloDefault: 'Elenco Sedi' },
    { id: 'mappa', numero: '2', titoloDefault: 'Mappa Geografica Sedi' },
    { id: 'autoparco', numero: '3', titoloDefault: 'Autoparco per Sede' },
    { id: 'cartaIntestata', numero: '4', titoloDefault: 'Carta Intestata & Intestazioni' },
    { id: 'contiCorrenti', numero: '5', titoloDefault: 'Coordinate Bancarie & Postali' },
  ],
  turni: [
    { id: 'calendario', numero: '1', titoloDefault: 'Calendario Turni & Equipaggi' },
    { id: 'candidature', numero: '2', titoloDefault: 'Gestione Candidature Turni' },
    { id: 'tipi_turno', numero: '3', titoloDefault: 'Tipi di Turni' },
  ],
  bacheca: [
    { id: 'elenco', numero: '1', titoloDefault: 'Consultazione Bacheca & Avvisi' },
    { id: 'pubblica', numero: '2', titoloDefault: 'Pubblica & Modifica Comunicazioni' },
  ],
  contatti: [
    { id: 'fornitore', numero: '1', titoloDefault: 'Fornitori DPI & Ricambi' },
    { id: 'officina', numero: '2', titoloDefault: 'Officine & Manutentori' },
    { id: 'cliente_ente', numero: '3', titoloDefault: 'Clienti & Enti Debitori' },
    { id: 'donatore', numero: '4', titoloDefault: 'Donatori da Intervento' },
    { id: 'indirizzi_collezionati', numero: '5', titoloDefault: 'Indirizzi Collezionati (Mappa GPS)' },
  ],
};

/**
 * Restituisce le sottosezioni delegabili (esclude quelle strettamente riservate all'Admin).
 */
export function getSottosezioniDelegabili(dbId: MacroCategoriaId): InfoSottosezioneDatabase[] {
  return (SOTTOSEZIONI_PER_DATABASE[dbId] || []).filter((s) => s.id !== 'permessi_database');
}

/**
 * Calcola quali sottosezioni di uno specifico database sono autorizzate per un account.
 * Ritorna `null` se l'utente ha accesso completo a tutte le sottosezioni del database
 * (es. Amministratore, oppure database abilitato senza restrizioni granulari pregresse).
 * Ritorna `string[]` se sono state configurate sottosezioni specifiche.
 */
export function isQualificaOperatoreCentrale(qualifica?: string): boolean {
  if (!qualifica) return false;
  const q = qualifica.trim().toLowerCase();
  return q === 'operatore centrale' || q.includes('operatore di centrale') || q.includes('operatore centrale');
}

export function getAllowedSubtabsForDatabase(
  utente: {
    isAdmin?: boolean;
    pin?: string;
    profiloCentrale?: boolean;
    qualifica?: string;
    caricaConsiglioDirettivo?: string;
    macroCategorieAbilitate?: string[];
    sottosezioniAbilitate?: Record<string, string[]>;
  } | null | undefined,
  dbId: MacroCategoriaId
): string[] | null {
  if (!utente) return [];
  if (
    utente.isAdmin ||
    utente.pin === '4451' ||
    (utente.caricaConsiglioDirettivo && utente.caricaConsiglioDirettivo.toLowerCase().includes('presidente'))
  ) {
    return null;
  }

  const macro = Array.isArray(utente.macroCategorieAbilitate)
    ? utente.macroCategorieAbilitate
    : [];
  const subsConfig = utente.sottosezioniAbilitate?.[dbId];
  const hasExplicitSubs = Array.isArray(subsConfig) && subsConfig.length > 0;
  const hasAnyExplicitSubs = Boolean(
    utente.sottosezioniAbilitate &&
    Object.values(utente.sottosezioniAbilitate).some((arr) => Array.isArray(arr) && arr.length > 0)
  );
  const hasDefaultCentrale =
    macro.length === 0 &&
    !hasAnyExplicitSubs &&
    (utente.profiloCentrale || isQualificaOperatoreCentrale(utente.qualifica));

  const dbAbilitato = macro.includes(dbId) || hasExplicitSubs || (dbId === 'centrale' && hasDefaultCentrale);
  if (!dbAbilitato) return [];

  if (subsConfig === undefined) {
    // Retrocompatibilità: DB abilitato senza restrizione di sottosezione => tutte le sottosezioni delegabili consentite
    return null;
  }
  if (!Array.isArray(subsConfig)) return null;
  const valide = new Set(getSottosezioniDelegabili(dbId).map((s) => s.id));
  const filtered = subsConfig.filter((id) => valide.has(id));
  if (filtered.length >= valide.size) return null;
  return filtered;
}

export function isSottosezioneAbilitataPerUtente(
  utente: Parameters<typeof getAllowedSubtabsForDatabase>[0],
  dbId: MacroCategoriaId,
  subId: string
): boolean {
  const allowed = getAllowedSubtabsForDatabase(utente, dbId);
  if (allowed === null) return true;
  return allowed.includes(subId);
}

// Pulsanti barra strumenti riservati di default ad Amministratore e Presidente,
// delegabili singolarmente ad altri account dalla sottosezione "8. Accesso Database"
export type PulsanteStrumentiId =
  | 'database'
  | 'web_pc'
  | 'backup_10gb'
  | 'rinomina_db'
  | 'rinomina_sub';

export interface InfoPulsanteStrumenti {
  id: PulsanteStrumentiId;
  titolo: string;
  descrizione: string;
  icona: string;
}

export const LISTA_PULSANTI_STRUMENTI_RISERVATI: InfoPulsanteStrumenti[] = [
  {
    id: 'database',
    titolo: 'Database',
    descrizione: 'Pulsante rapido Database Account Volontari e Operatori',
    icona: '👥',
  },
  {
    id: 'web_pc',
    titolo: 'Web PC',
    descrizione: 'Pulsante Accesso Web PC (link e QR postazione desktop)',
    icona: '🌐',
  },
  {
    id: 'backup_10gb',
    titolo: '10 GB',
    descrizione: 'Pulsante Server Backup (10 GB spazio hosting)',
    icona: '💾',
  },
  {
    id: 'rinomina_db',
    titolo: 'Rinomina DB',
    descrizione: 'Pulsante Rinomina i nomi dei Database',
    icona: '✏️',
  },
  {
    id: 'rinomina_sub',
    titolo: 'Rinomina SUB',
    descrizione: 'Pulsante Rinomina i nomi delle Sottosezioni',
    icona: '🗂️',
  },
];

export function isPulsanteStrumentiAbilitato(
  utente: {
    isAdmin?: boolean;
    pin?: string;
    caricaConsiglioDirettivo?: string;
    qualifica?: string;
    pulsantiStrumentiAbilitati?: string[];
  } | null | undefined,
  pulsanteId: PulsanteStrumentiId
): boolean {
  if (!utente) return false;
  if (
    utente.isAdmin ||
    utente.pin === '4451' ||
    (utente.caricaConsiglioDirettivo && utente.caricaConsiglioDirettivo.toLowerCase().includes('presidente')) ||
    (utente.qualifica && utente.qualifica.toLowerCase().includes('presidente'))
  ) {
    return true;
  }
  return Array.isArray(utente.pulsantiStrumentiAbilitati) && utente.pulsantiStrumentiAbilitati.includes(pulsanteId);
}

export const NOMI_DATABASE_STORAGE_KEY = 'CROCE_ORO_NOMI_DATABASE_CUSTOM';
export const NOMI_DATABASE_UPDATED_AT_KEY = 'CROCE_ORO_NOMI_DATABASE_UPDATED_AT';
export const NOMI_SOTTOSEZIONI_STORAGE_KEY = 'CROCE_ORO_NOMI_SOTTOSEZIONI_CUSTOM';

export function getNomiDatabaseUpdatedAt(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(NOMI_DATABASE_UPDATED_AT_KEY);
    const num = raw ? Number(raw) : 0;
    return Number.isFinite(num) && num > 0 ? num : 0;
  } catch {
    return 0;
  }
}

export function touchNomiDatabaseUpdatedAt(ts?: number): number {
  const val = typeof ts === 'number' && Number.isFinite(ts) && ts > 0 ? ts : Date.now();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(NOMI_DATABASE_UPDATED_AT_KEY, String(val));
    } catch {}
  }
  return val;
}

export function getNomiDatabaseCustom(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(NOMI_DATABASE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const clean: Record<string, string> = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'string' && v.trim()) {
          clean[k] = v.trim();
        }
      });
      return clean;
    }
  } catch {}
  return {};
}

export function getNomiSottosezioniCustom(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(NOMI_SOTTOSEZIONI_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const clean: Record<string, string> = {};
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'string' && v.trim()) {
          clean[k] = v.trim();
        }
      });
      return clean;
    }
  } catch {}
  return {};
}

export function salvaNomiDatabaseCustom(
  nomiMap: Record<string, string>,
  dispatch = true,
  updatedAt?: number
): Record<string, string> {
  const clean: Record<string, string> = {};
  Object.entries(nomiMap || {}).forEach(([k, v]) => {
    if (typeof v === 'string' && v.trim()) {
      clean[k] = v.trim();
    }
  });
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(NOMI_DATABASE_STORAGE_KEY, JSON.stringify(clean));
      touchNomiDatabaseUpdatedAt(updatedAt);
      if (dispatch) {
        window.dispatchEvent(new CustomEvent('croceoro_nomi_db_updated'));
      }
    } catch {}
  }
  return clean;
}

export function salvaNomiSottosezioniCustom(
  nomiMap: Record<string, string>,
  dispatch = true,
  updatedAt?: number
): Record<string, string> {
  const clean: Record<string, string> = {};
  Object.entries(nomiMap || {}).forEach(([k, v]) => {
    if (typeof v === 'string' && v.trim()) {
      clean[k] = v.trim();
    }
  });
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(NOMI_SOTTOSEZIONI_STORAGE_KEY, JSON.stringify(clean));
      touchNomiDatabaseUpdatedAt(updatedAt);
      if (dispatch) {
        window.dispatchEvent(new CustomEvent('croceoro_nomi_db_updated'));
      }
    } catch {}
  }
  return clean;
}

function areStringMapsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i += 1) {
    const k = keysA[i];
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export function applicaNomiDatabaseDaSync(
  nomiMap?: Record<string, string> | null,
  updatedAt?: number
): boolean {
  if (typeof window === 'undefined') return false;
  if (!nomiMap || typeof nomiMap !== 'object' || Array.isArray(nomiMap)) return false;
  const incomingTs = typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : 0;
  const localTs = getNomiDatabaseUpdatedAt();
  // Ignora snapshot più vecchi o privi di timestamp se esiste già uno stato locale salvato
  if (localTs > 0 && (incomingTs === 0 || incomingTs < localTs)) {
    return false;
  }
  // Separa le chiavi database (es. 'mezzi') dalle chiavi sottosezioni (es. 'sub:mezzi.flotta')
  const dbClean: Record<string, string> = {};
  const subClean: Record<string, string> = {};
  const hasSubsMarker = Object.prototype.hasOwnProperty.call(nomiMap, '__hasSubs');
  Object.entries(nomiMap).forEach(([k, v]) => {
    if (k === '__hasSubs') return;
    if (typeof v === 'string' && v.trim()) {
      if (k.startsWith('sub:')) {
        subClean[k.slice(4)] = v.trim();
      } else {
        dbClean[k] = v.trim();
      }
    }
  });

  const currentDb = getNomiDatabaseCustom();
  const currentSub = getNomiSottosezioniCustom();
  const shouldUpdateSub = Object.keys(subClean).length > 0 || hasSubsMarker;
  const dbChanged = !areStringMapsEqual(currentDb, dbClean);
  const subChanged = shouldUpdateSub && !areStringMapsEqual(currentSub, subClean);

  // Se non è cambiato nulla rispetto ai dati già locali, aggiorna eventualmente solo il timestamp
  // SENZA emettere l'evento croceoro_nomi_db_updated (evita di resettare gli input in modifica durante il polling!)
  if (!dbChanged && !subChanged) {
    if (incomingTs > localTs) {
      touchNomiDatabaseUpdatedAt(incomingTs);
    }
    return false;
  }

  const tsToStore = incomingTs > 0 ? incomingTs : Date.now();
  salvaNomiDatabaseCustom(dbClean, false, tsToStore);
  if (shouldUpdateSub) {
    salvaNomiSottosezioniCustom(subClean, false, tsToStore);
  }
  try {
    window.dispatchEvent(new CustomEvent('croceoro_nomi_db_updated'));
  } catch {}
  return true;
}

export function getNomiDatabaseSyncPayload(): Record<string, string> {
  const db = getNomiDatabaseCustom();
  const subs = getNomiSottosezioniCustom();
  const merged: Record<string, string> = { ...db, __hasSubs: '1' };
  Object.entries(subs).forEach(([k, v]) => {
    if (v && v.trim()) {
      merged[`sub:${k}`] = v.trim();
    }
  });
  return merged;
}

export function getTitoloDatabase(
  id: string,
  defaultTitle: string,
  customMap?: Record<string, string>
): string {
  const source = customMap ?? getNomiDatabaseCustom();
  const custom = source?.[id];
  return custom && custom.trim() ? custom.trim() : defaultTitle;
}

export function getTitoloSottosezione(
  dbId: MacroCategoriaId | string,
  subId: string,
  defaultTitle: string,
  customMap?: Record<string, string>
): string {
  const source = customMap ?? getNomiSottosezioniCustom();
  const custom = source?.[`${dbId}.${subId}`];
  return custom && custom.trim() ? custom.trim() : defaultTitle;
}

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (!e.key || e.key === NOMI_DATABASE_STORAGE_KEY || e.key === NOMI_SOTTOSEZIONI_STORAGE_KEY) {
        window.dispatchEvent(new CustomEvent('croceoro_nomi_db_updated'));
      }
    });
  } catch {}
}



