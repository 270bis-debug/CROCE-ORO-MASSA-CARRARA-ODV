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
