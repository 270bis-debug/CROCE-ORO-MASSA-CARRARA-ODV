import { jsPDF } from 'jspdf';
import { RicevutaContabile } from '../types/adminTypes';
import {
  disegnaHeaderIstituzionale,
  disegnaFooterIstituzionale,
  sanitizeWinAnsi
} from './pdfInstitutionalLayout';
import { getDatiCartaIntestata } from './cartaIntestataStore';
import { formatISODateItaly } from './italianTime';
import { DatiTesorierePDF, disegnaBoxFirmaTesoriere } from './pdfRicevutaTesseramento';

/**
 * Genera il documento PDF ufficiale per una Ricevuta Contabile emessa dalla
 * sottosezione "Emissione Ricevute" del Database Contabilità, su carta intestata
 * Croce Oro Massa Carrara OdV, includendo Email, PEC (o dichiarazione di non possesso).
 */
export function generaRicevutaContabilePDF(ricevuta: RicevutaContabile, tesoriere?: DatiTesorierePDF): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const safeBottomY = pageHeight - 20;
  const info = getDatiCartaIntestata();

  const renderHeader = () => {
    disegnaHeaderIstituzionale(doc, {
      titoloDocumento: 'AMMINISTRAZIONE - RICEVUTA UFFICIALE / QUIETANZA FUORI CAMPO IVA',
      badge: {
        riga1Tag: ricevuta.stato === 'Annullata' ? 'RICEVUTA ANNULLATA' : 'RICEVUTA N.',
        riga2Valore: sanitizeWinAnsi(ricevuta.numeroProgressivo || 'RIC-2026/001'),
        riga3Sotto: sanitizeWinAnsi(`Emessa il ${ricevuta.dataEmissione || formatISODateItaly()}`)
      },
      pageWidth,
      margin
    });
  };

  renderHeader();
  let currentY = 36;

  const ensureSpace = (neededH: number) => {
    if (currentY + neededH > safeBottomY) {
      doc.addPage();
      renderHeader();
      currentY = 36;
    }
  };

  // Eventuale banner ANNULLATA
  if (ricevuta.stato === 'Annullata') {
    doc.setFillColor(254, 226, 226);
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, currentY, contentWidth, 10, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(185, 28, 28);
    doc.text(
      sanitizeWinAnsi(
        `DOCUMENTO ANNULLATO${ricevuta.motivoAnnullamento ? ` — Motivo: ${ricevuta.motivoAnnullamento}` : ''}`
      ),
      pageWidth / 2,
      currentY + 6.3,
      { align: 'center', maxWidth: contentWidth - 8 }
    );
    currentY += 13;
  }

  // 2. Griglia due riquadri: Emittente (Associazione) a sinistra, Intestatario a destra
  const colW = (contentWidth - 6) / 2;
  const boxInnerW = colW - 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  const sedeLegLines = doc.splitTextToSize(sanitizeWinAnsi(`Sede Legale: ${info.sedeLegale}`), boxInnerW);
  const sedeOpLines = doc.splitTextToSize(sanitizeWinAnsi(`Sede Operativa: ${info.sedeMassa}`), boxInnerW);
  const mittenteH = 26 + sedeLegLines.length * 3.5 + sedeOpLines.length * 3.5 + 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  const intNomeLines = doc.splitTextToSize(sanitizeWinAnsi(ricevuta.intestatario || 'Intestatario'), boxInnerW);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  const intIndLines = doc.splitTextToSize(
    sanitizeWinAnsi(`Indirizzo: ${ricevuta.indirizzoIntestatario || 'N.D.'}`),
    boxInnerW
  );
  const intCfLines = doc.splitTextToSize(
    sanitizeWinAnsi(`C.F. / P.IVA: ${ricevuta.codiceFiscalePartitaIva || 'N.D.'}`),
    boxInnerW
  );

  const emailTxt = ricevuta.emailNonDisponibile
    ? "Email: Non disponibile (dichiarato non in possesso all'emissione)"
    : ricevuta.emailDestinatario
      ? `Email: ${ricevuta.emailDestinatario}`
      : 'Email: N.D.';
  const pecTxt = ricevuta.pecNonDisponibile
    ? "PEC: Non disponibile (dichiarato non in possesso all'emissione)"
    : ricevuta.pecDestinatario
      ? `PEC: ${ricevuta.pecDestinatario}`
      : 'PEC: N.D.';

  const intEmailLines = doc.splitTextToSize(sanitizeWinAnsi(emailTxt), boxInnerW);
  const intPecLines = doc.splitTextToSize(sanitizeWinAnsi(pecTxt), boxInnerW);
  const intRifLines = ricevuta.codiceServizioRiferimento
    ? doc.splitTextToSize(sanitizeWinAnsi(`Rif. Servizio / Pratica: ${ricevuta.codiceServizioRiferimento}`), boxInnerW)
    : [];

  const destH =
    14 +
    intNomeLines.length * 4.2 +
    intIndLines.length * 3.6 +
    intCfLines.length * 3.6 +
    intEmailLines.length * 3.5 +
    intPecLines.length * 3.5 +
    (intRifLines.length > 0 ? intRifLines.length * 3.6 + 1.5 : 0) +
    10;

  const topBoxH = Math.max(48, mittenteH, destH);

  // Box Emittente
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, colW, topBoxH, 2, 2, 'FD');

  let yM = currentY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('ENTE EMITTENTE', margin + 4, yM);
  yM += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizeWinAnsi(info.denominazione || 'CROCE ORO MASSA CARRARA OdV').toUpperCase(), margin + 4, yM, {
    maxWidth: boxInnerW
  });
  yM += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(71, 85, 105);
  doc.text(sedeLegLines, margin + 4, yM);
  yM += sedeLegLines.length * 3.5 + 0.8;
  doc.text(sedeOpLines, margin + 4, yM);
  yM += sedeOpLines.length * 3.5 + 0.8;
  doc.text(sanitizeWinAnsi(`Codice Fiscale: ${info.codiceFiscale}`), margin + 4, yM);
  yM += 4.2;
  doc.text(sanitizeWinAnsi(`Telefono: ${info.centraleTel}`), margin + 4, yM);
  yM += 4.2;
  doc.text(sanitizeWinAnsi(`Email: ${info.email}`), margin + 4, yM, { maxWidth: boxInnerW });
  yM += 4.2;
  doc.text(sanitizeWinAnsi(`PEC: ${info.pec}`), margin + 4, yM, { maxWidth: boxInnerW });

  // Box Intestatario Ricevuta
  const colRightX = margin + colW + 6;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.4);
  doc.roundedRect(colRightX, currentY, colW, topBoxH, 2, 2, 'FD');

  let yD = currentY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(21, 128, 61);
  doc.text('INTESTATARIO RICEVUTA / VERSANTE', colRightX + 4, yD);
  yD += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(15, 23, 42);
  doc.text(intNomeLines, colRightX + 4, yD);
  yD += intNomeLines.length * 4.2 + 1.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(51, 65, 85);
  doc.text(intIndLines, colRightX + 4, yD);
  yD += intIndLines.length * 3.6 + 1.0;

  doc.text(intCfLines, colRightX + 4, yD);
  yD += intCfLines.length * 3.6 + 1.0;

  doc.setFont('helvetica', ricevuta.emailNonDisponibile ? 'italic' : 'normal');
  doc.setFontSize(7.1);
  doc.setTextColor(ricevuta.emailNonDisponibile ? 146 : 51, ricevuta.emailNonDisponibile ? 64 : 65, ricevuta.emailNonDisponibile ? 14 : 85);
  doc.text(intEmailLines, colRightX + 4, yD);
  yD += intEmailLines.length * 3.5 + 1.0;

  doc.setFont('helvetica', ricevuta.pecNonDisponibile ? 'italic' : 'normal');
  doc.setFontSize(7.1);
  doc.setTextColor(ricevuta.pecNonDisponibile ? 146 : 51, ricevuta.pecNonDisponibile ? 64 : 65, ricevuta.pecNonDisponibile ? 14 : 85);
  doc.text(intPecLines, colRightX + 4, yD);
  yD += intPecLines.length * 3.5 + 1.0;

  if (intRifLines.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.3);
    doc.setTextColor(29, 26, 96);
    doc.text(intRifLines, colRightX + 4, yD);
  }

  currentY += topBoxH + 5;

  // 3. Barra Dati Protocollo, Tipologia & Modalita Incasso
  const metodoLines = doc.splitTextToSize(sanitizeWinAnsi(ricevuta.metodoPagamento || 'Contanti'), contentWidth - 114);
  const protoBoxH = Math.max(16, 9 + metodoLines.length * 3.6);
  ensureSpace(protoBoxH + 6);

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, protoBoxH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(71, 85, 105);
  doc.text('RICEVUTA N.', margin + 4, currentY + 5);
  doc.text('DATA EMISSIONE', margin + 35, currentY + 5);
  doc.text('TIPOLOGIA', margin + 68, currentY + 5);
  doc.text('MODALITA DI INCASSO', margin + 114, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.0);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizeWinAnsi(ricevuta.numeroProgressivo), margin + 4, currentY + 10.5);
  doc.text(sanitizeWinAnsi(ricevuta.dataEmissione), margin + 35, currentY + 10.5);
  doc.setFontSize(7.2);
  doc.text(sanitizeWinAnsi(ricevuta.tipologia || 'Ricevuta'), margin + 68, currentY + 10.5, { maxWidth: 43 });
  doc.setFontSize(7.0);
  doc.text(metodoLines, margin + 114, currentY + 10.5);

  currentY += protoBoxH + 5;

  // 4. Riquadro Causale & Somma Ricevuta
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  const causaleLines = doc.splitTextToSize(
    sanitizeWinAnsi(ricevuta.causale || 'Versamento / contributo a favore dell\'Associazione'),
    contentWidth - 48
  );
  const noteLines = ricevuta.note
    ? doc.splitTextToSize(sanitizeWinAnsi(`Note: ${ricevuta.note}`), contentWidth - 48)
    : [];
  const causaleH = Math.max(30, causaleLines.length * 4.4 + noteLines.length * 3.8 + 20);
  ensureSpace(causaleH + 14);

  doc.setFillColor(29, 26, 96);
  doc.rect(margin, currentY, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(255, 255, 255);
  doc.text('CAUSALE / DESCRIZIONE DEL VERSAMENTO', margin + 4, currentY + 5.5);
  doc.text('IMPORTO (EUR)', margin + contentWidth - 4, currentY + 5.5, { align: 'right' });
  currentY += 8;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.rect(margin, currentY, contentWidth, causaleH, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text(causaleLines, margin + 4, currentY + 7);

  let subY = currentY + 7 + causaleLines.length * 4.4 + 2;
  if (noteLines.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    doc.text(noteLines, margin + 4, subY);
    subY += noteLines.length * 3.8 + 1.5;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(100, 116, 139);
  doc.text('Si rilascia la presente ricevuta quale formale quietanza dell\'importo incassato.', margin + 4, subY);
  doc.text(
    sanitizeWinAnsi(`Operatore di emissione: ${ricevuta.operatoreEmissione || 'Amministrazione Centrale'}`),
    margin + 4,
    subY + 4.2
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(21, 128, 61);
  doc.text(`EUR ${Number(ricevuta.importoTotale || 0).toFixed(2)}`, margin + contentWidth - 4, currentY + 11, {
    align: 'right'
  });

  currentY += causaleH + 4;

  // 5. Box Totale Quietanzato
  ensureSpace(19);
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.6);
  doc.rect(margin, currentY, contentWidth, 14, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(29, 26, 96);
  doc.text('IMPORTO TOTALE QUIETANZATO:', margin + 6, currentY + 9);

  doc.setFontSize(13);
  doc.setTextColor(21, 128, 61);
  doc.text(`EUR ${Number(ricevuta.importoTotale || 0).toFixed(2)}`, margin + contentWidth - 6, currentY + 9.5, {
    align: 'right'
  });

  currentY += 18;

  // 6. Dicitura Fiscale OdV / Esenzione IVA e Bollo
  const fiscaleTxt =
    "Ricevuta fuori campo IVA ai sensi dell'art. 2 e 4 del D.P.R. 633/1972. " +
    'Ente del Terzo Settore — Organizzazione di Volontariato (OdV) iscritta al RUNTS. ' +
    "Esente dall'imposta di bollo ai sensi dell'art. 82, comma 5 del D.Lgs. 117/2017 (Codice del Terzo Settore). " +
    'Per le erogazioni liberali effettuate con sistemi di pagamento tracciabili e prevista la detraibilita/deducibilita fiscale ai sensi dell\'art. 83 D.Lgs. 117/2017.';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  const fiscaleLines = doc.splitTextToSize(sanitizeWinAnsi(fiscaleTxt), contentWidth - 8);
  const boxFiscH = 8 + fiscaleLines.length * 3.1;
  ensureSpace(boxFiscH + 28);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxFiscH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(29, 26, 96);
  doc.text('REGIME FISCALE, ESENZIONE IVA E BOLLO (D.LGS. 117/2017):', margin + 4, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  doc.setTextColor(51, 65, 85);
  doc.text(fiscaleLines, margin + 4, currentY + 8.3);

  currentY += boxFiscH + 6;

  // 7. Firma Ufficiale del Tesoriere (rimossa la firma del Presidente)
  const boxFirmaH = 41;
  ensureSpace(boxFirmaH + 4);
  const boxFirmaW = 92;
  const boxFirmaX = margin + contentWidth - boxFirmaW;

  disegnaBoxFirmaTesoriere(doc, {
    x: boxFirmaX,
    y: currentY,
    width: boxFirmaW,
    height: boxFirmaH,
    tesoriere,
    denominazioneEnte: info.denominazione || 'Croce Oro Massa Carrara OdV',
    dataDocumento: ricevuta.dataEmissione || formatISODateItaly()
  });

  // 8. Footer Istituzionale
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    disegnaFooterIstituzionale(doc, {
      dicituraArchiviazione: `Ricevuta ${sanitizeWinAnsi(ricevuta.numeroProgressivo)} - Archivio Fiscale & Contabile Ufficiale - Pagina ${p} di ${totalPages}`,
      pageWidth,
      pageHeight,
      margin
    });
  }

  return doc;
}

export function scaricaRicevutaContabilePDF(ricevuta: RicevutaContabile, tesoriere?: DatiTesorierePDF): void {
  const doc = generaRicevutaContabilePDF(ricevuta, tesoriere);
  const nomeFile = `Ricevuta_${(ricevuta.numeroProgressivo || 'RIC-2026').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  doc.save(nomeFile);
}
