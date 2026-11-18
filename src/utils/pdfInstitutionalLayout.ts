import { jsPDF } from 'jspdf';
import { LOGO_IPOTESI_SEMITRASP_BASE64 } from '../assets/logoBase64';
import {
  getDatiCartaIntestata,
  DatiCartaIntestata,
  DATI_CARTA_INTESTATA_DEFAULT,
  formattaSocialCartaIntestata,
} from './cartaIntestataStore';

/**
 * Oggetto proxy per retrocompatibilità e accesso diretto.
 * Qualsiasi lettura di ASSOCIAZIONE_INFO restituisce sempre
 * in tempo reale i dati aggiornati configurati dall'utente.
 */
export const ASSOCIAZIONE_INFO: DatiCartaIntestata & { denominazioneMaiuscolo: string } = new Proxy(
  {} as any,
  {
    get(_target, prop: string) {
      const dati = getDatiCartaIntestata();
      if (prop === 'denominazioneMaiuscolo') {
        return (dati.denominazione || DATI_CARTA_INTESTATA_DEFAULT.denominazione).toUpperCase();
      }
      return (dati as any)[prop] ?? (DATI_CARTA_INTESTATA_DEFAULT as any)[prop] ?? '';
    }
  }
);

export interface BadgeHeader {
  riga1Tag: string;       // es. "SCHEDA DIPENDENTE / VOLONTARIO" oppure "DOMANDA DI ISCRIZIONE"
  riga2Valore: string;    // es. "VOL-CROCEORO" oppure "LIBRO SOCI & VOLONTARI" oppure "N. 2026/001"
  riga3Sotto: string;     // es. "Personale Operativo" oppure "Pagina 1 di 2 • RUNTS"
}

export interface OpzioniHeader {
  titoloDocumento: string; // Subtitolo in oro/ambra sotto la denominazione
  badge: BadgeHeader;      // Rettangolo in alto a destra personalizzato per tipologia di file
  pageWidth?: number;      // default 210mm
  margin?: number;         // default 12mm
}

export interface OpzioniFooter {
  dicituraArchiviazione: string; // Riga 3 del footer (es. "Pagina 1 di 1 • Archiviazione Amministrativa")
  pageWidth?: number;            // default 210mm
  pageHeight?: number;           // default 297mm
  margin?: number;               // default 12mm
}

/**
 * Normalizza qualsiasi stringa ai caratteri sicuri WinAnsi / Latin-1 supportati
 * dai font standard jsPDF, evitando mojibake e sfasamenti di larghezza.
 */
export function sanitizeWinAnsi(input?: string | number | null): string {
  if (input === undefined || input === null) return '';
  return String(input)
    .replace(/\[?Ø=ÜÍ\]?/g, '')
    .replace(/[\u2713\u2714]/g, '[OK]')
    .replace(/[\u2715\u2716\u2717\u2718]/g, '[X]')
    .replace(/[\u2605\u2606]/g, '*')
    .replace(/[\u25B6\u25BA]/g, '>')
    .replace(/[\u2014\u2013\u2212]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\u2600-\u27BF]|\uFE0F|\u200D/g, '')
    .replace(/[^\x20-\x7E\xA0-\xFF\u20AC\n]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Disegna l'intestazione istituzionale unificata per tutti i documenti PDF di Croce Oro Massa Carrara OdV.
 * Mantiene la fascia blu navy (#1d1a60) con filetto in oro (#bfa353), il logo ufficiale a sinistra,
 * tutti i dati associativi aggiornati (Sede Legale, Sede Massa, Sede Carrara, Sede Pietrasanta, CF, Tel, Web, Email, PEC)
 * e il rettangolo in alto a destra specifico per tipo di file, con calcolo dinamico righe senza sovrapposizioni.
 */
export function disegnaHeaderIstituzionale(doc: jsPDF, opzioni: OpzioniHeader): void {
  const pageWidth = opzioni.pageWidth || 210;
  const margin = opzioni.margin || 12;
  const info = getDatiCartaIntestata();

  // 1. Fascia Istituzionale Blu Navy (#1d1a60) e Filetto Oro (#bfa353)
  const headerNavyH = 29.5;
  const headerOroH = 1.8;

  doc.setFillColor(29, 26, 96);
  doc.rect(0, 0, pageWidth, headerNavyH, 'F');

  doc.setFillColor(191, 163, 83);
  doc.rect(0, headerNavyH, pageWidth, headerOroH, 'F');

  // 2. Logo Ufficiale a sinistra (21x21 mm)
  try {
    doc.addImage(LOGO_IPOTESI_SEMITRASP_BASE64, 'PNG', margin, 4, 21, 21, undefined, 'FAST');
  } catch {}

  // 3. Rettangolo in Alto a Destra (Personalizzato per tipologia di documento)
  const badgeW = 54;
  const badgeH = 21;
  const badgeX = pageWidth - margin - badgeW;
  const badgeY = 4;

  doc.setFillColor(15, 23, 42); // slate-900 profondo
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, 'F');
  doc.setDrawColor(245, 158, 11); // amber-500
  doc.setLineWidth(0.4);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, 'D');

  // Testo Rettangolo in Alto a Destra
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.8);
  doc.setTextColor(245, 158, 11);
  doc.text(sanitizeWinAnsi(opzioni.badge.riga1Tag).toUpperCase(), badgeX + badgeW / 2, badgeY + 5.0, {
    align: 'center',
    maxWidth: badgeW - 4
  });

  doc.setFontSize(7.8);
  doc.setTextColor(255, 255, 255);
  doc.text(sanitizeWinAnsi(opzioni.badge.riga2Valore), badgeX + badgeW / 2, badgeY + 11.4, {
    align: 'center',
    maxWidth: badgeW - 4
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.4);
  doc.setTextColor(203, 213, 225);
  doc.text(sanitizeWinAnsi(opzioni.badge.riga3Sotto), badgeX + badgeW / 2, badgeY + 17.0, {
    align: 'center',
    maxWidth: badgeW - 4
  });

  // 4. Testi Istituzionali a Sinistra (tra Logo e Badge) con avanzamento Y dinamico
  const textX = margin + 24;
  const maxTextW = badgeX - textX - 4;
  const socialStr = sanitizeWinAnsi(formattaSocialCartaIntestata(info));
  const hasSocial = socialStr.length > 0;

  let curY = 6.8;

  // Riga 1: Nome Associazione
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.0);
  doc.setTextColor(255, 255, 255);
  const nomeAssoc = sanitizeWinAnsi(info.denominazione || DATI_CARTA_INTESTATA_DEFAULT.denominazione).toUpperCase();
  const righeNome = doc.splitTextToSize(nomeAssoc, maxTextW);
  doc.text(righeNome.slice(0, 1), textX, curY);
  curY += 4.2;

  // Riga 2: Titolo Documento in Giallo/Ambra
  doc.setFontSize(6.9);
  doc.setTextColor(253, 224, 71);
  const titoloDoc = sanitizeWinAnsi(opzioni.titoloDocumento);
  const righeTitolo = doc.splitTextToSize(titoloDoc, maxTextW);
  doc.text(righeTitolo.slice(0, 1), textX, curY);
  curY += 3.8;

  // Riga 3: Sede Legale & Tutte le Sedi Operative
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.2);
  doc.setTextColor(226, 232, 240);
  const testoSedi = sanitizeWinAnsi(
    `Sede Legale: ${info.sedeLegale} - Sede Massa: ${info.sedeMassa} - Sede Carrara: ${info.sedeCarrara} - Sede Pietrasanta: ${info.sedePietrasanta}`
  );
  const righeSedi = doc.splitTextToSize(testoSedi, maxTextW).slice(0, 2);
  doc.text(righeSedi, textX, curY);
  curY += righeSedi.length * 2.7 + 0.8;

  // Riga 4: Contatti, Telefono Centrale, CF, Sito Web
  doc.setFontSize(4.3);
  doc.setTextColor(203, 213, 225);
  const testoContatti = sanitizeWinAnsi(`Centrale Tel: ${info.centraleTel} - Codice Fiscale: ${info.codiceFiscale} - ${info.sitoWeb}`);
  const righeContatti = doc.splitTextToSize(testoContatti, maxTextW).slice(0, 1);
  doc.text(righeContatti, textX, curY);
  curY += 3.1;

  // Riga 5: Email Ufficiale e PEC
  const testoEmailPec = sanitizeWinAnsi(`Email: ${info.email} - Pec: ${info.pec}`);
  doc.text(doc.splitTextToSize(testoEmailPec, maxTextW).slice(0, 1), textX, curY);
  curY += 3.0;

  // Riga 6 (facoltativa): Social
  if (hasSocial && curY <= 27.8) {
    doc.setFontSize(4.1);
    doc.setTextColor(253, 224, 71);
    doc.text(doc.splitTextToSize(socialStr, maxTextW).slice(0, 1), textX, curY);
  }
}

/**
 * Disegna il piè di pagina (footer) istituzionale unificato per tutti i file PDF di Croce Oro Massa Carrara OdV.
 * Comprende filetto superiore in oro (#bfa353), coordinate legali/operative con tutte le sedi (Massa, Carrara, Pietrasanta),
 * contatti completi, e la riga con protocollo/archiviazione/numero pagina, formattato rigorosamente senza sovrapposizioni.
 */
export function disegnaFooterIstituzionale(doc: jsPDF, opzioni: OpzioniFooter): void {
  const pageWidth = opzioni.pageWidth || 210;
  const pageHeight = opzioni.pageHeight || 297;
  const margin = opzioni.margin || 12;
  const contentWidth = pageWidth - margin * 2;
  const info = getDatiCartaIntestata();

  // Filetto separatore oro (#bfa353)
  const filettoY = pageHeight - 15.5;
  doc.setFillColor(191, 163, 83);
  doc.rect(margin, filettoY, contentWidth, 0.4, 'F');

  // Riga 1 (Sedi & Telefono Centrale)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.3);
  doc.setTextColor(71, 85, 105);
  const footerSedi = sanitizeWinAnsi(
    `${info.denominazione} - Sede Legale: ${info.sedeLegale} - Sede Massa: ${info.sedeMassa} - Sede Carrara: ${info.sedeCarrara} - Sede Pietrasanta: ${info.sedePietrasanta}`
  );
  const righeFooterSedi = doc.splitTextToSize(footerSedi, contentWidth).slice(0, 2);
  const yRiga1 = filettoY + 3.2;
  doc.text(righeFooterSedi, pageWidth / 2, yRiga1, { align: 'center' });

  // Riga 2 (Centrale Tel, Codice Fiscale, Sito, Email, Pec + eventuali Social)
  const socialStrFooter = sanitizeWinAnsi(formattaSocialCartaIntestata(info));
  doc.setFontSize(socialStrFooter ? 4.1 : 4.3);
  doc.setTextColor(100, 116, 139);
  const footerContatti = sanitizeWinAnsi(
    `Centrale Tel: ${info.centraleTel} - Codice Fiscale: ${info.codiceFiscale} - ${info.sitoWeb} - Email: ${info.email} - Pec: ${info.pec}` +
      (socialStrFooter ? ` - ${socialStrFooter}` : '')
  );
  const yRiga2 = yRiga1 + righeFooterSedi.length * 2.8 + 0.6;
  doc.text(doc.splitTextToSize(footerContatti, contentWidth).slice(0, 1), pageWidth / 2, yRiga2, { align: 'center' });

  // Riga 3 (Dicitura Archiviazione, Numero Pagina, Registro)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.7);
  doc.setTextColor(148, 163, 184);
  const yRiga3 = Math.max(yRiga2 + 3.2, pageHeight - 3.8);
  doc.text(
    sanitizeWinAnsi(opzioni.dicituraArchiviazione),
    pageWidth / 2,
    yRiga3,
    { align: 'center', maxWidth: contentWidth }
  );
}
