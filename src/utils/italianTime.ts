/**
 * Gestione centralizzata dell'orario ufficiale italiano (Europe/Rome)
 * con passaggio automatico tra Ora Solare (CET • UTC+1) e Ora Legale (CEST • UTC+2).
 *
 * Garantisce che l'intera app (orologi, timbrature, giornale di bordo, turni,
 * email, notifiche, servizi e PDF) utilizzi sempre il fuso orario italiano ufficiale
 * indipendentemente dal fuso orario del server container o del dispositivo utente.
 */

export const ITALY_TIMEZONE = 'Europe/Rome';

export interface ItalianDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  yyyy: string;
  mm: string;
  dd: string;
  hh: string;
  min: string;
  ss: string;
  isoDate: string;          // YYYY-MM-DD in fuso Europe/Rome
  dateIt: string;           // DD/MM/YYYY in fuso Europe/Rome
  timeIt: string;           // HH:mm:ss in fuso Europe/Rome
  timeShortIt: string;      // HH:mm in fuso Europe/Rome
  dateTimeIt: string;       // DD/MM/YYYY HH:mm:ss in fuso Europe/Rome
  tomorrowIsoDate: string;  // YYYY-MM-DD del giorno successivo in Europe/Rome
  yesterdayIsoDate: string; // YYYY-MM-DD del giorno precedente in Europe/Rome
  isOraLegale: boolean;     // true durante Ora Legale (CEST UTC+2), false durante Ora Solare (CET UTC+1)
  fasciaOraLabel: string;   // 'Ora Legale (CEST • UTC+2)' | 'Ora Solare (CET • UTC+1)'
  fasciaOraShort: string;   // 'Ora Legale (UTC+2)' | 'Ora Solare (UTC+1)'
  offsetMinutes: number;    // 120 in Ora Legale, 60 in Ora Solare
}

const romePartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ITALY_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function toValidDate(input?: Date | number | string): Date {
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? new Date() : input;
  }
  if (typeof input === 'number' || typeof input === 'string') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  return new Date();
}

function extractRawRomeParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = romePartsFormatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  const year = parseInt(map.year || '1970', 10);
  const month = parseInt(map.month || '1', 10);
  const day = parseInt(map.day || '1', 10);
  let hour = parseInt(map.hour || '0', 10);
  if (hour === 24) hour = 0;
  const minute = parseInt(map.minute || '0', 10);
  const second = parseInt(map.second || '0', 10);
  return { year, month, day, hour, minute, second };
}

/**
 * Calcola l'offset esatto in minuti di Europe/Rome rispetto a UTC nell'istante specificato:
 * 60 = Ora Solare (CET, UTC+1)
 * 120 = Ora Legale (CEST, UTC+2)
 */
export function getItalyOffsetMinutes(date: Date = new Date()): number {
  const d = toValidDate(date);
  const p = extractRawRomeParts(d);
  const romeAsUtcSec = Math.floor(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) / 1000);
  const realUtcSec = Math.floor(d.getTime() / 1000);
  return Math.round((romeAsUtcSec - realUtcSec) / 60);
}

/**
 * Restituisce true se l'istante ricade nell'Ora Legale italiana (CEST, UTC+2),
 * false se ricade nell'Ora Solare italiana (CET, UTC+1).
 */
export function isOraLegaleItaly(date: Date = new Date()): boolean {
  return getItalyOffsetMinutes(date) >= 120;
}

/**
 * Aggiunge o sottrae giorni di calendario ad una data ISO YYYY-MM-DD in modo immune al DST.
 */
export function addDaysISODate(isoDate: string, deltaDays: number): string {
  const m = (isoDate || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return isoDate;
  const dt = new Date(Date.UTC(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10) + deltaDays, 12, 0, 0));
  const y = dt.getUTCFullYear();
  const mon = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${mon}-${day}`;
}

/**
 * Estrae tutte le componenti di data e ora nel fuso italiano ufficiale (Europe/Rome)
 * completo di indicazione automatica Ora Legale / Ora Solare.
 */
export function getItalianDateParts(input?: Date | number | string): ItalianDateParts {
  const d = toValidDate(input);
  const { year, month, day, hour, minute, second } = extractRawRomeParts(d);
  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const min = String(minute).padStart(2, '0');
  const ss = String(second).padStart(2, '0');

  const isoDate = `${yyyy}-${mm}-${dd}`;
  const dateIt = `${dd}/${mm}/${yyyy}`;
  const timeIt = `${hh}:${min}:${ss}`;
  const timeShortIt = `${hh}:${min}`;
  const dateTimeIt = `${dateIt} ${timeIt}`;

  // Calcolo giorni adiacenti dal calendario italiano a mezzogiorno UTC (evita salti ai cambi ora 23h/25h)
  const tomorrowIsoDate = addDaysISODate(isoDate, 1);
  const yesterdayIsoDate = addDaysISODate(isoDate, -1);

  const offsetMinutes = getItalyOffsetMinutes(d);
  const isOraLegale = offsetMinutes >= 120;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    yyyy,
    mm,
    dd,
    hh,
    min,
    ss,
    isoDate,
    dateIt,
    timeIt,
    timeShortIt,
    dateTimeIt,
    tomorrowIsoDate,
    yesterdayIsoDate,
    isOraLegale,
    fasciaOraLabel: isOraLegale ? 'Ora Legale (CEST • UTC+2)' : 'Ora Solare (CET • UTC+1)',
    fasciaOraShort: isOraLegale ? 'Ora Legale (UTC+2)' : 'Ora Solare (UTC+1)',
    offsetMinutes,
  };
}

/**
 * Formatta un'ora in formato italiano HH:mm o HH:mm:ss nel fuso Europe/Rome (auto DST).
 */
export function formatTimeItaly(input?: Date | number | string, includeSeconds = true): string {
  const p = getItalianDateParts(input);
  return includeSeconds ? p.timeIt : p.timeShortIt;
}

/**
 * Formatta una data in formato italiano DD/MM/YYYY nel fuso Europe/Rome (auto DST).
 */
export function formatDateItaly(input?: Date | number | string): string {
  return getItalianDateParts(input).dateIt;
}

/**
 * Formatta una data e ora in formato italiano DD/MM/YYYY HH:mm:ss nel fuso Europe/Rome (auto DST).
 */
export function formatDateTimeItaly(input?: Date | number | string, includeSeconds = true): string {
  const p = getItalianDateParts(input);
  return includeSeconds ? `${p.dateIt} ${p.timeIt}` : `${p.dateIt} ${p.timeShortIt}`;
}

/**
 * Restituisce la data ISO YYYY-MM-DD in Italia (Europe/Rome).
 * Evita gli sfasamenti di `.toISOString().slice(0, 10)` attorno alla mezzanotte UTC.
 */
export function formatISODateItaly(input?: Date | number | string): string {
  return getItalianDateParts(input).isoDate;
}

/**
 * Restituisce l'anno corrente secondo il calendario italiano (Europe/Rome).
 */
export function getCurrentYearItaly(input?: Date | number | string): number {
  return getItalianDateParts(input).year;
}

/**
 * Converte data ISO (YYYY-MM-DD) + orario ("HH:mm" o "HH:mm:ss") espressi in ora italiana (Europe/Rome)
 * nel timestamp UTC esatto in millisecondi, tenendo conto automaticamente di Ora Solare (UTC+1) e Ora Legale (UTC+2).
 */
export function parseItalianDateTimeMs(dateISO: string, timeStr?: string): number | null {
  const dateMatch = (dateISO || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = (timeStr || '').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!dateMatch || !timeMatch) return null;

  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const day = parseInt(dateMatch[3], 10);
  const hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
  const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;

  if ([year, month, day, hours, minutes, seconds].some(Number.isNaN) || hours > 24 || minutes > 59 || seconds > 59) {
    return null;
  }

  const utcGuess = Date.UTC(year, month - 1, day, hours, minutes, seconds, 0);
  const off1 = getItalyOffsetMinutes(new Date(utcGuess)) * 60000;
  const candidate = utcGuess - off1;
  const off2 = getItalyOffsetMinutes(new Date(candidate)) * 60000;
  return utcGuess - off2;
}
