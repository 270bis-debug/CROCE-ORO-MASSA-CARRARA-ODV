// Utility condivisa per la fusione non distruttiva e il tracciamento eliminazioni del Database Volontari

function isMissingOrTempId(id?: string): boolean {
  if (!id || typeof id !== 'string' || !id.trim()) return true;
  // Vecchi ID seed generati su istanze server precedenti per i profili iniziali
  if (/^vol-179\d{10}$/.test(id)) return true;
  return false;
}

const SEED_ALIAS_PAIRS: ReadonlyArray<[string, string]> = [
  ['vol-156', 'vol-1790806001919'],
  ['vol-318', 'vol-1792318394496'],
];

export function normalizeDeletedIds(ids?: any[]): string[] {
  if (!Array.isArray(ids)) return [];
  const set = new Set<string>();
  for (const id of ids) {
    if (typeof id === 'string' && id.trim()) {
      const clean = id.trim();
      set.add(clean);
      for (const [a, b] of SEED_ALIAS_PAIRS) {
        if (clean === a) set.add(b);
        else if (clean === b) set.add(a);
      }
    }
  }
  const arr = Array.from(set);
  return arr.length > 300 ? arr.slice(-300) : arr;
}

function mergeSingleVolontario<T extends Record<string, any>>(base: T, incoming: T): T {
  const merged: Record<string, any> = { ...base };
  for (const [key, val] of Object.entries(incoming)) {
    if (key === 'sottosezioniAbilitate') {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        merged.sottosezioniAbilitate = { ...val };
      } else {
        // Permette di rimuovere restrizioni parziali (es. riattivazione di tutte le sottosezioni di un DB)
        merged.sottosezioniAbilitate = {};
      }
      continue;
    }
    if (key === 'macroCategorieAbilitate' && Array.isArray(val)) {
      merged.macroCategorieAbilitate = [...val];
      continue;
    }
    if (val === undefined || val === null) {
      // Non sovrascrivere allegati o campi valorizzati localmente con null/undefined
      // (es. quando Firestore alleggerisce blob base64 pesanti per rimanere sotto 1 MiB)
      continue;
    }
    if (
      (key === 'fotoBase64' || key === 'firmaBase64') &&
      typeof val === 'string' &&
      val.trim() === '' &&
      typeof base[key] === 'string' &&
      base[key].trim() !== ''
    ) {
      continue;
    }
    if (key === 'vestiario' && val && typeof val === 'object' && base.vestiario && typeof base.vestiario === 'object') {
      const mergedVestiario: Record<string, any> = { ...base.vestiario, ...val };
      if (
        (!val.documentoFirmato || !val.documentoFirmato.fileBase64) &&
        base.vestiario.documentoFirmato?.fileBase64
      ) {
        mergedVestiario.documentoFirmato = {
          ...base.vestiario.documentoFirmato,
          ...(val.documentoFirmato || {}),
          fileBase64: base.vestiario.documentoFirmato.fileBase64,
        };
      }
      merged.vestiario = mergedVestiario;
      continue;
    }
    if (
      key === 'domandaIscrizioneFirmata' &&
      val &&
      typeof val === 'object' &&
      !val.fileBase64 &&
      base.domandaIscrizioneFirmata?.fileBase64
    ) {
      merged.domandaIscrizioneFirmata = {
        ...base.domandaIscrizioneFirmata,
        ...val,
        fileBase64: base.domandaIscrizioneFirmata.fileBase64,
      };
      continue;
    }
    if (
      (key === 'documentoIdentita' || key === 'patente') &&
      val &&
      typeof val === 'object' &&
      base[key] &&
      typeof base[key] === 'object'
    ) {
      merged[key] = {
        ...base[key],
        ...val,
        fotoFronte: val.fotoFronte ?? base[key].fotoFronte,
        fotoRetro: val.fotoRetro ?? base[key].fotoRetro,
      };
      continue;
    }
    merged[key] = val;
  }
  return merged as T;
}

/**
 * Fusione non distruttiva dell'elenco volontari/operatori tra stato locale, Express e Cloud Firestore.
 * - Abbina prioritariamente per `id` esatto.
 * - Abbina per `nome + cognome` (o `matricola` se privo di cognome) SOLO se almeno uno dei due record
 *   è privo di ID oppure ha un vecchio ID temporaneo (`vol-179...`), impedendo che due account con ID
 *   espliciti distinti (inclusi i seed `vol-quattrini`, `vol-156`, ecc.) si sovrascrivano mai a vicenda.
 * - Rispetta eventuali `deletedIds` (tombstone espliciti di eliminazione).
 */
export function mergeVolontariListsSafe<T extends Record<string, any>>(
  prev: T[],
  incoming: T[],
  deletedIds?: string[]
): T[] {
  const deletedSet = new Set(normalizeDeletedIds(deletedIds));
  const safePrev = Array.isArray(prev) ? prev : [];
  const safeIncoming = Array.isArray(incoming) ? incoming : [];
  const result: T[] = [];

  const addOrUpdate = (v: T) => {
    if (!v || typeof v !== 'object') return;
    if (v.id && deletedSet.has(String(v.id))) return;

    const vId = v.id ? String(v.id).trim() : '';
    const vMat = v.matricola ? String(v.matricola).trim().toUpperCase() : '';
    const n = String(v.nome || '').trim().toLowerCase();
    const c = String(v.cognome || '').trim().toLowerCase();

    // 1. Match prioritario su ID esatto
    let idx = vId ? result.findIndex((ex) => ex.id && String(ex.id).trim() === vId) : -1;

    // 2. Fallback SOLO se uno dei due è privo di ID o usa un vecchio ID temporaneo vol-179...
    if (idx === -1) {
      idx = result.findIndex((ex) => {
        const exId = ex.id ? String(ex.id).trim() : '';
        if (!isMissingOrTempId(exId) && !isMissingOrTempId(vId)) return false;

        const exN = String(ex.nome || '').trim().toLowerCase();
        const exC = String(ex.cognome || '').trim().toLowerCase();
        if (n && c && exN === n && exC === c) return true;

        const exMat = ex.matricola ? String(ex.matricola).trim().toUpperCase() : '';
        if (!c && !exC && exMat && vMat && exMat === vMat) return true;

        return false;
      });
    }

    if (idx !== -1) {
      result[idx] = mergeSingleVolontario(result[idx], v);
    } else {
      result.push({ ...v });
    }
  };

  for (const v of safePrev) addOrUpdate(v);
  for (const v of safeIncoming) addOrUpdate(v);

  return result;
}
