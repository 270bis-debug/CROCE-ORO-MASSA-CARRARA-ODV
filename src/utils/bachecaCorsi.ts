import { CorsoFormazione } from '../types/adminTypes';
import { formatISODateItaly } from './italianTime';

export interface NotificaBachecaRecord {
  id: string;
  tipo: 'nuovo_post' | 'nuovo_corso' | 'nuovo_commento';
  postId: string;
  postTitolo: string;
  messaggio: string;
  autoreCommento?: string;
  testoCommento?: string;
  destinatariVolontariIds?: string[];
  destinatariVolontariNomi?: string[];
  dataInizio?: string;
  tipologia?: string;
  sedeCorso?: string;
  soloInApp?: boolean;
  createdAt: number;
}

/**
 * Normalizza una stringa data (YYYY-MM-DD, DD/MM/YYYY o ISO) in formato YYYY-MM-DD.
 */
export function normalizeCourseDateISO(raw?: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // YYYY-MM-DD o prefisso ISO
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // DD/MM/YYYY o DD-MM-YYYY
  const itMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (itMatch) {
    const [, d, m, y] = itMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return '';
}

/**
 * Restituisce la data di inizio effettiva del corso (YYYY-MM-DD),
 * usando `dataInizio` o, in mancanza, la prima lezione programmata.
 */
export function getDataInizioEffettivaCorso(corso?: Partial<CorsoFormazione> | null): string {
  if (!corso) return '';
  const direct = normalizeCourseDateISO(corso.dataInizio);
  if (direct) return direct;

  if (Array.isArray(corso.lezioni) && corso.lezioni.length > 0) {
    const dateValide = corso.lezioni
      .map((l) => normalizeCourseDateISO(l?.data))
      .filter(Boolean)
      .sort();
    if (dateValide.length > 0) return dateValide[0];
  }

  return '';
}

/**
 * Determina se un corso o percorso di formazione deve essere mostrato in Bacheca:
 * - Stato non Annullato e non Concluso
 * - Data di inizio >= giorno corrente in Italia (visibile fino al giorno stesso in cui inizia, poi rimosso automaticamente)
 */
export function isCorsoVisibileInBacheca(
  corso?: Partial<CorsoFormazione> | null,
  oggiISO?: string
): boolean {
  if (!corso || !corso.id || !corso.titolo) return false;
  if (corso.stato === 'Annullato' || corso.stato === 'Concluso') return false;

  const startIso = getDataInizioEffettivaCorso(corso);
  if (!startIso) return false;

  const today = normalizeCourseDateISO(oggiISO) || formatISODateItaly(new Date());
  return startIso >= today;
}

/**
 * Restituisce i prossimi corsi / formazione in programma visibili in Bacheca,
 * ordinati dal più imminente al più lontano.
 */
export function getCorsiVisibiliInBacheca(
  corsi?: CorsoFormazione[] | null,
  oggiISO?: string
): CorsoFormazione[] {
  if (!Array.isArray(corsi) || corsi.length === 0) return [];
  const today = normalizeCourseDateISO(oggiISO) || formatISODateItaly(new Date());

  return corsi
    .filter((c) => isCorsoVisibileInBacheca(c, today))
    .sort((a, b) => {
      const dateA = getDataInizioEffettivaCorso(a);
      const dateB = getDataInizioEffettivaCorso(b);
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const oraA = a.orarioInizioLezione || '00:00';
      const oraB = b.orarioInizioLezione || '00:00';
      if (oraA !== oraB) return oraA.localeCompare(oraB);
      return (a.titolo || '').localeCompare(b.titolo || '', 'it');
    });
}

/**
 * Formatta una data YYYY-MM-DD in DD/MM/YYYY.
 */
export function formatDataItalianaCorso(raw?: string): string {
  const iso = normalizeCourseDateISO(raw);
  if (!iso) return raw || 'Da definire';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Calcola il numero di giorni interi tra oggi (Italia) e la data di inizio del corso.
 * 0 = oggi, 1 = domani, >1 = tra N giorni.
 */
export function calcolaGiorniAlCorso(raw?: string, oggiISO?: string): number {
  const startIso = normalizeCourseDateISO(raw);
  if (!startIso) return 0;
  const today = normalizeCourseDateISO(oggiISO) || formatISODateItaly(new Date());

  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const todayUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((startUtc - todayUtc) / (24 * 60 * 60 * 1000));
}

/**
 * Fonde e deduplica in modo non distruttivo le notifiche recenti della bacheca
 * (post e corsi/formazione pubblicati), mantenendo le ultime 30 più recenti.
 */
export function mergeNotificheBachecaRecenti(
  prev?: NotificaBachecaRecord[] | null,
  incoming?: NotificaBachecaRecord[] | null
): NotificaBachecaRecord[] {
  const map = new Map<string, NotificaBachecaRecord>();
  const addList = (list?: NotificaBachecaRecord[] | null) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!item || typeof item !== 'object' || !item.postTitolo) continue;
      const key =
        (item.id && String(item.id).trim()) ||
        `${item.tipo || 'nuovo_post'}-${item.postId || ''}-${item.createdAt || 0}`;
      const existing = map.get(key);
      if (!existing || Number(item.createdAt || 0) >= Number(existing.createdAt || 0)) {
        map.set(key, {
          ...item,
          id: key,
          createdAt: Number(item.createdAt) || Date.now(),
        });
      }
    }
  };
  addList(prev);
  addList(incoming);

  return Array.from(map.values())
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 30);
}
