import { jsPDF } from 'jspdf';
import { Volontario } from '../components/DatabaseVolontariModal';
import {
  disegnaHeaderIstituzionale,
  disegnaFooterIstituzionale,
  sanitizeWinAnsi
} from './pdfInstitutionalLayout';
import { formatISODateItaly } from './italianTime';

function importoInLettere(importo: number): string {
  const rounded = Math.round((importo + Number.EPSILON) * 100) / 100;
  if (rounded === 0) return 'Zero/00';
  if (rounded === 30) return 'Trenta/00';
  if (rounded === 45) return 'Quarantacinque/00';
  if (rounded === 75) return 'Settantacinque/00';
  return `${rounded.toFixed(2).replace('.', ',')}`;
}

export interface CapoRestituzioneDettaglio {
  nome: string;
  taglia?: string;
  quantita?: number;
  restituito: boolean;
  cauzioneUnitaria: number;
  esenteCauzione?: boolean;
  importoRimborso: number;
}

export interface DatiRestituzioneDivisa {
  dataRestituzione: string; // YYYY-MM-DD
  ibanBonifico: string; // IT...
  intestatarioBonifico?: string;
  restituitoPantaloni: boolean;
  restituitoGiubbetto: boolean;
  altriCapiRestituiti?: string[];
  capiDettaglio?: CapoRestituzioneDettaglio[];
  cifraRimborsoTotale: number;
  annotazioniAdmin?: string;
  amministratoreNome?: string;
  firmaVolontarioBase64?: string;
}

/**
 * Genera il PDF ufficiale del Verbale di Restituzione Divisa / DPI
 * con attestazione di riconsegna dei capi, coordinate IBAN per il bonifico
 * e rimborso automatico della cauzione versata (con layout anti-sovrapposizione e paginazione).
 */
export function generaPDFRestituzioneDivisa(
  volontario: Volontario,
  dati: DatiRestituzioneDivisa
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186mm
  const safeBottomY = pageHeight - 19;
  const now = new Date();

  const renderHeader = () => {
    disegnaHeaderIstituzionale(doc, {
      titoloDocumento: 'VERBALE RICONSEGNA DIVISA / D.P.I. & RESTITUZIONE CAUZIONE',
      badge: {
        riga1Tag: 'RICONSEGNA & LIQUIDAZIONE',
        riga2Valore: sanitizeWinAnsi(volontario.matricola || 'VOLONTARIO'),
        riga3Sotto: dati.ibanBonifico ? 'Rimborso a Bonifico' : 'Verbale Riconsegna'
      },
      pageWidth,
      margin
    });
  };

  renderHeader();
  let currentY = 33;

  const ensureSpace = (neededH: number) => {
    if (currentY + neededH > safeBottomY) {
      doc.addPage();
      renderHeader();
      currentY = 33;
    }
  };

  // 2. BOX DATI ANAGRAFICI DEL VOLONTARIO
  const col1X = margin + 4;
  const col2X = margin + contentWidth / 2 + 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  const resLines = doc.splitTextToSize(sanitizeWinAnsi(volontario.indirizzoResidenza || 'N/D'), contentWidth / 2 - 34);
  const telEmailLines = doc.splitTextToSize(
    sanitizeWinAnsi(`${volontario.telefono || 'N/D'} - ${volontario.email || 'N/D'}`),
    contentWidth / 2 - 34
  );
  const boxAnagraficaH = Math.max(34, 24 + resLines.length * 3.6 + telEmailLines.length * 3.6);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxAnagraficaH, 1.5, 1.5, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, contentWidth, 6, 1.5, 1.5, 'F');
  doc.rect(margin, currentY + 3, contentWidth, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  doc.text('1. DATI ANAGRAFICI DEL SOCIO / VOLONTARIO RESTITUENTE', margin + 3.5, currentY + 4.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('Cognome e Nome:', col1X, currentY + 11.2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizeWinAnsi(`${volontario.cognome.toUpperCase()} ${volontario.nome}`), col1X + 28, currentY + 11.2, {
    maxWidth: contentWidth / 2 - 32
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('Codice Fiscale:', col1X, currentY + 16.5);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizeWinAnsi(volontario.codiceFiscale || 'NON SPECIFICATO'), col1X + 28, currentY + 16.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('Indirizzo Residenza:', col1X, currentY + 21.8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85);
  doc.text(resLines, col1X + 28, currentY + 21.8);

  const yTel = currentY + 21.8 + resLines.length * 3.6 + 1.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('Telefono / Email:', col1X, yTel);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85);
  doc.text(telEmailLines, col1X + 28, yTel);

  // Colonna 2
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('Matricola Interna:', col2X, currentY + 11.2);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(191, 163, 83);
  doc.text(sanitizeWinAnsi(volontario.matricola || 'VOL-CROCEORO'), col2X + 26, currentY + 11.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('Qualifica:', col2X, currentY + 16.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizeWinAnsi(volontario.qualifica || 'Volontario'), col2X + 26, currentY + 16.5, {
    maxWidth: contentWidth / 2 - 30
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('Data Riconsegna:', col2X, currentY + 21.8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizeWinAnsi(dati.dataRestituzione || formatISODateItaly(now)), col2X + 26, currentY + 21.8);

  currentY += boxAnagraficaH + 4;

  // 3. TABELLA CAPI RICONSEGNATI & CALCOLO CAUZIONE
  const drawTabellaHeader = () => {
    doc.setFillColor(30, 41, 59);
    doc.rect(margin, currentY, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(255, 255, 255);
    doc.text('2. CAPI DI VESTIARIO RICONSEGNATI & PROSPETTO CAUZIONI DA RIMBORSARE', margin + 3.5, currentY + 4.2);
    currentY += 6;

    doc.setFillColor(15, 23, 42);
    doc.rect(margin, currentY, contentWidth, 5.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text('ARTICOLO / CAPO DI VESTIARIO', margin + 3, currentY + 3.8);
    doc.text('STATO RESTITUZIONE', margin + 88, currentY + 3.8);
    doc.text('VALORE CAUZIONE', margin + 125, currentY + 3.8);
    doc.text('RIMBORSO (EUR)', margin + contentWidth - 3, currentY + 3.8, { align: 'right' });
    currentY += 5.5;
  };

  ensureSpace(22);
  drawTabellaHeader();

  interface RigaStampaRestituzione {
    nome: string;
    restituito: boolean;
    valoreCauzione: string;
    rimborso: string;
    rimborsoPositivo: boolean;
  }

  const righe: RigaStampaRestituzione[] = [];
  if (dati.capiDettaglio && dati.capiDettaglio.length > 0) {
    dati.capiDettaglio.forEach((item) => {
      const labelNome = sanitizeWinAnsi(`${item.nome}${item.taglia ? ` (Tg. ${item.taglia})` : ''}${item.quantita && item.quantita > 1 ? ` x${item.quantita}` : ''}`);
      const cVal = item.esenteCauzione
        ? 'Esente (EUR 0,00)'
        : `EUR ${Number(item.cauzioneUnitaria || 0).toFixed(2).replace('.', ',')}`;
      const rimbNum = Number(item.importoRimborso || 0);
      righe.push({
        nome: labelNome,
        restituito: item.restituito,
        valoreCauzione: cVal,
        rimborso: `EUR ${rimbNum.toFixed(2).replace('.', ',')}`,
        rimborsoPositivo: item.restituito && rimbNum > 0
      });
    });
  } else {
    righe.push(
      {
        nome: 'Pantaloni Operativi Alta Visibilita',
        restituito: dati.restituitoPantaloni,
        valoreCauzione: 'EUR 30,00',
        rimborso: dati.restituitoPantaloni ? 'EUR 30,00' : 'EUR 0,00',
        rimborsoPositivo: dati.restituitoPantaloni
      },
      {
        nome: 'Giubbetto Mezza Stagione Operativo',
        restituito: dati.restituitoGiubbetto,
        valoreCauzione: 'EUR 45,00',
        rimborso: dati.restituitoGiubbetto ? 'EUR 45,00' : 'EUR 0,00',
        rimborsoPositivo: dati.restituitoGiubbetto
      }
    );
    if (dati.altriCapiRestituiti && dati.altriCapiRestituiti.length > 0) {
      dati.altriCapiRestituiti.forEach((c) => {
        righe.push({
          nome: sanitizeWinAnsi(c),
          restituito: true,
          valoreCauzione: 'EUR 0,00 (Gratuito)',
          rimborso: 'EUR 0,00',
          rimborsoPositivo: false
        });
      });
    }
  }

  righe.forEach((r, idx) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    const nomeLines = doc.splitTextToSize(r.nome, 78);
    const rowH = Math.max(7, nomeLines.length * 3.6 + 3.2);

    if (currentY + rowH > safeBottomY) {
      doc.addPage();
      renderHeader();
      currentY = 33;
      drawTabellaHeader();
    }

    doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(margin, currentY, contentWidth, rowH, 'FD');

    const textY = currentY + 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(15, 23, 42);
    doc.text(nomeLines, margin + 3, textY);

    if (r.restituito) {
      doc.setTextColor(22, 101, 52);
      doc.text('[OK] RICONSEGNATO', margin + 88, textY);
    } else {
      doc.setTextColor(148, 163, 184);
      doc.text('- Non riconsegnato', margin + 88, textY);
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(r.valoreCauzione, margin + 125, textY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(r.rimborsoPositivo ? 22 : 148, r.rimborsoPositivo ? 101 : 163, r.rimborsoPositivo ? 52 : 184);
    doc.text(r.rimborso, margin + contentWidth - 3, textY, { align: 'right' });

    currentY += rowH;
  });

  // Box Totale Rimborso in Evidenza
  ensureSpace(14);
  doc.setFillColor(254, 240, 138);
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.4);
  doc.rect(margin, currentY, contentWidth, 9.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.0);
  doc.setTextColor(146, 64, 14);
  doc.text('TOTALE CAUZIONE DA RIMBORSARE CON BONIFICO:', margin + 4, currentY + 6.2);

  doc.setFontSize(10.5);
  doc.setTextColor(29, 26, 96);
  const importoStr = `EUR ${Number(dati.cifraRimborsoTotale || 0).toFixed(2).replace('.', ',')}`;
  doc.text(importoStr, margin + 120, currentY + 6.3, { align: 'right' });

  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    sanitizeWinAnsi(`(in lettere: Euro ${importoInLettere(dati.cifraRimborsoTotale)})`),
    margin + contentWidth - 3,
    currentY + 6.2,
    { align: 'right', maxWidth: 62 }
  );

  currentY += 12.5;

  // 4. BOX COORDINATE BANCARIE PER IL BONIFICO (IBAN)
  const boxIbanH = 24;
  ensureSpace(boxIbanH + 4);
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxIbanH, 1.5, 1.5, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, contentWidth, 6, 1.5, 1.5, 'F');
  doc.rect(margin, currentY + 3, contentWidth, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  doc.text('3. MODALITA DI RESTITUZIONE CAUZIONE & COORDINATE BANCARIE', margin + 3.5, currentY + 4.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('IBAN per il Bonifico Bancario:', margin + 4, currentY + 12);

  doc.setFont('courier', 'bold');
  doc.setFontSize(9.0);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizeWinAnsi(dati.ibanBonifico || 'IBAN DA COMUNICARE / NON SPECIFICATO'), margin + 50, currentY + 12, {
    maxWidth: contentWidth - 54
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('Intestatario del Conto:', margin + 4, currentY + 18.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const intest = dati.intestatarioBonifico || `${volontario.cognome.toUpperCase()} ${volontario.nome}`;
  doc.text(sanitizeWinAnsi(intest), margin + 50, currentY + 18.5, { maxWidth: contentWidth - 54 });

  currentY += boxIbanH + 4;

  // 5. CAMPO ANNOTAZIONI AMMINISTRATORE
  const annotazioniTesto =
    dati.annotazioniAdmin?.trim() ||
    'I capi di vestiario sono stati restituiti in buono stato di conservazione, lavati e privi di manomissioni o danneggiamenti irreversibili. ' +
      'Si autorizza la liquidazione della cauzione a mezzo bonifico bancario sulle coordinate IBAN indicate.';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  const splitNote = doc.splitTextToSize(sanitizeWinAnsi(annotazioniTesto), contentWidth - 8);
  const boxNoteH = Math.max(24, 10 + splitNote.length * 3.8 + 4);
  ensureSpace(boxNoteH + 4);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxNoteH, 1.5, 1.5, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, contentWidth, 6, 1.5, 1.5, 'F');
  doc.rect(margin, currentY + 3, contentWidth, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  doc.text("4. ANNOTAZIONI DELL'AMMINISTRATORE / STATO CONSERVAZIONE DEI CAPI", margin + 3.5, currentY + 4.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(15, 23, 42);
  doc.text(splitNote, margin + 4, currentY + 10.8);

  currentY += boxNoteH + 4;

  // 6. CLAUSOLA DI LIBERATORIA & RICEVUTA
  const declText =
    "Con la sottoscrizione del presente verbale, il/la richiedente attesta la riconsegna dei capi sopra indicati e la correttezza dell'IBAN " +
    "fornito per l'accredito della cauzione. L'Associazione Croce Oro Massa Carrara OdV si impegna ad eseguire il bonifico bancario entro i termini amministrativi ordinari.";
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.0);
  const splitDecl = doc.splitTextToSize(sanitizeWinAnsi(declText), contentWidth - 7);
  const boxDeclH = Math.max(16, 7 + splitDecl.length * 3.2 + 3);
  ensureSpace(boxDeclH + 38);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxDeclH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(29, 26, 96);
  doc.text('5. DICHIARAZIONE DI RICONSEGNA E LIBERATORIA RECIPROCA', margin + 3.5, currentY + 4.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.0);
  doc.setTextColor(71, 85, 105);
  doc.text(splitDecl, margin + 3.5, currentY + 8);

  currentY += boxDeclH + 4;

  // 7. RIQUADRI FIRME
  const colFirmaW = (contentWidth - 6) / 2;
  const boxFirmaH = 34;
  ensureSpace(boxFirmaH + 2);

  // Box 1: Firma Volontario
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, currentY, colFirmaW, boxFirmaH, 1.5, 1.5, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, colFirmaW, 6, 1.5, 1.5, 'F');
  doc.rect(margin, currentY + 3, colFirmaW, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text('FIRMA DEL SOCIO / VOLONTARIO RESTITUENTE', margin + 3, currentY + 4.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizeWinAnsi(`${volontario.cognome.toUpperCase()} ${volontario.nome}`), margin + 3, currentY + 11, {
    maxWidth: colFirmaW - 6
  });

  if (dati.firmaVolontarioBase64 || volontario.firmaBase64) {
    try {
      const f = dati.firmaVolontarioBase64 || volontario.firmaBase64;
      if (f) {
        doc.addImage(f, 'PNG', margin + 8, currentY + 13, 40, 15, undefined, 'FAST');
      }
    } catch {}
  } else {
    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(margin + 5, currentY + 25, margin + colFirmaW - 5, currentY + 25);
    doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.5);
    doc.setTextColor(148, 163, 184);
    doc.text('(Firma per conferma riconsegna e coordinate IBAN)', margin + 3, currentY + 29);
  }

  // Box 2: Firma Amministratore / Responsabile Logistica
  const box2X = margin + colFirmaW + 6;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.35);
  doc.roundedRect(box2X, currentY, colFirmaW, boxFirmaH, 1.5, 1.5, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(box2X, currentY, colFirmaW, 6, 1.5, 1.5, 'F');
  doc.rect(box2X, currentY + 3, colFirmaW, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text("PER L'ASSOCIAZIONE / AMMINISTRAZIONE", box2X + 3, currentY + 4.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Croce Oro Massa Carrara OdV', box2X + 3, currentY + 11);

  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([2, 1], 0);
  doc.line(box2X + 5, currentY + 25, box2X + colFirmaW - 5, currentY + 25);
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text('(Timbro e Firma per presa in carico e autorizzazione bonifico)', box2X + 3, currentY + 29);

  // Footer unificato su tutte le pagine
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    disegnaFooterIstituzionale(doc, {
      dicituraArchiviazione: `Pagina ${p} di ${totalPages} - Verbale Ufficiale Riconsegna DPI e Liquidazione Bonifico - Archiviazione Amministrativa`,
      pageWidth,
      pageHeight,
      margin
    });
  }

  return doc;
}

/**
 * Scarica direttamente il file PDF di Restituzione Divisa nel browser
 */
export function scaricaPDFRestituzioneDivisa(
  volontario: Volontario,
  dati: DatiRestituzioneDivisa
): void {
  const doc = generaPDFRestituzioneDivisa(volontario, dati);
  const dataClean = (dati.dataRestituzione || formatISODateItaly()).replace(/-/g, '');
  const nomeFile = `Restituzione_Divisa_${volontario.cognome}_${volontario.nome}_${dataClean}.pdf`;
  doc.save(nomeFile);
}
