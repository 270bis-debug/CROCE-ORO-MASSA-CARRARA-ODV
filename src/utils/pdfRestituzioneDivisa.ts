import { jsPDF } from 'jspdf';
import { Volontario } from '../components/DatabaseVolontariModal';
import {
  disegnaHeaderIstituzionale,
  disegnaFooterIstituzionale
} from './pdfInstitutionalLayout';
import { formatISODateItaly } from './italianTime';

function pulisciTesto(str?: string): string {
  if (!str) return '';
  return str.replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ').trim();
}

function importoInLettere(importo: number): string {
  if (importo === 0) return 'Zero/00';
  if (importo === 30) return 'Trenta/00';
  if (importo === 45) return 'Quarantacinque/00';
  if (importo === 75) return 'Settantacinque/00';
  return `${importo.toFixed(2).replace('.', ',')}`;
}

export interface DatiRestituzioneDivisa {
  dataRestituzione: string; // YYYY-MM-DD
  ibanBonifico: string; // IT...
  intestatarioBonifico?: string;
  restituitoPantaloni: boolean;
  restituitoGiubbetto: boolean;
  altriCapiRestituiti?: string[];
  cifraRimborsoTotale: number; // Calcolata in automatico (es. € 30 pantalone + € 45 giubbetto)
  annotazioniAdmin?: string; // Scritto dall'amministratore da PC
  amministratoreNome?: string;
  firmaVolontarioBase64?: string;
}

/**
 * Genera il PDF ufficiale del Verbale di Restituzione Divisa / DPI
 * con attestazione di riconsegna dei capi, coordinate IBAN per il bonifico
 * e rimborso automatico della cauzione versata.
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
  const now = new Date();

  // 1. INTESTAZIONE ISTITUZIONALE UNIFICATA CON RETTANGOLO RICONSEGNA A DESTRA
  disegnaHeaderIstituzionale(doc, {
    titoloDocumento: 'VERBALE RICONSEGNA DIVISA / D.P.I. & RESTITUZIONE CAUZIONE',
    badge: {
      riga1Tag: 'RICONSEGNA & LIQUIDAZIONE',
      riga2Valore: pulisciTesto(volontario.matricola || 'VOLONTARIO'),
      riga3Sotto: dati.ibanBonifico ? 'Rimborso a Bonifico' : 'Verbale Riconsegna'
    },
    pageWidth,
    margin
  });

  let currentY = 33;

  // 2. BOX DATI ANAGRAFICI DEL VOLONTARIO (RECUPERO AUTOMATICO)
  const boxAnagraficaH = 34;
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

  const col1X = margin + 4;
  const col2X = margin + contentWidth / 2 + 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('Cognome e Nome:', col1X, currentY + 11.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${pulisciTesto(volontario.cognome).toUpperCase()} ${pulisciTesto(volontario.nome)}`, col1X + 28, currentY + 11.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('Codice Fiscale:', col1X, currentY + 17);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(pulisciTesto(volontario.codiceFiscale || 'NON SPECIFICATO'), col1X + 28, currentY + 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('Indirizzo Residenza:', col1X, currentY + 22.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(pulisciTesto(volontario.indirizzoResidenza || 'N/D'), col1X + 28, currentY + 22.5, { maxWidth: contentWidth / 2 - 32 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('Telefono / Email:', col1X, currentY + 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`${pulisciTesto(volontario.telefono || 'N/D')} • ${pulisciTesto(volontario.email || 'N/D')}`, col1X + 28, currentY + 28);

  // Colonna 2
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('Matricola Interna:', col2X, currentY + 11.5);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(191, 163, 83);
  doc.text(pulisciTesto(volontario.matricola || 'VOL-CROCEORO'), col2X + 26, currentY + 11.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('Qualifica:', col2X, currentY + 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(pulisciTesto(volontario.qualifica || 'Volontario'), col2X + 26, currentY + 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('Data Riconsegna:', col2X, currentY + 22.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(dati.dataRestituzione || formatISODateItaly(now), col2X + 26, currentY + 22.5);

  currentY += boxAnagraficaH + 4;

  // 3. TABELLA CAPI RICONSEGNATI & CALCOLO AUTOMATICO CAUZIONE
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, currentY, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(255, 255, 255);
  doc.text('2. CAPI DI VESTIARIO RICONSEGNATI & PROSPETTO CAUZIONI DA RIMBORSARE', margin + 3.5, currentY + 4.2);

  currentY += 6;

  // Header tabella
  const colT = [margin, margin + 85, margin + 120, margin + 150];
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, currentY, contentWidth, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.text('ARTICOLO / CAPO DI VESTIARIO', colT[0] + 3, currentY + 3.8);
  doc.text('STATO RESTITUZIONE', colT[1] + 3, currentY + 3.8);
  doc.text('VALORE CAUZIONE', colT[2] + 3, currentY + 3.8);
  doc.text('IMPORTO RIMBORSO', colT[3] + 3, currentY + 3.8);

  currentY += 5.5;

  const righe = [
    {
      nome: 'Pantaloni Operativi Alta Visibilità',
      restituito: dati.restituitoPantaloni,
      valoreCauzione: '€ 30,00',
      rimborso: dati.restituitoPantaloni ? '€ 30,00' : '€ 0,00'
    },
    {
      nome: 'Giubbetto Mezza Stagione Operativo',
      restituito: dati.restituitoGiubbetto,
      valoreCauzione: '€ 45,00',
      rimborso: dati.restituitoGiubbetto ? '€ 45,00' : '€ 0,00'
    }
  ];

  if (dati.altriCapiRestituiti && dati.altriCapiRestituiti.length > 0) {
    dati.altriCapiRestituiti.forEach((c) => {
      righe.push({
        nome: c,
        restituito: true,
        valoreCauzione: '€ 0,00 (Gratuito)',
        rimborso: '€ 0,00'
      });
    });
  }

  const rowH = 7;
  righe.forEach((r, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(248, 250, 252);
    }
    doc.rect(margin, currentY, contentWidth, rowH, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(margin, currentY, contentWidth, rowH, 'S');

    const textY = currentY + 4.8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(pulisciTesto(r.nome), colT[0] + 3, textY);

    if (r.restituito) {
      doc.setTextColor(22, 101, 52);
      doc.text('✓ RICONSEGNATO', colT[1] + 3, textY);
    } else {
      doc.setTextColor(148, 163, 184);
      doc.text('— Non riconsegnato', colT[1] + 3, textY);
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(r.valoreCauzione, colT[2] + 3, textY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(r.restituito && r.rimborso !== '€ 0,00' ? 22 : 148, r.restituito && r.rimborso !== '€ 0,00' ? 101 : 163, r.restituito && r.rimborso !== '€ 0,00' ? 52 : 184);
    doc.text(r.rimborso, colT[3] + 3, textY);

    currentY += rowH;
  });

  // Box Totale Rimborso in Evidenza
  doc.setFillColor(254, 240, 138); // Giallo evidenziatore
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.4);
  doc.rect(margin, currentY, contentWidth, 9, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(146, 64, 14);
  doc.text('TOTALE CAUZIONE DA RIMBORSARE CON BONIFICO:', margin + 4, currentY + 6);

  doc.setFontSize(11);
  doc.setTextColor(29, 26, 96);
  const importoStr = `€ ${dati.cifraRimborsoTotale.toFixed(2).replace('.', ',')}`;
  doc.text(importoStr, margin + 115, currentY + 6.2);

  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  doc.text(`(in lettere: Euro ${importoInLettere(dati.cifraRimborsoTotale)})`, margin + 140, currentY + 6);

  currentY += 12;

  // 4. BOX COORDINATE BANCARIE PER IL BONIFICO (IBAN)
  const boxIbanH = 24;
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
  doc.text('3. MODALITÀ DI RESTITUZIONE CAUZIONE & COORDINATE BANCARIE', margin + 3.5, currentY + 4.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('IBAN per il Bonifico Bancario:', margin + 4, currentY + 12);

  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(pulisciTesto(dati.ibanBonifico || 'IBAN DA COMUNICARE / NON SPECIFICATO'), margin + 48, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(29, 26, 96);
  doc.text('Intestatario del Conto:', margin + 4, currentY + 18.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const intest = dati.intestatarioBonifico || `${volontario.cognome.toUpperCase()} ${volontario.nome}`;
  doc.text(pulisciTesto(intest), margin + 48, currentY + 18.5);

  currentY += boxIbanH + 4;

  // 5. CAMPO ANNOTAZIONI AMMINISTRATORE (SCRITTO DA PC PRIMA DELLA STAMPA)
  const boxNoteH = 28;
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
  doc.text('4. ANNOTAZIONI DELL\'AMMINISTRATORE / STATO CONSERVAZIONE DEI CAPI', margin + 3.5, currentY + 4.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  const annotazioniTesto =
    dati.annotazioniAdmin?.trim() ||
    'I capi di vestiario sono stati restituiti in buono stato di conservazione, lavati e privi di manomissioni o danneggiamenti irreversibili. ' +
    'Si autorizza la liquidazione della cauzione a mezzo bonifico bancario sulle coordinate IBAN indicate.';
  const splitNote = doc.splitTextToSize(pulisciTesto(annotazioniTesto), contentWidth - 8);
  doc.text(splitNote, margin + 4, currentY + 11.5);

  currentY += boxNoteH + 4;

  // 6. CLAUSOLA DI LIBERATORIA & RICEVUTA
  const boxDeclH = 18;
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
  const declText =
    'Con la sottoscrizione del presente verbale, il/la richiedente attesta la riconsegna dei capi sopra indicati e la correttezza dell\'IBAN ' +
    'fornito per l\'accredito della cauzione. L\'Associazione Croce Oro Massa Carrara OdV si impegna ad eseguire il bonifico bancario entro i termini amministrativi ordinari.';
  const splitDecl = doc.splitTextToSize(declText, contentWidth - 6);
  doc.text(splitDecl, margin + 3.5, currentY + 8);

  currentY += boxDeclH + 4;

  // 7. RIQUADRI FIRME
  const colFirmaW = (contentWidth - 6) / 2;
  const boxFirmaH = 34;

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
  doc.text(`${volontario.cognome.toUpperCase()} ${volontario.nome}`, margin + 3, currentY + 11);

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
  doc.text('PER L\'ASSOCIAZIONE / AMMINISTRAZIONE', box2X + 3, currentY + 4.2);

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

  // Footer unificato
  disegnaFooterIstituzionale(doc, {
    dicituraArchiviazione: 'Pagina 1 di 1 • Verbale Ufficiale Riconsegna DPI e Liquidazione Bonifico • Archiviazione Amministrativa',
    pageWidth,
    pageHeight,
    margin
  });

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
