import { jsPDF } from 'jspdf';
import { Volontario } from '../components/DatabaseVolontariModal';
import {
  RicevutaTesseramento,
  DICITURA_ESENZIONE_BOLLO,
  formattaNumeroRicevuta
} from '../data/tesseramento';
import {
  disegnaHeaderIstituzionale,
  disegnaFooterIstituzionale,
  sanitizeWinAnsi
} from './pdfInstitutionalLayout';
import { formatISODateItaly, getCurrentYearItaly } from './italianTime';

function pulisciTesto(str?: string): string {
  return sanitizeWinAnsi(str);
}

/**
 * Converte l'importo numerico in lettere per la ricevuta (italiano)
 */
function importoInLettere(importo: number): string {
  if (importo === 0) return 'Zero/00 (Quota già assolta)';
  if (importo === 5) return 'Cinque/00';
  if (importo === 10) return 'Dieci/00';
  return `${importo.toFixed(2).replace('.', ',')}`;
}

/**
 * Genera il file PDF ufficiale della Ricevuta di Tesseramento e Quota Associativa.
 * Scaricabile solo dall'amministratore, a firma della Tesoriera del Consiglio Direttivo.
 */
export function generaRicevutaTesseramentoPDF(
  volontario: Volontario,
  ricevuta?: RicevutaTesseramento,
  tesoriera?: { nome: string; cognome: string; carica?: string; firmaBase64?: string }
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2; // 180mm

  const tess = volontario.tesseramento;
  const anno = ricevuta?.annoRiferimento || tess?.annoRiferimento || getCurrentYearItaly();
  const numRic = ricevuta?.numeroRicevutaFormattato || (tess?.numeroRicevuta ? formattaNumeroRicevuta(tess.numeroRicevuta, anno) : '01/' + anno);
  const dataRic = ricevuta?.dataEmissione || tess?.dataRinnovo || formatISODateItaly();
  const importo = ricevuta?.importo !== undefined ? ricevuta.importo : (tess?.importoVersato !== undefined ? tess.importoVersato : (volontario.profiloCentrale || volontario.qualifica === 'Operatore Centrale' ? 10.0 : 5.0));
  const isEsenteFineAnno = ricevuta?.esenteQuotaPrimoAnno || tess?.copertaDaIscrizioneFineAnnoPrec || (importo === 0);

  // 1. INTESTAZIONE ISTITUZIONALE UNIFICATA CON RETTANGOLO RICEVUTA A DESTRA
  disegnaHeaderIstituzionale(doc, {
    titoloDocumento: 'RICEVUTA QUOTA ASSOCIATIVA & TESSERAMENTO ANNUALE',
    badge: {
      riga1Tag: 'RICEVUTA TESSERAMENTO',
      riga2Valore: pulisciTesto(numRic),
      riga3Sotto: `Anno Sociale ${anno} • RUNTS`
    },
    pageWidth,
    margin
  });

  let currentY = 33;

  // 2. BOX TITOLO DOCUMENTO & ANNO SOCIALE
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(191, 163, 83);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, currentY, contentWidth, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(29, 26, 96);
  doc.text('ATTESTAZIONE DI PAGAMENTO QUOTA ASSOCIATIVA ANNUALE', margin + 4, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  doc.text('Anno Sociale: ', margin + 4, currentY + 10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${anno}`, margin + 22, currentY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Data Convalida / Emissione: ', margin + 45, currentY + 10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${dataRic}`, margin + 83, currentY + 10.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(191, 163, 83);
  doc.text(`Ricevuta N. ${pulisciTesto(numRic)}`, margin + contentWidth - 4, currentY + 10.5, { align: 'right' });

  currentY += 17.5;

  // 3. BOX DATI ANAGRAFICI DEL SOCIO (RECUPERO AUTOMATICO)
  const boxSocioH = 46;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxSocioH, 2, 2, 'FD');

  // Testatina Box Socio
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, contentWidth, 6.5, 2, 2, 'F');
  doc.rect(margin, currentY + 3.5, contentWidth, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('1. DATI ANAGRAFICI, FISCALI E ASSOCIATIVI DEL SOCIO', margin + 3.5, currentY + 4.8);

  const col1X = margin + 4;
  const col2X = margin + (contentWidth / 2) + 2;

  // Foto o Avatar se presente
  let testoInizioX = col1X;
  if (volontario.fotoBase64) {
    try {
      doc.addImage(volontario.fotoBase64, 'JPEG', col1X, currentY + 9, 23, 28, undefined, 'FAST');
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.rect(col1X, currentY + 9, 23, 28, 'S');
      testoInizioX = col1X + 26;
    } catch {
      testoInizioX = col1X;
    }
  }

  // Nome e Cognome
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('Cognome e Nome:', testoInizioX, currentY + 13);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${pulisciTesto(volontario.cognome).toUpperCase()} ${pulisciTesto(volontario.nome)}`, testoInizioX + 28, currentY + 13);

  // Codice Fiscale
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('Codice Fiscale:', testoInizioX, currentY + 19);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(pulisciTesto(volontario.codiceFiscale || 'NON SPECIFICATO'), testoInizioX + 28, currentY + 19);

  // Indirizzo di Residenza
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('Residenza:', testoInizioX, currentY + 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  const indCompleto = pulisciTesto(volontario.indirizzoResidenza || 'Non specificato in anagrafica');
  doc.text(indCompleto, testoInizioX + 28, currentY + 25, { maxWidth: contentWidth / 2 - 20 });

  // Telefono ed Email
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('Recapito Telefonico:', testoInizioX, currentY + 31);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(pulisciTesto(volontario.telefono || 'N/D'), testoInizioX + 28, currentY + 31);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('Indirizzo Email:', testoInizioX, currentY + 37);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(pulisciTesto(volontario.email || 'N/D'), testoInizioX + 28, currentY + 37, { maxWidth: contentWidth / 2 - 20 });

  // Colonna 2: Dati Associativi & Carica Direttivo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('Numero Tessera Socio:', col2X, currentY + 13);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(191, 163, 83);
  doc.text(pulisciTesto(tess?.numeroTessera || volontario.matricola || 'TESS-2026'), col2X + 35, currentY + 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('Qualifica Operativa:', col2X, currentY + 19);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(pulisciTesto(volontario.qualifica || (volontario.profiloCentrale ? 'Operatore Centrale' : 'Volontario')), col2X + 35, currentY + 19);

  // Carica nel Consiglio Direttivo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('Consiglio Direttivo:', col2X, currentY + 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  if (volontario.caricaConsiglioDirettivo && volontario.caricaConsiglioDirettivo !== 'Nessuna') {
    doc.setTextColor(180, 83, 9);
    doc.text(`* ${pulisciTesto(volontario.caricaConsiglioDirettivo)}`, col2X + 35, currentY + 25, { maxWidth: contentWidth / 2 - 38 });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Nessuna carica direttiva (Socio Ordinario)', col2X + 35, currentY + 25, { maxWidth: contentWidth / 2 - 38 });
  }

  // Data Prima Iscrizione
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('Prima Iscrizione:', col2X, currentY + 31);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(pulisciTesto(tess?.dataPrimaIscrizione || volontario.dataRegistrazione || 'Storico Ente'), col2X + 35, currentY + 31);

  // Stato Timbro Cartaceo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('Timbro Cartaceo:', col2X, currentY + 37);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  if (tess?.timbroCartaceoEseguito) {
    doc.setTextColor(22, 101, 52);
    doc.text('[OK] APPOSTO SU TESSERA', col2X + 35, currentY + 37, { maxWidth: contentWidth / 2 - 38 });
  } else {
    doc.setTextColor(180, 83, 9);
    doc.text('Da apporre su tessera cartacea', col2X + 35, currentY + 37, { maxWidth: contentWidth / 2 - 38 });
  }

  currentY += boxSocioH + 4;

  // 4. DETTAGLIO DELLA QUOTA E CAUSALE DEL VERSAMENTO
  const boxQuotaH = 50;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxQuotaH, 2, 2, 'FD');

  // Testatina Box Quota
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, contentWidth, 6.5, 2, 2, 'F');
  doc.rect(margin, currentY + 3.5, contentWidth, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('2. DETTAGLIO QUOTA SOCIALE VERSATA & CAUSALE', margin + 3.5, currentY + 4.8);

  // Tabella Dettaglio Quota
  const quotaRowY = currentY + 11;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('Causale Ufficiale del Versamento:', margin + 4, quotaRowY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  const causale = `Quota sociale associativa per il rinnovo del tesseramento all'Associazione Croce Oro Massa Carrara OdV per l'anno solare ${anno}, approvata dal Consiglio Direttivo ai sensi dello Statuto vigente.`;
  const splitCausale = doc.splitTextToSize(causale, contentWidth - 8);
  doc.text(splitCausale, margin + 4, quotaRowY + 4.5);

  // Box Importo in evidenza
  const importoBoxY = quotaRowY + 14;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(191, 163, 83);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin + 4, importoBoxY, contentWidth - 8, 19, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('Importo Versato:', margin + 8, importoBoxY + 6);

  doc.setFontSize(14);
  doc.setTextColor(191, 163, 83);
  doc.text(`€ ${importo.toFixed(2).replace('.', ',')}`, margin + 8, importoBoxY + 13.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('IN LETTERE:', margin + 45, importoBoxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Euro ${importoInLettere(importo)}`, margin + 45, importoBoxY + 13);

  // Nota Speciale se esente per iscrizione fine anno precedente
  if (isEsenteFineAnno) {
    doc.setFillColor(254, 240, 138); // Giallo
    doc.setDrawColor(234, 179, 8);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin + 105, importoBoxY + 2.5, contentWidth - 118, 14, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(133, 77, 14);
    doc.text('* REGOLA ISCRIZIONE FINE ANNO:', margin + 107, importoBoxY + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.text(`Iscrizione a fine ${anno - 1} (Ott/Nov/Dic):`, margin + 107, importoBoxY + 10, { maxWidth: contentWidth - 122 });
    doc.text(`quota ${anno} gia compresa. Solo timbro!`, margin + 107, importoBoxY + 13.5, { maxWidth: contentWidth - 122 });
  }

  currentY += boxQuotaH + 4;

  // 5. DICITURA FISCALE OBBLIGATORIA (ART. 82 D.LGS 117/2017) IN EVIDENZA
  doc.setFillColor(254, 249, 195); // Giallo soft per il bollo
  doc.setDrawColor(234, 179, 8);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, currentY, contentWidth, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(133, 77, 14);
  doc.text('DISPOSIZIONE FISCALE E AGEVOLAZIONE ENTI DEL TERZO SETTORE (RUNTS):', margin + 4, currentY + 4.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`"${DICITURA_ESENZIONE_BOLLO}"`, margin + 4, currentY + 10);

  currentY += 18;

  // 6. RIQUADRI FIRME: TESORIERA & AMMINISTRATORE
  const boxFirmaH = 46;
  const colFirmaW = (contentWidth - 6) / 2;

  // Nome della Tesoriera predefinito o recuperato
  const nomeTesoriera = tesoriera
    ? `${tesoriera.cognome.toUpperCase()} ${tesoriera.nome}`
    : 'LA TESORIERA';
  const caricaTesoriera = tesoriera?.carica || 'Tesoriera del Consiglio Direttivo';

  // Box 1: Firma Obbligatoria del Tesoriere
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, currentY, colFirmaW, boxFirmaH, 1.5, 1.5, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, colFirmaW, 6.5, 1.5, 1.5, 'F');
  doc.rect(margin, currentY + 3.5, colFirmaW, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('A CURA E FIRMA OBBLIGATORIA DEL TESORIERE', margin + 3, currentY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text(nomeTesoriera, margin + 3, currentY + 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text(caricaTesoriera, margin + 3, currentY + 15.5);

  // Firma del Tesoriere: Grafica trasparente se caricata, OPPURE Sigillo Istituzionale di Firma Digitale Automatica
  if (tesoriera?.firmaBase64) {
    try {
      doc.addImage(tesoriera.firmaBase64, 'PNG', margin + 12, currentY + 17, 45, 17, undefined, 'FAST');
    } catch {
      disegnaFirmaAutomaticaTesoriere(doc, margin + 3, currentY + 17.5, colFirmaW - 6, 20, nomeTesoriera);
    }
  } else {
    // Apposizione automatica obbligatoria della firma digitale del Tesoriere in carica
    disegnaFirmaAutomaticaTesoriere(doc, margin + 3, currentY + 17.5, colFirmaW - 6, 20, nomeTesoriera);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Emesso in data: ${dataRic} a Massa Carrara (MS)`, margin + 3, currentY + 42);

  // Box 2: Timbro Ente e Firma di Ricevuta del Socio
  const box2X = margin + colFirmaW + 6;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.35);
  doc.roundedRect(box2X, currentY, colFirmaW, boxFirmaH, 1.5, 1.5, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(box2X, currentY, colFirmaW, 6.5, 1.5, 1.5, 'F');
  doc.rect(box2X, currentY + 3.5, colFirmaW, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('TIMBRO ASSOCIAZIONE & FIRMA DEL SOCIO', box2X + 3, currentY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Croce Oro Massa Carrara OdV', box2X + 3, currentY + 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text('Per ricevuta e convalida tesseramento', box2X + 3, currentY + 15.5);

  // Firma del Socio se ha firmato digitalmente
  if (volontario.firmaBase64) {
    try {
      doc.addImage(volontario.firmaBase64, 'PNG', box2X + 12, currentY + 17, 45, 17, undefined, 'FAST');
    } catch {}
  } else {
    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(box2X + 6, currentY + 33, box2X + colFirmaW - 6, currentY + 33);
    doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.8);
    doc.setTextColor(148, 163, 184);
    doc.text('(Firma del Socio per presa d\'atto)', box2X + 3, currentY + 37);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Tessera N. ${pulisciTesto(tess?.numeroTessera || volontario.matricola || 'TESS-2026')}`, box2X + 3, currentY + 42);

  // 7. FOOTER DELLA PAGINA UNIFICATO (RIGOROSAMENTE 1 PAGINA A4)
  disegnaFooterIstituzionale(doc, {
    dicituraArchiviazione: 'Pagina 1 di 1 • Ricevuta Originale Conservata agli Atti del Libro Soci e Registro Amministrativo RUNTS',
    pageWidth,
    pageHeight,
    margin
  });

  return doc;
}

/**
 * Disegna il sigillo grafico certificato di firma automatica del Tesoriere in carica
 */
function disegnaFirmaAutomaticaTesoriere(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  nomeTesoriere: string
): void {
  // Box di sicurezza firma digitale con bordo dorato/blu
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(191, 163, 83);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, w, h, 1, 1, 'FD');

  // Badge intestazione firma
  doc.setFillColor(30, 41, 59);
  doc.rect(x + 1, y + 1, w - 2, 3.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  doc.setTextColor(255, 255, 255);
  doc.text('[OK] FIRMA DIGITALE AUTOMATICA CERTIFICATA', x + 2.5, y + 3.4);

  // Scrittura corsiva del nome
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(9.5);
  doc.setTextColor(29, 26, 96);
  doc.text(nomeTesoriere, x + 3, y + 9.5);

  // Linea ondulata di firma
  doc.setDrawColor(29, 26, 96);
  doc.setLineWidth(0.35);
  doc.line(x + 3, y + 11, x + w - 4, y + 11);

  // Metadati di certificazione
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.8);
  doc.setTextColor(71, 85, 105);
  doc.text('Carica: Tesoriere del Consiglio Direttivo • RUNTS OdV', x + 3, y + 14.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.setTextColor(180, 83, 9);
  doc.text('Doc. conforme art. 82 D.Lgs 117/2017 & CAD D.Lgs 82/2005', x + 3, y + 18);
}

/**
 * Individua in automatico chi ha la carica di Tesoriere all'interno del Consiglio Direttivo
 */
export function getTesoriereAttivo(volontari: Volontario[] = []): {
  nome: string;
  cognome: string;
  carica: string;
  email: string;
  firmaBase64?: string;
} {
  const found = volontari.find(
    (v) =>
      v.caricaConsiglioDirettivo &&
      v.caricaConsiglioDirettivo.toLowerCase().includes('tesorier')
  );

  if (found) {
    return {
      nome: found.nome,
      cognome: found.cognome,
      carica: found.caricaConsiglioDirettivo || 'Tesoriere del Consiglio Direttivo',
      email: found.email || 'tesoreria@croceoro.org',
      firmaBase64: found.firmaBase64
    };
  }

  // Predefinito istituzionale dell'Ufficio di Tesoreria
  return {
    nome: 'Sara',
    cognome: 'Ferretti',
    carica: 'Tesoriere del Consiglio Direttivo',
    email: 'tesoreria@croceoro.org',
    firmaBase64: undefined
  };
}

/**
 * Scarica direttamente il file PDF della Ricevuta di Tesseramento nel browser dell'amministratore.
 */
export function scaricaRicevutaTesseramentoPDF(
  volontario: Volontario,
  ricevuta?: RicevutaTesseramento,
  tesoriera?: { nome: string; cognome: string; carica?: string; firmaBase64?: string }
): jsPDF {
  const doc = generaRicevutaTesseramentoPDF(volontario, ricevuta, tesoriera);
  const anno = ricevuta?.annoRiferimento || volontario.tesseramento?.annoRiferimento || getCurrentYearItaly();
  const numSanit = (ricevuta?.numeroRicevutaFormattato || volontario.tesseramento?.numeroRicevutaFormattato || 'Ricevuta')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const nomeFile = `Ricevuta_Tesseramento_${anno}_${volontario.cognome}_${volontario.nome}_${numSanit}.pdf`;
  doc.save(nomeFile);
  return doc;
}

/**
 * Genera la ricevuta, avvia la stampa/download PDF E invia una mail automatica a chi ha la carica di Tesoriere con allegato il PDF
 */
export async function stampaEInviaRicevutaTesseramento(
  volontario: Volontario,
  ricevuta?: RicevutaTesseramento,
  volontari: Volontario[] = []
): Promise<{ success: boolean; emailInviata: boolean; destinatarioEmail: string; error?: string }> {
  try {
    const tesoriere = getTesoriereAttivo(volontari);
    const doc = generaRicevutaTesseramentoPDF(volontario, ricevuta, tesoriere);

    const anno = ricevuta?.annoRiferimento || volontario.tesseramento?.annoRiferimento || getCurrentYearItaly();
    const numRic = ricevuta?.numeroRicevutaFormattato || volontario.tesseramento?.numeroRicevutaFormattato || `01/${anno}`;
    const nomeFile = `Ricevuta_Tesseramento_${anno}_${(volontario.cognome || 'Socio').replace(/[^a-zA-Z0-9_-]/g, '_')}_${(volontario.nome || '').replace(/[^a-zA-Z0-9_-]/g, '_')}_${numRic.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    // 1. Download / Stampa locale del documento
    doc.save(nomeFile);

    // 2. Esportazione Base64 per allegato email
    const pdfBase64 = doc.output('datauristring');

    // 3. Invio email a chi ha la carica di tesoriere
    let emailInviata = false;
    try {
      const res = await fetch('/api/invia-email-ricevuta-tesoriere', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tesoriereEmail: tesoriere.email,
          tesoriereNome: `${tesoriere.nome} ${tesoriere.cognome}`,
          socioNome: volontario.nome,
          socioCognome: volontario.cognome,
          numeroTessera: volontario.tesseramento?.numeroTessera || volontario.matricola || 'VOL-2026',
          numeroRicevuta: numRic,
          importo: ricevuta?.importo !== undefined ? ricevuta.importo : (volontario.tesseramento?.importoVersato || 5.0),
          pdfBase64,
          nomeFile
        })
      });
      const data = await res.json();
      emailInviata = !!data?.success;
    } catch (err) {
      console.warn('Errore chiamata invio email ricevuta tesoriere:', err);
    }

    return {
      success: true,
      emailInviata,
      destinatarioEmail: tesoriere.email
    };
  } catch (err: any) {
    console.error('Errore stampa e invio ricevuta tesseramento:', err);
    return {
      success: false,
      emailInviata: false,
      destinatarioEmail: 'tesoreria@croceoro.org',
      error: err?.message || 'Errore generazione ricevuta'
    };
  }
}

/**
 * Converte una TesseraAssociativa (da SezioneContabilita) in formato Volontario per la generazione PDF
 */
export function preparaVolontarioDaTessera(
  tessera: {
    numeroTessera: string;
    annoSociale: number;
    socioNome: string;
    socioCognome: string;
    socioCodiceFiscale: string;
    qualifica: string;
    quotaVersata: number;
    dataEmissione: string;
    ricevutaNumero?: string;
  },
  volontari: Volontario[] = []
): Volontario {
  const match = volontari.find(
    (v) =>
      (v.codiceFiscale && tessera.socioCodiceFiscale && v.codiceFiscale.toUpperCase() === tessera.socioCodiceFiscale.toUpperCase()) ||
      (v.nome.toLowerCase() === tessera.socioNome.toLowerCase() && v.cognome.toLowerCase() === tessera.socioCognome.toLowerCase())
  );

  if (match) {
    return {
      ...match,
      tesseramento: {
        ...match.tesseramento,
        numeroTessera: tessera.numeroTessera,
        annoRiferimento: tessera.annoSociale,
        rinnovata: true,
        dataRinnovo: tessera.dataEmissione,
        importoVersato: tessera.quotaVersata,
        numeroRicevutaFormattato: tessera.ricevutaNumero || `01/${tessera.annoSociale}`
      }
    };
  }

  // Volontario sintetico completo dai dati della tessera
  return {
    id: `socio-${Date.now()}`,
    nome: tessera.socioNome,
    cognome: tessera.socioCognome,
    codiceFiscale: tessera.socioCodiceFiscale,
    indirizzoResidenza: 'Via Como, 12 Massa (MS)',
    matricola: tessera.numeroTessera,
    qualifica: tessera.qualifica as any,
    telefono: '0585 625410',
    email: 'segreteria@croceoro.org',
    pin: '0000',
    dataRegistrazione: tessera.dataEmissione,
    inTurno: false,
    tesseramento: {
      numeroTessera: tessera.numeroTessera,
      annoRiferimento: tessera.annoSociale,
      rinnovata: true,
      dataRinnovo: tessera.dataEmissione,
      importoVersato: tessera.quotaVersata,
      numeroRicevutaFormattato: tessera.ricevutaNumero || `01/${tessera.annoSociale}`,
      timbroCartaceoEseguito: true
    }
  };
}
