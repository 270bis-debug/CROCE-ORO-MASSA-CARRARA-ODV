import {
  CorsoFormazione,
  ModelloAttestatoCategoria,
  PosizioneCampoPdfPrestampato,
  TipologiaCorso
} from '../types/adminTypes';

const LS_KEY_MODELLI = 'CROCE_ORO_MODELLI_ATTESTATI_CATEGORIA';
const LS_KEY_UPDATED_AT = 'CROCE_ORO_MODELLI_ATTESTATI_UPDATED_AT';
const IDB_NAME = 'CroceOroModelliAttestatiDB';
const IDB_STORE = 'pdfs';
const MAX_INLINE_PDF_BASE64_LEN = 320_000; // ~240KB binari per sicurezza sotto limite 1MB Firestore
const MAX_TOTAL_CLOUD_INLINE_LEN = 420_000;

export const EVENTO_MODELLI_ATTESTATI_UPDATED = 'croceoro_modelli_attestati_updated';

export const TIPOLOGIE_ATTESTATI_DEFAULT: TipologiaCorso[] = [
  'Seminario PSV',
  'Formazione PSV',
  'Seminario Autisti',
  'BLSD',
  'Protezione Civile Corso 0',
  'Protezione Civile Corso Base'
];

export function slugificaTipologiaCorso(tipologia: string): string {
  return (
    String(tipologia || 'corso')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'corso'
  );
}

export function getPosizioniDefaultPdf(): {
  campoNomeCognome: PosizioneCampoPdfPrestampato;
  campoDataLuogo: PosizioneCampoPdfPrestampato;
  campoMatricola: PosizioneCampoPdfPrestampato;
} {
  return {
    campoNomeCognome: {
      xPercent: 50,
      yPercent: 34,
      fontSize: 24,
      align: 'center',
      bold: true,
      uppercase: true,
      colorHex: '#000000',
      prefisso: '',
      sfondoBianco: false
    },
    campoDataLuogo: {
      xPercent: 88,
      yPercent: 79,
      fontSize: 15,
      align: 'right',
      bold: true,
      uppercase: false,
      colorHex: '#000000',
      prefisso: '',
      sfondoBianco: false
    },
    campoMatricola: {
      xPercent: 50,
      yPercent: 74,
      fontSize: 15,
      align: 'center',
      bold: true,
      uppercase: false,
      colorHex: '#000000',
      prefisso: 'MATRICOLA: ',
      sfondoBianco: false
    }
  };
}

export function creaModelloDefaultPerTipologia(tipologia: TipologiaCorso): ModelloAttestatoCategoria {
  const pos = getPosizioniDefaultPdf();
  let prefisso = 'ATT-';
  let prossimo = 1;

  if (tipologia === 'Seminario PSV') {
    prefisso = 'GEV-';
    prossimo = 99;
  } else if (tipologia === 'Formazione PSV') {
    prefisso = 'PSV-';
    prossimo = 1;
  } else if (tipologia === 'Seminario Autisti') {
    prefisso = 'AUT-PART-';
    prossimo = 1;
  } else if (tipologia === 'BLSD') {
    prefisso = 'BLSD-';
    prossimo = 1;
  } else if (tipologia === 'Protezione Civile Corso 0') {
    prefisso = 'PC0-';
    prossimo = 1;
  } else if (tipologia === 'Protezione Civile Corso Base') {
    prefisso = 'PCB-';
    prossimo = 1;
  } else {
    const slug = String(tipologia || '').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6) || 'ATT';
    prefisso = `${slug}-`;
    prossimo = 1;
  }

  return {
    tipologia,
    attivo: false,
    pdfSlug: slugificaTipologiaCorso(tipologia),
    hasPdfFile: false,
    updatedAt: 0,
    prefissoMatricola: prefisso,
    cifrePadding: 3,
    prossimoProgressivo: prossimo,
    progressivoImpostatoManualmente: false,
    luogoRilascioDefault: '',
    formatoDataLuogo: 'con_li',
    ...pos
  };
}

function normalizzaModello(tipologia: TipologiaCorso, raw?: Partial<ModelloAttestatoCategoria> | null): ModelloAttestatoCategoria {
  const def = creaModelloDefaultPerTipologia(tipologia);
  if (!raw || typeof raw !== 'object') return def;

  const cifre = Math.min(8, Math.max(1, Number(raw.cifrePadding ?? def.cifrePadding) || 3));
  const progRaw = Number(raw.prossimoProgressivo);
  const prossimoProgressivo = Number.isFinite(progRaw) && progRaw >= 0 ? Math.floor(progRaw) : def.prossimoProgressivo;

  return {
    ...def,
    ...raw,
    tipologia,
    pdfSlug: raw.pdfSlug || def.pdfSlug,
    prefissoMatricola: typeof raw.prefissoMatricola === 'string' ? raw.prefissoMatricola : def.prefissoMatricola,
    cifrePadding: cifre,
    prossimoProgressivo,
    formatoDataLuogo: raw.formatoDataLuogo === 'virgola' ? 'virgola' : 'con_li',
    campoNomeCognome: { ...def.campoNomeCognome, ...(raw.campoNomeCognome || {}) },
    campoDataLuogo: { ...def.campoDataLuogo, ...(raw.campoDataLuogo || {}) },
    campoMatricola: { ...def.campoMatricola, ...(raw.campoMatricola || {}) }
  };
}

export function getModelliAttestatiCategoria(): Record<string, ModelloAttestatoCategoria> {
  const result: Record<string, ModelloAttestatoCategoria> = {};
  TIPOLOGIE_ATTESTATI_DEFAULT.forEach((tip) => {
    result[tip] = creaModelloDefaultPerTipologia(tip);
  });

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(LS_KEY_MODELLI);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          Object.entries(parsed).forEach(([tip, val]) => {
            result[tip] = normalizzaModello(tip as TipologiaCorso, val as Partial<ModelloAttestatoCategoria>);
          });
        }
      }
    } catch {}
  }

  return result;
}

export function getModelloPerTipologia(tipologia: TipologiaCorso): ModelloAttestatoCategoria {
  const tutti = getModelliAttestatiCategoria();
  return tutti[tipologia] || creaModelloDefaultPerTipologia(tipologia);
}

export function getModelliAttestatiUpdatedAt(): number {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return 0;
  try {
    return Number(localStorage.getItem(LS_KEY_UPDATED_AT) || 0) || 0;
  } catch {
    return 0;
  }
}

export function sanitizzaModelliPerCloud(
  mappa: Record<string, ModelloAttestatoCategoria>
): Record<string, ModelloAttestatoCategoria> {
  const pulita: Record<string, ModelloAttestatoCategoria> = {};
  let totalInline = 0;

  Object.entries(mappa || {}).forEach(([tip, mod]) => {
    if (!mod || typeof mod !== 'object') return;
    const norm = normalizzaModello(tip as TipologiaCorso, mod);
    const clone: ModelloAttestatoCategoria = { ...norm };
    if (clone.pdfBase64Inline) {
      if (
        clone.pdfBase64Inline.length <= MAX_INLINE_PDF_BASE64_LEN &&
        totalInline + clone.pdfBase64Inline.length <= MAX_TOTAL_CLOUD_INLINE_LEN
      ) {
        totalInline += clone.pdfBase64Inline.length;
      } else {
        delete clone.pdfBase64Inline;
      }
    }
    pulita[tip] = clone;
  });

  return pulita;
}

export function salvaModelliAttestatiCategoria(
  mappa: Record<string, ModelloAttestatoCategoria>,
  updatedAt?: number
): { mappa: Record<string, ModelloAttestatoCategoria>; updatedAt: number } {
  const ts = updatedAt || Date.now();
  const compact = sanitizzaModelliPerCloud(mappa);

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LS_KEY_MODELLI, JSON.stringify(compact));
      localStorage.setItem(LS_KEY_UPDATED_AT, String(ts));
    } catch {
      // Se localStorage è quasi pieno, salva senza pdfBase64Inline (i file PDF restano in IndexedDB e su server)
      try {
        const light: Record<string, ModelloAttestatoCategoria> = {};
        Object.entries(compact).forEach(([k, v]) => {
          const c = { ...v };
          delete c.pdfBase64Inline;
          light[k] = c;
        });
        localStorage.setItem(LS_KEY_MODELLI, JSON.stringify(light));
        localStorage.setItem(LS_KEY_UPDATED_AT, String(ts));
      } catch {}
    }
    try {
      window.dispatchEvent(new CustomEvent(EVENTO_MODELLI_ATTESTATI_UPDATED, { detail: { mappa: compact, updatedAt: ts } }));
    } catch {}
  }

  return { mappa: compact, updatedAt: ts };
}

export function applicaModelliAttestatiDaSync(
  incoming?: Record<string, ModelloAttestatoCategoria> | null,
  incomingUpdatedAt?: number
): Record<string, ModelloAttestatoCategoria> {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return getModelliAttestatiCategoria();
  }
  const localTs = getModelliAttestatiUpdatedAt();
  const remoteTs = Number(incomingUpdatedAt || 0);
  if (localTs > 0 && remoteTs > 0 && remoteTs < localTs) {
    return getModelliAttestatiCategoria();
  }
  const current = getModelliAttestatiCategoria();
  const merged: Record<string, ModelloAttestatoCategoria> = { ...current };

  Object.entries(incoming).forEach(([tip, mod]) => {
    const prev = current[tip];
    const norm = normalizzaModello(tip as TipologiaCorso, mod);
    // Preserva eventuale pdfBase64Inline locale se il remoto ha lo stesso slug/file ma stripped per Firestore
    if (!norm.pdfBase64Inline && prev?.pdfBase64Inline && norm.hasPdfFile && prev.fileName === norm.fileName) {
      norm.pdfBase64Inline = prev.pdfBase64Inline;
    }
    merged[tip] = norm;
  });

  const saved = salvaModelliAttestatiCategoria(merged, remoteTs || Date.now());
  return saved.mappa;
}

/**
 * Formatta un numero progressivo usando il prefisso e il padding della categoria.
 */
export function formattaMatricolaDaModello(modello: ModelloAttestatoCategoria, numero?: number): string {
  const num = Number.isFinite(numero) ? Math.max(0, Math.floor(numero!)) : modello.prossimoProgressivo;
  const padding = Math.min(8, Math.max(1, Number(modello.cifrePadding || 3)));
  const prefisso = modello.prefissoMatricola ?? '';
  return `${prefisso}${String(num).padStart(padding, '0')}`;
}

/**
 * Estrae il numero massimo già presente negli attestati di una specifica tipologia di corso.
 */
export function trovaMassimoProgressivoNeiCorsi(
  tipologia: TipologiaCorso,
  tuttiCorsi: CorsoFormazione[] = []
): number {
  let maxNum = 0;
  tuttiCorsi.forEach((c) => {
    if (c.tipologia !== tipologia) return;
    (c.iscritti || []).forEach((p) => {
      if (!p.numeroAttestato) return;
      const matches = String(p.numeroAttestato).match(/(\d+)(?!.*\d)/);
      if (matches) {
        const val = parseInt(matches[1], 10);
        if (!isNaN(val) && val > maxNum) {
          maxNum = val;
        }
      }
    });
  });
  return maxNum;
}

/**
 * Calcola quale numero progressivo verrà assegnato al prossimo attestato della categoria,
 * rispettando eventuali modifiche manuali dell'operatore.
 */
export function getProssimoNumeroEffettivoCategoria(
  modello: ModelloAttestatoCategoria,
  tuttiCorsi: CorsoFormazione[] = []
): number {
  if (modello.progressivoImpostatoManualmente || modello.ultimoNumeroEmesso) {
    return Math.max(0, Math.floor(modello.prossimoProgressivo));
  }
  const maxEsistente = trovaMassimoProgressivoNeiCorsi(modello.tipologia, tuttiCorsi);
  if (maxEsistente > 0 && maxEsistente >= modello.prossimoProgressivo) {
    return maxEsistente + 1;
  }
  return Math.max(0, Math.floor(modello.prossimoProgressivo));
}

/**
 * Consuma il prossimo numero di matricola progressivo per la categoria, incrementandolo di +1
 * e restituendo la nuova mappa aggiornata pronta per la sincronizzazione cloud/server.
 */
export function consumaProssimaMatricolaCategoria(
  tipologia: TipologiaCorso,
  tuttiCorsi: CorsoFormazione[] = [],
  operatore?: string
): {
  matricola: string;
  numeroUsato: number;
  modelloAggiornato: ModelloAttestatoCategoria;
  mappaAggiornata: Record<string, ModelloAttestatoCategoria>;
  updatedAt: number;
} {
  const mappa = getModelliAttestatiCategoria();
  const corrente = mappa[tipologia] || creaModelloDefaultPerTipologia(tipologia);
  const numeroUsato = getProssimoNumeroEffettivoCategoria(corrente, tuttiCorsi);
  const matricola = formattaMatricolaDaModello(corrente, numeroUsato);

  const updatedAt = Date.now();
  const modelloAggiornato: ModelloAttestatoCategoria = {
    ...corrente,
    prossimoProgressivo: numeroUsato + 1,
    progressivoImpostatoManualmente: true,
    ultimoNumeroEmesso: matricola,
    updatedAt,
    updatedBy: operatore || corrente.updatedBy
  };

  const nuovaMappa = {
    ...mappa,
    [tipologia]: modelloAggiornato
  };

  const saved = salvaModelliAttestatiCategoria(nuovaMappa, updatedAt);
  return {
    matricola,
    numeroUsato,
    modelloAggiornato,
    mappaAggiornata: saved.mappa,
    updatedAt: saved.updatedAt
  };
}

// ---------------------------------------------------------------------------
// CACHE BINARIA LOCALE (IndexedDB) + FETCH/UPLOAD SERVER PER PDF MULTI-MB
// ---------------------------------------------------------------------------
function openPdfIdb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function salvaPdfBytesInCacheLocale(slug: string, bytes: Uint8Array): Promise<void> {
  const db = await openPdfIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(bytes, slug);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function leggiPdfBytesDaCacheLocale(slug: string): Promise<Uint8Array | null> {
  const db = await openPdfIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(slug);
      req.onsuccess = () => {
        const val = req.result;
        if (val instanceof Uint8Array) resolve(val);
        else if (val instanceof ArrayBuffer) resolve(new Uint8Array(val));
        else resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function eliminaPdfBytesDaCacheLocale(slug: string): Promise<void> {
  const db = await openPdfIdb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(slug);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

export function base64ToUint8ArraySafe(base64: string): Uint8Array {
  const clean = base64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  if (typeof atob === 'function') {
    const bin = atob(clean);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(clean, 'base64'));
  }
  throw new Error('Decodifica Base64 non supportata');
}

/**
 * Carica i byte del file PDF prestampato di una categoria, cercando in:
 * 1) Cache IndexedDB locale (istantanea)
 * 2) Campo pdfBase64Inline (se il file era compatto e sincronizzato in cloud)
 * 3) Endpoint backend /api/modelli-attestati/:slug (con salvataggio automatico in cache locale)
 */
export async function caricaPdfPrestampatoBytes(
  modello: ModelloAttestatoCategoria,
  apiBaseUrl: string = ''
): Promise<Uint8Array | null> {
  if (!modello || !modello.hasPdfFile) return null;
  const slug = modello.pdfSlug || slugificaTipologiaCorso(modello.tipologia);

  // 1. IndexedDB locale
  const localBytes = await leggiPdfBytesDaCacheLocale(slug);
  if (localBytes && localBytes.length > 100) {
    return localBytes;
  }

  // 2. Inline base64 (per PDF compatti sincronizzati via Firestore/localStorage)
  if (modello.pdfBase64Inline && modello.pdfBase64Inline.length > 100) {
    try {
      const bytes = base64ToUint8ArraySafe(modello.pdfBase64Inline);
      if (bytes.length > 100) {
        await salvaPdfBytesInCacheLocale(slug, bytes);
        return bytes;
      }
    } catch {}
  }

  // 3. Backend server (se siamo nel browser)
  if (typeof fetch === 'function') {
    try {
      const base = apiBaseUrl ? apiBaseUrl.replace(/\/$/, '') : '';
      const resp = await fetch(`${base}/api/modelli-attestati/${encodeURIComponent(slug)}`, {
        cache: 'no-store'
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data?.success && typeof data.pdfBase64 === 'string' && data.pdfBase64.length > 100) {
          const bytes = base64ToUint8ArraySafe(data.pdfBase64);
          await salvaPdfBytesInCacheLocale(slug, bytes);
          return bytes;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Carica un nuovo PDF prestampato per una categoria: salva in IndexedDB,
 * carica su server (/api/modelli-attestati/:slug) e restituisce il modello aggiornato.
 */
export async function uploadPdfPrestampatoPerCategoria(
  tipologia: TipologiaCorso,
  file: File,
  apiBaseUrl: string = '',
  operatore?: string
): Promise<{
  modello: ModelloAttestatoCategoria;
  mappa: Record<string, ModelloAttestatoCategoria>;
  updatedAt: number;
  pdfBytes: Uint8Array;
  salvatoSuServer: boolean;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfBytes = new Uint8Array(arrayBuffer);

  // Controllo intestazione magica PDF (%PDF-)
  const header = String.fromCharCode(pdfBytes[0] || 0, pdfBytes[1] || 0, pdfBytes[2] || 0, pdfBytes[3] || 0);
  if (header !== '%PDF') {
    throw new Error('Il file selezionato non è un documento PDF valido.');
  }
  if (pdfBytes.length > 15 * 1024 * 1024) {
    throw new Error('Il file PDF supera il limite massimo di 15 MB.');
  }

  const slug = slugificaTipologiaCorso(tipologia);
  const pdfBase64 = uint8ArrayToBase64(pdfBytes);

  // Salva sempre nella cache locale IndexedDB (istantaneo)
  await salvaPdfBytesInCacheLocale(slug, pdfBytes);

  // Tenta salvataggio sul server Express persistente
  let salvatoSuServer = false;
  if (typeof fetch === 'function') {
    try {
      const base = apiBaseUrl ? apiBaseUrl.replace(/\/$/, '') : '';
      const resp = await fetch(`${base}/api/modelli-attestati/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64,
          fileName: file.name,
          tipologia,
          operatore: operatore || 'Operatore Formazione'
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        salvatoSuServer = Boolean(data?.success);
      }
    } catch {}
  }

  const mappa = getModelliAttestatiCategoria();
  const corrente = mappa[tipologia] || creaModelloDefaultPerTipologia(tipologia);
  const updatedAt = Date.now();
  const modello: ModelloAttestatoCategoria = {
    ...corrente,
    attivo: true,
    hasPdfFile: true,
    fileName: file.name,
    fileSize: pdfBytes.length,
    pdfSlug: slug,
    pdfBase64Inline: pdfBase64.length <= MAX_INLINE_PDF_BASE64_LEN ? pdfBase64 : undefined,
    updatedAt,
    updatedBy: operatore || corrente.updatedBy
  };

  const nuovaMappa = {
    ...mappa,
    [tipologia]: modello
  };
  const saved = salvaModelliAttestatiCategoria(nuovaMappa, updatedAt);

  return {
    modello: saved.mappa[tipologia] || modello,
    mappa: saved.mappa,
    updatedAt: saved.updatedAt,
    pdfBytes,
    salvatoSuServer
  };
}

/**
 * Rimuove il file PDF prestampato per una categoria (mantenendo intatta la numerazione progressiva).
 */
export async function rimuoviPdfPrestampatoPerCategoria(
  tipologia: TipologiaCorso,
  apiBaseUrl: string = '',
  operatore?: string
): Promise<{
  modello: ModelloAttestatoCategoria;
  mappa: Record<string, ModelloAttestatoCategoria>;
  updatedAt: number;
}> {
  const slug = slugificaTipologiaCorso(tipologia);
  await eliminaPdfBytesDaCacheLocale(slug);

  if (typeof fetch === 'function') {
    try {
      const base = apiBaseUrl ? apiBaseUrl.replace(/\/$/, '') : '';
      await fetch(`${base}/api/modelli-attestati/${encodeURIComponent(slug)}`, {
        method: 'DELETE'
      });
    } catch {}
  }

  const mappa = getModelliAttestatiCategoria();
  const corrente = mappa[tipologia] || creaModelloDefaultPerTipologia(tipologia);
  const updatedAt = Date.now();
  const modello: ModelloAttestatoCategoria = {
    ...corrente,
    attivo: false,
    hasPdfFile: false,
    fileName: undefined,
    fileSize: undefined,
    pdfBase64Inline: undefined,
    updatedAt,
    updatedBy: operatore || corrente.updatedBy
  };

  const nuovaMappa = {
    ...mappa,
    [tipologia]: modello
  };
  const saved = salvaModelliAttestatiCategoria(nuovaMappa, updatedAt);
  return {
    modello: saved.mappa[tipologia] || modello,
    mappa: saved.mappa,
    updatedAt: saved.updatedAt
  };
}
