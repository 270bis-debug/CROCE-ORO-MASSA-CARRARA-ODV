import { jsPDF } from 'jspdf';
import { NotaDiDebito } from '../types/adminTypes';
import {
  disegnaHeaderIstituzionale,
  disegnaFooterIstituzionale,
  sanitizeWinAnsi
} from './pdfInstitutionalLayout';
import { getDatiCartaIntestata } from './cartaIntestataStore';
import { formatISODateItaly } from './italianTime';

/**
 * Genera il documento PDF ufficiale per la Nota di Debito con carta intestata istituzionale
 * Croce Oro Massa Carrara OdV, senza caratteri sovrapposti e con supporto completo a voci dettagliate,
 * servizio collegato, proprietario immobile (Assistenza Atto Esecutivo) e scontistiche.
 */
export function generaNotaDiDebitoPDF(nota: NotaDiDebito): jsPDF {
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
      titoloDocumento: 'AMMINISTRAZIONE - NOTA DI DEBITO UFFICIALE FUORI CAMPO IVA',
      badge: {
        riga1Tag: 'NOTA DI DEBITO',
        riga2Valore: sanitizeWinAnsi(nota.numeroProgressivo || 'ND-2026/001'),
        riga3Sotto: sanitizeWinAnsi(`Emessa il ${nota.dataEmissione || formatISODateItaly()}`)
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

  // 2. Griglia a due riquadri: Mittente (Associazione) a sinistra, Destinatario (Debitore) a destra
  const colW = (contentWidth - 6) / 2;
  const boxInnerW = colW - 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  const sedeLegLines = doc.splitTextToSize(sanitizeWinAnsi(`Sede Legale: ${info.sedeLegale}`), boxInnerW);
  const sedeOpLines = doc.splitTextToSize(sanitizeWinAnsi(`Sede Operativa: ${info.sedeMassa}`), boxInnerW);
  const mittenteH = 26 + sedeLegLines.length * 3.5 + sedeOpLines.length * 3.5 + 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  const debNomeLines = doc.splitTextToSize(sanitizeWinAnsi(nota.debitoreIntestatario || 'Ente / Azienda'), boxInnerW);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const debIndLines = doc.splitTextToSize(sanitizeWinAnsi(`Indirizzo Sede: ${nota.indirizzoDebitore || 'N.D.'}`), boxInnerW);
  const debCfLines = doc.splitTextToSize(sanitizeWinAnsi(`P.IVA / Cod. Fiscale: ${nota.partitaIvaCodiceFiscale || 'N.D.'}`), boxInnerW);
  const debRifLines = nota.codiceServizioRiferimento
    ? doc.splitTextToSize(sanitizeWinAnsi(`Rif. Servizio / Codice: ${nota.codiceServizioRiferimento}`), boxInnerW)
    : [];
  const propImm = nota.datiProprietarioImmobile;
  const hasPropImm = Boolean(propImm && (propImm.nomeCognome || propImm.codiceFiscale || propImm.indirizzoResidenza));
  const propImmLines = hasPropImm
    ? doc.splitTextToSize(
        sanitizeWinAnsi(
          `Proprietario Immobile: ${propImm?.nomeCognome || '-'} | CF: ${propImm?.codiceFiscale || '-'} | Res.: ${propImm?.indirizzoResidenza || '-'}`
        ),
        boxInnerW
      )
    : [];

  const destH =
    12 +
    debNomeLines.length * 4.2 +
    debIndLines.length * 3.6 +
    debCfLines.length * 3.6 +
    debRifLines.length * 3.6 +
    (propImmLines.length > 0 ? propImmLines.length * 3.4 + 3 : 0) +
    6;

  const topBoxH = Math.max(46, mittenteH, destH);

  // Box Mittente
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, colW, topBoxH, 2, 2, 'FD');

  let yM = currentY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('EMITTENTE / CREDITORE', margin + 4, yM);
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

  // Box Destinatario (Debitore / Ente Intestatario)
  const colRightX = margin + colW + 6;
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.4);
  doc.roundedRect(colRightX, currentY, colW, topBoxH, 2, 2, 'FD');

  let yD = currentY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.text('SPETT.LE DEBITORE / ENTE INTESTATARIO', colRightX + 4, yD);
  yD += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(15, 23, 42);
  doc.text(debNomeLines, colRightX + 4, yD);
  yD += debNomeLines.length * 4.2 + 1.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(debIndLines, colRightX + 4, yD);
  yD += debIndLines.length * 3.6 + 1.0;

  doc.text(debCfLines, colRightX + 4, yD);
  yD += debCfLines.length * 3.6 + 1.0;

  if (debRifLines.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text(debRifLines, colRightX + 4, yD);
    yD += debRifLines.length * 3.6 + 1.0;
  }

  if (propImmLines.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(146, 64, 14);
    doc.text(propImmLines, colRightX + 4, yD);
  }

  currentY += topBoxH + 5;

  // 3. Barra Dati Protocollo & Pagamento
  const metodoLines = doc.splitTextToSize(sanitizeWinAnsi(nota.metodoPagamento || 'Bonifico Bancario'), contentWidth - 118);
  const haDatiServizioCollegato = Boolean(
    nota.servizioCollegatoId || nota.kmPercorsiServizio !== undefined || nota.oreImpiegoServizio !== undefined
  );
  const protoBoxH = Math.max(15, 8 + metodoLines.length * 3.6 + (haDatiServizioCollegato ? 5.5 : 0));
  ensureSpace(protoBoxH + 6);

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, protoBoxH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  doc.text('DOCUMENTO', margin + 4, currentY + 5);
  doc.text('DATA EMISSIONE', margin + 38, currentY + 5);
  doc.text('SCADENZA', margin + 74, currentY + 5);
  doc.text('MODALITA DI PAGAMENTO / CONTO', margin + 108, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizeWinAnsi(nota.numeroProgressivo), margin + 4, currentY + 10.2);
  doc.text(sanitizeWinAnsi(nota.dataEmissione), margin + 38, currentY + 10.2);
  doc.text(sanitizeWinAnsi(nota.scadenzaPagamento || 'A vista'), margin + 74, currentY + 10.2);
  doc.setFontSize(7.0);
  doc.text(doc.splitTextToSize(sanitizeWinAnsi(nota.metodoPagamento || 'Bonifico Bancario'), contentWidth - 112), margin + 108, currentY + 10.2);

  if (haDatiServizioCollegato) {
    const rifY = currentY + 10.2 + Math.max(1, metodoLines.length) * 3.5 + 1.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(109, 40, 217);
    const kmStr = nota.kmPercorsiServizio !== undefined ? `${nota.kmPercorsiServizio} KM` : '-';
    const oreStr = nota.oreImpiegoServizio !== undefined ? `${nota.oreImpiegoServizio} ore` : '-';
    doc.text(
      sanitizeWinAnsi(
        `Servizio Collegato: ${nota.codiceServizioRiferimento || nota.servizioCollegatoId || 'N/D'}   |   KM Percorsi: ${kmStr}   |   Ore Impiego: ${oreStr}`
      ),
      margin + 4,
      rifY
    );
  }

  currentY += protoBoxH + 5;

  // 4. Tabella Dettaglio Prestazione / Voci Addebitate
  const voci = Array.isArray(nota.vociDettaglio) ? nota.vociDettaglio : [];

  if (voci.length > 0) {
    // Causale riepilogativa in testata
    if (nota.causale) {
      const causaleTopLines = doc.splitTextToSize(sanitizeWinAnsi(`Causale Generale: ${nota.causale}`), contentWidth - 8);
      const cBoxH = causaleTopLines.length * 3.8 + 4;
      ensureSpace(cBoxH + 14);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, currentY, contentWidth, cBoxH, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(causaleTopLines, margin + 4, currentY + 4.5);
      currentY += cBoxH + 3;
    }

    const drawVociHeader = () => {
      doc.setFillColor(29, 26, 96);
      doc.rect(margin, currentY, contentWidth, 7.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(255, 255, 255);
      doc.text('SIGLA', margin + 3, currentY + 5);
      doc.text('DESCRIZIONE VOCE / DETTAGLIO SIGLA', margin + 24, currentY + 5);
      doc.text('Q.TA', margin + 122, currentY + 5, { align: 'right' });
      doc.text('UNIT. (EUR)', margin + 150, currentY + 5, { align: 'right' });
      doc.text('TOTALE (EUR)', margin + contentWidth - 3, currentY + 5, { align: 'right' });
      currentY += 7.5;
    };

    ensureSpace(16);
    drawVociHeader();

    voci.forEach((v, idx) => {
      const descBase = v.descrizioneVoce || v.descrizione || '';
      const descrCompleta = sanitizeWinAnsi(
        v.descrizioneSigla ? `${descBase} (${v.descrizioneSigla})` : descBase
      );
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      const descLines = doc.splitTextToSize(descrCompleta, 92);
      const rowH = Math.max(7.5, descLines.length * 3.8 + 3.2);

      if (currentY + rowH > safeBottomY) {
        doc.addPage();
        renderHeader();
        currentY = 36;
        drawVociHeader();
      }

      doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, currentY, contentWidth, rowH, 'FD');

      doc.setFont('courier', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(29, 26, 96);
      doc.text(sanitizeWinAnsi(v.siglaBreve || v.sigla || (v.completamenteEditabile || v.editabile ? 'EDIT' : 'VOCE')), margin + 3, currentY + 4.8, {
        maxWidth: 19
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      doc.text(descLines, margin + 24, currentY + 4.6);

      doc.setFont('helvetica', 'normal');
      doc.text(
        sanitizeWinAnsi(`${Number(v.quantita || 0).toFixed(2).replace(/\.00$/, '')} ${v.unitaMisura || v.unita || ''}`.trim()),
        margin + 122,
        currentY + 4.8,
        { align: 'right' }
      );
      doc.text(`${Number(v.prezzoUnitario || 0).toFixed(2)}`, margin + 150, currentY + 4.8, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text(`${Number(v.totaleRiga ?? v.subtotale ?? 0).toFixed(2)}`, margin + contentWidth - 3, currentY + 4.8, { align: 'right' });

      currentY += rowH;
    });
  } else {
    // Modalita causale singola con altezza adattiva
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    const causaleLines = doc.splitTextToSize(
      sanitizeWinAnsi(nota.causale || 'Rimborso spese per servizio di trasporto e assistenza sanitaria'),
      contentWidth - 46
    );
    const causaleH = Math.max(30, causaleLines.length * 4.4 + 20);
    ensureSpace(causaleH + 12);

    doc.setFillColor(29, 26, 96);
    doc.rect(margin, currentY, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(255, 255, 255);
    doc.text('DESCRIZIONE PRESTAZIONE / CAUSALE DEL SERVIZIO', margin + 4, currentY + 5.5);
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
    if (nota.codiceServizioRiferimento) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139);
      doc.text(sanitizeWinAnsi(`Riferimento scheda operativa d'intervento: ${nota.codiceServizioRiferimento}`), margin + 4, subY);
      subY += 4.2;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.0);
    doc.setTextColor(100, 116, 139);
    doc.text('Servizio reso conformemente alle disposizioni associative e convenzioni vigenti.', margin + 4, subY);
    doc.text(sanitizeWinAnsi(`Operatore di emissione: ${nota.operatoreEmissione || 'Amministrazione Centrale'}`), margin + 4, subY + 4.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    const lordoDisplay = nota.imponibileLordo !== undefined ? nota.imponibileLordo : nota.importoTotale;
    doc.text(`EUR ${Number(lordoDisplay || 0).toFixed(2)}`, margin + contentWidth - 4, currentY + 11, { align: 'right' });

    currentY += causaleH;
  }

  // 4b. Subtotale e Scontistica se presente
  const hasSconto = Boolean(nota.scontoImportoCalcolato && nota.scontoImportoCalcolato > 0);
  if (hasSconto || (voci.length > 0 && nota.imponibileLordo !== undefined)) {
    const scontoBoxH = hasSconto ? 13 : 8;
    ensureSpace(scontoBoxH + 16);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, currentY, contentWidth, scontoBoxH, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const imponibile = Number(nota.imponibileLordo ?? nota.importoTotale ?? 0);
    doc.text('Imponibile / Subtotale Lordo:', margin + 6, currentY + 5);
    doc.setFont('helvetica', 'bold');
    doc.text(`EUR ${imponibile.toFixed(2)}`, margin + contentWidth - 6, currentY + 5, { align: 'right' });

    if (hasSconto) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(185, 28, 28);
      const scontoDesc = sanitizeWinAnsi(
        nota.scontoDescrizione ||
          (nota.scontoTipo === 'percentuale' ? `Sconto applicato (${nota.scontoValore || 0}%)` : 'Sconto applicato')
      );
      doc.text(scontoDesc, margin + 6, currentY + 10);
      doc.text(`- EUR ${Number(nota.scontoImportoCalcolato || 0).toFixed(2)}`, margin + contentWidth - 6, currentY + 10, {
        align: 'right'
      });
    }
    currentY += scontoBoxH;
  }

  // 5. Totale Dovuto
  ensureSpace(19);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(191, 163, 83);
  doc.setLineWidth(0.6);
  doc.rect(margin, currentY, contentWidth, 14, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(29, 26, 96);
  doc.text('TOTALE DOVUTO A SALDO:', margin + 6, currentY + 9);

  doc.setFontSize(13);
  doc.setTextColor(180, 83, 9);
  doc.text(`EUR ${Number(nota.importoTotale || 0).toFixed(2)}`, margin + contentWidth - 6, currentY + 9.5, {
    align: 'right'
  });

  currentY += 18;

  // 6. Box Coordinate di Pagamento Bancario (IBAN)
  const isPosteDesignato =
    nota.contoAccredito === 'Poste Italiane' ||
    Boolean(nota.metodoPagamento && (nota.metodoPagamento.includes('Poste') || nota.metodoPagamento.includes('C/C Postale')));
  const isCreditAgricoleDesignato =
    nota.contoAccredito === 'Credit Agricole' ||
    Boolean(
      nota.metodoPagamento &&
        (nota.metodoPagamento.includes('Credit Agricole') ||
          nota.metodoPagamento.includes('Agricole') ||
          (!isPosteDesignato && nota.metodoPagamento.includes('Bonifico')))
    );

  const causaleBonificoText = sanitizeWinAnsi(`Causale Bonifico: Saldo ${nota.numeroProgressivo} - ${nota.debitoreIntestatario}`);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  const causaleBonificoLines = doc.splitTextToSize(causaleBonificoText, contentWidth - 8);
  const boxCoordH = 24 + causaleBonificoLines.length * 3.8;
  ensureSpace(boxCoordH + 4);

  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, currentY, contentWidth, boxCoordH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(21, 128, 61);
  doc.text('COORDINATE BANCARIE E POSTALI PER IL PAGAMENTO (DATABASE SEDI ASSOCIATIVE)', margin + 4, currentY + 5.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(15, 23, 42);
  doc.text(
    sanitizeWinAnsi(`Intestatario Ufficiale: ${(info.intestatarioConti || info.denominazione || 'CROCE ORO MASSA CARRARA ODV').toUpperCase()}`),
    margin + 4,
    currentY + 10.2
  );

  // 1) Credit Agricole
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  if (isCreditAgricoleDesignato) {
    doc.setTextColor(22, 101, 52);
    doc.text('> 1) Conto Credit Agricole [CONTO INDICATO]:', margin + 4, currentY + 15.2);
  } else {
    doc.setTextColor(29, 26, 96);
    doc.text('1) Conto Bancario Credit Agricole:', margin + 4, currentY + 15.2);
  }
  doc.setFont('helvetica', isCreditAgricoleDesignato ? 'bold' : 'normal');
  doc.text(sanitizeWinAnsi(`IBAN: ${info.ibanBanca || 'IT79M0623024500000046980317'}`), margin + 72, currentY + 15.2);

  // 2) Poste Italiane
  doc.setFont('helvetica', 'bold');
  if (isPosteDesignato) {
    doc.setTextColor(180, 83, 9);
    doc.text('> 2) Conto Poste Italiane [CONTO INDICATO]:', margin + 4, currentY + 20.0);
  } else {
    doc.setTextColor(29, 26, 96);
    doc.text('2) Conto Postale Poste Italiane:', margin + 4, currentY + 20.0);
  }
  doc.setFont('helvetica', isPosteDesignato ? 'bold' : 'normal');
  doc.text(
    sanitizeWinAnsi(`IBAN: ${info.ibanPoste || 'IT40P0760113600001007035676'} (C/c: ${info.ccPostale || '00001007035676'})`),
    margin + 72,
    currentY + 20.0
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(180, 83, 9);
  doc.text(causaleBonificoLines, margin + 4, currentY + 24.8);

  currentY += boxCoordH + 4;

  // 7. Dicitura Regime Fiscale OdV (Esente IVA)
  const fiscaleTxt =
    "Operazione fuori campo IVA ai sensi dell'art. 2 e 4 del D.P.R. 633/1972 e successive modifiche. " +
    'Attivita istituzionale non commerciale resa da Organizzazione di Volontariato (OdV) iscritta al Registro Unico Nazionale del Terzo Settore (RUNTS). ' +
    "Imposta di bollo assolta sull'originale ove previsto ai sensi dell'art. 82, comma 5 del D.Lgs. 117/2017 (Codice del Terzo Settore).";
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  const fiscaleLines = doc.splitTextToSize(sanitizeWinAnsi(fiscaleTxt), contentWidth - 8);
  const boxFiscH = 8 + fiscaleLines.length * 3.1;
  ensureSpace(boxFiscH + 28);

  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(248, 113, 113);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxFiscH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(153, 27, 27);
  doc.text('REGIME FISCALE ED ESENZIONE IVA:', margin + 4, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(80, 20, 20);
  doc.text(fiscaleLines, margin + 4, currentY + 8.3);

  currentY += boxFiscH + 4;

  // 8. Box Firme Ufficiali (Tesoreria & Presidenza)
  ensureSpace(28);
  const boxFirmaW = (contentWidth - 6) / 2;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin + 10, currentY + 16, margin + boxFirmaW - 10, currentY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  doc.text("L'Ufficio Tesoreria / Contabilita", margin + boxFirmaW / 2, currentY + 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(sanitizeWinAnsi(info.denominazione || 'Croce Oro Massa Carrara OdV'), margin + boxFirmaW / 2, currentY + 23.5, {
    align: 'center'
  });

  const box2X = margin + boxFirmaW + 6;
  doc.line(box2X + 10, currentY + 16, box2X + boxFirmaW - 10, currentY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  doc.text('Il Presidente / Legale Rappresentante', box2X + boxFirmaW / 2, currentY + 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(sanitizeWinAnsi(info.denominazione || 'Croce Oro Massa Carrara OdV'), box2X + boxFirmaW / 2, currentY + 23.5, {
    align: 'center'
  });

  // 9. Footer Istituzionale su tutte le pagine
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    disegnaFooterIstituzionale(doc, {
      dicituraArchiviazione: `Nota di Debito ${sanitizeWinAnsi(nota.numeroProgressivo)} - Archivio Fiscale & Contabile Ufficiale - Pagina ${p} di ${totalPages}`,
      pageWidth,
      pageHeight,
      margin
    });
  }

  return doc;
}

/**
 * Scarica il file PDF della Nota di Debito senza usare popup esterni bloccati.
 */
export function scaricaNotaDiDebitoPDF(nota: NotaDiDebito): void {
  const doc = generaNotaDiDebitoPDF(nota);
  const nomeFile = `Nota_Di_Debito_${(nota.numeroProgressivo || 'ND-2026').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  doc.save(nomeFile);
}
