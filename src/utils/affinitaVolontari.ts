import { TurnoSedeOperativa, RuoloTurno, TipoTurnoConfig } from '../types/adminTypes';
import { Volontario } from '../components/DatabaseVolontariModal';
import { puoCoprireRuoloTurno, getMansioniVolontario } from './mansioniVolontari';

export interface AffinitaVolontarioDettaglio {
  /** Percentuale complessiva 0..100 */
  percentuale: number;
  /** Punteggi percentuali (0..100) per ciascuno dei 4 criteri */
  criteri: {
    tipoTurno: number;
    mansione: number;
    fasciaOraria: number;
    giornoSettimanale: number;
  };
  /** Numero di turni storici/programmati analizzati per questo volontario */
  turniAnalizzati: number;
  /** True se il volontario possiede la mansione/qualifica idonea per il ruolo richiesto */
  qualificatoRuolo: boolean;
  /** Etichetta breve giorno settimanale target (es. "Sab") */
  etichettaGiorno: string;
  /** Etichetta breve fascia oraria target (es. "Pomeriggio") */
  etichettaFascia: string;
}

export interface ContestoAffinitaTurno {
  data: string; // YYYY-MM-DD
  fasciaOraria: string;
  orarioInizio?: string;
  tipoTurnoId?: string;
  tipoTurnoNome?: string;
  nomeTurno?: string;
  tipoTurnoObj?: TipoTurnoConfig;
  excludeTurnoId?: string;
}

const GIORNI_BREVI = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function getDayOfWeekFromISO(iso?: string): number {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 1;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
}

type FasciaBucket = 'mattina' | 'pomeriggio' | 'notte' | 'h24' | 'ordinario';

function normalizzaFasciaBucket(fascia?: string, orarioInizio?: string): { bucket: FasciaBucket; label: string } {
  const f = (fascia || '').toLowerCase();
  if (f.includes('mattin')) return { bucket: 'mattina', label: 'Mattina' };
  if (f.includes('pomerig')) return { bucket: 'pomeriggio', label: 'Pomeriggio' };
  if (f.includes('nott')) return { bucket: 'notte', label: 'Notte' };
  if (f.includes('h24') || f.includes('24')) return { bucket: 'h24', label: 'H24' };

  if (orarioInizio && /^\d{1,2}:\d{2}/.test(orarioInizio)) {
    const ora = parseInt(orarioInizio.split(':')[0], 10);
    if (ora >= 6 && ora < 13) return { bucket: 'mattina', label: 'Mattina' };
    if (ora >= 13 && ora < 19) return { bucket: 'pomeriggio', label: 'Pomeriggio' };
    return { bucket: 'notte', label: 'Notte' };
  }

  return { bucket: 'ordinario', label: 'Ordinario' };
}

function getRuoloVolontarioNelTurno(turno: TurnoSedeOperativa, volId: string): RuoloTurno | null {
  if (turno.autista?.id === volId) return 'autista';
  if (turno.soccorritore2?.id === volId) return 'soccorritore2';
  if (turno.terzoSoccorritore?.id === volId) return 'terzoSoccorritore';
  if (turno.operatoreCentrale?.id === volId) return 'operatoreCentrale';
  if (turno.centralinista?.id === volId) return 'centralinista';
  if (turno.osservatore?.id === volId) return 'osservatore';
  if (turno.caposervizio?.id === volId) return 'caposervizio';

  const cand = turno.richiesteIscrizione?.find(
    (r) => r.volontarioId === volId && r.stato !== 'Rifiutato'
  );
  if (cand) return cand.ruoloRichiesto;

  return null;
}

function volontarioCopreMansioniTipoTurno(vol: Volontario, tipoTurnoObj?: TipoTurnoConfig): boolean {
  if (!tipoTurnoObj || !Array.isArray(tipoTurnoObj.mansioniObbligatorie) || tipoTurnoObj.mansioniObbligatorie.length === 0) {
    return false;
  }
  const mansVol = getMansioniVolontario(vol).map((m) => m.toLowerCase());
  const idsVol = new Set((vol.mansioniIds || []).map((id) => id.toLowerCase()));
  const qualNorm = (vol.qualifica || '').toLowerCase();

  return tipoTurnoObj.mansioniObbligatorie.some((req) => {
    const reqCatId = (req.mansioneCatalogoId || '').toLowerCase();
    const reqId = (req.id || '').toLowerCase();
    const reqNome = (req.nome || '').toLowerCase();
    if (reqCatId && idsVol.has(reqCatId)) return true;
    if (reqId && idsVol.has(reqId)) return true;
    if (req.ruoloTurno && puoCoprireRuoloTurno(vol, req.ruoloTurno).idoneo) return true;
    if (reqNome && mansVol.some((m) => m.includes(reqNome) || reqNome.includes(m))) return true;
    if (reqNome && qualNorm && (reqNome.includes(qualNorm) || qualNorm.includes(reqNome))) return true;
    return false;
  });
}

function calcolaPunteggioStorico25(matches: number, totale: number): number {
  if (totale <= 0 || matches <= 0) return 0;
  const ratio = matches / totale;
  // Combina la frequenza relativa (peso 18 pt) con la solidità dell'esperienza assoluta (fino a 7 pt)
  return Math.min(25, Math.round(ratio * 18 + Math.min(7, matches * 2.5)));
}

/**
 * Calcola l'affinità percentuale (0..100) di un singolo volontario rispetto a:
 * 1. Mansione / ruolo richiesto (25%)
 * 2. Tipo di turno (25%)
 * 3. Fascia oraria (25%)
 * 4. Giorno settimanale (25%)
 */
export function calcolaAffinitaVolontarioTurno(
  vol: Volontario,
  ruoloTarget: RuoloTurno,
  contesto: ContestoAffinitaTurno,
  tuttiTurni: TurnoSedeOperativa[]
): AffinitaVolontarioDettaglio {
  const targetDow = getDayOfWeekFromISO(contesto.data);
  const etichettaGiorno = GIORNI_BREVI[targetDow] || 'Lun';
  const targetFascia = normalizzaFasciaBucket(contesto.fasciaOraria, contesto.orarioInizio);
  const targetTipoId = (contesto.tipoTurnoId || '').trim();
  const targetTipoNome = (contesto.tipoTurnoNome || contesto.tipoTurnoObj?.nome || '').trim().toLowerCase();
  const targetNomeTurno = (contesto.nomeTurno || '').trim().toLowerCase();

  // Raccoglie i turni storici/programmati in cui il volontario è presente (escludendo il turno attualmente in modifica)
  const turniVol: Array<{ turno: TurnoSedeOperativa; ruolo: RuoloTurno }> = [];
  for (const t of tuttiTurni) {
    if (contesto.excludeTurnoId && t.id === contesto.excludeTurnoId) continue;
    const ruoloTrovato = getRuoloVolontarioNelTurno(t, vol.id);
    if (ruoloTrovato) {
      turniVol.push({ turno: t, ruolo: ruoloTrovato });
    }
  }

  const N = turniVol.length;
  const qualificatoRuolo = puoCoprireRuoloTurno(vol, ruoloTarget).idoneo;
  const compatibileTipoTurno = volontarioCopreMansioniTipoTurno(vol, contesto.tipoTurnoObj);

  // -------------------------------------------------------------------------
  // 1. MANSIONE (0..25 pt)
  // -------------------------------------------------------------------------
  const matchRuolo = turniVol.filter((item) => {
    if (item.ruolo === ruoloTarget) return true;
    // Secondo e terzo soccorritore condividono la stessa mansione operativa
    if (
      (ruoloTarget === 'soccorritore2' || ruoloTarget === 'terzoSoccorritore') &&
      (item.ruolo === 'soccorritore2' || item.ruolo === 'terzoSoccorritore')
    ) {
      return true;
    }
    return false;
  }).length;

  let puntiMansione = 0;
  if (qualificatoRuolo) {
    if (N === 0) {
      puntiMansione = 20;
    } else {
      const bonusEsperienza = Math.min(7, Math.round((matchRuolo / N) * 4 + Math.min(3, matchRuolo)));
      puntiMansione = Math.min(25, 18 + bonusEsperienza);
    }
  } else if (matchRuolo > 0) {
    // Non ha la mansione formalmente spuntata in anagrafica, ma ha già svolto il ruolo
    puntiMansione = Math.min(12, matchRuolo * 4);
  }

  // -------------------------------------------------------------------------
  // 2. TIPO DI TURNO (0..25 pt)
  // -------------------------------------------------------------------------
  const matchTipoTurno = turniVol.filter(({ turno }) => {
    if (targetTipoId && turno.tipoTurnoId && turno.tipoTurnoId === targetTipoId) return true;
    if (targetTipoNome && turno.tipoTurnoNome && turno.tipoTurnoNome.trim().toLowerCase() === targetTipoNome) {
      return true;
    }
    if (!targetTipoId && !targetTipoNome && targetNomeTurno && turno.nomeTurno) {
      const n = turno.nomeTurno.trim().toLowerCase();
      if (n === targetNomeTurno) return true;
    }
    return false;
  }).length;

  let puntiTipoTurno = 0;
  if (N > 0) {
    if (matchTipoTurno > 0) {
      puntiTipoTurno = calcolaPunteggioStorico25(matchTipoTurno, N);
    } else if (compatibileTipoTurno) {
      puntiTipoTurno = 8;
    } else if (qualificatoRuolo) {
      puntiTipoTurno = 4;
    }
  } else {
    if (compatibileTipoTurno) {
      puntiTipoTurno = 12;
    } else if (qualificatoRuolo) {
      puntiTipoTurno = 6;
    }
  }

  // -------------------------------------------------------------------------
  // 3. FASCIA ORARIA (0..25 pt)
  // -------------------------------------------------------------------------
  const matchFascia = turniVol.filter(({ turno }) => {
    const f = normalizzaFasciaBucket(turno.fasciaOraria, turno.orarioInizio);
    return f.bucket === targetFascia.bucket;
  }).length;

  const puntiFascia = N > 0 ? calcolaPunteggioStorico25(matchFascia, N) : 0;

  // -------------------------------------------------------------------------
  // 4. GIORNO SETTIMANALE (0..25 pt)
  // -------------------------------------------------------------------------
  const isTargetWeekend = targetDow === 0 || targetDow === 6;
  let matchGiornoEsatto = 0;
  let matchStessaTipologiaGiorno = 0;

  for (const { turno } of turniVol) {
    const dow = getDayOfWeekFromISO(turno.data);
    if (dow === targetDow) {
      matchGiornoEsatto++;
    }
    const isWeekend = dow === 0 || dow === 6;
    if (isWeekend === isTargetWeekend) {
      matchStessaTipologiaGiorno++;
    }
  }

  let puntiGiorno = 0;
  if (N > 0) {
    if (matchGiornoEsatto > 0) {
      puntiGiorno = calcolaPunteggioStorico25(matchGiornoEsatto, N);
    } else if (matchStessaTipologiaGiorno > 0) {
      // Piccola affinità parziale se il volontario copre abitualmente la stessa fascia feriale/weekend
      puntiGiorno = Math.min(6, Math.round((matchStessaTipologiaGiorno / N) * 6));
    }
  }

  const percentuale = Math.max(0, Math.min(100, Math.round(puntiMansione + puntiTipoTurno + puntiFascia + puntiGiorno)));

  return {
    percentuale,
    criteri: {
      tipoTurno: Math.round((puntiTipoTurno / 25) * 100),
      mansione: Math.round((puntiMansione / 25) * 100),
      fasciaOraria: Math.round((puntiFascia / 25) * 100),
      giornoSettimanale: Math.round((puntiGiorno / 25) * 100),
    },
    turniAnalizzati: N,
    qualificatoRuolo,
    etichettaGiorno,
    etichettaFascia: targetFascia.label,
  };
}
