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

export const NOMI_DATABASE_STORAGE_KEY = 'CROCE_ORO_NOMI_DATABASE_CUSTOM';
export const NOMI_DATABASE_UPDATED_AT_KEY = 'CROCE_ORO_NOMI_DATABASE_UPDATED_AT';

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

export function applicaNomiDatabaseDaSync(
  nomiMap?: Record<string, string> | null,
  updatedAt?: number
): boolean {
  if (typeof window === 'undefined') return false;
  if (!nomiMap || typeof nomiMap !== 'object' || Array.isArray(nomiMap)) return false;
  const incomingTs = typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : 0;
  const localTs = getNomiDatabaseUpdatedAt();
  if (incomingTs > 0 && localTs > incomingTs) {
    return false;
  }
  salvaNomiDatabaseCustom(nomiMap, true, incomingTs > 0 ? incomingTs : undefined);
  return true;
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

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (!e.key || e.key === NOMI_DATABASE_STORAGE_KEY) {
        window.dispatchEvent(new CustomEvent('croceoro_nomi_db_updated'));
      }
    });
  } catch {}
}


