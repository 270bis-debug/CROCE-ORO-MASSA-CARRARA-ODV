import { Volontario } from '../components/DatabaseVolontariModal';
import { TurnoSedeOperativa } from '../types/adminTypes';
import { puoCoprireRuoloTurno } from './mansioniVolontari';
import { formatISODateItaly } from './italianTime';

export interface RuoloScopertoTurno {
  ruoloKey: string;
  ruoloLabel: string;
  volontariIdonei: Array<{
    id: string;
    nomeCompleto: string;
    email?: string;
    sezione?: string;
  }>;
}

export interface TurnoScopertoAlert {
  turnoId: string;
  data: string; // YYYY-MM-DD
  dataFormatted: string; // DD/MM/YYYY
  fasciaOraria: string;
  sedeId?: string;
  sedeNome: string;
  oreMancanti: number;
  finestra: '24h' | '48h';
  ruoliScoperti: RuoloScopertoTurno[];
  dedupKey: string;
}

const ETICHETTE_RUOLI: Record<string, string> = {
  autista: 'Autista',
  caposervizio: 'Caposervizio',
  soccorritore2: '2° Soccorritore',
  terzoSoccorritore: '3° Soccorritore',
  operatoreCentrale: 'Operatore Centrale',
  centralinista: 'Centralinista',
  osservatore: 'Osservatore',
};

function parseInizioTurnoMs(dataIso: string, orarioInizio?: string, fascia?: string): number | null {
  if (!dataIso || !/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) return null;
  let hhmm = (orarioInizio || '').trim();
  if (!hhmm && fascia) {
    hhmm = fascia.split(/[-–]/)[0]?.trim() || '08:00';
  }
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  const h = m ? Math.min(23, Math.max(0, parseInt(m[1], 10))) : 8;
  const min = m ? Math.min(59, Math.max(0, parseInt(m[2], 10))) : 0;
  const [y, mo, d] = dataIso.split('-').map(Number);
  return new Date(y, mo - 1, d, h, min, 0, 0).getTime();
}

function getRuoliRichiestiPerTurno(turno: any): string[] {
  if (Array.isArray(turno?.mansioniRichieste) && turno.mansioniRichieste.length > 0) {
    const richiesti = turno.mansioniRichieste
      .filter((m: any) => m && Number(m.minimo ?? 1) > 0)
      .map((m: any) => String(m.ruoloKey || m.chiave || m.ruolo || '').trim())
      .filter(Boolean);
    if (richiesti.length > 0) return richiesti;
  }
  if (Array.isArray(turno?.ruoliRichiesti) && turno.ruoliRichiesti.length > 0) {
    return turno.ruoliRichiesti.map((r: any) => String(r));
  }
  const tipo = String(turno?.tipoTurnoNome || turno?.nomeTurno || turno?.tipoTurno || '').toLowerCase();
  if (tipo.includes('central')) {
    return ['operatoreCentrale'];
  }
  // Default turno ambulanza/equipaggio: Autista + 2° Soccorritore (o Caposervizio legacy)
  return ['autista', 'soccorritore2'];
}

function estraiAssegnatiIdsENomi(turno: any): { ids: Set<string>; nomi: Set<string> } {
  const ids = new Set<string>();
  const nomi = new Set<string>();
  const equip = turno?.equipaggio || {};
  const slots = [
    turno?.autista,
    turno?.caposervizio,
    turno?.soccorritore2,
    turno?.terzoSoccorritore,
    turno?.operatoreCentrale,
    turno?.centralinista,
    turno?.osservatore,
    equip.autista,
    equip.caposervizio,
    equip.soccorritore2,
    equip.terzoSoccorritore,
    equip.operatoreCentrale,
    equip.centralinista,
    equip.osservatore,
    ...(Array.isArray(turno?.equipaggioExtra) ? turno.equipaggioExtra : []),
  ];
  for (const s of slots) {
    if (!s) continue;
    if (typeof s === 'string') {
      if (s.trim()) nomi.add(s.trim().toLowerCase());
    } else if (typeof s === 'object') {
      if (s.id) ids.add(String(s.id));
      if (s.volontarioId) ids.add(String(s.volontarioId));
      const n = String(s.nome || s.volontarioNome || '').trim().toLowerCase();
      if (n) nomi.add(n);
    }
  }
  return { ids, nomi };
}

function isSlotCoperto(turno: any, ruoloKey: string): boolean {
  const equip = turno?.equipaggio || {};
  const candidates = [turno?.[ruoloKey], equip[ruoloKey]];
  if (ruoloKey === 'soccorritore2') {
    candidates.push(turno?.caposervizio, equip.caposervizio);
  }
  return candidates.some((slot) => {
    if (!slot) return false;
    if (typeof slot === 'string') return slot.trim().length > 0;
    if (typeof slot === 'object') {
      return Boolean(
        (slot.id && String(slot.id).trim()) ||
          (slot.volontarioId && String(slot.volontarioId).trim()) ||
          (slot.nome && String(slot.nome).trim()) ||
          (slot.volontarioNome && String(slot.volontarioNome).trim())
      );
    }
    return false;
  });
}

/**
 * Individua tutti i turni delle prossime 48 ore che presentano almeno un ruolo scoperto
 * e calcola i volontari idonei (per mansione e sezione territoriale) a coprirli.
 */
export function analizzaTurniScopertiProssime48h(
  turni: TurnoSedeOperativa[],
  volontari: Volontario[],
  nowMs: number = Date.now()
): TurnoScopertoAlert[] {
  const out: TurnoScopertoAlert[] = [];
  const oggiIso = formatISODateItaly(new Date(nowMs));
  const volontariAttivi = (volontari || []).filter(
    (v) =>
      v &&
      v.approvato !== false &&
      !v.bloccatoPerTentativi
  );

  for (const t of turni || []) {
    if (!t || !t.data || t.data < oggiIso) continue;
    const fascia = t.fasciaOraria || `${t.orarioInizio || '08:00'} - ${t.orarioFine || '14:00'}`;
    const startMs = parseInizioTurnoMs(t.data, t.orarioInizio, fascia);
    if (!startMs) continue;
    const diffHours = (startMs - nowMs) / 3600000;
    // Solo turni futuri tra 1 ora e 48 ore da adesso
    if (diffHours < 1 || diffHours > 48) continue;

    const ruoliRichiesti = getRuoliRichiestiPerTurno(t);
    const mancanti = ruoliRichiesti.filter((rk) => !isSlotCoperto(t, rk));
    if (mancanti.length === 0) continue;

    const assegnati = estraiAssegnatiIdsENomi(t);
    const sedeNorm = String(t.sedeNome || '').trim().toLowerCase();
    const sedeId = String((t as any).sedeId || '').trim();

    const ruoliScoperti: RuoloScopertoTurno[] = mancanti.map((ruoloKey) => {
      const idonei = volontariAttivi
        .filter((v) => {
          const nomeFull = `${v.nome || ''} ${v.cognome || ''}`.trim().toLowerCase();
          if (assegnati.ids.has(v.id) || (nomeFull && assegnati.nomi.has(nomeFull))) {
            return false;
          }
          // Se il volontario ha una sezione assegnata e il turno ha una sezione, preferisce stessa sezione
          // (se la sezione non è impostata sul volontario o coincide, è idoneo)
          const volSedeId = String(v.sezioneAppartenenzaId || '').trim();
          const volSedeNome = String(v.sezioneAppartenenzaNome || '').trim().toLowerCase();
          const sezioneCompatibile =
            !sedeNorm ||
            (!volSedeId && !volSedeNome) ||
            (sedeId && volSedeId === sedeId) ||
            (volSedeNome && (volSedeNome.includes(sedeNorm) || sedeNorm.includes(volSedeNome)));
          if (!sezioneCompatibile) return false;

          return puoCoprireRuoloTurno(v, ruoloKey).idoneo;
        })
        .map((v) => ({
          id: v.id,
          nomeCompleto: `${v.nome || ''} ${v.cognome || ''}`.trim(),
          email: (v.emailNotifiche || v.email || '').trim() || undefined,
          sezione: v.sezioneAppartenenzaNome || 'Sede Centrale',
        }));

      return {
        ruoloKey,
        ruoloLabel: ETICHETTE_RUOLI[ruoloKey] || ruoloKey,
        volontariIdonei: idonei,
      };
    });

    const finestra: '24h' | '48h' = diffHours <= 24 ? '24h' : '48h';
    const [yyyy, mm, dd] = t.data.split('-');
    out.push({
      turnoId: t.id,
      data: t.data,
      dataFormatted: `${dd}/${mm}/${yyyy}`,
      fasciaOraria: fascia,
      sedeId: sedeId || undefined,
      sedeNome: t.sedeNome || 'Sede Operativa',
      oreMancanti: Math.round(diffHours),
      finestra,
      ruoliScoperti,
      dedupKey: `turno_scoperto_${t.data}_${t.id}_${finestra}`,
    });
  }

  return out.sort((a, b) => a.oreMancanti - b.oreMancanti);
}
