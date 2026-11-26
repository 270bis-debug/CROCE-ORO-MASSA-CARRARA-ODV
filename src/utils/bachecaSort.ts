import { ComunicazioneBacheca } from '../types/adminTypes';

/**
 * Estrae un timestamp numerico affidabile (ms) per l'ordinamento cronologico dei post in bacheca.
 * Supporta date in formato ISO (YYYY-MM-DD) o italiano (DD/MM/YYYY), ora (HH:mm o HH:mm:ss),
 * e utilizza il timestamp embedded nell'id (com-<epochMs>) o createdAt/updatedAt come tie-breaker
 * preciso quando due post vengono pubblicati nello stesso minuto.
 */
export function getComunicazioneSortTimestamp(com: Partial<ComunicazioneBacheca> | any): number {
  if (!com || typeof com !== 'object') return 0;

  let dateMs = 0;
  const rawDate = typeof com.dataPubblicazione === 'string' ? com.dataPubblicazione.trim() : '';
  const rawTime = typeof com.oraPubblicazione === 'string' ? com.oraPubblicazione.trim() : '';

  let year = 0;
  let month = 0;
  let day = 0;

  const isoMatch = rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const itMatch = !isoMatch ? rawDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/) : null;

  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else if (itMatch) {
    day = Number(itMatch[1]);
    month = Number(itMatch[2]);
    year = Number(itMatch[3]);
  }

  if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    let hours = 0;
    let minutes = 0;
    let seconds = 0;
    const timeMatch = rawTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      hours = Math.min(23, Math.max(0, Number(timeMatch[1])));
      minutes = Math.min(59, Math.max(0, Number(timeMatch[2])));
      seconds = timeMatch[3] ? Math.min(59, Math.max(0, Number(timeMatch[3]))) : 0;
    }
    const parsed = Date.UTC(year, month - 1, day, hours, minutes, seconds);
    if (Number.isFinite(parsed)) {
      dateMs = parsed;
    }
  }

  // Tie-breaker sub-minuto: estrai epoch ms dall'ID (es. com-1795726873500-123) se presente
  let idEpochMs = 0;
  if (typeof com.id === 'string') {
    const idMatch = com.id.match(/(\d{13})/);
    if (idMatch) {
      const candidate = Number(idMatch[1]);
      if (Number.isFinite(candidate) && candidate > 1_600_000_000_000) {
        idEpochMs = candidate;
      }
    }
  }

  if (dateMs > 0) {
    // Se l'ID contiene un timestamp dello stesso giorno/minuto, preserva i secondi/ms reali per disambiguare
    if (idEpochMs > 0 && Math.abs(idEpochMs - dateMs) < 24 * 3600 * 1000) {
      return idEpochMs;
    }
    return dateMs;
  }

  if (idEpochMs > 0) return idEpochMs;
  if (typeof com.createdAt === 'number' && Number.isFinite(com.createdAt)) return com.createdAt;
  if (typeof com.updatedAt === 'number' && Number.isFinite(com.updatedAt)) return com.updatedAt;
  return 0;
}

/**
 * Ordinamento ufficiale Bacheca Croce Oro:
 * 1. Prima i post fissati in alto (evidenziata === true), ordinati dal più recente al meno recente.
 * 2. Subito dopo tutti gli altri post in stretto ordine cronologico decrescente (più recente in alto).
 */
export function sortComunicazioniBacheca<T extends Partial<ComunicazioneBacheca>>(list: T[]): T[] {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const pinA = Boolean(a?.evidenziata);
    const pinB = Boolean(b?.evidenziata);
    if (pinA !== pinB) return pinA ? -1 : 1;

    const tsA = getComunicazioneSortTimestamp(a);
    const tsB = getComunicazioneSortTimestamp(b);
    if (tsA !== tsB) return tsB - tsA;

    const dtA = `${a?.dataPubblicazione || ''} ${a?.oraPubblicazione || ''}`;
    const dtB = `${b?.dataPubblicazione || ''} ${b?.oraPubblicazione || ''}`;
    const cmp = dtB.localeCompare(dtA);
    if (cmp !== 0) return cmp;

    return String(b?.id || '').localeCompare(String(a?.id || ''));
  });
}
