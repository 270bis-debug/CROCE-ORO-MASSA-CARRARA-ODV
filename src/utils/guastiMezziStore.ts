import { jsPDF } from 'jspdf';
import { disegnaHeaderIstituzionale, disegnaFooterIstituzionale, sanitizeWinAnsi } from './pdfInstitutionalLayout';
import { formatDateTimeItaly, formatISODateItaly } from './italianTime';

export type TipoSegnalazioneGuasto =
  | 'Guasto Meccanico'
  | 'Danno Carrozzeria'
  | 'Sinistro Stradale'
  | 'Guasto Apparecchiature / Sanitario'
  | 'Pneumatici / Freni / Luci'
  | 'Altro';

export type GravitaGuastoMezzo =
  | 'Lieve / Utilizzabile'
  | 'Attenzione / Con Riserva'
  | 'Critico / Fuori Servizio';

export type StatoSegnalazioneGuasto =
  | 'Aperta'
  | 'In Officina / Presa in Carico'
  | 'Risolta';

export interface SegnalazioneGuastoMezzo {
  id: string;
  mezzoSigla: string;
  mezzoTarga?: string;
  mezzoModello?: string;
  tipo: TipoSegnalazioneGuasto;
  gravita: GravitaGuastoMezzo;
  descrizione: string;
  luogo?: string;
  kmMezzo?: number;
  dataOra: string;
  segnalatoDaId?: string;
  segnalatoDaNome: string;
  sezione?: string;
  fotoBase64?: string[]; // Max 3 foto compresse
  richiestoFermoImmediato?: boolean;
  coinvoltiTerzi?: boolean;
  datiControparte?: string;
  stato: StatoSegnalazioneGuasto;
  noteOfficina?: string;
  costoRiparazione?: number;
  gestitaDa?: string;
  dataChiusura?: string;
  updatedAt: number;
}

const STORAGE_KEY = 'CROCE_ORO_GUASTI_MEZZI_V1';
const UPDATED_AT_KEY = 'CROCE_ORO_GUASTI_MEZZI_UPDATED_AT';
export const GUASTI_MEZZI_UPDATED_EVENT = 'croce_oro_guasti_mezzi_updated';
const MAX_ENTRIES = 120;

export function getSegnalazioniGuastiMezzi(): SegnalazioneGuastoMezzo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getSegnalazioniGuastiUpdatedAt(): number {
  try {
    return Number(localStorage.getItem(UPDATED_AT_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

export function salvaSegnalazioniGuastiMezzi(
  lista: SegnalazioneGuastoMezzo[],
  updatedAt: number = Date.now()
): { lista: SegnalazioneGuastoMezzo[]; updatedAt: number } {
  const ordered = [...(lista || [])]
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ordered));
    localStorage.setItem(UPDATED_AT_KEY, String(updatedAt));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(GUASTI_MEZZI_UPDATED_EVENT, { detail: { lista: ordered, updatedAt } }));
  } catch {}
  return { lista: ordered, updatedAt };
}

export function mergeSegnalazioniGuastiCloud(
  remoti: SegnalazioneGuastoMezzo[],
  remoteUpdatedAt: number = 0
): { lista: SegnalazioneGuastoMezzo[]; updatedAt: number } {
  const locali = getSegnalazioniGuastiMezzi();
  const byId = new Map<string, SegnalazioneGuastoMezzo>();
  for (const g of locali) {
    if (g?.id) byId.set(g.id, g);
  }
  for (const g of remoti || []) {
    if (!g?.id) continue;
    const prev = byId.get(g.id);
    if (!prev || Number(g.updatedAt || 0) >= Number(prev.updatedAt || 0)) {
      byId.set(g.id, g);
    }
  }
  const merged = Array.from(byId.values());
  const nextTs = Math.max(getSegnalazioniGuastiUpdatedAt(), remoteUpdatedAt || Date.now());
  return salvaSegnalazioniGuastiMezzi(merged, nextTs);
}

export function generaPdfSchedaGuastoSinistro(g: SegnalazioneGuastoMezzo): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const dataOraGen = formatDateTimeItaly();

  disegnaHeaderIstituzionale(doc, {
    titoloDocumento: g.tipo === 'Sinistro Stradale'
      ? 'SCHEDA RILEVAZIONE SINISTRO STRADALE / DANNO MEZZO'
      : 'SCHEDA SEGNALAZIONE GUASTO / DANNO MEZZO (OFFICINA)',
    badge: {
      riga1Tag: 'MEZZO',
      riga2Valore: `${g.mezzoSigla}${g.mezzoTarga ? ` • ${g.mezzoTarga}` : ''}`,
      riga3Sotto: `Stato: ${g.stato}`,
    },
    pageWidth,
    margin,
  });

  disegnaFooterIstituzionale(doc, {
    dicituraArchiviazione: `Scheda ${g.id} • Uso Officina / Assicurazione • Croce Oro Massa Carrara OdV • ${dataOraGen}`,
    pageWidth,
    pageHeight,
    margin,
  });

  let y = 42;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 42, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(29, 26, 96);
  doc.text('DATI GENERALI SEGNALAZIONE', margin + 5, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(30, 41, 59);
  doc.text(sanitizeWinAnsi(`Mezzo: ${g.mezzoSigla} ${g.mezzoModello ? `(${g.mezzoModello})` : ''} • Targa: ${g.mezzoTarga || '-'}`), margin + 5, y + 14);
  doc.text(sanitizeWinAnsi(`Tipologia: ${g.tipo} • Gravità: ${g.gravita}`), margin + 5, y + 20);
  doc.text(sanitizeWinAnsi(`Data/Ora: ${g.dataOra} • Chilometraggio: ${g.kmMezzo ? `${g.kmMezzo} km` : 'Non rilevato'}`), margin + 5, y + 26);
  doc.text(sanitizeWinAnsi(`Segnalato da: ${g.segnalatoDaNome}${g.sezione ? ` (${g.sezione})` : ''}`), margin + 5, y + 32);
  doc.text(sanitizeWinAnsi(`Luogo evento: ${g.luogo || 'Non specificato'} • Fermo immediato: ${g.richiestoFermoImmediato ? 'SI' : 'NO'}`), margin + 5, y + 38);
  y += 49;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(29, 26, 96);
  doc.text('DESCRIZIONE DETTAGLIATA DEL GUASTO / DANNO / DINAMICA', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(15, 23, 42);
  const descLines = doc.splitTextToSize(sanitizeWinAnsi(g.descrizione || '-'), contentWidth);
  doc.text(descLines, margin, y);
  y += descLines.length * 4.8 + 6;

  if (g.coinvoltiTerzi || g.datiControparte) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(185, 28, 28);
    doc.text('DATI CONTROPARTE / TERZI COINVOLTI (USO ASSICURATIVO)', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const cpLines = doc.splitTextToSize(sanitizeWinAnsi(g.datiControparte || 'Terzi coinvolti segnalati'), contentWidth);
    doc.text(cpLines, margin, y);
    y += cpLines.length * 4.8 + 6;
  }

  if (g.noteOfficina || g.costoRiparazione) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.setTextColor(29, 26, 96);
    doc.text('GESTIONE OFFICINA / CHIUSURA', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    const offTxt = sanitizeWinAnsi(
      `${g.noteOfficina || ''}${g.costoRiparazione ? ` • Costo riparazione: EUR ${g.costoRiparazione.toFixed(2)}` : ''}${g.gestitaDa ? ` • Gestita da: ${g.gestitaDa}` : ''}${g.dataChiusura ? ` • Chiusa il: ${g.dataChiusura}` : ''}`
    );
    const offLines = doc.splitTextToSize(offTxt, contentWidth);
    doc.text(offLines, margin, y);
    y += offLines.length * 4.8 + 6;
  }

  // Foto allegate
  const fotos = (g.fotoBase64 || []).filter((f) => typeof f === 'string' && f.startsWith('data:image/'));
  if (fotos.length > 0) {
    if (y > 210) {
      doc.addPage();
      y = 22;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(29, 26, 96);
    doc.text(`DOCUMENTAZIONE FOTOGRAFICA ALLEGATA (${fotos.length})`, margin, y);
    y += 5;
    const imgW = fotos.length === 1 ? 110 : 56;
    const imgH = fotos.length === 1 ? 74 : 42;
    fotos.slice(0, 3).forEach((f, idx) => {
      const xPos = margin + idx * (imgW + 4);
      try {
        doc.addImage(f, 'JPEG', xPos, y, imgW, imgH);
        doc.setDrawColor(148, 163, 184);
        doc.rect(xPos, y, imgW, imgH);
      } catch {}
    });
  }

  doc.save(`Scheda_Guasto_${g.mezzoSigla}_${formatISODateItaly()}.pdf`);
}
