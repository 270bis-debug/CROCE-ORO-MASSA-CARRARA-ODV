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
 * Disegna l'intestazione istituzionale unificata per tutti i documenti PDF di Croce Oro Massa Carrara OdV.
 * Mantiene la fascia blu navy (#1d1a60) con filetto in oro (#bfa353), il logo ufficiale a sinistra,
 * tutti i dati associativi aggiornati (Sede Legale, Sede Massa, Sede Carrara, Sede Pietrasanta, CF, Tel, Web, Email, PEC)
 * e il rettangolo in alto a destra specifico per tipo di file.
 */
export function disegnaHeaderIstituzionale(doc: jsPDF, opzioni: OpzioniHeader): void {
  const pageWidth = opzioni.pageWidth || 210;
  const margin = opzioni.margin || 12;
  const info = getDatiCartaIntestata();

  // 1. Fascia Istituzionale Blu Navy (#1d1a60) e Filetto Oro (#bfa353)
  const headerNavyH = 28;
  const headerOroH = 1.8;

  doc.setFillColor(29, 26, 96);
  doc.rect(0, 0, pageWidth, headerNavyH, 'F');

  doc.setFillColor(191, 163, 83);
  doc.rect(0, headerNavyH, pageWidth, headerOroH, 'F');

  // 2. Logo Ufficiale a sinistra (21x21 mm)
  try {
    doc.addImage(LOGO_IPOTESI_SEMITRASP_BASE64, 'PNG', margin, 3.5, 21, 21, undefined, 'FAST');
  } catch {}

  // 3. Rettangolo in Alto a Destra (Personalizzato per tipologia di documento)
  const badgeW = 54;
  const badgeH = 20.5;
  const badgeX = pageWidth - margin - badgeW;
  const badgeY = 3.8;

  doc.setFillColor(15, 23, 42); // slate-900 profondo
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, 'F');
  doc.setDrawColor(245, 158, 11); // amber-500
  doc.setLineWidth(0.4);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.5, 1.5, 'D');

  // Testo Rettangolo in Alto a Destra
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.0);
  doc.setTextColor(245, 158, 11); // ambra vivace
  doc.text(opzioni.badge.riga1Tag.toUpperCase(), badgeX + badgeW / 2, badgeY + 5.0, {
    align: 'center',
    maxWidth: badgeW - 3
  });

  doc.setFontSize(8.2);
  doc.setTextColor(255, 255, 255);
  doc.text(opzioni.badge.riga2Valore, badgeX + badgeW / 2, badgeY + 11.2, {
    align: 'center',
    maxWidth: badgeW - 3
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.6);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(opzioni.badge.riga3Sotto, badgeX + badgeW / 2, badgeY + 16.5, {
    align: 'center',
    maxWidth: badgeW - 3
  });

  // 4. Testi Istituzionali a Sinistra (tra Logo e Badge)
  const textX = margin + 24;
  const maxTextW = badgeX - textX - 3; // ~107mm di larghezza libera
  const socialStr = formattaSocialCartaIntestata(info);
  const hasSocial = socialStr.length > 0;

  // Riga 1: Nome Associazione
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text((info.denominazione || DATI_CARTA_INTESTATA_DEFAULT.denominazione).toUpperCase(), textX, hasSocial ? 7.2 : 8.2);

  // Riga 2: Titolo Documento in Giallo/Ambra
  doc.setFontSize(7.2);
  doc.setTextColor(253, 224, 71); // amber-300
  doc.text(opzioni.titoloDocumento, textX, hasSocial ? 11.4 : 12.8, { maxWidth: maxTextW });

  // Riga 3: Sede Legale & Tutte le Sedi Operative (Massa, Carrara, Pietrasanta)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.3);
  doc.setTextColor(226, 232, 240); // slate-200
  const testoSedi = `Sede Legale: ${info.sedeLegale} • Sede Massa: ${info.sedeMassa} • Sede Carrara: ${info.sedeCarrara} • Sede Pietrasanta: ${info.sedePietrasanta}`;
  doc.text(testoSedi, textX, hasSocial ? 15.2 : 17.2, { maxWidth: maxTextW });

  // Riga 4: Contatti, Telefono Centrale, CF, Sito Web
  doc.setFontSize(4.5);
  doc.setTextColor(203, 213, 225); // slate-300
  const testoContatti = `Centrale Tel: ${info.centraleTel} • Codice Fiscale: ${info.codiceFiscale} • ${info.sitoWeb}`;
  doc.text(testoContatti, textX, hasSocial ? 18.8 : 21.6, { maxWidth: maxTextW });

  // Riga 5: Email Ufficiale e Posta Elettronica Certificata (PEC)
  const testoEmailPec = `Email: ${info.email} • Pec: ${info.pec}`;
  doc.text(testoEmailPec, textX, hasSocial ? 22.3 : 25.4, { maxWidth: maxTextW });

  // Riga 6 (facoltativa): Riferimenti Social Ufficiali - mostrata SOLO se almeno un social è compilato
  if (hasSocial) {
    doc.setFontSize(4.2);
    doc.setTextColor(253, 224, 71);
    doc.text(socialStr, textX, 25.8, { maxWidth: maxTextW });
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

  // Filetto separatore oro (#bfa353) a y = 282.5mm
  const filettoY = pageHeight - 14.5;
  doc.setFillColor(191, 163, 83);
  doc.rect(margin, filettoY, contentWidth, 0.4, 'F');

  // Riga 1 (Sedi & Telefono Centrale) a y = 286.2mm
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.4);
  doc.setTextColor(71, 85, 105); // slate-600
  const footerSedi = `${info.denominazione} • Sede Legale: ${info.sedeLegale} • Sede Massa: ${info.sedeMassa} • Sede Carrara: ${info.sedeCarrara} • Sede Pietrasanta: ${info.sedePietrasanta}`;
  doc.text(footerSedi, pageWidth / 2, pageHeight - 10.8, { align: 'center', maxWidth: contentWidth });

  // Riga 2 (Centrale Tel, Codice Fiscale, Sito, Email, Pec + eventuali Social)
  const socialStrFooter = formattaSocialCartaIntestata(info);
  doc.setFontSize(socialStrFooter ? 4.2 : 4.5);
  doc.setTextColor(100, 116, 139); // slate-500
  const footerContatti =
    `Centrale Tel: ${info.centraleTel} • Codice Fiscale: ${info.codiceFiscale} • ${info.sitoWeb} • Email: ${info.email} • Pec: ${info.pec}` +
    (socialStrFooter ? ` • ${socialStrFooter}` : '');
  doc.text(footerContatti, pageWidth / 2, pageHeight - 7.5, { align: 'center', maxWidth: contentWidth });

  // Riga 3 (Dicitura Archiviazione, Numero Pagina, Registro) a y = 292.8mm
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    opzioni.dicituraArchiviazione,
    pageWidth / 2,
    pageHeight - 4.2,
    { align: 'center', maxWidth: contentWidth }
  );
}
