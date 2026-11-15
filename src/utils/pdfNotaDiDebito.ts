import { jsPDF } from 'jspdf';
import { NotaDiDebito } from '../types/adminTypes';
import {
  disegnaHeaderIstituzionale,
  disegnaFooterIstituzionale,
  ASSOCIAZIONE_INFO
} from './pdfInstitutionalLayout';
import { getDatiCartaIntestata } from './cartaIntestataStore';
import { formatISODateItaly } from './italianTime';

/**
 * Genera il documento PDF ufficiale per la Nota di Debito con carta intestata istituzionale
 * Croce Oro Massa Carrara OdV.
 */
export function generaNotaDiDebitoPDF(nota: NotaDiDebito): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const info = getDatiCartaIntestata();

  // 1. Header Istituzionale Unificato Croce Oro
  disegnaHeaderIstituzionale(doc, {
    titoloDocumento: 'AMMINISTRAZIONE • NOTA DI DEBITO UFFICIALE FUORI CAMPO IVA',
    badge: {
      riga1Tag: 'NOTA DI DEBITO',
      riga2Valore: nota.numeroProgressivo || 'ND-2026/001',
      riga3Sotto: `Emessa il ${nota.dataEmissione || formatISODateItaly()}`
    },
    pageWidth,
    margin
  });

  let currentY = 36;

  // 2. Griglia a due riquadri: Mittente (Associazione) a sinistra, Destinatario (Debitore) a destra
  const colW = (contentWidth - 6) / 2;

  // Box Mittente
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(margin, currentY, colW, 46, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, colW, 46, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96); // navy
  doc.text('EMITTENTE / CREDITORE', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text((info.denominazione || 'CROCE ORO MASSA CARRARA OdV').toUpperCase(), margin + 4, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  doc.text(`Sede Legale: ${info.sedeLegale}`, margin + 4, currentY + 17, { maxWidth: colW - 8 });
  doc.text(`Sede Operativa: ${info.sedeMassa}`, margin + 4, currentY + 22, { maxWidth: colW - 8 });
  doc.text(`Codice Fiscale: ${info.codiceFiscale}`, margin + 4, currentY + 27);
  doc.text(`Telefono: ${info.centraleTel}`, margin + 4, currentY + 32);
  doc.text(`Email: ${info.email}`, margin + 4, currentY + 37);
  doc.text(`PEC: ${info.pec}`, margin + 4, currentY + 42);

  // Box Destinatario (Debitore / Ente Intestatario)
  const colRightX = margin + colW + 6;
  doc.setFillColor(254, 252, 232); // yellow-50
  doc.roundedRect(colRightX, currentY, colW, 46, 2, 2, 'F');
  doc.setDrawColor(217, 119, 6); // amber-600
  doc.setLineWidth(0.4);
  doc.roundedRect(colRightX, currentY, colW, 46, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text('SPETT.LE DEBITORE / ENTE INTESTATARIO', colRightX + 4, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(nota.debitoreIntestatario || 'Ente / Azienda', colRightX + 4, currentY + 13, { maxWidth: colW - 8 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85);
  doc.text(`Indirizzo Sede: ${nota.indirizzoDebitore || 'N.D.'}`, colRightX + 4, currentY + 22, { maxWidth: colW - 8 });
  doc.text(`P.IVA / Cod. Fiscale: ${nota.partitaIvaCodiceFiscale || 'N.D.'}`, colRightX + 4, currentY + 31);
  if (nota.codiceServizioRiferimento) {
    doc.text(`Rif. Servizio / Codice: ${nota.codiceServizioRiferimento}`, colRightX + 4, currentY + 37);
  }

  currentY += 52;

  // 3. Barra Dati Protocollo & Pagamento
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(margin, currentY, contentWidth, 14, 1.5, 1.5, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, 14, 1.5, 1.5, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('DOCUMENTO', margin + 4, currentY + 5);
  doc.text('DATA EMISSIONE', margin + 40, currentY + 5);
  doc.text('SCADENZA', margin + 80, currentY + 5);
  doc.text('MODALITÀ DI PAGAMENTO / CONTO', margin + 115, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(nota.numeroProgressivo, margin + 4, currentY + 10.5);
  doc.text(nota.dataEmissione, margin + 40, currentY + 10.5);
  doc.text(nota.scadenzaPagamento || 'A vista', margin + 80, currentY + 10.5);
  doc.setFontSize(7.5);
  doc.text(nota.metodoPagamento || 'Bonifico Bancario', margin + 115, currentY + 10.5, { maxWidth: contentWidth - 118 });

  currentY += 19;

  // 4. Tabella Dettaglio Prestazione e Causale
  doc.setFillColor(29, 26, 96); // navy
  doc.rect(margin, currentY, contentWidth, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(255, 255, 255);
  doc.text('DESCRIZIONE PRESTAZIONE / CAUSALE DEL SERVIZIO', margin + 4, currentY + 5.5);
  doc.text('IMPORTO (€)', margin + contentWidth - 4, currentY + 5.5, { align: 'right' });

  currentY += 8;

  // Riga Causale
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, currentY, contentWidth, 32, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.rect(margin, currentY, contentWidth, 32, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(nota.causale || 'Rimborso spese per servizio di trasporto e assistenza sanitaria', margin + 4, currentY + 8, { maxWidth: contentWidth - 40 });

  if (nota.codiceServizioRiferimento) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Riferimento scheda operativa d'intervento: ${nota.codiceServizioRiferimento}`, margin + 4, currentY + 15);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text('Servizio reso conformemente alle disposizioni associative e convenzioni vigenti.', margin + 4, currentY + 22);
  doc.text('Operatore di emissione: ' + (nota.operatoreEmissione || 'Amministrazione Centrale'), margin + 4, currentY + 27);

  // Importo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`€ ${Number(nota.importoTotale || 0).toFixed(2)}`, margin + contentWidth - 4, currentY + 12, { align: 'right' });

  currentY += 32;

  // 5. Totale e Dicitura Fiscale
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, currentY, contentWidth, 14, 'F');
  doc.setDrawColor(191, 163, 83); // oro
  doc.setLineWidth(0.6);
  doc.rect(margin, currentY, contentWidth, 14, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(29, 26, 96);
  doc.text('TOTALE DOVUTO A SALDO:', margin + 6, currentY + 9);

  doc.setFontSize(13);
  doc.setTextColor(180, 83, 9); // ambra
  doc.text(`€ ${Number(nota.importoTotale || 0).toFixed(2)}`, margin + contentWidth - 6, currentY + 9.5, { align: 'right' });

  currentY += 19;

  // 6. Box Coordinate di Pagamento Bancario (IBAN) - Da Anagrafiche Sedi Associative
  const isPosteDesignato = nota.contoAccredito === 'Poste Italiane' || (nota.metodoPagamento && (nota.metodoPagamento.includes('Poste') || nota.metodoPagamento.includes('C/C Postale')));
  const isCreditAgricoleDesignato = nota.contoAccredito === 'Credit Agricole' || (nota.metodoPagamento && (nota.metodoPagamento.includes('Credit Agricole') || nota.metodoPagamento.includes('Agricole') || (!isPosteDesignato && nota.metodoPagamento.includes('Bonifico'))));

  const boxCoordH = 28;
  doc.setFillColor(240, 253, 244); // green-50
  doc.roundedRect(margin, currentY, contentWidth, boxCoordH, 2, 2, 'F');
  doc.setDrawColor(34, 197, 94); // emerald-500
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, currentY, contentWidth, boxCoordH, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(21, 128, 61); // emerald-700
  doc.text('COORDINATE BANCARIE E POSTALI PER IL PAGAMENTO (DATABASE SEDI ASSOCIATIVE)', margin + 4, currentY + 5.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text(`Intestatario Ufficiale: ${(info.intestatarioConti || info.denominazione || 'CROCE ORO MASSA CARRARA ODV').toUpperCase()}`, margin + 4, currentY + 10.2);

  // 1) Credit Agricole
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  if (isCreditAgricoleDesignato) {
    doc.setTextColor(22, 101, 52); // green-800
    doc.text(`▶ 1) Conto Credit Agricole [CONTO INDICATO]:`, margin + 4, currentY + 15.2);
  } else {
    doc.setTextColor(29, 26, 96);
    doc.text(`1) Conto Bancario Credit Agricole:`, margin + 4, currentY + 15.2);
  }
  doc.setFont('helvetica', isCreditAgricoleDesignato ? 'bold' : 'normal');
  doc.text(`IBAN: ${info.ibanBanca || 'IT79M0623024500000046980317'}`, margin + 70, currentY + 15.2);

  // 2) Poste Italiane
  doc.setFont('helvetica', 'bold');
  if (isPosteDesignato) {
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text(`▶ 2) Conto Poste Italiane [CONTO INDICATO]:`, margin + 4, currentY + 20.2);
  } else {
    doc.setTextColor(29, 26, 96);
    doc.text(`2) Conto Postale Poste Italiane:`, margin + 4, currentY + 20.2);
  }
  doc.setFont('helvetica', isPosteDesignato ? 'bold' : 'normal');
  doc.text(`IBAN: ${info.ibanPoste || 'IT40P0760113600001007035676'} (C/c: ${info.ccPostale || '00001007035676'})`, margin + 70, currentY + 20.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text(`Causale Bonifico: Saldo ${nota.numeroProgressivo} - ${nota.debitoreIntestatario}`, margin + 4, currentY + 25.2, { maxWidth: contentWidth - 8 });

  currentY += boxCoordH + 4;

  // 7. Dicitura Regime Fiscale OdV (Esente IVA)
  doc.setFillColor(254, 242, 242); // red-50
  doc.roundedRect(margin, currentY, contentWidth, 16, 1.5, 1.5, 'F');
  doc.setDrawColor(248, 113, 113); // red-400
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, 16, 1.5, 1.5, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(153, 27, 27); // red-800
  doc.text('REGIME FISCALE ED ESENZIONE IVA:', margin + 4, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(80, 20, 20);
  doc.text(
    'Operazione fuori campo IVA ai sensi dell\'art. 2 e 4 del D.P.R. 633/1972 e successive modifiche. ' +
    'Attività istituzionale non commerciale resa da Organizzazione di Volontariato (OdV) iscritta al Registro Unico Nazionale del Terzo Settore (RUNTS). ' +
    'Imposta di bollo assolta sull\'originale ove previsto ai sensi dell\'art. 82, comma 5 del D.Lgs. 117/2017 (Codice del Terzo Settore).',
    margin + 4,
    currentY + 8.5,
    { maxWidth: contentWidth - 8 }
  );

  currentY += 20;

  // 8. Box Firme Ufficiali (Tesoreria & Presidenza)
  const boxFirmaW = (contentWidth - 6) / 2;

  // Firma Tesoriere
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin + 10, currentY + 18, margin + boxFirmaW - 10, currentY + 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  doc.text('L\'Ufficio Tesoreria / Contabilità', margin + boxFirmaW / 2, currentY + 22, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(info.denominazione || 'Croce Oro Massa Carrara OdV', margin + boxFirmaW / 2, currentY + 25.5, { align: 'center' });

  // Firma Legale Rappresentante
  const box2X = margin + boxFirmaW + 6;
  doc.line(box2X + 10, currentY + 18, box2X + boxFirmaW - 10, currentY + 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  doc.text('Il Presidente / Legale Rappresentante', box2X + boxFirmaW / 2, currentY + 22, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(info.denominazione || 'Croce Oro Massa Carrara OdV', box2X + boxFirmaW / 2, currentY + 25.5, { align: 'center' });

  // 9. Footer Istituzionale
  disegnaFooterIstituzionale(doc, {
    dicituraArchiviazione: `Nota di Debito ${nota.numeroProgressivo} • Archivio Fiscale & Contabile Ufficiale • Pagina 1 di 1`,
    pageWidth,
    margin
  });

  return doc;
}

/**
 * Scarica e apre la finestra di stampa per la Nota di Debito.
 */
export function scaricaNotaDiDebitoPDF(nota: NotaDiDebito): void {
  const doc = generaNotaDiDebitoPDF(nota);
  const nomeFile = `Nota_Di_Debito_${(nota.numeroProgressivo || 'ND-2026').replace(/\//g, '_')}.pdf`;
  
  // Salva il file PDF sul dispositivo dell'utente
  doc.save(nomeFile);

  // Apre anche una finestra o un blob URL per la stampa diretta
  try {
    const blobUrl = doc.output('bloburl');
    if (typeof window !== 'undefined') {
      const win = window.open(blobUrl as unknown as string, '_blank');
      if (win) {
        win.focus();
      }
    }
  } catch (e) {
    console.warn('Stampa browser popup non disponibile:', e);
  }
}
