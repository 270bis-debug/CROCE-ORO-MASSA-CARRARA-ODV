import { TimbraturaVolontario } from '../types/adminTypes';
import { Volontario } from '../components/DatabaseVolontariModal';
import { addDaysISODate, formatDateItaly, formatISODateItaly, formatTimeItaly } from './italianTime';
import { isTimbraturaConUscitaValida, isTimbraturaNfc, isTimbraturaNfcScaduta24h } from './raspberryDisplayConfig';

export type ModalitaPeriodoTimbrature = 'tutto' | 'giornaliero' | 'settimanale' | 'personalizzato';

/**
 * Formatta un oggetto Date in YYYY-MM-DD usando il fuso ufficiale italiano (Europe/Rome)
 */
export function formatLocalISODate(date: Date = new Date()): string {
  return formatISODateItaly(date);
}

/**
 * Normalizza date in formato "DD/MM/YYYY" o "YYYY-MM-DD" verso "YYYY-MM-DD"
 */
export function normalizzaDataISO(raw?: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return s;
}

/**
 * Formatta una data ISO (YYYY-MM-DD) in formato italiano DD/MM/YYYY
 */
export function formatDataItaliana(iso?: string): string {
  const norm = normalizzaDataISO(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(norm)) return iso || '—';
  const [y, m, d] = norm.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Restituisce il nome del giorno della settimana in italiano
 */
export function getGiornoSettimanaIt(iso?: string): string {
  const norm = normalizzaDataISO(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(norm)) return '';
  const [y, m, d] = norm.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const giorni = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  return giorni[dt.getUTCDay()] || '';
}

/**
 * Calcola lunedì e domenica (YYYY-MM-DD) della settimana contenente la data di riferimento
 */
export function calcolaIntervalloSettimanaISO(refISO?: string): { inizio: string; fine: string } {
  const norm = normalizzaDataISO(refISO) || formatLocalISODate();
  const [y, m, d] = norm.split('-').map(Number);
  const ref = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const dayOfWeek = ref.getUTCDay(); // 0=Dom, 1=Lun, ... 6=Sab
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const inizio = addDaysISODate(norm, diffToMonday);
  const fine = addDaysISODate(inizio, 6);
  return {
    inizio,
    fine,
  };
}

/**
 * Formatta un oggetto Date in HH:mm:ss nel fuso ufficiale italiano (Europe/Rome)
 */
export function formatOrarioConSecondi(date: Date = new Date()): string {
  return formatTimeItaly(date, true);
}

/**
 * Converte una stringa orario "HH:mm:ss" o "HH:mm" in secondi dall'inizio della giornata
 */
export function parseOrarioInSecondi(orario?: string): number | null {
  const s = String(orario || '').trim();
  const match = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  const sec = Number(match[3] || 0);
  if ([h, m, sec].some((n) => Number.isNaN(n))) return null;
  return h * 3600 + m * 60 + sec;
}

/**
 * Formatta un numero di secondi in stringa leggibile con secondi (es. "2h 15m 08s" o "4m 30s")
 */
export function formatSecondiInDurata(diffSecondi: number): string {
  const clean = Math.max(0, Math.round(diffSecondi));
  const h = Math.floor(clean / 3600);
  const m = Math.floor((clean % 3600) / 60);
  const s = clean % 60;
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }
  if (m > 0) {
    return `${m}m ${String(s).padStart(2, '0')}s`;
  }
  return `${s}s`;
}

/**
 * Calcola durata esatta in secondi, ore decimali e testo formattato tra due orari (supporta HH:mm e HH:mm:ss)
 */
export function calcolaDurataTimbratura(ingresso?: string, uscita?: string): {
  diffSecondi: number;
  oreDecimali: number;
  durataTesto: string;
} {
  const inSec = parseOrarioInSecondi(ingresso);
  const outSec = parseOrarioInSecondi(uscita);
  if (inSec === null || outSec === null) {
    return { diffSecondi: 0, oreDecimali: 0, durataTesto: '—' };
  }
  let diffSecondi = outSec - inSec;
  if (diffSecondi < 0) diffSecondi += 24 * 3600;
  const oreDecimali = Math.round((diffSecondi / 3600) * 100) / 100;
  return {
    diffSecondi,
    oreDecimali,
    durataTesto: formatSecondiInDurata(diffSecondi),
  };
}

/**
 * Converte ore decimali o orari ingresso/uscita in formato leggibile con secondi
 */
export function formatDurataTimbratura(t: TimbraturaVolontario): string {
  if (isTimbraturaNfcScaduta24h(t)) {
    return '—';
  }
  if (t.orarioIngresso && t.orarioUscita) {
    const calc = calcolaDurataTimbratura(t.orarioIngresso, t.orarioUscita);
    if (calc.durataTesto !== '—') return calc.durataTesto;
  }
  if (t.oreEMinuti && t.oreEMinuti.trim()) return t.oreEMinuti;
  if (typeof t.oreTotali === 'number' && !Number.isNaN(t.oreTotali)) {
    return formatSecondiInDurata(Math.round(t.oreTotali * 3600));
  }
  return t.orarioUscita ? '—' : 'In Corso';
}

export interface ExportReportTimbratureParams {
  timbrature: TimbraturaVolontario[];
  volontari: Volontario[];
  etichettaVolontario: string;
  etichettaPeriodo: string;
  modalitaPeriodo: ModalitaPeriodoTimbrature;
  dataInizio?: string;
  dataFine?: string;
  filtroSede: string;
  filtroTesto?: string;
  singoloVolontarioId?: string;
}

interface RigaRiepilogoVolontario {
  nominativo: string;
  matricola: string;
  qualifica: string;
  numeroTurni: number;
  turniAperti: number;
  oreTotali: number;
}

function trovaVolontarioRecord(t: TimbraturaVolontario, volontari: Volontario[]): Volontario | undefined {
  return volontari.find((v) => {
    if (v.id && t.volontarioId && v.id === t.volontarioId) return true;
    const full1 = `${v.nome || ''} ${v.cognome || ''}`.trim().toLowerCase();
    const full2 = `${v.cognome || ''} ${v.nome || ''}`.trim().toLowerCase();
    const nom = (t.volontarioNome || '').trim().toLowerCase();
    return Boolean(nom && (nom === full1 || nom === full2));
  });
}

function calcolaRiepilogoPerVolontario(
  timbrature: TimbraturaVolontario[],
  volontari: Volontario[]
): RigaRiepilogoVolontario[] {
  const map = new Map<string, RigaRiepilogoVolontario>();
  for (const t of timbrature) {
    // Le chiusure automatiche NFC >24h non hanno alcuna validità ai fini dei conteggi presenze
    if (isTimbraturaNfcScaduta24h(t)) continue;
    const vol = trovaVolontarioRecord(t, volontari);
    const key = vol?.id || t.volontarioId || t.volontarioNome.trim().toLowerCase();
    const nominativo = vol ? `${vol.nome} ${vol.cognome}`.trim() : t.volontarioNome;
    const existing = map.get(key) || {
      nominativo,
      matricola: vol?.matricola || 'N/D',
      qualifica: t.qualifica || vol?.qualifica || 'Volontario',
      numeroTurni: 0,
      turniAperti: 0,
      oreTotali: 0,
    };
    existing.numeroTurni += 1;
    if (!isTimbraturaConUscitaValida(t)) {
      existing.turniAperti += 1;
    } else if (typeof t.oreTotali === 'number' && !Number.isNaN(t.oreTotali)) {
      existing.oreTotali = Math.round((existing.oreTotali + t.oreTotali) * 100) / 100;
    }
    map.set(key, existing);
  }
  return Array.from(map.values()).sort((a, b) => a.nominativo.localeCompare(b.nominativo, 'it'));
}

function costruisciNomeFile(params: ExportReportTimbratureParams, estensione: 'csv' | 'xls'): string {
  const slugVol = params.etichettaVolontario
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_|_$/g, '') || 'tutti';
  const slugPeriodo = params.modalitaPeriodo;
  const datePart =
    params.dataInizio && params.dataFine
      ? params.dataInizio === params.dataFine
        ? params.dataInizio
        : `${params.dataInizio}_${params.dataFine}`
      : params.dataInizio
      ? `dal_${params.dataInizio}`
      : params.dataFine
      ? `al_${params.dataFine}`
      : formatLocalISODate();
  return `Report_Timbrature_${slugVol}_${slugPeriodo}_${datePart}.${estensione}`;
}

function escapeCSV(val: unknown): string {
  const str = String(val ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""');
  return `"${str}"`;
}

function escapeHTML(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Scarica il report completo delle timbrature filtrate in formato CSV (UTF-8 con BOM, delimitatore ";")
 */
export function esportaReportTimbratureCSV(params: ExportReportTimbratureParams): string {
  const { timbrature, volontari, etichettaVolontario, etichettaPeriodo, filtroSede, filtroTesto } = params;
  const timbratureValidePerConteggio = timbrature.filter((t) => !isTimbraturaNfcScaduta24h(t));
  const totaleOre =
    Math.round(
      timbratureValidePerConteggio.reduce(
        (acc, t) => acc + (isTimbraturaConUscitaValida(t) ? Number(t.oreTotali) || 0 : 0),
        0
      ) * 100
    ) / 100;
  const riepilogoVolontari = calcolaRiepilogoPerVolontario(timbrature, volontari);

  const metaRows = [
    [`CROCE ORO MASSA CARRARA OdV - REPORT COMPLETO TIMBRATURE & PRESENZE VOLONTARI`],
    [`Generato il:`, `${formatDateItaly()} ${formatOrarioConSecondi()}`],
    [`Volontario:`, etichettaVolontario],
    [`Periodo Filtrato:`, etichettaPeriodo],
    [`Sede / Luogo:`, filtroSede === 'tutte' ? 'Tutte le Sedi Operative' : filtroSede],
    ...(filtroTesto?.trim() ? [[`Ricerca Testuale:`, filtroTesto.trim()]] : []),
    [
      `Totale Presenze Valide:`,
      String(timbratureValidePerConteggio.length),
      `Totale Ore Registrate:`,
      totaleOre.toFixed(2).replace('.', ','),
    ],
    [],
  ];

  const headers = [
    'N°',
    'Data',
    'Giorno',
    'ID Volontario',
    'Nominativo Volontario',
    'Matricola',
    'Qualifica',
    'Sede / Luogo Entrata',
    'Sede / Luogo Uscita',
    'Attività Svolta (Cosa stai facendo)',
    'Orario Ingresso (HH:MM:SS)',
    'Orario Uscita (HH:MM:SS)',
    'Ore Totali',
    'Durata',
    'Origine / Stato',
    'Ultima Modifica Admin',
    'Operatore Modifica',
    'Note',
  ];

  const dataRows = timbrature.map((t, idx) => {
    const vol = trovaVolontarioRecord(t, volontari);
    const scadutaNfc = isTimbraturaNfcScaduta24h(t);
    const hasUscitaValida = isTimbraturaConUscitaValida(t);
    const stato = scadutaNfc
      ? 'Solo Entrata NFC (senza uscita)'
      : !hasUscitaValida
      ? isTimbraturaNfc(t)
        ? 'Turno in Corso (NFC)'
        : 'Turno in Corso (Aperto)'
      : t.modificataDaAdmin
      ? 'Modificata da Admin'
      : isTimbraturaNfc(t)
      ? 'Originale NFC'
      : 'Originale GPS/App';
    const sedeUscitaVal = scadutaNfc ? '' : t.sedeUscita || (hasUscitaValida ? t.sede || '' : 'In Turno');
    const uscitaVal = scadutaNfc ? '' : t.orarioUscita || 'In Turno';
    const oreVal = scadutaNfc
      ? ''
      : hasUscitaValida && typeof t.oreTotali === 'number'
      ? t.oreTotali.toFixed(2).replace('.', ',')
      : '0,00';
    return [
      idx + 1,
      formatDataItaliana(t.data),
      getGiornoSettimanaIt(t.data),
      t.volontarioId || vol?.id || '',
      t.volontarioNome || (vol ? `${vol.nome} ${vol.cognome}` : ''),
      vol?.matricola || '',
      t.qualifica || vol?.qualifica || 'Volontario',
      t.sede || '',
      sedeUscitaVal,
      t.attivitaSvolta || '—',
      t.orarioIngresso || '',
      uscitaVal,
      oreVal,
      formatDurataTimbratura(t),
      stato,
      t.modificataDaAdmin ? t.dataUltimaModifica || '' : '',
      t.modificataDaAdmin ? t.operatoreModifica || '' : '',
      t.note || '',
    ];
  });

  const totalsRow = [
    '',
    'TOTALE GENERALE',
    '',
    '',
    `${timbratureValidePerConteggio.length} Presenze Valide`,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    totaleOre.toFixed(2).replace('.', ','),
    formatSecondiInDurata(Math.round(totaleOre * 3600)),
    '',
    '',
    '',
    '',
  ];

  const summaryBlock: string[] = [];
  if (riepilogoVolontari.length > 0) {
    summaryBlock.push('');
    summaryBlock.push(escapeCSV('RIEPILOGO ORE PER VOLONTARIO'));
    summaryBlock.push(
      ['Nominativo Volontario', 'Matricola', 'Qualifica', 'Numero Timbrature', 'Turni Aperti', 'Ore Totali Periodo']
        .map(escapeCSV)
        .join(';')
    );
    for (const r of riepilogoVolontari) {
      summaryBlock.push(
        [
          r.nominativo,
          r.matricola,
          r.qualifica,
          r.numeroTurni,
          r.turniAperti,
          r.oreTotali.toFixed(2).replace('.', ','),
        ]
          .map(escapeCSV)
          .join(';')
      );
    }
  }

  const csvLines = [
    ...metaRows.map((row) => row.map(escapeCSV).join(';')),
    headers.map(escapeCSV).join(';'),
    ...dataRows.map((row) => row.map(escapeCSV).join(';')),
    totalsRow.map(escapeCSV).join(';'),
    ...summaryBlock,
  ];

  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const nomeFile = costruisciNomeFile(params, 'csv');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return nomeFile;
}

/**
 * Scarica il report completo delle timbrature filtrate in formato Excel (.xls nativo HTML SpreadsheetML)
 */
export function esportaReportTimbratureExcel(params: ExportReportTimbratureParams): string {
  const { timbrature, volontari, etichettaVolontario, etichettaPeriodo, filtroSede, filtroTesto } = params;
  const timbratureValidePerConteggio = timbrature.filter((t) => !isTimbraturaNfcScaduta24h(t));
  const totaleOre =
    Math.round(
      timbratureValidePerConteggio.reduce(
        (acc, t) => acc + (isTimbraturaConUscitaValida(t) ? Number(t.oreTotali) || 0 : 0),
        0
      ) * 100
    ) / 100;
  const riepilogoVolontari = calcolaRiepilogoPerVolontario(timbrature, volontari);

  const dataRowsHtml = timbrature
    .map((t, idx) => {
      const vol = trovaVolontarioRecord(t, volontari);
      const scadutaNfc = isTimbraturaNfcScaduta24h(t);
      const hasUscitaValida = isTimbraturaConUscitaValida(t);
      const stato = scadutaNfc
        ? 'Solo Entrata NFC (senza uscita)'
        : !hasUscitaValida
        ? isTimbraturaNfc(t)
          ? 'In Corso (NFC)'
          : 'In Corso (Aperto)'
        : t.modificataDaAdmin
        ? `Modificata Admin (${t.operatoreModifica || 'Admin'})`
        : isTimbraturaNfc(t)
        ? 'Originale NFC'
        : 'Originale GPS/App';
      const oreVal = scadutaNfc
        ? ''
        : hasUscitaValida && typeof t.oreTotali === 'number'
        ? t.oreTotali.toFixed(2).replace('.', ',')
        : '0,00';
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const sedeUscitaVal = scadutaNfc ? '' : t.sedeUscita || (hasUscitaValida ? t.sede || '' : 'In Turno');
      const uscitaVal = scadutaNfc ? '' : t.orarioUscita || 'In Turno';
      return `
        <tr style="background:${bg};">
          <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${idx + 1}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;mso-number-format:'\\@';">${escapeHTML(formatDataItaliana(t.data))}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;">${escapeHTML(getGiornoSettimanaIt(t.data))}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;font-weight:bold;">${escapeHTML(t.volontarioNome || (vol ? `${vol.nome} ${vol.cognome}` : ''))}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;mso-number-format:'\\@';">${escapeHTML(vol?.matricola || 'N/D')}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;">${escapeHTML(t.qualifica || vol?.qualifica || 'Volontario')}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;">${escapeHTML(t.sede || '')}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;">${escapeHTML(sedeUscitaVal)}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;font-weight:bold;">${escapeHTML(t.attivitaSvolta || '—')}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;mso-number-format:'\\@';">${escapeHTML(t.orarioIngresso || '')}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;mso-number-format:'\\@';">${escapeHTML(uscitaVal)}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;text-align:right;font-weight:bold;mso-number-format:'0\\.00';">${oreVal}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${escapeHTML(formatDurataTimbratura(t))}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;">${escapeHTML(stato)}</td>
          <td style="border:1px solid #cbd5e1;padding:5px;">${escapeHTML(t.note || '')}</td>
        </tr>`;
    })
    .join('');

  const summaryRowsHtml = riepilogoVolontari
    .map(
      (r, idx) => `
      <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="border:1px solid #cbd5e1;padding:5px;font-weight:bold;">${escapeHTML(r.nominativo)}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;mso-number-format:'\\@';">${escapeHTML(r.matricola)}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;">${escapeHTML(r.qualifica)}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${r.numeroTurni}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;text-align:center;">${r.turniAperti}</td>
        <td style="border:1px solid #cbd5e1;padding:5px;text-align:right;font-weight:bold;mso-number-format:'0\\.00';">${r.oreTotali.toFixed(2).replace('.', ',')}</td>
      </tr>`
    )
    .join('');

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Report Timbrature</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #0f172a; }
    table { border-collapse: collapse; }
  </style>
</head>
<body>
  <table>
    <tr>
      <td colspan="15" style="background:#1d1a60;color:#fbbf24;font-size:14pt;font-weight:bold;padding:10px;border:1px solid #0f172a;">
        CROCE ORO MASSA CARRARA OdV — REPORT COMPLETO TIMBRATURE VOLONTARI
      </td>
    </tr>
    <tr>
      <td colspan="3" style="font-weight:bold;background:#f1f5f9;border:1px solid #cbd5e1;padding:5px;">Volontario Selezionato:</td>
      <td colspan="4" style="border:1px solid #cbd5e1;padding:5px;font-weight:bold;">${escapeHTML(etichettaVolontario)}</td>
      <td colspan="3" style="font-weight:bold;background:#f1f5f9;border:1px solid #cbd5e1;padding:5px;">Periodo Temporale:</td>
      <td colspan="5" style="border:1px solid #cbd5e1;padding:5px;font-weight:bold;">${escapeHTML(etichettaPeriodo)}</td>
    </tr>
    <tr>
      <td colspan="3" style="font-weight:bold;background:#f1f5f9;border:1px solid #cbd5e1;padding:5px;">Sede / Postazione:</td>
      <td colspan="4" style="border:1px solid #cbd5e1;padding:5px;">${escapeHTML(filtroSede === 'tutte' ? 'Tutte le Sedi Operative' : filtroSede)}</td>
      <td colspan="3" style="font-weight:bold;background:#f1f5f9;border:1px solid #cbd5e1;padding:5px;">Data Generazione Report:</td>
      <td colspan="5" style="border:1px solid #cbd5e1;padding:5px;">${escapeHTML(formatDateItaly())} ${escapeHTML(formatOrarioConSecondi())}</td>
    </tr>
    ${
      filtroTesto?.trim()
        ? `<tr>
      <td colspan="3" style="font-weight:bold;background:#f1f5f9;border:1px solid #cbd5e1;padding:5px;">Filtro Testo Libero:</td>
      <td colspan="12" style="border:1px solid #cbd5e1;padding:5px;">${escapeHTML(filtroTesto.trim())}</td>
    </tr>`
        : ''
    }
    <tr><td colspan="15" style="height:10px;"></td></tr>
    <tr style="background:#0f172a;color:#ffffff;font-weight:bold;text-align:center;">
      <th style="border:1px solid #334155;padding:6px;">N°</th>
      <th style="border:1px solid #334155;padding:6px;">Data</th>
      <th style="border:1px solid #334155;padding:6px;">Giorno</th>
      <th style="border:1px solid #334155;padding:6px;">Nominativo Volontario</th>
      <th style="border:1px solid #334155;padding:6px;">Matricola</th>
      <th style="border:1px solid #334155;padding:6px;">Qualifica</th>
      <th style="border:1px solid #334155;padding:6px;">Sede / Luogo Entrata</th>
      <th style="border:1px solid #334155;padding:6px;">Sede / Luogo Uscita</th>
      <th style="border:1px solid #334155;padding:6px;">Attività Svolta (Cosa stai facendo)</th>
      <th style="border:1px solid #334155;padding:6px;">Ingresso</th>
      <th style="border:1px solid #334155;padding:6px;">Uscita</th>
      <th style="border:1px solid #334155;padding:6px;">Ore Totali</th>
      <th style="border:1px solid #334155;padding:6px;">Durata</th>
      <th style="border:1px solid #334155;padding:6px;">Stato / Origine</th>
      <th style="border:1px solid #334155;padding:6px;">Note</th>
    </tr>
    ${
      timbrature.length === 0
        ? `<tr><td colspan="15" style="border:1px solid #cbd5e1;padding:12px;text-align:center;color:#64748b;">Nessuna timbratura trovata con i filtri selezionati.</td></tr>`
        : dataRowsHtml
    }
    <tr style="background:#fef3c7;font-weight:bold;">
      <td colspan="11" style="border:1px solid #0f172a;padding:7px;text-align:right;text-transform:uppercase;">
        TOTALE GENERALE (${timbratureValidePerConteggio.length} PRESENZE VALIDE):
      </td>
      <td style="border:1px solid #0f172a;padding:7px;text-align:right;mso-number-format:'0\\.00';">${totaleOre.toFixed(2).replace('.', ',')}</td>
      <td style="border:1px solid #0f172a;padding:7px;text-align:center;">${escapeHTML(formatSecondiInDurata(Math.round(totaleOre * 3600)))}</td>
      <td colspan="2" style="border:1px solid #0f172a;padding:7px;"></td>
    </tr>
  </table>

  ${
    riepilogoVolontari.length > 0
      ? `<br/>
  <table>
    <tr>
      <td colspan="6" style="background:#1e293b;color:#ffffff;font-weight:bold;padding:7px;border:1px solid #0f172a;">
        RIEPILOGO ORE PER SINGOLO VOLONTARIO
      </td>
    </tr>
    <tr style="background:#e2e8f0;font-weight:bold;">
      <th style="border:1px solid #94a3b8;padding:6px;">Nominativo Volontario</th>
      <th style="border:1px solid #94a3b8;padding:6px;">Matricola</th>
      <th style="border:1px solid #94a3b8;padding:6px;">Qualifica</th>
      <th style="border:1px solid #94a3b8;padding:6px;">Timbrature</th>
      <th style="border:1px solid #94a3b8;padding:6px;">Turni Aperti</th>
      <th style="border:1px solid #94a3b8;padding:6px;">Ore Totali</th>
    </tr>
    ${summaryRowsHtml}
  </table>`
      : ''
  }
</body>
</html>`;

  const nomeFile = costruisciNomeFile(params, 'xls');
  const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return nomeFile;
}
