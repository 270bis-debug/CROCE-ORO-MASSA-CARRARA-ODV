/**
 * mansioniVolontari.ts
 * Gestione dinamica del catalogo Mansioni del personale e volontari della Croce Oro Massa Carrara.
 * Permette la creazione illimitata di mansioni personalizzate e l'assegnazione multipla/contemporanea.
 */

import { Volontario } from '../components/DatabaseVolontariModal';

export type CategoriaMansione = string;

export interface CategoriaMansioneItem {
  id: string;
  nome: string;
  badgeEmoji?: string;
  parentCategoriaId?: string;
}

export const CATEGORIE_MANSIONI_DEFAULT: CategoriaMansioneItem[] = [
  { id: 'cat-emergenza-118', nome: 'Emergenza 118', badgeEmoji: '🚑' },
  { id: 'cat-centrale-tlc', nome: 'Centrale & TLC', badgeEmoji: '📻' },
  { id: 'cat-ordinario-sociale', nome: 'Ordinario & Sociale', badgeEmoji: '🚐' },
  { id: 'cat-protezione-civile', nome: 'Protezione Civile', badgeEmoji: '🛡️' },
  { id: 'cat-gestionale-logistica', nome: 'Gestionale & Logistica', badgeEmoji: '👑' },
  { id: 'cat-altro', nome: 'Altro', badgeEmoji: '⭐' }
];

export const CATEGORIE_STORAGE_KEY = 'CROCE_ORO_MANSIONI_CATEGORIE';

export interface MansioneOperativa {
  id: string;
  nome: string;
  descrizione?: string;
  categoria: CategoriaMansione;
  coloreBg: string;
  coloreTesto: string;
  coloreBorder: string;
  badgeEmoji?: string;
  creataDaAdmin?: boolean;
  dataCreazione?: string;
  // Gerarchia mansioni: mansione genitore e mansioni sottostanti incluse automaticamente
  parentMansioneId?: string;
  mansioniIncluse?: string[];
}

export const MANSIONI_DEFAULT: MansioneOperativa[] = [
  {
    id: 'mansione-autista-118',
    nome: 'Autista Soccorritore 118',
    descrizione: 'Guida di ambulanza in emergenza urgenza sanitaria 118 e trasporti critici',
    categoria: 'Emergenza 118',
    coloreBg: 'bg-amber-950/70',
    coloreTesto: 'text-amber-300',
    coloreBorder: 'border-amber-500/60',
    badgeEmoji: '🚑',
    mansioniIncluse: [
      'Soccorritore Base',
      'Autista Mezzi Ordinari / Pulmino',
      'Barelliere / Accompagnatore Sanitario',
      'Volontario'
    ]
  },
  {
    id: 'mansione-socc-base',
    nome: 'Soccorritore Base',
    descrizione: 'Secondo/terzo soccorritore in equipaggio di emergenza e trasporti ordinari',
    categoria: 'Emergenza 118',
    coloreBg: 'bg-emerald-950/70',
    coloreTesto: 'text-emerald-300',
    coloreBorder: 'border-emerald-500/60',
    badgeEmoji: '🧑‍⚕️',
    mansioniIncluse: [
      'Barelliere / Accompagnatore Sanitario',
      'Volontario'
    ]
  },
  {
    id: 'mansione-op-centrale',
    nome: 'Operatore di Centrale Operativa',
    descrizione: 'Gestione comunicazioni radio, assegnazione missioni, interfaccia 118 e cartellino turni',
    categoria: 'Centrale & TLC',
    coloreBg: 'bg-purple-950/70',
    coloreTesto: 'text-purple-300',
    coloreBorder: 'border-purple-500/60',
    badgeEmoji: '🎧',
    mansioniIncluse: [
      'Centralinista & Accoglienza',
      'Addetto Segreteria & Tesseramento',
      'Volontario'
    ]
  },
  {
    id: 'mansione-centralinista',
    nome: 'Centralinista & Accoglienza',
    descrizione: 'Risposta telefonica ai cittadini, prenotazione servizi e accoglienza sede',
    categoria: 'Centrale & TLC',
    coloreBg: 'bg-indigo-950/70',
    coloreTesto: 'text-indigo-300',
    coloreBorder: 'border-indigo-500/60',
    badgeEmoji: '📞',
    mansioniIncluse: ['Volontario']
  },
  {
    id: 'mansione-autista-ordinario',
    nome: 'Autista Mezzi Ordinari / Pulmino',
    descrizione: 'Trasporto dializzati, visite specialistiche, disabili e terapie con pulmini e vetture',
    categoria: 'Ordinario & Sociale',
    coloreBg: 'bg-cyan-950/70',
    coloreTesto: 'text-cyan-300',
    coloreBorder: 'border-cyan-500/60',
    badgeEmoji: '🚐',
    mansioniIncluse: [
      'Barelliere / Accompagnatore Sanitario',
      'Volontario'
    ]
  },
  {
    id: 'mansione-barelliere',
    nome: 'Barelliere / Accompagnatore Sanitario',
    descrizione: 'Assistenza alla persona durante il trasporto sanitario semplice e sociale',
    categoria: 'Ordinario & Sociale',
    coloreBg: 'bg-teal-950/70',
    coloreTesto: 'text-teal-300',
    coloreBorder: 'border-teal-500/60',
    badgeEmoji: '🤝',
    mansioniIncluse: ['Volontario']
  },
  {
    id: 'mansione-protezione-civile',
    nome: 'Protezione Civile & Antincendio',
    descrizione: 'Interventi in calamità naturali, logistica emergenze, monitoraggio idrogeologico',
    categoria: 'Protezione Civile',
    coloreBg: 'bg-orange-950/70',
    coloreTesto: 'text-orange-300',
    coloreBorder: 'border-orange-500/60',
    badgeEmoji: '🚒',
    mansioniIncluse: ['Volontario']
  },
  {
    id: 'mansione-formatore',
    nome: 'Formatore Sanitario / Istruttore BLSD',
    descrizione: 'Docente corsi soccorritori, addestramento DAE e formazione continua del personale',
    categoria: 'Gestionale & Logistica',
    coloreBg: 'bg-rose-950/70',
    coloreTesto: 'text-rose-300',
    coloreBorder: 'border-rose-500/60',
    badgeEmoji: '🎓',
    mansioniIncluse: [
      'Soccorritore Base',
      'Barelliere / Accompagnatore Sanitario',
      'Volontario'
    ]
  },
  {
    id: 'mansione-resp-automezzi',
    nome: 'Responsabile Parco Automezzi',
    descrizione: 'Controllo efficienza veicoli, manutenzioni periodiche, revisioni e rifornimenti',
    categoria: 'Gestionale & Logistica',
    coloreBg: 'bg-yellow-950/70',
    coloreTesto: 'text-yellow-300',
    coloreBorder: 'border-yellow-500/60',
    badgeEmoji: '🔧',
    mansioniIncluse: ['Volontario']
  },
  {
    id: 'mansione-resp-vestiario',
    nome: 'Responsabile Magazzino & Vestiario',
    descrizione: 'Distribuzione divise, DPI, gestione cauzioni e scorte materiale sanitario',
    categoria: 'Gestionale & Logistica',
    coloreBg: 'bg-fuchsia-950/70',
    coloreTesto: 'text-fuchsia-300',
    coloreBorder: 'border-fuchsia-500/60',
    badgeEmoji: '👕',
    mansioniIncluse: ['Volontario']
  },
  {
    id: 'mansione-osservatore',
    nome: 'Osservatore (In Formazione / Tirocinante)',
    descrizione: 'Volontario in affiancamento formativo, osservazione operativa o tirocinio pratico',
    categoria: 'Ordinario & Sociale',
    coloreBg: 'bg-sky-950/70',
    coloreTesto: 'text-sky-300',
    coloreBorder: 'border-sky-500/60',
    badgeEmoji: '👁️',
    mansioniIncluse: ['Volontario']
  },
  {
    id: 'mansione-segreteria',
    nome: 'Addetto Segreteria & Tesseramento',
    descrizione: 'Gestione libri soci, quietanze, tesseramenti annuali e pratiche burocratiche',
    categoria: 'Gestionale & Logistica',
    coloreBg: 'bg-slate-900',
    coloreTesto: 'text-slate-300',
    coloreBorder: 'border-slate-700',
    badgeEmoji: '📋',
    mansioniIncluse: ['Volontario']
  }
];

const STORAGE_KEY = 'CROCE_ORO_MANSIONI_CATALOGO';
export const MANSIONI_UPDATED_AT_KEY = 'CROCE_ORO_MANSIONI_UPDATED_AT';

export function getMansioniConfigUpdatedAt(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(MANSIONI_UPDATED_AT_KEY);
    const num = raw ? Number(raw) : 0;
    return Number.isFinite(num) && num > 0 ? num : 0;
  } catch {
    return 0;
  }
}

export function touchMansioniConfigUpdatedAt(ts?: number): number {
  const val = typeof ts === 'number' && Number.isFinite(ts) && ts > 0 ? ts : Date.now();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(MANSIONI_UPDATED_AT_KEY, String(val));
    } catch {}
  }
  return val;
}

function emettiAggiornamentoMansioniLocal(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('croceoro_mansioni_updated'));
  } catch {}
}

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (!e.key || e.key === STORAGE_KEY || e.key === CATEGORIE_STORAGE_KEY) {
        emettiAggiornamentoMansioniLocal();
      }
    });
  } catch {}
}

export function getDescendantCategoriaIds(
  rootId: string,
  categorie?: CategoriaMansioneItem[]
): Set<string> {
  const list = categorie || getCategorieMansioni();
  const descendants = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const curr = stack.pop()!;
    list.forEach((c) => {
      if (c.parentCategoriaId === curr && c.id !== rootId && !descendants.has(c.id)) {
        descendants.add(c.id);
        stack.push(c.id);
      }
    });
  }
  return descendants;
}

export function getDescendantMansioneIds(
  rootId: string,
  catalogo?: MansioneOperativa[]
): Set<string> {
  const list = catalogo || getMansioniCatalogo();
  const descendants = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const curr = stack.pop()!;
    list.forEach((m) => {
      if (m.parentMansioneId === curr && m.id !== rootId && !descendants.has(m.id)) {
        descendants.add(m.id);
        stack.push(m.id);
      }
    });
  }
  return descendants;
}

/**
 * Carica l'elenco completo delle categorie mansioni (predefinite + personalizzate)
 */
export function getCategorieMansioni(): CategoriaMansioneItem[] {
  if (typeof window === 'undefined') return CATEGORIE_MANSIONI_DEFAULT;
  try {
    const raw = localStorage.getItem(CATEGORIE_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CATEGORIE_STORAGE_KEY, JSON.stringify(CATEGORIE_MANSIONI_DEFAULT));
      return CATEGORIE_MANSIONI_DEFAULT;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return CATEGORIE_MANSIONI_DEFAULT;
  } catch {
    return CATEGORIE_MANSIONI_DEFAULT;
  }
}

export function salvaCategorieMansioni(categorie: CategoriaMansioneItem[], dispatch = true, updatedAt?: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CATEGORIE_STORAGE_KEY, JSON.stringify(categorie));
    touchMansioniConfigUpdatedAt(updatedAt);
    if (dispatch) emettiAggiornamentoMansioniLocal();
  } catch (err) {
    console.error('Errore nel salvataggio categorie mansioni:', err);
  }
}

export function creaCategoriaMansione(dati: {
  nome: string;
  badgeEmoji?: string;
  parentCategoriaId?: string;
}): CategoriaMansioneItem[] {
  const cleanNome = (dati.nome || '').trim();
  if (!cleanNome) return getCategorieMansioni();
  const attuali = getCategorieMansioni();
  if (attuali.some((c) => c.nome.toLowerCase() === cleanNome.toLowerCase())) {
    return attuali;
  }
  const nuova: CategoriaMansioneItem = {
    id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nome: cleanNome,
    badgeEmoji: (dati.badgeEmoji || '').trim() || '📁',
    parentCategoriaId: dati.parentCategoriaId || undefined
  };
  const aggiornate = [...attuali, nuova];
  salvaCategorieMansioni(aggiornate);
  return aggiornate;
}

export function modificaCategoriaMansione(
  id: string,
  modifiche: { nome?: string; badgeEmoji?: string; parentCategoriaId?: string | null }
): { categorie: CategoriaMansioneItem[]; catalogo: MansioneOperativa[]; vecchioNome?: string; nuovoNome?: string } {
  const attuali = getCategorieMansioni();
  const target = attuali.find((c) => c.id === id);
  if (!target) {
    return { categorie: attuali, catalogo: getMansioniCatalogo() };
  }
  const vecchioNome = target.nome;
  const nuovoNome = modifiche.nome !== undefined ? modifiche.nome.trim() || target.nome : target.nome;
  const descendants = getDescendantCategoriaIds(id, attuali);
  const candidateParent =
    modifiche.parentCategoriaId === null || modifiche.parentCategoriaId === ''
      ? undefined
      : modifiche.parentCategoriaId !== undefined
      ? (modifiche.parentCategoriaId === id || descendants.has(modifiche.parentCategoriaId)
          ? undefined
          : modifiche.parentCategoriaId)
      : target.parentCategoriaId;

  const aggiornate = attuali.map((c) =>
    c.id === id
      ? {
          ...c,
          nome: nuovoNome,
          badgeEmoji: modifiche.badgeEmoji !== undefined ? (modifiche.badgeEmoji.trim() || c.badgeEmoji || '📁') : c.badgeEmoji,
          parentCategoriaId: candidateParent
        }
      : c
  );
  salvaCategorieMansioni(aggiornate, false);

  let catalogo = getMansioniCatalogo();
  if (vecchioNome !== nuovoNome) {
    catalogo = catalogo.map((m) =>
      m.categoria === vecchioNome ? { ...m, categoria: nuovoNome } : m
    );
    salvaMansioniCatalogo(catalogo, false);
  }
  emettiAggiornamentoMansioniLocal();
  return { categorie: aggiornate, catalogo, vecchioNome, nuovoNome };
}

export function eliminaCategoriaMansione(id: string): {
  categorie: CategoriaMansioneItem[];
  catalogo: MansioneOperativa[];
} {
  const attuali = getCategorieMansioni();
  const target = attuali.find((c) => c.id === id);
  const rimaste = attuali
    .filter((c) => c.id !== id)
    .map((c) => (c.parentCategoriaId === id ? { ...c, parentCategoriaId: undefined } : c));
  const fallbackList = rimaste.length > 0 ? rimaste : [{ id: 'cat-altro', nome: 'Altro', badgeEmoji: '⭐' }];
  salvaCategorieMansioni(fallbackList, false);

  let catalogo = getMansioniCatalogo();
  if (target) {
    const fallbackCatName = fallbackList[0].nome;
    catalogo = catalogo.map((m) =>
      m.categoria === target.nome ? { ...m, categoria: fallbackCatName } : m
    );
    salvaMansioniCatalogo(catalogo, false);
  }
  emettiAggiornamentoMansioniLocal();
  return { categorie: fallbackList, catalogo };
}

export function ripristinaCategorieMansioniDefault(): CategoriaMansioneItem[] {
  salvaCategorieMansioni(CATEGORIE_MANSIONI_DEFAULT);
  return [...CATEGORIE_MANSIONI_DEFAULT];
}

export function applicaMansioniConfigDaSync(
  catalogo?: MansioneOperativa[] | null,
  categorie?: CategoriaMansioneItem[] | null,
  updatedAt?: number
): boolean {
  if (typeof window === 'undefined') return false;
  const incomingTs = typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : 0;
  const localTs = getMansioniConfigUpdatedAt();
  if (incomingTs > 0 && localTs > incomingTs) {
    return false;
  }
  let changed = false;
  if (Array.isArray(categorie) && categorie.length > 0) {
    try {
      localStorage.setItem(CATEGORIE_STORAGE_KEY, JSON.stringify(categorie));
      changed = true;
    } catch {}
  }
  if (Array.isArray(catalogo) && catalogo.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(catalogo));
      changed = true;
    } catch {}
  }
  if (changed) {
    touchMansioniConfigUpdatedAt(incomingTs > 0 ? incomingTs : undefined);
    emettiAggiornamentoMansioniLocal();
  }
  return changed;
}

/**
 * Carica il catalogo completo di mansioni (predefinite + create dall'utente)
 */
export function getMansioniCatalogo(): MansioneOperativa[] {
  if (typeof window === 'undefined') return MANSIONI_DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(MANSIONI_DEFAULT));
      return MANSIONI_DEFAULT;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Garantisce che le mansioni predefinite abbiano sempre la loro gerarchia definita anche se caricate da storage legacy
      return parsed.map((m: MansioneOperativa) => {
        const def = MANSIONI_DEFAULT.find(d => d.id === m.id || d.nome.toLowerCase() === m.nome.toLowerCase());
        if (def && (!m.mansioniIncluse || m.mansioniIncluse.length === 0) && def.mansioniIncluse) {
          return { ...m, mansioniIncluse: def.mansioniIncluse };
        }
        return m;
      });
    }
    return MANSIONI_DEFAULT;
  } catch {
    return MANSIONI_DEFAULT;
  }
}

/**
 * Salva l'elenco aggiornato delle mansioni nel catalogo persistente
 */
export function salvaMansioniCatalogo(mansioni: MansioneOperativa[], dispatch = true, updatedAt?: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mansioni));
    touchMansioniConfigUpdatedAt(updatedAt);
    if (dispatch) emettiAggiornamentoMansioniLocal();
  } catch (err) {
    console.error('Errore nel salvataggio del catalogo mansioni:', err);
  }
}

/**
 * Aggiunge una nuova mansione personalizzata al catalogo
 */
export function creaNuovaMansione(dati: {
  nome: string;
  descrizione?: string;
  categoria?: CategoriaMansione;
  coloreBg?: string;
  coloreTesto?: string;
  coloreBorder?: string;
  badgeEmoji?: string;
  parentMansioneId?: string;
  mansioniIncluse?: string[];
}): MansioneOperativa {
  const catalogo = getMansioniCatalogo();
  const id = `mansione-custom-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  const nuova: MansioneOperativa = {
    id,
    nome: dati.nome.trim(),
    descrizione: dati.descrizione?.trim() || 'Mansione operativa personalizzata',
    categoria: dati.categoria || 'Altro',
    coloreBg: dati.coloreBg || 'bg-blue-950/70',
    coloreTesto: dati.coloreTesto || 'text-blue-300',
    coloreBorder: dati.coloreBorder || 'border-blue-500/60',
    badgeEmoji: dati.badgeEmoji || '⭐',
    parentMansioneId: dati.parentMansioneId || undefined,
    mansioniIncluse: Array.isArray(dati.mansioniIncluse) ? dati.mansioniIncluse : ['Volontario'],
    creataDaAdmin: true,
    dataCreazione: new Date().toISOString()
  };

  const aggiornato = [...catalogo, nuova];
  salvaMansioniCatalogo(aggiornato);
  return nuova;
}

/**
 * Elimina una mansione dal catalogo (qualsiasi mansione esistente)
 */
export function eliminaMansioneCatalogo(id: string): MansioneOperativa[] {
  const catalogo = getMansioniCatalogo();
  const aggiornato = catalogo
    .filter((m) => m.id !== id)
    .map((m) => (m.parentMansioneId === id ? { ...m, parentMansioneId: undefined } : m));
  salvaMansioniCatalogo(aggiornato);
  return aggiornato;
}

/**
 * Modifica una mansione esistente nel catalogo
 */
export function modificaMansioneCatalogo(
  id: string,
  modifiche: Partial<Omit<MansioneOperativa, 'parentMansioneId'>> & { parentMansioneId?: string | null }
): MansioneOperativa[] {
  const catalogo = getMansioniCatalogo();
  const targetOrig = catalogo.find((m) => m.id === id);
  const vecchioNome = targetOrig?.nome;
  const nuovoNome = modifiche.nome !== undefined ? modifiche.nome.trim() : vecchioNome;
  const descendants = getDescendantMansioneIds(id, catalogo);
  const aggiornato = catalogo.map((m) => {
    if (m.id === id) {
      const requestedParent = modifiche.parentMansioneId;
      const nextParent =
        requestedParent === '' || requestedParent === null
          ? undefined
          : requestedParent !== undefined
          ? (requestedParent === id || descendants.has(requestedParent) ? undefined : requestedParent)
          : m.parentMansioneId;
      return { ...m, ...modifiche, parentMansioneId: nextParent };
    }
    if (
      vecchioNome &&
      nuovoNome &&
      vecchioNome.trim().toLowerCase() !== nuovoNome.trim().toLowerCase() &&
      Array.isArray(m.mansioniIncluse) &&
      m.mansioniIncluse.some((inc) => inc.trim().toLowerCase() === vecchioNome.trim().toLowerCase())
    ) {
      return {
        ...m,
        mansioniIncluse: m.mansioniIncluse.map((inc) =>
          inc.trim().toLowerCase() === vecchioNome.trim().toLowerCase() ? nuovoNome : inc
        )
      };
    }
    return m;
  });
  salvaMansioniCatalogo(aggiornato);
  return aggiornato;
}

export interface RinominaMansioneGlobaleDetail {
  mansioneId: string;
  vecchioNome: string;
  nuovoNome: string;
  nuovaEmoji?: string;
  nuovaCategoria?: string;
}

/**
 * Emette l'evento globale di rinomina/aggiornamento mansione affinché App.tsx, Tipi di Turno,
 * Calendario Turni, Volontari, Formazione e Timbrature aggiornino automaticamente tutti i riferimenti.
 */
export function emettiRinominaMansioneGlobale(detail: RinominaMansioneGlobaleDetail): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent<RinominaMansioneGlobaleDetail>('croceoro_mansione_rinominata', { detail }));
  } catch {}
}

/**
 * Ripristina il set di mansioni di default dell'associazione
 */
export function ripristinaMansioniDefault(): MansioneOperativa[] {
  salvaMansioniCatalogo(MANSIONI_DEFAULT);
  return [...MANSIONI_DEFAULT];
}

/**
 * Aggiorna in cascata i volontari quando il nome di una mansione viene modificato
 */
export function aggiornaVolontariDopoModificaMansione(
  volontari: Volontario[],
  vecchioNome: string,
  nuovoNome: string,
  mansioneId?: string
): Volontario[] {
  if (!vecchioNome || !nuovoNome || vecchioNome === nuovoNome) return volontari;
  const vecchioLow = vecchioNome.trim().toLowerCase();
  return volontari.map((v) => {
    let modificato = false;
    const idsAttuali = Array.isArray(v.mansioniIds) ? [...v.mansioniIds] : [];
    const hasId = Boolean(mansioneId && idsAttuali.includes(mansioneId));
    let nuoveMansioni = Array.isArray(v.mansioni) ? [...v.mansioni] : [v.qualifica || 'Volontario'];
    if (nuoveMansioni.some((m) => m.trim().toLowerCase() === vecchioLow)) {
      nuoveMansioni = nuoveMansioni.map((m) => (m.trim().toLowerCase() === vecchioLow ? nuovoNome : m));
      modificato = true;
      if (mansioneId && !idsAttuali.includes(mansioneId)) {
        idsAttuali.push(mansioneId);
      }
    } else if (hasId && !nuoveMansioni.some((m) => m.trim().toLowerCase() === nuovoNome.trim().toLowerCase())) {
      nuoveMansioni.push(nuovoNome);
      modificato = true;
    }
    const nuovaPrinc = v.mansione && v.mansione.trim().toLowerCase() === vecchioLow ? nuovoNome : v.mansione;
    const nuovaQual = v.qualifica && v.qualifica.trim().toLowerCase() === vecchioLow ? nuovoNome : v.qualifica;
    if (nuovaPrinc !== v.mansione || nuovaQual !== v.qualifica) modificato = true;

    return modificato
      ? {
          ...v,
          mansioni: nuoveMansioni,
          ...(idsAttuali.length > 0 ? { mansioniIds: Array.from(new Set(idsAttuali)) } : {}),
          mansione: nuovaPrinc || nuoveMansioni[0] || 'Volontario',
          qualifica: nuovaQual || nuoveMansioni[0] || 'Volontario'
        }
      : v;
  });
}

/**
 * Aggiorna in cascata i volontari quando una mansione viene eliminata dal catalogo
 */
export function aggiornaVolontariDopoEliminazioneMansione(
  volontari: Volontario[],
  nomeMansioneEliminata: string,
  mansioneId?: string
): Volontario[] {
  if (!nomeMansioneEliminata && !mansioneId) return volontari;
  const elimLow = (nomeMansioneEliminata || '').trim().toLowerCase();
  return volontari.map((v) => {
    let nuoveMansioni = Array.isArray(v.mansioni) ? [...v.mansioni] : [v.qualifica || 'Volontario'];
    const hadName = elimLow ? nuoveMansioni.some((m) => m.trim().toLowerCase() === elimLow) : false;
    const hadId = Boolean(mansioneId && Array.isArray(v.mansioniIds) && v.mansioniIds.includes(mansioneId));
    if (!hadName && !hadId) return v;

    if (elimLow) {
      nuoveMansioni = nuoveMansioni.filter((m) => m.trim().toLowerCase() !== elimLow);
    }
    if (nuoveMansioni.length === 0) nuoveMansioni = ['Volontario'];

    const nuoveIds = Array.isArray(v.mansioniIds) && mansioneId
      ? v.mansioniIds.filter((id) => id !== mansioneId)
      : v.mansioniIds;

    const nuovaPrinc = elimLow && v.mansione?.trim().toLowerCase() === elimLow ? nuoveMansioni[0] : v.mansione;
    const nuovaQual = elimLow && v.qualifica?.trim().toLowerCase() === elimLow ? nuoveMansioni[0] : v.qualifica;

    return {
      ...v,
      mansioni: nuoveMansioni,
      ...(Array.isArray(nuoveIds) ? { mansioniIds: nuoveIds } : {}),
      mansione: nuovaPrinc || nuoveMansioni[0] || 'Volontario',
      qualifica: nuovaQual || nuoveMansioni[0] || 'Volontario'
    };
  });
}

/**
 * Restituisce l'elenco delle mansioni assegnate a un volontario.
 * Garantisce piena compatibilità retroattiva con i campi legacy qualifica e mansione.
 */
export function getMansioniVolontario(v: Partial<Volontario>): string[] {
  if (!v) return ['Volontario'];

  const elenco: string[] = [];

  // Se ci sono mansioni multiple salvate nell'array
  if (Array.isArray(v.mansioni) && v.mansioni.length > 0) {
    v.mansioni.forEach((m) => {
      if (m && typeof m === 'string' && !elenco.includes(m.trim())) {
        elenco.push(m.trim());
      }
    });
  }

  // Mansione singola specifica
  if (v.mansione && typeof v.mansione === 'string' && !elenco.includes(v.mansione.trim())) {
    elenco.unshift(v.mansione.trim());
  }

  // Fallback con qualifica
  if (elenco.length === 0 && v.qualifica && typeof v.qualifica === 'string') {
    elenco.push(v.qualifica.trim());
  }

  return elenco.length > 0 ? elenco : ['Volontario'];
}

/**
 * Restituisce la mansione principale (singola stringa) per badge o riepiloghi rapidi
 */
export function getMansionePrincipale(v: Partial<Volontario>): string {
  if (!v) return 'Volontario';
  if (v.mansione && typeof v.mansione === 'string') return v.mansione;
  if (Array.isArray(v.mansioni) && v.mansioni.length > 0 && v.mansioni[0]) return v.mansioni[0];
  if (v.qualifica && typeof v.qualifica === 'string') return v.qualifica;
  return 'Volontario';
}

/**
 * Trova i dettagli di stile (colori, emoji) di una mansione dato il suo nome
 */
export function getStileMansione(nomeMansione: string, catalogo?: MansioneOperativa[]): {
  coloreBg: string;
  coloreTesto: string;
  coloreBorder: string;
  badgeEmoji: string;
} {
  const lista = catalogo || getMansioniCatalogo();
  const trovata = lista.find(
    (m) => m.nome.toLowerCase() === nomeMansione.toLowerCase() || m.id === nomeMansione
  );

  if (trovata) {
    return {
      coloreBg: trovata.coloreBg,
      coloreTesto: trovata.coloreTesto,
      coloreBorder: trovata.coloreBorder,
      badgeEmoji: trovata.badgeEmoji || '🏷️'
    };
  }

  // Default color palette basata sull'hash del nome per nuove mansioni arbitrarie
  const palette = [
    { bg: 'bg-blue-950/70', text: 'text-blue-300', border: 'border-blue-500/60', emoji: '⭐' },
    { bg: 'bg-emerald-950/70', text: 'text-emerald-300', border: 'border-emerald-500/60', emoji: '🟢' },
    { bg: 'bg-amber-950/70', text: 'text-amber-300', border: 'border-amber-500/60', emoji: '🔶' },
    { bg: 'bg-purple-950/70', text: 'text-purple-300', border: 'border-purple-500/60', emoji: '🟣' },
    { bg: 'bg-rose-950/70', text: 'text-rose-300', border: 'border-rose-500/60', emoji: '🔴' },
    { bg: 'bg-cyan-950/70', text: 'text-cyan-300', border: 'border-cyan-500/60', emoji: '🔷' }
  ];

  let hash = 0;
  for (let i = 0; i < nomeMansione.length; i++) {
    hash = (hash << 5) - hash + nomeMansione.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % palette.length;
  const p = palette[index];

  return {
    coloreBg: p.bg,
    coloreTesto: p.text,
    coloreBorder: p.border,
    badgeEmoji: p.emoji
  };
}

/**
 * Risolve l'albero gerarchico delle mansioni:
 * Restituisce tutte le mansioni possedute direttamente dal volontario PIÙ tutte le mansioni
 * incluse/ereditate gerarchicamente dalle mansioni superiori.
 * Ad es. "Autista Soccorritore 118" include automaticamente "Soccorritore Avanzato", "Soccorritore Base", "Autista Ordinari", ecc.
 */
function risolviAliasMansioneCanoniche(nomeRaw: string): string[] {
  const norm = (nomeRaw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!norm) return [];

  const alias: string[] = [];

  if (
    norm === 'autista' ||
    norm === 'autista soccorritore' ||
    norm === 'autista 118' ||
    norm === 'autista soccorritore 118' ||
    (norm.includes('autista') &&
      !norm.includes('ordinar') &&
      !norm.includes('pulmino') &&
      !norm.includes('semplice') &&
      !norm.includes('4x4'))
  ) {
    alias.push('Autista Soccorritore 118');
  }

  if (norm.includes('autista') && (norm.includes('ordinar') || norm.includes('pulmino') || norm.includes('4x4'))) {
    alias.push('Autista Mezzi Ordinari / Pulmino');
  }

  if (norm.includes('protezione civile') || norm.includes('antincendio') || norm.includes('4x4')) {
    alias.push('Protezione Civile & Antincendio');
  }

  if (norm.includes('caposervizio') || norm.includes('avanzato') || norm.includes('blsd')) {
    alias.push('Soccorritore Avanzato (Caposervizio)');
  } else if (
    norm === 'soccorritore' ||
    norm === 'volontario soccorritore' ||
    norm === 'soccorritore base' ||
    (norm.includes('soccorritor') && !norm.includes('autista'))
  ) {
    alias.push('Soccorritore Base');
  }

  if (
    norm === 'operatore centrale' ||
    norm === 'operatore centrale radio' ||
    norm.includes('operatore centrale') ||
    norm.includes('operatore di centrale') ||
    norm.includes('sala radio')
  ) {
    alias.push('Operatore di Centrale Operativa');
  }

  if (norm.includes('centralinist') || norm.includes('accoglienza')) {
    alias.push('Centralinista & Accoglienza');
  }

  if (norm.includes('barellier') || norm.includes('accompagnator')) {
    alias.push('Barelliere / Accompagnatore Sanitario');
  }

  if (norm.includes('formator') || norm.includes('istruttor')) {
    alias.push('Formatore Sanitario / Istruttore BLSD');
  }

  return alias;
}

export function getMansioniEffettiveVolontario(
  v: Partial<Volontario>,
  catalogo?: MansioneOperativa[]
): string[] {
  if (!v) return ['Volontario'];
  const catalogoEffettivo = catalogo || getMansioniCatalogo();
  const mansioniDirette = getMansioniVolontario(v);

  const setEffettive = new Set<string>();
  const daEsaminare: string[] = [];

  // Risolvi eventuali mansioniIds immutabili nel nome attuale dal catalogo (resilienza alle rinomine)
  if (Array.isArray(v.mansioniIds)) {
    v.mansioniIds.forEach((mId) => {
      const trovataPerId = catalogoEffettivo.find((m) => m.id === mId);
      if (trovataPerId?.nome) {
        daEsaminare.push(trovataPerId.nome.trim());
      }
      daEsaminare.push(mId);
    });
  }

  mansioniDirette.forEach((entry) => {
    const clean = entry.trim();
    if (!clean) return;
    daEsaminare.push(clean);
    if (/[\/,+&]/.test(clean)) {
      clean
        .split(/[\/,+&]+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .forEach((sub) => {
          daEsaminare.push(sub);
          risolviAliasMansioneCanoniche(sub).forEach((a) => daEsaminare.push(a));
        });
    }
    risolviAliasMansioneCanoniche(clean).forEach((a) => daEsaminare.push(a));
  });

  while (daEsaminare.length > 0) {
    const corrente = daEsaminare.pop()!;
    const normCorrente = corrente.trim();
    if (!normCorrente || setEffettive.has(normCorrente)) continue;

    // Se è un ID di mansione, espandi sia l'ID che il nome corrente
    const trovata = catalogoEffettivo.find(
      (m) => m.nome.toLowerCase() === normCorrente.toLowerCase() || m.id === normCorrente
    );

    if (trovata) {
      setEffettive.add(trovata.id);
      setEffettive.add(trovata.nome.trim());
      const defOrig = MANSIONI_DEFAULT.find((d) => d.id === trovata.id);
      if (defOrig) {
        setEffettive.add(defOrig.nome.trim());
      }
      if (Array.isArray(trovata.mansioniIncluse)) {
        trovata.mansioniIncluse.forEach((figlia) => {
          if (figlia && !setEffettive.has(figlia.trim())) {
            daEsaminare.push(figlia.trim());
          }
        });
      }
      // Ereditarietà tramite genitorialità esplicita (parentMansioneId)
      catalogoEffettivo.forEach((candidateChild) => {
        if (
          candidateChild.parentMansioneId === trovata.id &&
          candidateChild.id !== trovata.id &&
          !setEffettive.has(candidateChild.nome.trim())
        ) {
          daEsaminare.push(candidateChild.nome.trim());
        }
      });
    } else {
      setEffettive.add(normCorrente);
    }
  }

  // Aggiungi sempre 'Volontario' come base minima universale
  setEffettive.add('Volontario');

  return Array.from(setEffettive);
}

/**
 * Controlla se un volontario possiede una specifica mansione, tenendo conto sia dell'assegnazione
 * diretta che dell'ereditarietà gerarchica (mansione superiore che include quella richiesta).
 */
export function volontarioHaMansione(
  v: Partial<Volontario>,
  mansioneRichiesta: string,
  catalogo?: MansioneOperativa[]
): boolean {
  if (!mansioneRichiesta || !mansioneRichiesta.trim()) return true;
  const catalogoEffettivo = catalogo || getMansioniCatalogo();
  const target = mansioneRichiesta.trim().toLowerCase();
  if (target === 'volontario') return true;

  const targetItem = catalogoEffettivo.find(
    (m) => m.nome.toLowerCase() === target || m.id.toLowerCase() === target
  );

  const effettive = getMansioniEffettiveVolontario(v, catalogoEffettivo).map((m) => m.toLowerCase());
  if (effettive.includes(target)) return true;
  if (targetItem && effettive.includes(targetItem.id.toLowerCase())) return true;
  return false;
}

/**
 * Verifica se un volontario ricopre il ruolo di Responsabile Parco Automezzi / Responsabile Mezzi
 * tollerando qualsiasi rinomina della mansione base ('mansione-resp-automezzi').
 */
export function isResponsabileParcoMezzi(
  v: Partial<Omit<Volontario, 'caricaConsiglioDirettivo'>> & { caricaConsiglioDirettivo?: string },
  catalogo?: MansioneOperativa[]
): boolean {
  if (!v) return false;
  const catalogoEffettivo = catalogo || getMansioniCatalogo();
  const vCast = v as Partial<Volontario>;
  if (volontarioHaMansione(vCast, 'mansione-resp-automezzi', catalogoEffettivo)) {
    return true;
  }
  const text = `${getMansioniVolontario(vCast).join(' ')} ${v.qualifica || ''} ${v.caricaConsiglioDirettivo || ''}`.toLowerCase();
  return (
    text.includes('responsabile parco automezzi') ||
    text.includes('responsabile mezzi') ||
    text.includes('resp. mezzi') ||
    text.includes('parco automezzi')
  );
}

const RUOLO_TURNO_MANSIONI_IDS: Record<string, { ids: string[]; fallbackNomi: string[]; defaultEmoji: string }> = {
  autista: {
    ids: ['mansione-autista-118', 'mansione-autista-ordinario'],
    fallbackNomi: ['Autista Soccorritore 118', 'Autista Mezzi Ordinari / Pulmino'],
    defaultEmoji: '🚑',
  },
  soccorritore2: {
    ids: ['mansione-socc-base', 'mansione-autista-118'],
    fallbackNomi: ['Soccorritore Base', 'Autista Soccorritore 118'],
    defaultEmoji: '🧑‍⚕️',
  },
  terzosoccorritore: {
    ids: ['mansione-barelliere', 'mansione-socc-base', 'mansione-autista-118'],
    fallbackNomi: ['Barelliere / Accompagnatore Sanitario', 'Soccorritore Base', 'Autista Soccorritore 118'],
    defaultEmoji: '🤝',
  },
  operatorecentrale: {
    ids: ['mansione-op-centrale'],
    fallbackNomi: ['Operatore di Centrale Operativa'],
    defaultEmoji: '🎧',
  },
  centralinista: {
    ids: ['mansione-centralinista', 'mansione-op-centrale'],
    fallbackNomi: ['Centralinista & Accoglienza', 'Operatore di Centrale Operativa'],
    defaultEmoji: '📞',
  },
  osservatore: {
    ids: ['mansione-osservatore'],
    fallbackNomi: ['Osservatore (In Formazione / Tirocinante)'],
    defaultEmoji: '👁️',
  },
};

/**
 * Restituisce la mansione primaria dal catalogo Mansioni & Competenze associata a uno slot equipaggio,
 * garantendo che Ruoli Equipaggio combacino sempre con Mansioni & Competenze anche dopo rinomine.
 */
export function getMansioneCatalogoPerRuoloTurno(
  ruolo: string,
  catalogo?: MansioneOperativa[]
): MansioneOperativa | undefined {
  const norm = (ruolo || '').toLowerCase().trim();
  const cfg = RUOLO_TURNO_MANSIONI_IDS[norm];
  if (!cfg) return undefined;
  const lista = catalogo || getMansioniCatalogo();
  for (const id of cfg.ids) {
    const found = lista.find((m) => m.id === id);
    if (found) return found;
  }
  for (const fb of cfg.fallbackNomi) {
    const found = lista.find((m) => m.nome.trim().toLowerCase() === fb.toLowerCase());
    if (found) return found;
  }
  return undefined;
}

/**
 * Restituisce nome e icona LIVE di un ruolo equipaggio leggendoli direttamente dal catalogo Mansioni & Competenze.
 */
export function getLabelRuoloEquipaggioLive(
  ruolo: string,
  catalogo?: MansioneOperativa[]
): { nome: string; emoji: string; mansioneId?: string } {
  const norm = (ruolo || '').toLowerCase().trim();
  const mans = getMansioneCatalogoPerRuoloTurno(norm, catalogo);
  const cfg = RUOLO_TURNO_MANSIONI_IDS[norm];
  if (mans) {
    return {
      nome: mans.nome,
      emoji: mans.badgeEmoji || cfg?.defaultEmoji || '🎖️',
      mansioneId: mans.id,
    };
  }
  if (cfg) {
    return {
      nome: cfg.fallbackNomi[0] || ruolo,
      emoji: cfg.defaultEmoji || '🎖️',
      mansioneId: cfg.ids[0],
    };
  }
  return { nome: ruolo || 'Equipaggio', emoji: '🎖️' };
}

/**
 * Restituisce i requisiti di mansione previsti per ciascun ruolo dello slot turno (risolvendo eventuali rinomine dal catalogo live)
 */
export function getMansioniPerRuoloTurno(ruolo: string, catalogo?: MansioneOperativa[]): string[] {
  const norm = (ruolo || '').toLowerCase().trim();
  const cfg = RUOLO_TURNO_MANSIONI_IDS[norm];
  if (!cfg || norm === 'osservatore') return ['Volontario'];
  const lista = catalogo || getMansioniCatalogo();
  return cfg.ids.map((id, idx) => {
    const item = lista.find((m) => m.id === id);
    return item?.nome || cfg.fallbackNomi[idx] || id;
  });
}

/**
 * Verifica se un volontario può coprire un determinato ruolo di turno in base alle mansioni assegnate ed ereditate.
 * Tollera eventuali rinomine delle mansioni grazie al matching sia per ID immutabile che per nome aggiornato.
 */
export function puoCoprireRuoloTurno(
  v: Partial<Volontario>,
  ruolo: string,
  catalogo?: MansioneOperativa[]
): {
  idoneo: boolean;
  motivo?: string;
  mansioniPossedute: string[];
  mansioniRichieste: string[];
} {
  const catalogoEffettivo = catalogo || getMansioniCatalogo();
  const effettive = getMansioniEffettiveVolontario(v, catalogoEffettivo);
  const normRuolo = (ruolo || '').toLowerCase().trim();
  const cfg = RUOLO_TURNO_MANSIONI_IDS[normRuolo];
  const richieste = getMansioniPerRuoloTurno(ruolo, catalogoEffettivo);

  // Per il ruolo osservatore o ruoli liberi, chiunque è ammesso
  if (!cfg || normRuolo === 'osservatore') {
    return {
      idoneo: true,
      mansioniPossedute: effettive,
      mansioniRichieste: richieste
    };
  }

  // Verifica tramite ID immutabili, nomi live rinominati e nomi canonici di fallback
  const effettiveLower = effettive.map((m) => m.toLowerCase());
  const possibiliTokens = new Set<string>([
    ...cfg.ids.map((x) => x.toLowerCase()),
    ...cfg.fallbackNomi.map((x) => x.toLowerCase()),
    ...richieste.map((x) => x.toLowerCase()),
  ]);
  const haRequisito = effettiveLower.some((eff) => possibiliTokens.has(eff));

  if (haRequisito) {
    return {
      idoneo: true,
      mansioniPossedute: effettive,
      mansioniRichieste: richieste
    };
  }

  const elencoRichiesteStr = richieste.join(' oppure ');
  const elencoPosseduteStr = getMansioniVolontario(v).join(', ');

  return {
    idoneo: false,
    motivo: `Il ruolo "${ruolo}" richiede: ${elencoRichiesteStr}. Mansioni possedute dal volontario: ${elencoPosseduteStr || 'Nessuna specifica (solo Volontario)'}.`,
    mansioniPossedute: effettive,
    mansioniRichieste: richieste
  };
}

/**
 * Assegna automaticamente una nuova mansione a un volontario (es. a seguito di corso/esame superato).
 * Non duplica le mansioni e aggiorna correttamente anche gli ID immutabili.
 */
export function assegnaMansioneAVolontario(
  v: Volontario,
  nuovaMansioneNome: string,
  catalogo?: MansioneOperativa[]
): Volontario {
  const nomePulito = (nuovaMansioneNome || '').trim();
  if (!nomePulito) return v;

  const lista = catalogo || getMansioniCatalogo();
  const itemCatalogo = lista.find(
    (m) => m.nome.toLowerCase() === nomePulito.toLowerCase() || m.id === nomePulito
  );
  const nomeFinale = itemCatalogo?.nome || nomePulito;

  const mansioniAttuali = getMansioniVolontario(v);
  const giaPosseduta = mansioniAttuali.some(
    (m) => m.toLowerCase() === nomeFinale.toLowerCase()
  );

  const idsAttuali = Array.isArray(v.mansioniIds) ? [...v.mansioniIds] : [];
  if (itemCatalogo && !idsAttuali.includes(itemCatalogo.id)) {
    idsAttuali.push(itemCatalogo.id);
  }

  if (giaPosseduta) {
    return itemCatalogo && idsAttuali.length !== (v.mansioniIds?.length || 0)
      ? { ...v, mansioniIds: idsAttuali }
      : v;
  }

  const nuoveMansioni = [...mansioniAttuali, nomeFinale];

  return {
    ...v,
    mansioni: nuoveMansioni,
    ...(idsAttuali.length > 0 ? { mansioniIds: idsAttuali } : {}),
    // Se la qualifica/mansione precedente era solo generica 'Volontario', promuovi la nuova
    mansione: (!v.mansione || v.mansione === 'Volontario') ? nomeFinale : v.mansione,
    qualifica: (!v.qualifica || v.qualifica === 'Volontario') ? nomeFinale : v.qualifica
  };
}
