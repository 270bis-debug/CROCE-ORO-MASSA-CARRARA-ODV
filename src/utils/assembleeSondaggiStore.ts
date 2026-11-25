import { jsPDF } from 'jspdf';
import { disegnaHeaderIstituzionale, disegnaFooterIstituzionale, sanitizeWinAnsi } from './pdfInstitutionalLayout';
import { formatDateTimeItaly, formatISODateItaly } from './italianTime';

export type TipoConvocazioneOdv =
  | 'Assemblea Ordinaria dei Soci'
  | 'Assemblea Straordinaria dei Soci'
  | 'Riunione di Sezione'
  | 'Consiglio Direttivo';

export interface RispostaConvocazioneOdv {
  volontarioId: string;
  volontarioNome: string;
  esito: 'Presente' | 'Assente' | 'Delega';
  delegatoAId?: string;
  delegatoANome?: string;
  note?: string;
  dataOra: string;
}

export interface ConvocazioneAssembleaOdv {
  id: string;
  titolo: string;
  tipo: TipoConvocazioneOdv;
  dataPrimaConvocazione: string; // YYYY-MM-DD
  oraPrimaConvocazione: string;
  dataSecondaConvocazione?: string;
  oraSecondaConvocazione?: string;
  luogo: string;
  ordineDelGiorno: string;
  sezioneTargetId: string; // 'tutte' o id sede
  sezioneTargetNome: string;
  maxDeleghePerSocio?: number; // Default 3 (Art. 24 CTS per ODV <500 soci)
  creataDa: string;
  dataCreazione: string;
  stato: 'Aperta' | 'Chiusa' | 'Annullata';
  risposte: RispostaConvocazioneOdv[];
  updatedAt: number;
}

export interface OpzioneSondaggioOdv {
  id: string;
  testo: string;
}

export interface VotoSondaggioOdv {
  volontarioId: string;
  volontarioNome: string;
  opzioniIds: string[];
  dataOra: string;
}

export interface SondaggioRapidoOdv {
  id: string;
  domanda: string;
  descrizione?: string;
  opzioni: OpzioneSondaggioOdv[];
  sceltaMultipla: boolean;
  anonimo: boolean;
  sezioneTargetId: string;
  sezioneTargetNome: string;
  dataScadenza?: string;
  creatoDa: string;
  dataCreazione: string;
  stato: 'Aperto' | 'Chiuso';
  voti: VotoSondaggioOdv[];
  updatedAt: number;
}

export interface ArchivioAssembleeSondaggiPayload {
  convocazioni: ConvocazioneAssembleaOdv[];
  sondaggi: SondaggioRapidoOdv[];
  updatedAt: number;
}

const KEY_CONVOCAZIONI = 'CROCE_ORO_CONVOCAZIONI_ASSEMBLEE_V1';
const KEY_SONDAGGI = 'CROCE_ORO_SONDAGGI_RAPIDI_V1';
const KEY_UPDATED_AT = 'CROCE_ORO_ASSEMBLEE_SONDAGGI_UPDATED_AT';
export const ASSEMBLEE_SONDAGGI_UPDATED_EVENT = 'croce_oro_assemblee_sondaggi_updated';

export function getConvocazioniAssemblee(): ConvocazioneAssembleaOdv[] {
  try {
    const raw = localStorage.getItem(KEY_CONVOCAZIONI);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getSondaggiRapidi(): SondaggioRapidoOdv[] {
  try {
    const raw = localStorage.getItem(KEY_SONDAGGI);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getAssembleeSondaggiUpdatedAt(): number {
  try {
    return Number(localStorage.getItem(KEY_UPDATED_AT) || 0) || 0;
  } catch {
    return 0;
  }
}

export function salvaAssembleeSondaggi(
  convocazioni: ConvocazioneAssembleaOdv[],
  sondaggi: SondaggioRapidoOdv[],
  updatedAt: number = Date.now()
): ArchivioAssembleeSondaggiPayload {
  const convSorted = [...(convocazioni || [])]
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .slice(0, 60);
  const sondSorted = [...(sondaggi || [])]
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .slice(0, 80);

  try {
    localStorage.setItem(KEY_CONVOCAZIONI, JSON.stringify(convSorted));
    localStorage.setItem(KEY_SONDAGGI, JSON.stringify(sondSorted));
    localStorage.setItem(KEY_UPDATED_AT, String(updatedAt));
  } catch {}
  try {
    window.dispatchEvent(
      new CustomEvent(ASSEMBLEE_SONDAGGI_UPDATED_EVENT, {
        detail: { convocazioni: convSorted, sondaggi: sondSorted, updatedAt },
      })
    );
  } catch {}
  return { convocazioni: convSorted, sondaggi: sondSorted, updatedAt };
}

export function mergeAssembleeSondaggiCloud(
  payload: Partial<ArchivioAssembleeSondaggiPayload> | null | undefined
): ArchivioAssembleeSondaggiPayload {
  const locConv = getConvocazioniAssemblee();
  const locSond = getSondaggiRapidi();

  const convMap = new Map<string, ConvocazioneAssembleaOdv>();
  for (const c of locConv) if (c?.id) convMap.set(c.id, c);
  for (const c of payload?.convocazioni || []) {
    if (!c?.id) continue;
    const prev = convMap.get(c.id);
    if (!prev) {
      convMap.set(c.id, c);
    } else {
      const rispMap = new Map<string, RispostaConvocazioneOdv>();
      for (const r of prev.risposte || []) rispMap.set(r.volontarioId, r);
      for (const r of c.risposte || []) rispMap.set(r.volontarioId, r);
      const base = Number(c.updatedAt || 0) >= Number(prev.updatedAt || 0) ? c : prev;
      convMap.set(c.id, { ...base, risposte: Array.from(rispMap.values()) });
    }
  }

  const sondMap = new Map<string, SondaggioRapidoOdv>();
  for (const s of locSond) if (s?.id) sondMap.set(s.id, s);
  for (const s of payload?.sondaggi || []) {
    if (!s?.id) continue;
    const prev = sondMap.get(s.id);
    if (!prev) {
      sondMap.set(s.id, s);
    } else {
      const votiMap = new Map<string, VotoSondaggioOdv>();
      for (const v of prev.voti || []) votiMap.set(v.volontarioId, v);
      for (const v of s.voti || []) votiMap.set(v.volontarioId, v);
      const base = Number(s.updatedAt || 0) >= Number(prev.updatedAt || 0) ? s : prev;
      sondMap.set(s.id, { ...base, voti: Array.from(votiMap.values()) });
    }
  }

  const nextTs = Math.max(getAssembleeSondaggiUpdatedAt(), Number(payload?.updatedAt || 0) || Date.now());
  return salvaAssembleeSondaggi(Array.from(convMap.values()), Array.from(sondMap.values()), nextTs);
}

/**
 * Helper centralizzato: verifica se un account appartiene al Consiglio Direttivo o è Amministratore.
 * Usato per proteggere creazione Convocazioni/Sondaggi e accesso Statistiche Annuali.
 */
export function isMembroDirettivoOAdmin(params: {
  isAdmin?: boolean;
  caricaConsiglioDirettivo?: string | null;
  qualifica?: string | null;
}): boolean {
  if (params.isAdmin) return true;
  const carica = String(params.caricaConsiglioDirettivo || '').trim().toLowerCase();
  if (
    carica &&
    !['nessuna', 'nessuna carica', 'nessuna carica direttivo', '-', 'n/d', 'volontario'].includes(carica)
  ) {
    return true;
  }
  const q = String(params.qualifica || '').trim().toLowerCase();
  return (
    q.includes('presidente') ||
    q.includes('vicepresidente') ||
    q.includes('segretario') ||
    q.includes('tesoriere') ||
    q.includes('consigliere') ||
    q.includes('direttivo')
  );
}

export function generaPdfConvocazioneAssemblea(c: ConvocazioneAssembleaOdv): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const presenti = (c.risposte || []).filter((r) => r.esito === 'Presente');
  const deleghe = (c.risposte || []).filter((r) => r.esito === 'Delega');
  const assenti = (c.risposte || []).filter((r) => r.esito === 'Assente');

  disegnaHeaderIstituzionale(doc, {
    titoloDocumento: `CONVOCAZIONE UFFICIALE — ${c.tipo.toUpperCase()}`,
    badge: {
      riga1Tag: 'CONVOCAZIONE',
      riga2Valore: c.dataPrimaConvocazione.split('-').reverse().join('/'),
      riga3Sotto: `Ore ${c.oraPrimaConvocazione}`,
    },
    pageWidth,
    margin,
  });

  disegnaFooterIstituzionale(doc, {
    dicituraArchiviazione: `Convocazione ${c.id} • Croce Oro Massa Carrara OdV • Generato il ${formatDateTimeItaly()}`,
    pageWidth,
    pageHeight,
    margin,
  });

  let y = 42;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(29, 26, 96);
  doc.text(sanitizeWinAnsi(c.titolo), pageWidth / 2, y, { align: 'center', maxWidth: contentWidth });
  y += 10;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(191, 163, 83);
  doc.roundedRect(margin, y, contentWidth, 34, 3, 3, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(30, 41, 59);
  doc.text(sanitizeWinAnsi(`Organo / Tipo: ${c.tipo} • Destinatari: ${c.sezioneTargetNome}`), margin + 5, y + 7);
  doc.text(sanitizeWinAnsi(`1a Convocazione: ${c.dataPrimaConvocazione.split('-').reverse().join('/')} alle ore ${c.oraPrimaConvocazione}`), margin + 5, y + 14);
  if (c.dataSecondaConvocazione) {
    doc.text(sanitizeWinAnsi(`2a Convocazione: ${c.dataSecondaConvocazione.split('-').reverse().join('/')} alle ore ${c.oraSecondaConvocazione || c.oraPrimaConvocazione}`), margin + 5, y + 21);
  }
  doc.text(sanitizeWinAnsi(`Luogo di svolgimento: ${c.luogo}`), margin + 5, y + 28);
  y += 42;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(29, 26, 96);
  doc.text('ORDINE DEL GIORNO', margin, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(15, 23, 42);
  const odgLines = doc.splitTextToSize(sanitizeWinAnsi(c.ordineDelGiorno || '-'), contentWidth);
  doc.text(odgLines, margin, y);
  y += odgLines.length * 4.8 + 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(29, 26, 96);
  doc.text(
    `FOGLIO ADESIONI & DELEGHE REGISTRATE (Presenti: ${presenti.length} • Deleghe: ${deleghe.length} • Assenti: ${assenti.length})`,
    margin,
    y
  );
  y += 6;

  if (presenti.length === 0 && deleghe.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.8);
    doc.setTextColor(100, 116, 139);
    doc.text('Nessuna conferma di presenza o delega ancora registrata.', margin, y);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.4);
    doc.setTextColor(30, 41, 59);
    [...presenti, ...deleghe].forEach((r, idx) => {
      if (y > pageHeight - 25) {
        doc.addPage();
        y = 22;
      }
      const line =
        r.esito === 'Delega'
          ? `${idx + 1}. [DELEGA] ${r.volontarioNome} delega -> ${r.delegatoANome || 'Non indicato'} (${r.dataOra})`
          : `${idx + 1}. [PRESENTE] ${r.volontarioNome} (${r.dataOra})`;
      doc.text(sanitizeWinAnsi(line), margin + 2, y);
      y += 5.2;
    });
  }

  doc.save(`Convocazione_${c.dataPrimaConvocazione || formatISODateItaly()}.pdf`);
}
