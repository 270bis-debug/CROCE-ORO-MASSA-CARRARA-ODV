import { TurnoSedeOperativa, TimbraturaVolontario } from '../types/adminTypes';
import { Volontario } from '../components/DatabaseVolontariModal';
import { formatISODateItaly, getItalianDateParts } from './italianTime';

export interface EsitoVerificaTurno {
  isDiTurno: boolean;
  motivo: string;
  dettaglioTurno?: {
    sedeNome?: string;
    fasciaOraria?: string;
    orarioInizio?: string;
    orarioFine?: string;
    ruoloAssegnato?: string;
    mezzoAssegnato?: string;
  };
}

/**
 * Converte una stringa oraria "HH:mm" in minuti totali trascorsi dalla mezzanotte.
 */
function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Formatta una data in stringa standard "YYYY-MM-DD".
 */
function toDateKey(d: Date): string {
  return formatISODateItaly(d);
}

/**
 * Normalizza il nome completo per confronti case-insensitive e spazi multipli.
 */
function normalizzaNome(str?: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Verifica se un volontario è assegnato a un determinato turno di sede.
 */
function trovaAssegnazioneVolontario(turno: TurnoSedeOperativa, vol: Volontario): string | null {
  const volId = vol.id;
  const volNomeCompleto = normalizzaNome(`${vol.nome} ${vol.cognome}`);

  const check = (slot?: { id?: string; nome?: string }, label?: string): boolean => {
    if (!slot) return false;
    if (slot.id && slot.id === volId) return true;
    if (slot.nome && normalizzaNome(slot.nome) === volNomeCompleto) return true;
    return false;
  };

  if (check(turno.autista, 'Autista')) return 'Autista';
  if (check(turno.caposervizio, 'Caposervizio')) return 'Caposervizio';
  if (check(turno.soccorritore2, 'Secondo Soccorritore')) return 'Secondo Soccorritore';
  if (check(turno.terzoSoccorritore, 'Terzo Soccorritore')) return 'Terzo Soccorritore';
  if (check(turno.operatoreCentrale, 'Operatore Centrale')) return 'Operatore Centrale';
  if (check(turno.centralinista, 'Centralinista')) return 'Centralinista';
  if (check(turno.osservatore, 'Osservatore')) return 'Osservatore';

  if (turno.richiesteIscrizione && turno.richiesteIscrizione.length > 0) {
    const approvata = turno.richiesteIscrizione.find(r =>
      r.stato === 'Approvato' &&
      (r.volontarioId === volId || normalizzaNome(r.volontarioNome) === volNomeCompleto)
    );
    if (approvata) {
      return approvata.ruoloRichiesto ? String(approvata.ruoloRichiesto) : 'Soccorritore';
    }
  }

  return null;
}

/**
 * Determina se il volontario specificato è di turno in questo preciso momento.
 *
 * Controlla in ordine:
 * 1. Timbrature di presenza GPS attive (ingresso timbrato senza uscita per oggi).
 * 2. Flag di turno attivo sul profilo del volontario (vol.inTurno).
 * 3. Tabellone Turni delle Sedi Operative (TurnoSedeOperativa):
 *    - Data corrispondente a oggi (o ieri sera per turni notturni che scavalcano mezzanotte).
 *    - Volontario regolarmente assegnato in uno dei ruoli del turno.
 *    - Orario attuale compreso tra inizio turno (con 45 min di anticipo per check-in e ispezione) e fine turno (+30 min di grazia).
 */
export function verificaVolontarioInTurnoAdesso(
  vol: Volontario,
  listaTurni: TurnoSedeOperativa[] = [],
  listaTimbrature: TimbraturaVolontario[] = []
): EsitoVerificaTurno {
  if (!vol) {
    return { isDiTurno: false, motivo: 'Nessun nominativo selezionato' };
  }

  const now = new Date();
  const nowItaly = getItalianDateParts(now);
  const oggiStr = nowItaly.isoDate;
  const nowMinutes = nowItaly.hour * 60 + nowItaly.minute;

  // 1. Controllo timbrature di presenza del volontario (se ha timbrato l'ingresso e non ancora l'uscita)
  if (listaTimbrature && listaTimbrature.length > 0) {
    const volNomeCompleto = normalizzaNome(`${vol.nome} ${vol.cognome}`);
    const timbraturaAperta = listaTimbrature.find(t => {
      const matchId = t.volontarioId === vol.id;
      const matchNome = t.volontarioNome && normalizzaNome(t.volontarioNome) === volNomeCompleto;
      return (matchId || matchNome) && !t.orarioUscita && (t.data === oggiStr || !t.data);
    });

    if (timbraturaAperta) {
      return {
        isDiTurno: true,
        motivo: `Timbratura ingresso attiva dalle ore ${timbraturaAperta.orarioIngresso || 'inizio servizio'} presso ${timbraturaAperta.sede || 'la sede operativa'}`
      };
    }
  }

  // 2. Controllo flag inTurno sul profilo volontario
  if (vol.inTurno) {
    return {
      isDiTurno: true,
      motivo: 'Stato di servizio "In Turno" attivo sul profilo'
    };
  }

  // 3. Controllo nel Calendario Turni di tutte le sedi operative
  let turni: TurnoSedeOperativa[] = listaTurni;
  if (!turni || turni.length === 0) {
    try {
      const raw = localStorage.getItem('CROCE_ORO_TURNI_SEDI');
      if (raw) turni = JSON.parse(raw);
    } catch {}
  }

  if (turni && Array.isArray(turni) && turni.length > 0) {
    // Margine di anticipo login per briefing e controllo mezzo (45 minuti prima dell'inizio)
    const GRACE_BEFORE_MIN = 45;
    // Margine dopo termine turno (30 minuti dopo la fine per passaggio consegne)
    const GRACE_AFTER_MIN = 30;

    // Data di ieri per turni notturni (es. 20:00 - 08:00 iniziati ieri sera)
    const ieriStr = nowItaly.yesterdayIsoDate;

    for (const t of turni) {
      const ruoloAssegnato = trovaAssegnazioneVolontario(t, vol);
      if (!ruoloAssegnato) continue;

      const turnoDataStr = (t.data || '').trim();
      const isOggi = turnoDataStr === oggiStr;
      const isIeri = turnoDataStr === ieriStr;

      if (!isOggi && !isIeri) continue;

      const fascia = (t.fasciaOraria || '').toLowerCase();
      const isH24 = fascia.includes('h24') || fascia.includes('reperibilit');

      // Se il turno è H24 ed è per oggi: attivo tutto il giorno
      if (isH24 && isOggi) {
        return {
          isDiTurno: true,
          motivo: `Turno Reperibilità H24 attivo oggi (${t.sedeNome}) - Ruolo: ${ruoloAssegnato}`,
          dettaglioTurno: {
            sedeNome: t.sedeNome,
            fasciaOraria: t.fasciaOraria,
            orarioInizio: t.orarioInizio || '00:00',
            orarioFine: t.orarioFine || '24:00',
            ruoloAssegnato,
            mezzoAssegnato: t.mezzoAssegnato
          }
        };
      }

      const startMin = parseTimeToMinutes(t.orarioInizio);
      const endMin = parseTimeToMinutes(t.orarioFine);

      if (startMin !== null && endMin !== null) {
        if (endMin < startMin) {
          // Turno Notturno a cavallo di mezzanotte (es. 20:00 - 08:00)
          // A) Iniziato ieri sera: attivo stamattina fino a endMin + GRACE_AFTER_MIN
          if (isIeri && nowMinutes <= (endMin + GRACE_AFTER_MIN)) {
            return {
              isDiTurno: true,
              motivo: `Turno notturno in corso iniziato ieri sera (${t.sedeNome}, ${t.orarioInizio} - ${t.orarioFine}) - Ruolo: ${ruoloAssegnato}`,
              dettaglioTurno: {
                sedeNome: t.sedeNome,
                fasciaOraria: t.fasciaOraria,
                orarioInizio: t.orarioInizio,
                orarioFine: t.orarioFine,
                ruoloAssegnato,
                mezzoAssegnato: t.mezzoAssegnato
              }
            };
          }
          // B) Programmato per stasera: attivo da startMin - GRACE_BEFORE_MIN fino a mezzanotte
          if (isOggi && nowMinutes >= Math.max(0, startMin - GRACE_BEFORE_MIN)) {
            return {
              isDiTurno: true,
              motivo: `Turno notturno in corso stasera (${t.sedeNome}, ${t.orarioInizio} - ${t.orarioFine}) - Ruolo: ${ruoloAssegnato}`,
              dettaglioTurno: {
                sedeNome: t.sedeNome,
                fasciaOraria: t.fasciaOraria,
                orarioInizio: t.orarioInizio,
                orarioFine: t.orarioFine,
                ruoloAssegnato,
                mezzoAssegnato: t.mezzoAssegnato
              }
            };
          }
        } else {
          // Turno Diurno (es. 08:00 - 14:00 oppure 14:00 - 20:00)
          if (isOggi) {
            const finestraInizio = Math.max(0, startMin - GRACE_BEFORE_MIN);
            const finestraFine = Math.min(24 * 60 - 1, endMin + GRACE_AFTER_MIN);
            if (nowMinutes >= finestraInizio && nowMinutes <= finestraFine) {
              return {
                isDiTurno: true,
                motivo: `Turno in corso adesso (${t.sedeNome}, ${t.orarioInizio} - ${t.orarioFine}) - Ruolo: ${ruoloAssegnato}`,
                dettaglioTurno: {
                  sedeNome: t.sedeNome,
                  fasciaOraria: t.fasciaOraria,
                  orarioInizio: t.orarioInizio,
                  orarioFine: t.orarioFine,
                  ruoloAssegnato,
                  mezzoAssegnato: t.mezzoAssegnato
                }
              };
            }
          }
        }
      } else {
        // Fallback per fasce orarie convenzionali se mancano orari precisi
        if (isOggi) {
          if (fascia.includes('mattina')) {
            if (nowMinutes >= 7 * 60 + 15 && nowMinutes <= 14 * 60 + 30) {
              return {
                isDiTurno: true,
                motivo: `Turno Mattina in corso (${t.sedeNome}) - Ruolo: ${ruoloAssegnato}`,
                dettaglioTurno: { sedeNome: t.sedeNome, fasciaOraria: t.fasciaOraria, ruoloAssegnato, mezzoAssegnato: t.mezzoAssegnato }
              };
            }
          } else if (fascia.includes('pomeriggio')) {
            if (nowMinutes >= 13 * 60 + 15 && nowMinutes <= 20 * 60 + 30) {
              return {
                isDiTurno: true,
                motivo: `Turno Pomeriggio in corso (${t.sedeNome}) - Ruolo: ${ruoloAssegnato}`,
                dettaglioTurno: { sedeNome: t.sedeNome, fasciaOraria: t.fasciaOraria, ruoloAssegnato, mezzoAssegnato: t.mezzoAssegnato }
              };
            }
          } else if (fascia.includes('notte')) {
            if (nowMinutes >= 19 * 60 + 15) {
              return {
                isDiTurno: true,
                motivo: `Turno Notte in corso stasera (${t.sedeNome}) - Ruolo: ${ruoloAssegnato}`,
                dettaglioTurno: { sedeNome: t.sedeNome, fasciaOraria: t.fasciaOraria, ruoloAssegnato, mezzoAssegnato: t.mezzoAssegnato }
              };
            }
          } else {
            // Turno programmato per oggi senza orari definiti
            return {
              isDiTurno: true,
              motivo: `Turno programmato per la giornata di oggi (${t.sedeNome}) - Ruolo: ${ruoloAssegnato}`,
              dettaglioTurno: { sedeNome: t.sedeNome, fasciaOraria: t.fasciaOraria, ruoloAssegnato, mezzoAssegnato: t.mezzoAssegnato }
            };
          }
        } else if (isIeri && fascia.includes('notte')) {
          if (nowMinutes <= 8 * 60 + 30) {
            return {
              isDiTurno: true,
              motivo: `Turno Notte iniziato ieri sera in corso stamattina (${t.sedeNome}) - Ruolo: ${ruoloAssegnato}`,
              dettaglioTurno: { sedeNome: t.sedeNome, fasciaOraria: t.fasciaOraria, ruoloAssegnato, mezzoAssegnato: t.mezzoAssegnato }
            };
          }
        }
      }
    }
  }

  return {
    isDiTurno: false,
    motivo: 'Nessun turno operativo programmato per questo volontario al momento'
  };
}
