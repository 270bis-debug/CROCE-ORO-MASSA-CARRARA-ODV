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

const PUBLIC_ROSTER_PROTECTED_PRIVATE_KEYS = new Set<string>([
  'pin',
  'email',
  'telefono',
  'codiceFiscale',
  'indirizzoResidenza',
  'dettaglioResidenza',
  'dataNascita',
  'sesso',
  'comuneNascita',
  'provinciaNascita',
  'firmaBase64',
  'fotoBase64',
  'documentoIdentita',
  'patente',
  'vestiario',
  'tesseramento',
  'domandaIscrizioneFirmata',
  'domandaIscrizioneDati',
  'dataRegistrazione',
  'ultimoAccesso',
  'inTurno',
  'mezzoAttivo',
  'ruoloTurno',
  'resetToken',
  'dataInvioInvitoReset',
  'dataRichiestaApprovazione',
  'dataRichiestaResetPassword',
  'dataBlocco',
  'esenteQuotaAssociativa',
  'motivoEsenzioneQuota',
  'sezioneAppartenenzaId',
  'sezioneAppartenenzaNome',
]);

function mergeSingleVolontario<T extends Record<string, any>>(base: T, incoming: T): T {
  const merged: Record<string, any> = { ...base };
  const incomingIsRosterOnly = Boolean(incoming.isPublicRosterOnly);
  const baseIsFull = !base.isPublicRosterOnly && Boolean(base.pin || base.email || base.telefono || base.firmaBase64);

  for (const [key, val] of Object.entries(incoming)) {
    if (incomingIsRosterOnly && baseIsFull && PUBLIC_ROSTER_PROTECTED_PRIVATE_KEYS.has(key)) {
      // Non degradare mai un profilo completo privato con i campi vuoti del roster pubblico zero-PII
      continue;
    }
    if (key === 'isPublicRosterOnly') {
      merged.isPublicRosterOnly = incomingIsRosterOnly && !baseIsFull;
      continue;
    }
    if (key === 'sottosezioniAbilitate') {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        merged.sottosezioniAbilitate = { ...val };
      } else if (!incomingIsRosterOnly) {
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
      key === 'hasFirma' &&
      incomingIsRosterOnly &&
      val === false &&
      (base.hasFirma === true || (typeof base.firmaBase64 === 'string' && base.firmaBase64.trim().length >= 20))
    ) {
      merged.hasFirma = true;
      continue;
    }
    if (
      key === 'pinIsEmergency' &&
      incomingIsRosterOnly &&
      val === true &&
      base.pinIsEmergency === false &&
      typeof base.pin === 'string' &&
      /^\d{4}$/.test(base.pin.trim()) &&
      base.pin.trim() !== '0000'
    ) {
      merged.pinIsEmergency = false;
      continue;
    }
    if (
      key === 'pinHash' &&
      incomingIsRosterOnly &&
      incoming.pinIsEmergency === true &&
      typeof base.pin === 'string' &&
      /^\d{4}$/.test(base.pin.trim()) &&
      base.pin.trim() !== '0000' &&
      typeof base.pinHash === 'string' &&
      base.pinHash.length === 64
    ) {
      merged.pinHash = base.pinHash;
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
    if (key === 'loggato') {
      const baseLogTs = Number(base.loggatoUpdatedAt || 0);
      const incLogTs = Number(incoming.loggatoUpdatedAt || 0);
      if (incLogTs > 0 && baseLogTs > 0 && incLogTs < baseLogTs) {
        // Stato incoming più vecchio dello stato locale/server: non sovrascrivere
        continue;
      }
      if (base.loggato === true && val === false && incLogTs === 0) {
        // Non permettere a una sincronizzazione massiva priva di timestamp di azzerare un login attivo
        continue;
      }
      merged.loggato = Boolean(val);
      continue;
    }
    if (key === 'loggatoUpdatedAt') {
      const baseLogTs = Number(base.loggatoUpdatedAt || 0);
      const incLogTs = Number(val || 0);
      if (incLogTs > baseLogTs) {
        merged.loggatoUpdatedAt = incLogTs;
      }
      continue;
    }
    merged[key] = val;
  }

  if (!incomingIsRosterOnly) {
    merged.isPublicRosterOnly = false;
    if (typeof incoming.pin === 'string' && /^\d{4}$/.test(incoming.pin.trim())) {
      merged.pinIsEmergency = incoming.pin.trim() === '0000';
    }
    if (typeof incoming.firmaBase64 === 'string' && incoming.firmaBase64.trim().length >= 20) {
      merged.hasFirma = true;
    }
  }

  return merged as T;
}

export interface LoggedSessionEntry {
  loggato: boolean;
  updatedAt?: number;
  volontarioNome?: string;
  mezzoScelto?: string;
  orarioInizio?: string;
}

/**
 * Fonde in modo non distruttivo le mappe delle sessioni loggate (`loggedSessions`)
 * mantenendo sempre l'evento più recente per singolo `volontarioId` (in base a `updatedAt`).
 */
export function mergeLoggedSessionsSafe(
  prev?: Record<string, LoggedSessionEntry> | null,
  incoming?: Record<string, LoggedSessionEntry> | null
): Record<string, LoggedSessionEntry> {
  const merged: Record<string, LoggedSessionEntry> = {};
  if (prev && typeof prev === 'object') {
    for (const [volId, info] of Object.entries(prev)) {
      if (!volId || !info || typeof info !== 'object') continue;
      merged[volId] = { ...info };
    }
  }
  if (incoming && typeof incoming === 'object') {
    for (const [volId, info] of Object.entries(incoming)) {
      if (!volId || !info || typeof info !== 'object') continue;
      const existing = merged[volId];
      const prevTs = Number(existing?.updatedAt || 0);
      const incTs = Number(info.updatedAt || 0);
      if (!existing) {
        merged[volId] = { ...info };
      } else if (incTs > prevTs) {
        merged[volId] = { ...existing, ...info };
      } else if (incTs === prevTs) {
        // A parità di timestamp, preserva loggato=true se presente
        merged[volId] = {
          ...existing,
          ...info,
          loggato: Boolean(existing.loggato || info.loggato),
        };
      }
    }
  }
  return merged;
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
