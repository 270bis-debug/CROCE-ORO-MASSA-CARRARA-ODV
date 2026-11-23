import {
  ComunicazioneBacheca,
  SedeAssociativaCompleta,
  TimbraturaVolontario,
} from '../types/adminTypes';
import { addDaysISODate, formatISODateItaly } from './italianTime';

export interface RaspberryDisplayConfig {
  sezionePredefinitaId: string;
  mostraBachecaAssociativa: boolean;
  mostraBachecaSezione: boolean;
  mostraPresenzeSezione: boolean;
  soloImportantiAssociativa: boolean;
  soloImportantiSezione: boolean;
  finestraUsciti: 'oggi' | '12h' | '24h';
  autoScrollAttivo: boolean;
  velocitaScroll: 'lento' | 'medio' | 'veloce';
  refreshSecondi: number;
  tickerAvvisoCentrale: string;
  updatedBy?: string;
  updatedAtIso?: string;
}

export const RASPBERRY_CONFIG_STORAGE_KEY = 'CROCE_ORO_RASPBERRY_DISPLAY_CONFIG';

export const DEFAULT_RASPBERRY_DISPLAY_CONFIG: RaspberryDisplayConfig = {
  sezionePredefinitaId: 'sede-carrara-fossone',
  mostraBachecaAssociativa: true,
  mostraBachecaSezione: true,
  mostraPresenzeSezione: true,
  soloImportantiAssociativa: false,
  soloImportantiSezione: false,
  finestraUsciti: 'oggi',
  autoScrollAttivo: true,
  velocitaScroll: 'lento',
  refreshSecondi: 30,
  tickerAvvisoCentrale: '',
};

export function sanitizeRaspberryDisplayConfig(
  raw: any,
  fallbackSedeId?: string
): RaspberryDisplayConfig {
  const base = {
    ...DEFAULT_RASPBERRY_DISPLAY_CONFIG,
    ...(fallbackSedeId ? { sezionePredefinitaId: fallbackSedeId } : {}),
  };
  if (!raw || typeof raw !== 'object') return base;

  const finestra =
    raw.finestraUsciti === '12h' || raw.finestraUsciti === '24h' || raw.finestraUsciti === 'oggi'
      ? raw.finestraUsciti
      : base.finestraUsciti;

  const velocita =
    raw.velocitaScroll === 'lento' || raw.velocitaScroll === 'medio' || raw.velocitaScroll === 'veloce'
      ? raw.velocitaScroll
      : base.velocitaScroll;

  const refreshRaw = Number(raw.refreshSecondi);
  const refreshSecondi =
    Number.isFinite(refreshRaw) && refreshRaw >= 15 && refreshRaw <= 300
      ? Math.round(refreshRaw)
      : base.refreshSecondi;

  return {
    sezionePredefinitaId:
      typeof raw.sezionePredefinitaId === 'string' && raw.sezionePredefinitaId.trim()
        ? raw.sezionePredefinitaId.trim().slice(0, 128)
        : base.sezionePredefinitaId,
    mostraBachecaAssociativa:
      typeof raw.mostraBachecaAssociativa === 'boolean'
        ? raw.mostraBachecaAssociativa
        : base.mostraBachecaAssociativa,
    mostraBachecaSezione:
      typeof raw.mostraBachecaSezione === 'boolean'
        ? raw.mostraBachecaSezione
        : base.mostraBachecaSezione,
    mostraPresenzeSezione:
      typeof raw.mostraPresenzeSezione === 'boolean'
        ? raw.mostraPresenzeSezione
        : base.mostraPresenzeSezione,
    soloImportantiAssociativa:
      typeof raw.soloImportantiAssociativa === 'boolean'
        ? raw.soloImportantiAssociativa
        : base.soloImportantiAssociativa,
    soloImportantiSezione:
      typeof raw.soloImportantiSezione === 'boolean'
        ? raw.soloImportantiSezione
        : base.soloImportantiSezione,
    finestraUsciti: finestra,
    autoScrollAttivo:
      typeof raw.autoScrollAttivo === 'boolean' ? raw.autoScrollAttivo : base.autoScrollAttivo,
    velocitaScroll: velocita,
    refreshSecondi,
    tickerAvvisoCentrale:
      typeof raw.tickerAvvisoCentrale === 'string'
        ? raw.tickerAvvisoCentrale.trim().slice(0, 320)
        : '',
    ...(typeof raw.updatedBy === 'string' && raw.updatedBy.trim()
      ? { updatedBy: raw.updatedBy.trim().slice(0, 120) }
      : {}),
    ...(typeof raw.updatedAtIso === 'string' && raw.updatedAtIso.trim()
      ? { updatedAtIso: raw.updatedAtIso.trim().slice(0, 64) }
      : {}),
  };
}

export function loadRaspberryDisplayConfig(fallbackSedeId?: string): RaspberryDisplayConfig {
  try {
    const raw = localStorage.getItem(RASPBERRY_CONFIG_STORAGE_KEY);
    if (raw) {
      return sanitizeRaspberryDisplayConfig(JSON.parse(raw), fallbackSedeId);
    }
  } catch {}
  return sanitizeRaspberryDisplayConfig(null, fallbackSedeId);
}

export function saveRaspberryDisplayConfigLocal(config: RaspberryDisplayConfig): RaspberryDisplayConfig {
  const clean = sanitizeRaspberryDisplayConfig(config);
  try {
    localStorage.setItem(RASPBERRY_CONFIG_STORAGE_KEY, JSON.stringify(clean));
  } catch {}
  return clean;
}

export function buildRaspberryKioskUrl(baseUrl: string, sedeId?: string): string {
  const cleanBase = (baseUrl || '').replace(/\/+$/, '');
  const params = new URLSearchParams();
  params.set('view', 'raspberry');
  if (sedeId && sedeId.trim()) {
    params.set('sede', sedeId.trim());
  }
  return `${cleanBase}/?${params.toString()}`;
}

export function isDedicatedRaspberryUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  return (
    path.includes('/raspberry') ||
    path.includes('/display-sezione') ||
    search.includes('view=raspberry') ||
    search.includes('view=display-sezione') ||
    search.includes('raspberry=1') ||
    hash.includes('raspberry')
  );
}

export function getRaspberrySedeIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('sede') || params.get('sezione') || params.get('sedeId');
    return s && s.trim() ? s.trim() : null;
  } catch {
    return null;
  }
}

const GENERIC_SEDE_STOPWORDS = new Set([
  'sede',
  'sedi',
  'sezione',
  'sezioni',
  'operativa',
  'operativo',
  'territoriale',
  'legale',
  'centrale',
  'direzione',
  'generale',
  'autoparco',
  'emergenze',
  'presidio',
  'postazione',
  'croce',
  'oro',
  'massa',
  'odv',
  'h24',
  'localita',
  'via',
  'della',
  'delle',
  'degli',
  'del',
  'di',
  'da',
  'per',
  'con',
  'presso',
]);

function normalizeText(value?: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function extractDistinctiveTokens(sede: Partial<SedeAssociativaCompleta>): string[] {
  const combined = `${sede.id || ''} ${sede.codice || ''} ${sede.nome || ''} ${sede.comune || ''}`;
  const rawTokens = normalizeText(combined).split(' ').filter(Boolean);
  const out = new Set<string>();
  for (const tok of rawTokens) {
    if (tok.length < 4) continue;
    if (/^\d+$/.test(tok)) continue;
    if (GENERIC_SEDE_STOPWORDS.has(tok)) continue;
    out.add(tok);
    // Gestione varianti "lejare" <-> "jare"
    if (tok === 'lejare') out.add('jare');
  }
  return Array.from(out);
}

/**
 * Determina se una comunicazione appartiene alla Bacheca Associativa (Sede Centrale / Tutte le Sezioni).
 */
export function isComunicazioneAssociativaCentrale(com: ComunicazioneBacheca): boolean {
  const tid = normalizeText(com.sezioneTargetId);
  const tnome = normalizeText(com.sezioneTargetNome);
  return (
    !tid ||
    tid === 'tutte' ||
    tid === 'all' ||
    tid === 'generale' ||
    tid === 'associazione' ||
    tid === 'sede centrale' ||
    tnome.includes('tutte le sezioni') ||
    tnome.includes('sede centrale')
  );
}

/**
 * Determina se una comunicazione appartiene alla Bacheca della singola Sezione specificata.
 */
export function matchesComunicazioneSezione(
  com: ComunicazioneBacheca,
  sede: SedeAssociativaCompleta | null | undefined
): boolean {
  if (!sede) return false;
  if (isComunicazioneAssociativaCentrale(com)) return false;

  const targetId = String(com.sezioneTargetId || '').trim().toLowerCase();
  const sedeId = String(sede.id || '').trim().toLowerCase();
  if (targetId && sedeId && targetId === sedeId) return true;

  const normTargetNome = normalizeText(com.sezioneTargetNome);
  const normSedeNome = normalizeText(sede.nome);
  if (normTargetNome && normSedeNome) {
    if (normTargetNome === normSedeNome || normTargetNome.includes(normSedeNome) || normSedeNome.includes(normTargetNome)) {
      return true;
    }
  }

  const sedeTokens = extractDistinctiveTokens(sede);
  if (sedeTokens.length > 0) {
    const haystack = `${normalizeText(com.sezioneTargetId)} ${normTargetNome}`;
    return sedeTokens.some((tok) => haystack.includes(tok));
  }

  return false;
}

/**
 * Abbina in modo intelligente una timbratura (campo `sede` / `sedeUscita`) alla singola Sezione selezionata.
 * Gestisce automaticamente nomi abbreviati o storici (es. "Le Jare", "Ronchi", "Fossone", "Carrara", "Monteverde").
 */
export function matchesSedeTimbratura(
  timbratura: Pick<TimbraturaVolontario, 'sede' | 'sedeUscita'>,
  sede: SedeAssociativaCompleta | null | undefined
): boolean {
  if (!sede) return true;
  const testoSedeTimb = normalizeText(`${timbratura.sede || ''} ${timbratura.sedeUscita || ''}`);
  if (!testoSedeTimb) return false;

  const normSedeNome = normalizeText(sede.nome);
  const normSedeId = normalizeText(sede.id);
  const normSedeCodice = normalizeText(sede.codice);

  if (normSedeNome && (testoSedeTimb.includes(normSedeNome) || normSedeNome.includes(testoSedeTimb))) {
    return true;
  }
  if (normSedeId && testoSedeTimb.includes(normSedeId)) return true;
  if (normSedeCodice && testoSedeTimb.includes(normSedeCodice)) return true;

  const sedeTokens = extractDistinctiveTokens(sede);
  if (sedeTokens.length > 0) {
    return sedeTokens.some((tok) => testoSedeTimb.includes(tok));
  }

  // Fallback sul comune se la sede non ha token distintivi più specifici
  const normComune = normalizeText(sede.comune);
  if (normComune && normComune.length >= 4 && testoSedeTimb.includes(normComune)) {
    return true;
  }

  return false;
}

/**
 * Verifica se una timbratura chiusa (con uscita) rientra nella finestra temporale configurata sul Raspberry.
 */
export function isTimbraturaUscitaInFinestra(
  timbratura: Pick<TimbraturaVolontario, 'data' | 'orarioIngresso' | 'orarioUscita'>,
  finestra: RaspberryDisplayConfig['finestraUsciti'],
  nowDate: Date = new Date()
): boolean {
  if (!timbratura.orarioUscita) return false;
  const oggiIT = formatISODateItaly(nowDate);

  if (finestra === 'oggi') {
    return timbratura.data === oggiIT;
  }

  const maxOre = finestra === '12h' ? 12 : 24;
  try {
    const timePart = timbratura.orarioUscita.length === 5
      ? `${timbratura.orarioUscita}:00`
      : timbratura.orarioUscita.slice(0, 8);
    const dt = new Date(`${timbratura.data}T${timePart}`);
    if (!Number.isNaN(dt.getTime())) {
      const diffMs = nowDate.getTime() - dt.getTime();
      return diffMs >= -3600_000 && diffMs <= maxOre * 3600_000;
    }
  } catch {}

  return timbratura.data === oggiIT;
}

/**
 * Calcola la durata trascorsa dall'ingresso (per volontari attualmente presenti di turno).
 */
export function calcolaDurataLiveDaIngresso(
  dataIso: string,
  orarioIngresso: string,
  nowDate: Date = new Date()
): string {
  try {
    const timePart = orarioIngresso.length === 5 ? `${orarioIngresso}:00` : orarioIngresso.slice(0, 8);
    const start = new Date(`${dataIso}T${timePart}`);
    if (Number.isNaN(start.getTime())) return '';
    const diffMin = Math.max(0, Math.floor((nowDate.getTime() - start.getTime()) / 60000));
    const ore = Math.floor(diffMin / 60);
    const min = diffMin % 60;
    if (ore <= 0) return `${min}m`;
    return `${ore}h ${String(min).padStart(2, '0')}m`;
  } catch {
    return '';
  }
}

export function formatOraBreve(orario?: string): string {
  if (!orario) return '--:--';
  const clean = String(orario).trim();
  if (clean.length >= 5) return clean.slice(0, 5);
  return clean;
}

export const NFC_AUTO_CHIUSURA_MS = 24 * 60 * 60 * 1000;

/**
 * Riconosce se una timbratura è stata effettuata tramite lettore NFC.
 */
export function isTimbraturaNfc(
  t?: Partial<TimbraturaVolontario> | null
): boolean {
  if (!t) return false;
  if (t.metodoTimbratura === 'nfc') return true;
  const noteNorm = String(t.note || '').toLowerCase();
  if (noteNorm.includes('[nfc]') || noteNorm.includes('lettore nfc')) return true;
  return false;
}

/**
 * Converte data (YYYY-MM-DD) + orario (HH:mm[:ss]) in timestamp ms.
 */
export function parseTimbraturaDateTimeMs(dataIso?: string, orario?: string): number | null {
  if (!dataIso || !orario) return null;
  const d = String(dataIso).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const rawTime = String(orario).trim();
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(rawTime);
  if (!m) return null;
  const hh = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  const ss = (m[3] || '00').padStart(2, '0');
  const dt = new Date(`${d}T${hh}:${mm}:${ss}`);
  return Number.isNaN(dt.getTime()) ? null : dt.getTime();
}

/**
 * Determina se una timbratura NFC in ingresso senza uscita ha superato le 24 ore:
 * in tal caso viene considerata chiusa automaticamente lato presenza/display,
 * MA senza scrivere orarioUscita sul file timbrature e con validità ZERO sui conteggi presenze.
 */
export function isTimbraturaNfcScaduta24h(
  t?: Partial<TimbraturaVolontario> | null,
  nowDate: Date = new Date()
): boolean {
  if (!t) return false;
  if (t.orarioUscita && String(t.orarioUscita).trim() !== '') return false;
  if (t.autoChiusuraNfc24h === true) return true;
  if (!isTimbraturaNfc(t)) return false;
  const startMs = parseTimbraturaDateTimeMs(t.data, t.orarioIngresso);
  if (startMs === null) return false;
  return nowDate.getTime() - startMs >= NFC_AUTO_CHIUSURA_MS;
}

/**
 * Verifica se un volontario è attualmente PRESENTE in sede/turno
 * (ha badgiato l'entrata via App o NFC, non ha ancora timbrato l'uscita,
 * e se è NFC non ha superato le 24h senza uscita).
 */
export function isTimbraturaAttualmentePresente(
  t?: Partial<TimbraturaVolontario> | null,
  nowDate: Date = new Date()
): boolean {
  if (!t) return false;
  if (t.orarioUscita && String(t.orarioUscita).trim() !== '') return false;
  if (isTimbraturaNfcScaduta24h(t, nowDate)) return false;
  return true;
}

/**
 * Verifica se una timbratura ha una timbratura di uscita valida
 * (esclude le chiusure automatiche NFC >24h che non hanno alcuna validità nei conteggi presenze).
 */
export function isTimbraturaConUscitaValida(
  t?: Partial<TimbraturaVolontario> | null
): boolean {
  if (!t) return false;
  if (t.autoChiusuraNfc24h === true) return false;
  return Boolean(t.orarioUscita && String(t.orarioUscita).trim() !== '');
}

/**
 * Applica la chiusura automatica presenza >24h sulle timbrature NFC rimaste aperte.
 * NON imposta orarioUscita, NON imposta sedeUscita, NON imposta oreTotali/oreEMinuti:
 * così sul file timbrature compare regolarmente l'entrata SENZA uscita e con validità 0 nei conteggi.
 */
export function applicaAutoChiusuraNfc24hSuLista(
  lista: TimbraturaVolontario[],
  nowDate: Date = new Date()
): { listaAggiornata: TimbraturaVolontario[]; modificateCount: number } {
  if (!Array.isArray(lista) || lista.length === 0) {
    return { listaAggiornata: lista || [], modificateCount: 0 };
  }
  let modificateCount = 0;
  const listaAggiornata = lista.map((t) => {
    if (!t || (t.orarioUscita && String(t.orarioUscita).trim() !== '')) return t;
    if (t.autoChiusuraNfc24h === true) return t;
    if (!isTimbraturaNfc(t)) return t;
    const startMs = parseTimbraturaDateTimeMs(t.data, t.orarioIngresso);
    if (startMs === null) return t;
    if (nowDate.getTime() - startMs >= NFC_AUTO_CHIUSURA_MS) {
      modificateCount += 1;
      const clean: TimbraturaVolontario = {
        ...t,
        orarioUscita: undefined,
        sedeUscita: undefined,
        oreTotali: undefined,
        oreEMinuti: undefined,
        autoChiusuraNfc24h: true,
        autoChiusuraNfc24hAt: new Date(startMs + NFC_AUTO_CHIUSURA_MS).toISOString(),
      };
      return clean;
    }
    return t;
  });
  return { listaAggiornata, modificateCount };
}

/**
 * Deduce la data di uscita effettiva (gestendo automaticamente i turni notturni che superano la mezzanotte).
 */
export function inferDataUscitaTimbratura(
  t: Pick<TimbraturaVolontario, 'data' | 'dataUscita' | 'orarioIngresso' | 'orarioUscita'>
): string {
  if (t.dataUscita && /^\d{4}-\d{2}-\d{2}$/.test(t.dataUscita.trim())) {
    return t.dataUscita.trim();
  }
  const baseData = String(t.data || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseData)) return baseData;
  if (t.orarioIngresso && t.orarioUscita) {
    const inPart = t.orarioIngresso.trim().slice(0, 5);
    const outPart = t.orarioUscita.trim().slice(0, 5);
    if (outPart < inPart) {
      return addDaysISODate(baseData, 1);
    }
  }
  return baseData;
}

/**
 * Formatta una data ISO (YYYY-MM-DD) con giorno della settimana abbreviato + data italiana (es. "Dom 22/11/2026").
 */
export function formatGiornoDataBreveIt(iso?: string): string {
  const clean = String(iso || '').trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  if (!m) return clean || '—';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const giorni = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const g = giorni[dt.getUTCDay()] || '';
  return `${g} ${m[3]}/${m[2]}/${m[1]}`;
}

// ============================================================================
// GENERAZIONE FILE CONFIGURAZIONE WI-FI PER RASPBERRY PI (PER SINGOLA SEZIONE)
// ============================================================================

export function slugifyNomeSedeFile(nome?: string): string {
  return (
    String(nome || 'sezione')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'sezione'
  );
}

function escapeWpaQuoted(val: string): string {
  return String(val || '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]/g, '');
}

function escapeShellSingleQuote(val: string): string {
  return `'${String(val || '').replace(/'/g, `'\\''`)}'`;
}

function buildDeterministicUuid(seed: string): string {
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  const part = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const hex = `${part(h1)}${part(h2)}${part(h1 ^ h2)}${part(h1 + h2)}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export interface RaspberryWifiParams {
  ssid: string;
  password: string;
  sicurezza?: 'WPA-PSK' | 'SAE' | 'NONE';
  country?: string;
  sedeNome?: string;
  kioskUrl?: string;
}

/**
 * Genera il file standard Raspberry Pi `wpa_supplicant.conf` (LF Unix)
 * pronto da copiare nella partizione /boot della microSD.
 */
export function generaContenutoWpaSupplicant(params: RaspberryWifiParams): string {
  const ssid = escapeWpaQuoted(params.ssid.trim());
  const password = escapeWpaQuoted(params.password);
  const country = (params.country || 'IT').trim().toUpperCase().slice(0, 2) || 'IT';
  const sec = params.sicurezza || (params.password ? 'WPA-PSK' : 'NONE');

  const lines: string[] = [
    `# Configurazione Wi-Fi Raspberry Pi - Croce Oro Massa Carrara OdV`,
    ...(params.sedeNome ? [`# Sezione: ${params.sedeNome.replace(/[\r\n]/g, ' ')}`] : []),
    `ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev`,
    `update_config=1`,
    `country=${country}`,
    ``,
    `network={`,
    `    ssid="${ssid}"`,
  ];

  if (sec === 'NONE' || !params.password) {
    lines.push(`    key_mgmt=NONE`);
  } else if (sec === 'SAE') {
    lines.push(`    psk="${password}"`);
    lines.push(`    key_mgmt=SAE`);
    lines.push(`    ieee80211w=2`);
  } else {
    lines.push(`    psk="${password}"`);
    lines.push(`    key_mgmt=WPA-PSK`);
  }

  lines.push(`    scan_ssid=1`);
  lines.push(`    priority=10`);
  lines.push(`}`);
  lines.push(``);
  return lines.join('\n');
}

/**
 * Genera il profilo NetworkManager `.nmconnection` per Raspberry Pi OS Bookworm / Trixie
 * pronto per /etc/NetworkManager/system-connections/ (permessi 600).
 */
export function generaContenutoNmConnection(params: RaspberryWifiParams): string {
  const ssidClean = params.ssid.trim().replace(/[\r\n]/g, '');
  const passClean = params.password.replace(/[\r\n]/g, '');
  const slug = slugifyNomeSedeFile(params.sedeNome || ssidClean);
  const connId = `CroceOro-WiFi-${slug}`;
  const uuid = buildDeterministicUuid(`${connId}:${ssidClean}`);
  const sec = params.sicurezza || (passClean ? 'WPA-PSK' : 'NONE');

  const lines: string[] = [
    `[connection]`,
    `id=${connId}`,
    `uuid=${uuid}`,
    `type=wifi`,
    `autoconnect=true`,
    `autoconnect-priority=10`,
    ``,
    `[wifi]`,
    `mode=infrastructure`,
    `ssid=${ssidClean}`,
    ``,
  ];

  if (sec !== 'NONE' && passClean) {
    lines.push(`[wifi-security]`);
    lines.push(`key-mgmt=${sec === 'SAE' ? 'sae' : 'wpa-psk'}`);
    lines.push(`psk=${passClean}`);
    lines.push(``);
  }

  lines.push(`[ipv4]`);
  lines.push(`method=auto`);
  lines.push(``);
  lines.push(`[ipv6]`);
  lines.push(`addr-gen-mode=default`);
  lines.push(`method=auto`);
  lines.push(``);
  return lines.join('\n');
}

/**
 * Genera script Bash automatico (compatibile sia con Raspberry Pi OS Bookworm/NetworkManager che Bullseye/wpa_supplicant)
 * per collegare il Raspberry al Wi-Fi associativo della singola sezione in un solo comando.
 */
export function generaScriptSetupWifiRaspberry(params: RaspberryWifiParams): string {
  const ssid = params.ssid.trim();
  const password = params.password;
  const country = (params.country || 'IT').trim().toUpperCase().slice(0, 2) || 'IT';
  const sec = params.sicurezza || (password ? 'WPA-PSK' : 'NONE');
  const slug = slugifyNomeSedeFile(params.sedeNome || ssid);
  const wpaContent = generaContenutoWpaSupplicant(params);
  const nmContent = generaContenutoNmConnection(params);

  const lines: string[] = [
    `#!/usr/bin/env bash`,
    `# Script configurazione automatica Wi-Fi Raspberry Pi - Croce Oro Massa Carrara OdV`,
    `# Sezione: ${(params.sedeNome || 'Sezione').replace(/[\r\n]/g, ' ')}`,
    `# Uso sul Raspberry: sudo bash setup-wifi-raspberry-${slug}.sh`,
    `set -euo pipefail`,
    ``,
    `if [ "$(id -u)" -ne 0 ]; then`,
    `  echo "Esegui con sudo: sudo bash $0"`,
    `  exit 1`,
    `fi`,
    ``,
    `echo "==> Configurazione Wi-Fi associativo (${(params.sedeNome || slug).replace(/["`$\\]/g, '')})..."`,
    `if command -v raspi-config >/dev/null 2>&1; then`,
    `  raspi-config nonint do_wifi_country ${country} || true`,
    `fi`,
    `rfkill unblock wifi || true`,
    ``,
    `# 1) Raspberry Pi OS Bookworm / Trixie (NetworkManager)`,
    `if command -v nmcli >/dev/null 2>&1 && systemctl is-active --quiet NetworkManager; then`,
    `  NM_FILE="/etc/NetworkManager/system-connections/CroceOro-WiFi-${slug}.nmconnection"`,
    `  cat <<'EOF_NM' > "$NM_FILE"`,
    nmContent.trimEnd(),
    `EOF_NM`,
    `  chmod 600 "$NM_FILE"`,
    `  chown root:root "$NM_FILE"`,
    `  nmcli connection reload || true`,
    `  nmcli device wifi rescan || true`,
    ...(sec === 'NONE' || !password
      ? [`  nmcli device wifi connect ${escapeShellSingleQuote(ssid)} || nmcli connection up "CroceOro-WiFi-${slug}" || true`]
      : [`  nmcli connection up "CroceOro-WiFi-${slug}" || nmcli device wifi connect ${escapeShellSingleQuote(ssid)} password ${escapeShellSingleQuote(password)} || true`]),
    `  echo "OK: Profilo NetworkManager installato in $NM_FILE"`,
    `else`,
    `  # 2) Raspberry Pi OS Legacy / Bullseye (wpa_supplicant)`,
    `  cat <<'EOF_WPA' > /etc/wpa_supplicant/wpa_supplicant.conf`,
    wpaContent.trimEnd(),
    `EOF_WPA`,
    `  chmod 600 /etc/wpa_supplicant/wpa_supplicant.conf`,
    `  wpa_cli -i wlan0 reconfigure || systemctl restart dhcpcd || true`,
    `  echo "OK: File /etc/wpa_supplicant/wpa_supplicant.conf aggiornato"`,
    `fi`,
    ``,
    ...(params.kioskUrl
      ? [
          `echo ""`,
          `echo "Link Display Sezione pronto per Chromium Kiosk:"`,
          `echo "  ${params.kioskUrl}"`,
        ]
      : []),
    `echo "Configurazione Wi-Fi completata!"`,
    ``,
  ];

  return lines.join('\n');
}

/**
 * Scarica un file di testo con fine riga Unix LF (\n) garantito per Raspberry Pi / Linux.
 */
export function scaricaFileTestoLinux(filename: string, content: string): void {
  const unixContent = String(content || '').replace(/\r\n/g, '\n');
  const blob = new Blob([unixContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

