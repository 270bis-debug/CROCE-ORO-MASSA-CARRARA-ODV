import { jsPDF } from 'jspdf';
import { formatDateTimeItaly, formatISODateItaly } from './italianTime';
import {
  disegnaHeaderIstituzionale,
  disegnaFooterIstituzionale,
  sanitizeWinAnsi,
} from './pdfInstitutionalLayout';
import { Volontario } from '../components/DatabaseVolontariModal';

export type TipoOrganoSociale =
  | 'Assemblea Ordinaria dei Soci'
  | 'Assemblea Straordinaria dei Soci'
  | 'Consiglio Direttivo';

export type StatoVerbaleOdv = 'Bozza' | 'Approvato' | 'Firmato';

export interface PresenzaVerbaleOdv {
  volontarioId?: string;
  nomeCompleto: string;
  ruolo?: string;
  presente: boolean;
  delegaA?: string;
}

export interface VerbaleOrganoSociale {
  id: string;
  numeroProgressivo: string; // es. "2026/001"
  organo: TipoOrganoSociale;
  titolo: string;
  dataSeduta: string; // YYYY-MM-DD
  oraInizio: string;
  oraFine: string;
  luogo: string;
  presidenteSeduta: string;
  segretarioVerbalizzante: string;
  ordineDelGiorno: string;
  testoDeliberazioni: string;
  presenze: PresenzaVerbaleOdv[];
  stato: StatoVerbaleOdv;
  creatoDa: string;
  createdAt: string;
  updatedAt: string;
}

export type TipoDeliberaSocio = 'Ammissione' | 'Dimissione' | 'Decadenza' | 'Esclusione';

export interface DeliberaSocioOdv {
  id: string;
  tipo: TipoDeliberaSocio;
  volontarioId?: string;
  nomeCompleto: string;
  codiceFiscale?: string;
  matricola?: string;
  dataDelibera: string; // YYYY-MM-DD
  numeroVerbale: string;
  organoDeliberante: TipoOrganoSociale;
  motivazioneNote: string;
  operatore: string;
  createdAt: string;
}

export const LIBRI_SOCIALI_VERBALI_KEY = 'CROCE_ORO_LIBRI_SOCIALI_VERBALI_V1';
export const LIBRI_SOCIALI_DELIBERE_KEY = 'CROCE_ORO_LIBRI_SOCIALI_DELIBERE_V1';
export const LIBRI_SOCIALI_UPDATED_AT_KEY = 'CROCE_ORO_LIBRI_SOCIALI_UPDATED_AT';
export const LIBRI_SOCIALI_UPDATED_EVENT = 'croceoro_libri_sociali_updated';

export function getVerbaliOrganiSociali(): VerbaleOrganoSociale[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LIBRI_SOCIALI_VERBALI_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => String(b.dataSeduta || '').localeCompare(String(a.dataSeduta || '')))
      : [];
  } catch {
    return [];
  }
}

export function getDelibereSociOdv(): DeliberaSocioOdv[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LIBRI_SOCIALI_DELIBERE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => String(b.dataDelibera || '').localeCompare(String(a.dataDelibera || '')))
      : [];
  } catch {
    return [];
  }
}

export function getLibriSocialiUpdatedAt(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const n = Number(localStorage.getItem(LIBRI_SOCIALI_UPDATED_AT_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function salvaLibriSocialiOdv(
  verbali: VerbaleOrganoSociale[],
  delibere: DeliberaSocioOdv[],
  updatedAt?: number
): { verbali: VerbaleOrganoSociale[]; delibere: DeliberaSocioOdv[]; updatedAt: number } {
  const ts = typeof updatedAt === 'number' && updatedAt > 0 ? updatedAt : Date.now();
  const cleanVerbali = Array.isArray(verbali) ? verbali : [];
  const cleanDelibere = Array.isArray(delibere) ? delibere : [];
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LIBRI_SOCIALI_VERBALI_KEY, JSON.stringify(cleanVerbali));
      localStorage.setItem(LIBRI_SOCIALI_DELIBERE_KEY, JSON.stringify(cleanDelibere));
      localStorage.setItem(LIBRI_SOCIALI_UPDATED_AT_KEY, String(ts));
      window.dispatchEvent(new CustomEvent(LIBRI_SOCIALI_UPDATED_EVENT));
    } catch {}
  }
  return { verbali: cleanVerbali, delibere: cleanDelibere, updatedAt: ts };
}

export function applicaLibriSocialiDaSync(
  verbali?: any[],
  delibere?: any[],
  updatedAt?: number
): boolean {
  if (!Array.isArray(verbali) && !Array.isArray(delibere)) return false;
  const localTs = getLibriSocialiUpdatedAt();
  if (typeof updatedAt === 'number' && updatedAt > 0 && localTs > updatedAt) {
    return false;
  }
  salvaLibriSocialiOdv(
    Array.isArray(verbali) ? verbali : getVerbaliOrganiSociali(),
    Array.isArray(delibere) ? delibere : getDelibereSociOdv(),
    updatedAt || Date.now()
  );
  return true;
}

export function generaNumeroProgressivoVerbale(
  verbali: VerbaleOrganoSociale[],
  organo: TipoOrganoSociale,
  dataSeduta?: string
): string {
  const anno = (dataSeduta || formatISODateItaly()).slice(0, 4) || new Date().getFullYear().toString();
  const prefisso = organo === 'Consiglio Direttivo' ? 'CD' : 'ASS';
  const stessoAnno = verbali.filter(
    (v) =>
      String(v.dataSeduta || '').startsWith(anno) &&
      (organo === 'Consiglio Direttivo'
        ? v.organo === 'Consiglio Direttivo'
        : v.organo !== 'Consiglio Direttivo')
  );
  const nextNum = String(stessoAnno.length + 1).padStart(3, '0');
  return `${prefisso}-${anno}/${nextNum}`;
}

export function generaPdfVerbaleOrganoSociale(verbale: VerbaleOrganoSociale): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const dataIt = verbale.dataSeduta ? verbale.dataSeduta.split('-').reverse().join('/') : '-';

  const drawChrome = (pageNum: number) => {
    disegnaHeaderIstituzionale(doc, {
      titoloDocumento: `LIBRI SOCIALI ODV - VERBALE ${verbale.organo.toUpperCase()}`,
      badge: {
        riga1Tag: 'VERBALE N.',
        riga2Valore: verbale.numeroProgressivo || 'N.D.',
        riga3Sotto: `Seduta del ${dataIt} • ${verbale.stato}`,
      },
      pageWidth,
      margin,
    });
    disegnaFooterIstituzionale(doc, {
      dicituraArchiviazione: `Pagina ${pageNum} • Libro Verbali ${verbale.organo} • Art. 15 D.Lgs. 117/2017 (RUNTS)`,
      pageWidth,
      pageHeight,
      margin,
    });
  };

  let pageNum = 1;
  drawChrome(pageNum);
  let y = 38;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 22) {
      doc.addPage();
      pageNum += 1;
      drawChrome(pageNum);
      y = 38;
    }
  };

  // Titolo Verbale
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(29, 26, 96);
  const titleLines = doc.splitTextToSize(
    sanitizeWinAnsi(`VERBALE N. ${verbale.numeroProgressivo} - ${verbale.organo.toUpperCase()}`),
    contentWidth
  );
  doc.text(titleLines, margin, y);
  y += titleLines.length * 6 + 2;

  if (verbale.titolo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    const subLines = doc.splitTextToSize(sanitizeWinAnsi(verbale.titolo), contentWidth);
    doc.text(subLines, margin, y);
    y += subLines.length * 5 + 3;
  }

  // Box Estremi Seduta
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(sanitizeWinAnsi(`Data seduta: ${dataIt}   |   Orario: ${verbale.oraInizio || '--:--'} - ${verbale.oraFine || '--:--'}`), margin + 4, y + 6);
  doc.text(sanitizeWinAnsi(`Luogo: ${verbale.luogo || 'Sede Legale Associativa'}`), margin + 4, y + 12);
  doc.text(
    sanitizeWinAnsi(
      `Presidente di seduta: ${verbale.presidenteSeduta || '-'}   |   Segretario verbalizzante: ${verbale.segretarioVerbalizzante || '-'}`
    ),
    margin + 4,
    y + 18
  );
  y += 30;

  // Ordine del Giorno
  ensureSpace(22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(29, 26, 96);
  doc.text('ORDINE DEL GIORNO', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const odgLines = doc.splitTextToSize(sanitizeWinAnsi(verbale.ordineDelGiorno || 'Non specificato.'), contentWidth);
  for (const line of odgLines) {
    ensureSpace(6);
    doc.text(line, margin, y);
    y += 4.6;
  }
  y += 4;

  // Deliberazioni e Discussione
  ensureSpace(22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(29, 26, 96);
  doc.text('RESOCONTO E DELIBERAZIONI', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const bodyLines = doc.splitTextToSize(
    sanitizeWinAnsi(verbale.testoDeliberazioni || 'Nessuna deliberazione trascritta.'),
    contentWidth
  );
  for (const line of bodyLines) {
    ensureSpace(6);
    doc.text(line, margin, y);
    y += 4.6;
  }
  y += 8;

  // Foglio Presenze
  const presenti = (verbale.presenze || []).filter((p) => p.presente);
  const assenti = (verbale.presenze || []).filter((p) => !p.presente);
  if ((verbale.presenze || []).length > 0) {
    ensureSpace(26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(29, 26, 96);
    doc.text(
      `FOGLIO PRESENZE E FIRME (${presenti.length} Presenti / ${assenti.length} Assenti)`,
      margin,
      y
    );
    y += 6;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 6.5, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text('NOMINATIVO', margin + 2, y + 4.4);
    doc.text('QUALIFICA / CARICA', margin + 68, y + 4.4);
    doc.text('ESITO', margin + 122, y + 4.4);
    doc.text('FIRMA PRESENZA', margin + 146, y + 4.4);
    y += 8;

    for (const p of verbale.presenze) {
      ensureSpace(9);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y + 6.2, margin + contentWidth, y + 6.2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(sanitizeWinAnsi(p.nomeCompleto).slice(0, 34), margin + 2, y + 4);
      doc.text(sanitizeWinAnsi(p.ruolo || 'Socio').slice(0, 26), margin + 68, y + 4);
      doc.setFont('helvetica', 'bold');
      if (p.presente) {
        doc.setTextColor(5, 150, 105);
        doc.text('PRESENTE', margin + 122, y + 4);
      } else {
        doc.setTextColor(100, 116, 139);
        doc.text(p.delegaA ? 'DELEGA' : 'ASSENTE', margin + 122, y + 4);
      }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(p.delegaA ? sanitizeWinAnsi(`Del: ${p.delegaA}`).slice(0, 22) : '_____________________', margin + 146, y + 4);
      y += 7.5;
    }
    y += 6;
  }

  // Firme finali Presidente & Segretario
  ensureSpace(26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Il Segretario Verbalizzante', margin + 6, y + 4);
  doc.text('Il Presidente della Seduta', margin + contentWidth - 62, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(sanitizeWinAnsi(verbale.segretarioVerbalizzante || ''), margin + 6, y + 9);
  doc.text(sanitizeWinAnsi(verbale.presidenteSeduta || ''), margin + contentWidth - 62, y + 9);
  doc.line(margin + 6, y + 18, margin + 68, y + 18);
  doc.line(margin + contentWidth - 62, y + 18, margin + contentWidth - 4, y + 18);

  const safeNum = (verbale.numeroProgressivo || verbale.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Verbale_${safeNum}_${verbale.dataSeduta || formatISODateItaly()}.pdf`);
}

export function generaPdfRegistroVolontariRunts(volontari: Volontario[]): void {
  const attivi = (volontari || [])
    .filter((v) => v && v.approvato !== false && !v.bloccatoPerTentativi)
    .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it'));

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const oggi = formatISODateItaly();
  const dataOra = formatDateTimeItaly();

  const drawChrome = (pageNum: number) => {
    disegnaHeaderIstituzionale(doc, {
      titoloDocumento: 'REGISTRO UFFICIALE DEI VOLONTARI (ART. 17 D.LGS. 117/2017 - RUNTS)',
      badge: {
        riga1Tag: 'REGISTRO RUNTS',
        riga2Valore: `${attivi.length} VOLONTARI ATTIVI`,
        riga3Sotto: `Aggiornato al ${oggi.split('-').reverse().join('/')}`,
      },
      pageWidth,
      margin,
    });
    disegnaFooterIstituzionale(doc, {
      dicituraArchiviazione: `Pagina ${pageNum} • Registro Volontari ODV Art. 17 CTS (Assicurazione Obbligatoria Art. 18) • Generato il ${dataOra}`,
      pageWidth,
      pageHeight,
      margin,
    });
  };

  let pageNum = 1;
  drawChrome(pageNum);
  let y = 37;

  const drawTableHeader = () => {
    doc.setFillColor(29, 26, 96);
    doc.rect(margin, y, contentWidth, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('N.', margin + 2, y + 5);
    doc.text('MATRICOLA', margin + 11, y + 5);
    doc.text('COGNOME E NOME', margin + 35, y + 5);
    doc.text('CODICE FISCALE', margin + 88, y + 5);
    doc.text('DATA NASCITA', margin + 126, y + 5);
    doc.text('QUALIFICA / RUOLO', margin + 154, y + 5);
    doc.text('SEDE / SEZIONE', margin + 202, y + 5);
    doc.text('ISCRIZIONE', margin + 245, y + 5);
    doc.text('STATO', margin + 266, y + 5);
    y += 9;
  };

  drawTableHeader();

  attivi.forEach((v, idx) => {
    if (y > pageHeight - 22) {
      doc.addPage();
      pageNum += 1;
      drawChrome(pageNum);
      y = 37;
      drawTableHeader();
    }
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 1, contentWidth, 6.8, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 5.6, margin + contentWidth, y + 5.6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.3);
    doc.setTextColor(15, 23, 42);
    doc.text(String(idx + 1), margin + 2, y + 3.8);
    doc.text(sanitizeWinAnsi(v.matricola || '-').slice(0, 14), margin + 11, y + 3.8);
    doc.setFont('helvetica', 'bold');
    doc.text(sanitizeWinAnsi(`${v.cognome || ''} ${v.nome || ''}`).slice(0, 30), margin + 35, y + 3.8);
    doc.setFont('helvetica', 'normal');
    doc.text(sanitizeWinAnsi(v.codiceFiscale || '-').toUpperCase().slice(0, 16), margin + 88, y + 3.8);
    doc.text(sanitizeWinAnsi(v.dataNascita || '-').slice(0, 12), margin + 126, y + 3.8);
    doc.text(sanitizeWinAnsi(v.qualifica || 'Volontario').slice(0, 26), margin + 154, y + 3.8);
    doc.text(sanitizeWinAnsi(v.sezioneAppartenenzaNome || 'Sede Centrale').slice(0, 24), margin + 202, y + 3.8);
    doc.text(sanitizeWinAnsi(v.dataRegistrazione || '-').slice(0, 12), margin + 245, y + 3.8);
    doc.setTextColor(5, 150, 105);
    doc.text(sanitizeWinAnsi(v.bloccatoPerTentativi ? 'Bloccato' : 'Attivo').slice(0, 10), margin + 266, y + 3.8);

    y += 6.8;
  });

  doc.save(`Registro_Volontari_RUNTS_CroceOro_${oggi}.pdf`);
}

export function esportaRegistroVolontariRuntsCsv(volontari: Volontario[]): void {
  const attivi = (volontari || [])
    .filter((v) => v && v.approvato !== false && !v.bloccatoPerTentativi)
    .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it'));

  const headers = [
    'N',
    'Matricola',
    'Cognome',
    'Nome',
    'Codice Fiscale',
    'Data Nascita',
    'Luogo Nascita',
    'Residenza',
    'Telefono',
    'Email',
    'Qualifica',
    'Carica Direttivo',
    'Sezione Appartenenza',
    'Data Iscrizione',
    'Stato',
  ];
  const esc = (v?: string) => `"${String(v || '').replace(/"/g, '""')}"`;
  const rows = attivi.map((v, idx) =>
    [
      String(idx + 1),
      v.matricola || '',
      v.cognome || '',
      v.nome || '',
      (v.codiceFiscale || '').toUpperCase(),
      v.dataNascita || '',
      [v.comuneNascita, v.provinciaNascita ? `(${v.provinciaNascita})` : ''].filter(Boolean).join(' '),
      v.indirizzoResidenza || v.dettaglioResidenza?.comune || '',
      v.telefono || '',
      v.email || '',
      v.qualifica || '',
      v.caricaConsiglioDirettivo || '',
      v.sezioneAppartenenzaNome || '',
      v.dataRegistrazione || '',
      v.bloccatoPerTentativi ? 'Bloccato' : 'Attivo',
    ]
      .map(esc)
      .join(';')
  );
  const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Registro_Volontari_RUNTS_CroceOro_${formatISODateItaly()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
