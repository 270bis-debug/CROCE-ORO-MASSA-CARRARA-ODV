import { jsPDF } from 'jspdf';
import { formatDateTimeItaly, formatISODateItaly } from './italianTime';
import {
  disegnaHeaderIstituzionale,
  disegnaFooterIstituzionale,
  sanitizeWinAnsi,
} from './pdfInstitutionalLayout';

export type AreaAuditLog =
  | 'volontari'
  | 'turni'
  | 'timbrature'
  | 'contabilita'
  | 'mezzi'
  | 'formazione'
  | 'magazzino'
  | 'sedi'
  | 'bacheca'
  | 'libri_sociali'
  | 'backup'
  | 'sistema';

export type CriticitaAuditLog = 'info' | 'importante' | 'critico';

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  dataOra: string;
  operatore: string;
  area: AreaAuditLog;
  azione: string;
  dettaglio: string;
  criticita: CriticitaAuditLog;
}

export const AUDIT_LOG_STORAGE_KEY = 'CROCE_ORO_AUDIT_LOG_V1';
export const AUDIT_LOG_UPDATED_EVENT = 'croceoro_audit_log_updated';
const MAX_AUDIT_ENTRIES = 500;

function normalizzaEntry(raw: any): AuditLogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  const azione = String(raw.azione || '').trim();
  if (!id || !azione) return null;
  const areaValid: AreaAuditLog[] = [
    'volontari',
    'turni',
    'timbrature',
    'contabilita',
    'mezzi',
    'formazione',
    'magazzino',
    'sedi',
    'bacheca',
    'libri_sociali',
    'backup',
    'sistema',
  ];
  const area: AreaAuditLog = areaValid.includes(raw.area) ? raw.area : 'sistema';
  const criticita: CriticitaAuditLog =
    raw.criticita === 'critico' || raw.criticita === 'importante' ? raw.criticita : 'info';
  const timestamp =
    typeof raw.timestamp === 'number' && Number.isFinite(raw.timestamp)
      ? raw.timestamp
      : Date.now();
  return {
    id,
    timestamp,
    dataOra: String(raw.dataOra || formatDateTimeItaly(new Date(timestamp))),
    operatore: String(raw.operatore || 'Operatore').slice(0, 120),
    area,
    azione: azione.slice(0, 160),
    dettaglio: String(raw.dettaglio || '').slice(0, 420),
    criticita,
  };
}

export function getAuditLogEntries(): AuditLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizzaEntry)
      .filter((x): x is AuditLogEntry => Boolean(x))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_AUDIT_ENTRIES);
  } catch {
    return [];
  }
}

export function mergeAuditLogEntries(
  localList: AuditLogEntry[],
  incomingRaw: any[]
): AuditLogEntry[] {
  const byId = new Map<string, AuditLogEntry>();
  for (const item of localList) {
    const norm = normalizzaEntry(item);
    if (norm) byId.set(norm.id, norm);
  }
  for (const item of incomingRaw || []) {
    const norm = normalizzaEntry(item);
    if (norm && !byId.has(norm.id)) {
      byId.set(norm.id, norm);
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_AUDIT_ENTRIES);
}

export function salvaAuditLogEntries(entries: AuditLogEntry[]): AuditLogEntry[] {
  const clean = entries
    .map(normalizzaEntry)
    .filter((x): x is AuditLogEntry => Boolean(x))
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_AUDIT_ENTRIES);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(clean));
      window.dispatchEvent(new CustomEvent(AUDIT_LOG_UPDATED_EVENT));
    } catch {}
  }
  return clean;
}

export function applicaAuditLogDaSync(incoming?: any[]): AuditLogEntry[] {
  const local = getAuditLogEntries();
  if (!Array.isArray(incoming) || incoming.length === 0) return local;
  const merged = mergeAuditLogEntries(local, incoming);
  return salvaAuditLogEntries(merged);
}

export function creaERegistraEventoAudit(params: {
  operatore: string;
  area: AreaAuditLog;
  azione: string;
  dettaglio: string;
  criticita?: CriticitaAuditLog;
}): { entry: AuditLogEntry; lista: AuditLogEntry[] } {
  const now = Date.now();
  const entry: AuditLogEntry = {
    id: `aud-${now}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    dataOra: formatDateTimeItaly(new Date(now)),
    operatore: (params.operatore || 'Operatore').trim().slice(0, 120),
    area: params.area,
    azione: params.azione.trim().slice(0, 160),
    dettaglio: params.dettaglio.trim().slice(0, 420),
    criticita: params.criticita || 'info',
  };
  const current = getAuditLogEntries();
  const lista = salvaAuditLogEntries([entry, ...current]);
  return { entry, lista };
}

export function esportaAuditLogCsv(entries: AuditLogEntry[], filename?: string): void {
  const headers = ['Data e Ora', 'Operatore', 'Area', 'Criticita', 'Azione', 'Dettaglio'];
  const esc = (v: string) => `"${String(v || '').replace(/"/g, '""')}"`;
  const rows = entries.map((e) =>
    [e.dataOra, e.operatore, e.area, e.criticita, e.azione, e.dettaglio].map(esc).join(';')
  );
  const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `Registro_Attivita_CroceOro_${formatISODateItaly()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function esportaAuditLogPdf(entries: AuditLogEntry[]): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const oggi = formatISODateItaly();
  const dataOraGen = formatDateTimeItaly();

  const renderPageChrome = (pageNum: number) => {
    disegnaHeaderIstituzionale(doc, {
      titoloDocumento: 'REGISTRO ATTIVITA & AUDIT LOG DI SISTEMA',
      badge: {
        riga1Tag: 'CONTROLLO INTERNO',
        riga2Valore: `${entries.length} EVENTI`,
        riga3Sotto: `Estratto il ${oggi}`,
      },
      pageWidth,
      margin,
    });
    disegnaFooterIstituzionale(doc, {
      dicituraArchiviazione: `Pagina ${pageNum} • Registro Attivita Riservato Direttivo/Admin • Generato il ${dataOraGen}`,
      pageWidth,
      pageHeight,
      margin,
    });
  };

  let pageNum = 1;
  renderPageChrome(pageNum);
  let y = 38;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setTextColor(30, 41, 59);
  doc.text('DATA / ORA', margin + 2, y + 4.8);
  doc.text('OPERATORE', margin + 33, y + 4.8);
  doc.text('AREA', margin + 68, y + 4.8);
  doc.text('AZIONE E DETTAGLIO', margin + 94, y + 4.8);
  y += 9;

  for (const e of entries.slice(0, 250)) {
    const detLines = doc.splitTextToSize(
      sanitizeWinAnsi(`${e.azione}${e.dettaglio ? ` - ${e.dettaglio}` : ''}`),
      contentWidth - 96
    );
    const rowH = Math.max(7, detLines.length * 3.8 + 2.5);
    if (y + rowH > pageHeight - 20) {
      doc.addPage();
      pageNum += 1;
      renderPageChrome(pageNum);
      y = 38;
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + rowH - 0.5, margin + contentWidth, y + rowH - 0.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text(sanitizeWinAnsi(e.dataOra), margin + 2, y + 3.8);
    doc.text(sanitizeWinAnsi(e.operatore).slice(0, 24), margin + 33, y + 3.8);
    doc.setFont('helvetica', 'bold');
    if (e.criticita === 'critico') doc.setTextColor(185, 28, 28);
    else if (e.criticita === 'importante') doc.setTextColor(180, 83, 9);
    else doc.setTextColor(15, 118, 110);
    doc.text(sanitizeWinAnsi(e.area.toUpperCase()), margin + 68, y + 3.8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(detLines, margin + 94, y + 3.8);

    y += rowH;
  }

  doc.save(`Registro_Attivita_CroceOro_${oggi}.pdf`);
}
