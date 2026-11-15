import { jsPDF } from 'jspdf';
import { Volontario } from '../components/DatabaseVolontariModal';
import { calcolaStatoScadenzaPatente } from '../data/vestiarioDocumenti';

import {
  disegnaHeaderIstituzionale,
  disegnaFooterIstituzionale
} from './pdfInstitutionalLayout';
import { formatDateItaly, formatISODateItaly } from './italianTime';

/**
 * Pulisce e sanitizza stringhe per la stampa jsPDF
 */
function pulisciTesto(str?: string): string {
  if (!str) return '';
  return str
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
    .trim();
}

/**
 * Genera la Scheda Personale & Ricevuta Consegna Vestiario / DPI
 * Scaricabile solo dall'Amministratore, da stampare e firmare.
 * Evidenzia in giallo fluorescente/ambra i capi consegnati nell'ultimo aggiornamento.
 */
export function generaSchedaVestiarioPDF(volontario: Volontario): jsPDF {
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

  // 1. INTESTAZIONE ISTITUZIONALE UNIFICATA CON RETTANGOLO SCHEDA A DESTRA
  disegnaHeaderIstituzionale(doc, {
    titoloDocumento: 'SCHEDA PERSONALE, DOCUMENTI & RICEVUTA CONSEGNA VESTIARIO / D.P.I.',
    badge: {
      riga1Tag: 'SCHEDA DIPENDENTE / VOLONTARIO',
      riga2Valore: pulisciTesto(volontario.matricola || 'VOL-CROCEORO'),
      riga3Sotto: pulisciTesto(volontario.qualifica || 'Personale Operativo')
    },
    pageWidth,
    margin
  });

  let currentY = 33;

  // 2. BOX DATI ANAGRAFICI & RECAPITI (con eventuale FOTO a lato)
  const boxAnagraficaH = 38;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxAnagraficaH, 2, 2, 'FD');

  // Testatina Box Anagrafica
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, contentWidth, 6, 2, 2, 'F');
  doc.rect(margin, currentY + 3, contentWidth, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('1. DATI ANAGRAFICI & RECAPITI DELL\'ASSEGNATARIO', margin + 3, currentY + 4.2);

  // Se c'è la FOTO della persona, la disegniamo nel box a destra
  let photoWidth = 0;
  if (volontario.fotoBase64) {
    photoWidth = 24;
    const photoHeight = 29;
    const photoX = pageWidth - margin - photoWidth - 4;
    const photoY = currentY + 8;
    try {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(71, 85, 105);
      doc.setLineWidth(0.3);
      doc.roundedRect(photoX - 1, photoY - 1, photoWidth + 2, photoHeight + 2, 1, 1, 'FD');
      doc.addImage(volontario.fotoBase64, 'JPEG', photoX, photoY, photoWidth, photoHeight, undefined, 'FAST');
    } catch {
      photoWidth = 0;
    }
  }

  const anagrafeTextW = contentWidth - photoWidth - 8;
  const col1X = margin + 4;
  const col2X = margin + (anagrafeTextW / 2);

  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);

  // Riga 1: Nominativo & Ruolo
  doc.setFont('helvetica', 'bold');
  doc.text('Nominativo:', col1X, currentY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.text(pulisciTesto(`${volontario.nome} ${volontario.cognome}`), col1X + 22, currentY + 11.5, { maxWidth: (anagrafeTextW / 2) - 24 });

  doc.setFont('helvetica', 'bold');
  doc.text('Ruolo / Qualifica:', col2X, currentY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.text(pulisciTesto(volontario.qualifica), col2X + 25, currentY + 11.5, { maxWidth: (anagrafeTextW / 2) - 27 });

  // Riga 2: Codice Fiscale & Matricola
  doc.setFont('helvetica', 'bold');
  doc.text('Cod. Fiscale:', col1X, currentY + 17);
  doc.setFont('helvetica', 'normal');
  doc.setFont('helvetica', 'bold');
  doc.text(pulisciTesto(volontario.codiceFiscale || 'N/D'), col1X + 22, currentY + 17);

  doc.setFont('helvetica', 'bold');
  doc.text('Matricola:', col2X, currentY + 17);
  doc.setFont('helvetica', 'normal');
  doc.text(pulisciTesto(`${volontario.matricola || 'N/D'} (Iscr: ${volontario.dataRegistrazione || '01/01/2026'})`), col2X + 25, currentY + 17, { maxWidth: (anagrafeTextW / 2) - 27 });

  // Riga 3: Indirizzo di Residenza
  doc.setFont('helvetica', 'bold');
  doc.text('Residenza:', col1X, currentY + 22.5);
  doc.setFont('helvetica', 'normal');
  doc.text(pulisciTesto(volontario.indirizzoResidenza || 'Nessun indirizzo specificato'), col1X + 22, currentY + 22.5, { maxWidth: anagrafeTextW - 24 });

  // Riga 4: Telefono & Email
  doc.setFont('helvetica', 'bold');
  doc.text('Cellulare:', col1X, currentY + 28);
  doc.setFont('helvetica', 'normal');
  doc.text(pulisciTesto(volontario.telefono || 'N/D'), col1X + 22, currentY + 28);

  doc.setFont('helvetica', 'bold');
  doc.text('Email:', col2X, currentY + 28);
  doc.setFont('helvetica', 'normal');
  doc.text(pulisciTesto(volontario.email || 'N/D'), col2X + 25, currentY + 28, { maxWidth: (anagrafeTextW / 2) - 27 });

  // Riga 5: Tipo Account
  doc.setFont('helvetica', 'bold');
  doc.text('Tipo Account:', col1X, currentY + 34);
  doc.setFont('helvetica', 'normal');
  doc.text(
    volontario.profiloCentrale ? 'Operatore Centrale Radio 118' : 'Volontario Operativo Bordo Mezzo',
    col1X + 22,
    currentY + 34
  );

  currentY += boxAnagraficaH + 3.5;

  // 3. BOX DOCUMENTO DI IDENTITÀ & PATENTE DI GUIDA
  const boxDocH = 25;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxDocH, 2, 2, 'FD');

  // Testatina Box Documenti
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, contentWidth, 6, 2, 2, 'F');
  doc.rect(margin, currentY + 3, contentWidth, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('2. DOCUMENTI DI RICONOSCIMENTO & PATENTE DI GUIDA', margin + 3, currentY + 4.2);

  const docColW = (contentWidth - 6) / 2;
  const colDoc1 = margin + 4;
  const colDoc2 = margin + docColW + 6;

  // Colonna 1: Documento d'Identità
  const docId = volontario.documentoIdentita;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('• DOCUMENTO D\'IDENTITÀ', colDoc1, currentY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  if (docId?.numero) {
    doc.text(`Tipo: ${pulisciTesto(docId.tipo || 'Carta d\'Identità')} | N° ${pulisciTesto(docId.numero)}`, colDoc1 + 3, currentY + 15.5);
    doc.text(`Data Scadenza: ${pulisciTesto(docId.dataScadenza || 'N/D')}`, colDoc1 + 3, currentY + 20.5);
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(148, 163, 184);
    doc.text('Nessun documento d\'identità inserito a sistema', colDoc1 + 3, currentY + 15.5);
  }

  // Colonna 2: Patente di Guida
  const pat = volontario.patente;
  const statoPatente = pat?.dataScadenza ? calcolaStatoScadenzaPatente(pat.dataScadenza) : null;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text('• PATENTE DI GUIDA', colDoc2, currentY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  if (pat?.inPossesso && pat?.numero) {
    doc.text(`Cat: ${pulisciTesto(pat.categoria || 'B')} | N° ${pulisciTesto(pat.numero)}`, colDoc2 + 3, currentY + 15.5);
    doc.text(`Scadenza: ${pulisciTesto(pat.dataScadenza || 'N/D')}`, colDoc2 + 3, currentY + 20.5);

    // Alert Scadenza nel PDF se scade entro 7 giorni o già scaduta
    if (statoPatente && (statoPatente.inScadenza7Giorni || statoPatente.scaduta)) {
      doc.setFillColor(239, 68, 68); // rosso
      doc.roundedRect(colDoc2 + 45, currentY + 17, 40, 4.5, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.8);
      doc.setTextColor(255, 255, 255);
      doc.text(`⚠️ ${statoPatente.label.toUpperCase()}`, colDoc2 + 65, currentY + 20.2, { align: 'center' });
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(148, 163, 184);
    doc.text(pat?.inPossesso === false ? 'Non in possesso di patente di guida' : 'Dati patente non specificati', colDoc2 + 3, currentY + 15.5);
  }

  currentY += boxDocH + 4;

  // 4. TABELLA DOTAZIONE VESTIARIO ASSEGNATO
  // Testata Sezione Vestiario
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, currentY, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('3. RIEPILOGO CAPI DI VESTIARIO & D.P.I. ASSEGNATI (DISPOSITIVI DI PROTEZIONE INDIVIDUALE)', margin + 3, currentY + 4.2);

  // Barra di Avviso se c'è un capo evidenziato come ULTIMA CONSEGNA
  const vestiario = volontario.vestiario;
  let haUltimaConsegna = false;
  if (vestiario) {
    if (vestiario.tshirt?.some(p => p.isUltimaConsegna)) haUltimaConsegna = true;
    if (vestiario.felpa?.isUltimaConsegna) haUltimaConsegna = true;
    if (vestiario.pile?.isUltimaConsegna) haUltimaConsegna = true;
    if (vestiario.pantaloni?.isUltimaConsegna) haUltimaConsegna = true;
    if (vestiario.giubbetto?.isUltimaConsegna) haUltimaConsegna = true;
    if (vestiario.giubbottoInvernale?.isUltimaConsegna) haUltimaConsegna = true;
  }

  currentY += 6;

  if (haUltimaConsegna) {
    doc.setFillColor(254, 240, 138); // giallo evidenziatore chiaro (#fef08a)
    doc.setDrawColor(234, 179, 8); // amber-500
    doc.setLineWidth(0.4);
    doc.rect(margin, currentY, contentWidth, 5.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(133, 77, 14); // amber-900
    const dataUltima = vestiario?.dataUltimoAggiornamento ? ` (${vestiario.dataUltimoAggiornamento})` : '';
    doc.text(`★ NOTA EVIDENZIAZIONE: I capi evidenziati in GIALLO rappresentano la consegna effettuata in questo aggiornamento${dataUltima}.`, margin + 3, currentY + 3.8);
    currentY += 5.5;
  }

  // Intestazione Colonne Tabella
  // Colonne:
  // 1. Capo / Articolo: 62mm
  // 2. Taglia Assegnata: 28mm
  // 3. Quantità: 18mm
  // 4. Data Consegna: 28mm
  // 5. Stato / Evidenziazione: 50mm
  // Totale: 62 + 28 + 18 + 28 + 50 = 186mm
  const colW = [62, 28, 18, 28, 50];
  const colX = [
    margin,
    margin + 62,
    margin + 62 + 28,
    margin + 62 + 28 + 18,
    margin + 62 + 28 + 18 + 28
  ];

  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, currentY, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text('CAPO / DOTAZIONE INDIVIDUALE', colX[0] + 3, currentY + 4.2);
  doc.text('TAGLIA', colX[1] + 3, currentY + 4.2);
  doc.text('Q.TÀ', colX[2] + 3, currentY + 4.2);
  doc.text('DATA CONSEGNA', colX[3] + 3, currentY + 4.2);
  doc.text('STATO ASSEGNAZIONE / NOTE', colX[4] + 3, currentY + 4.2);

  currentY += 6;

  // Righe Vestiario da Generare
  // T-shirt (3 pezzi max) + 5 capi singoli
  interface RigaVestiarioStampa {
    nome: string;
    consegnato: boolean;
    taglia?: string;
    qta: string;
    dataConsegna?: string;
    isUltimaConsegna?: boolean;
  }

  const righeVestiario: RigaVestiarioStampa[] = [];

  // T-shirt 1, 2, 3
  const tshirts = vestiario?.tshirt || [
    { id: 1, consegnato: false },
    { id: 2, consegnato: false },
    { id: 3, consegnato: false }
  ];

  tshirts.forEach((p, idx) => {
    righeVestiario.push({
      nome: `T-shirt Istituzionale Croce Oro (Pezzo #${idx + 1} di 3)`,
      consegnato: !!p.consegnato,
      taglia: p.taglia || '—',
      qta: p.consegnato ? '1 pz' : '0',
      dataConsegna: p.dataConsegna,
      isUltimaConsegna: !!p.isUltimaConsegna
    });
  });

  // Felpa
  righeVestiario.push({
    nome: 'Felpa con Zip & Loghi Istituzionali Croce Oro',
    consegnato: !!vestiario?.felpa?.consegnato,
    taglia: vestiario?.felpa?.taglia || '—',
    qta: vestiario?.felpa?.consegnato ? '1 pz' : '0',
    dataConsegna: vestiario?.felpa?.dataConsegna,
    isUltimaConsegna: !!vestiario?.felpa?.isUltimaConsegna
  });

  // Pile
  righeVestiario.push({
    nome: 'Pile Tecnico Alta Visibilità / Termico',
    consegnato: !!vestiario?.pile?.consegnato,
    taglia: vestiario?.pile?.taglia || '—',
    qta: vestiario?.pile?.consegnato ? '1 pz' : '0',
    dataConsegna: vestiario?.pile?.dataConsegna,
    isUltimaConsegna: !!vestiario?.pile?.isUltimaConsegna
  });

  // Pantaloni (Cauzione € 30,00)
  const pantConsegnato = !!vestiario?.pantaloni?.consegnato;
  righeVestiario.push({
    nome: `Pantaloni Operativi Alta Visibilità (Cauzione € 30,00 ${pantConsegnato ? 'versata' : 'da versare'})`,
    consegnato: pantConsegnato,
    taglia: vestiario?.pantaloni?.taglia || '—',
    qta: pantConsegnato ? '1 pz' : '0',
    dataConsegna: vestiario?.pantaloni?.dataConsegna,
    isUltimaConsegna: !!vestiario?.pantaloni?.isUltimaConsegna
  });

  // Giubbetto (Cauzione € 45,00)
  const giubConsegnato = !!vestiario?.giubbetto?.consegnato;
  righeVestiario.push({
    nome: `Giubbetto Mezza Stagione Operativo (Cauzione € 45,00 ${giubConsegnato ? 'versata' : 'da versare'})`,
    consegnato: giubConsegnato,
    taglia: vestiario?.giubbetto?.taglia || '—',
    qta: giubConsegnato ? '1 pz' : '0',
    dataConsegna: vestiario?.giubbetto?.dataConsegna,
    isUltimaConsegna: !!vestiario?.giubbetto?.isUltimaConsegna
  });

  // Giubbotto Invernale
  righeVestiario.push({
    nome: 'Giubbotto Invernale Imbottito Alta Visibilità D.P.I.',
    consegnato: !!vestiario?.giubbottoInvernale?.consegnato,
    taglia: vestiario?.giubbottoInvernale?.taglia || '—',
    qta: vestiario?.giubbottoInvernale?.consegnato ? '1 pz' : '0',
    dataConsegna: vestiario?.giubbottoInvernale?.dataConsegna,
    isUltimaConsegna: !!vestiario?.giubbottoInvernale?.isUltimaConsegna
  });

  const rowHeight = 7.0;

  righeVestiario.forEach((riga, index) => {
    const isEvidenziata = riga.isUltimaConsegna;

    // Sfondo Riga: Evidenziazione Giallo Fluorescente/Oro se appena consegnata
    if (isEvidenziata) {
      doc.setFillColor(254, 240, 138); // #fef08a giallo brillante evidenziatore
      doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      // Bordo laterale dorato marcato
      doc.setFillColor(202, 138, 4);
      doc.rect(margin, currentY, 2.5, rowHeight, 'F');
      doc.setDrawColor(234, 179, 8);
    } else if (riga.consegnato) {
      // Consegnato in precedenza
      if (index % 2 === 1) {
        doc.setFillColor(241, 245, 249); // slate-100
        doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      } else {
        doc.setFillColor(255, 255, 255);
        doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      }
      doc.setDrawColor(226, 232, 240);
    } else {
      // Non ancora consegnato
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      doc.setDrawColor(226, 232, 240);
    }

    doc.setLineWidth(0.2);
    doc.rect(margin, currentY, contentWidth, rowHeight, 'S');

    // Testi Celle
    const textY = currentY + 4.6;

    // 1. Nome Capo
    doc.setFont('helvetica', isEvidenziata || riga.consegnato ? 'bold' : 'normal');
    doc.setFontSize(6.7);
    doc.setTextColor(isEvidenziata ? 133 : (riga.consegnato ? 15 : 100), isEvidenziata ? 77 : (riga.consegnato ? 23 : 116), isEvidenziata ? 14 : (riga.consegnato ? 42 : 139));
    doc.text(pulisciTesto(riga.nome), colX[0] + 3.5, textY, { maxWidth: colW[0] - 5 });

    // 2. Taglia
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    if (riga.consegnato) {
      doc.setTextColor(isEvidenziata ? 161 : 29, isEvidenziata ? 98 : 26, isEvidenziata ? 7 : 96);
      doc.text(pulisciTesto(riga.taglia), colX[1] + 3, textY);
    } else {
      doc.setTextColor(148, 163, 184);
      doc.text('—', colX[1] + 3, textY);
    }

    // 3. Quantità
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(riga.consegnato ? 15 : 148, riga.consegnato ? 23 : 163, riga.consegnato ? 42 : 184);
    doc.text(riga.qta, colX[2] + 3, textY);

    // 4. Data Consegna
    doc.setFont('helvetica', riga.consegnato ? 'bold' : 'normal');
    doc.setFontSize(6.8);
    if (riga.consegnato && riga.dataConsegna) {
      doc.setTextColor(isEvidenziata ? 180 : 51, isEvidenziata ? 83 : 65, isEvidenziata ? 9 : 85);
      doc.text(pulisciTesto(riga.dataConsegna), colX[3] + 3, textY);
    } else {
      doc.setTextColor(148, 163, 184);
      doc.text('Non assegnato', colX[3] + 3, textY);
    }

    // 5. Stato / Evidenziazione
    if (isEvidenziata) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.4);
      doc.setTextColor(161, 98, 7); // amber-700
      doc.text('★ ULTIMA CONSEGNA', colX[4] + 3, textY, { maxWidth: colW[4] - 5 });
    } else if (riga.consegnato) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.4);
      doc.setTextColor(22, 101, 52); // green-800
      doc.text('✓ Consegnato / In Dotazione', colX[4] + 3, textY, { maxWidth: colW[4] - 5 });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.4);
      doc.setTextColor(148, 163, 184);
      doc.text('— Da consegnare', colX[4] + 3, textY);
    }

    currentY += rowHeight;
  });

  currentY += 2.5;

  // 4. BOX REGIME CAUZIONALE DIVISA & IBAN ACCREDITO RIMBORSO
  const cauzioneP = vestiario?.pantaloni?.consegnato ? 30.0 : 0;
  const cauzioneG = vestiario?.giubbetto?.consegnato ? 45.0 : 0;
  const totCauzioneVersata = cauzioneP + cauzioneG;
  const ibanRimborso = vestiario?.ibanRestituzioneCauzione?.trim();

  const boxCauzioneH = 15.5;
  doc.setFillColor(254, 249, 195); // giallo-amber soft (#fef9c3)
  doc.setDrawColor(217, 119, 6); // amber-600
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, currentY, contentWidth, boxCauzioneH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(146, 64, 14); // amber-800
  doc.text('REGIME CAUZIONALE DIVISA & DPI:', margin + 3, currentY + 4.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `Pantaloni: cauzione € 30,00 (${cauzioneP > 0 ? 'VERSATA ✓' : 'Non ancora versata'}) • Giubbetto: cauzione € 45,00 (${cauzioneG > 0 ? 'VERSATA ✓' : 'Non ancora versata'})`,
    margin + 48,
    currentY + 4.2
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(29, 26, 96);
  doc.text(
    `TOTALE CAUZIONE CUSTODITA: € ${totCauzioneVersata.toFixed(2).replace('.', ',')}`,
    margin + 3,
    currentY + 8.8
  );

  // Riga dedicata IBAN Rimborso
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.3);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text('IBAN ACCREDITO RIMBORSO CAUZIONE ALLA RICONSEGNA:', margin + 3, currentY + 13.0);

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(15, 23, 42);
  doc.text(
    ibanRimborso || 'NON ANCORA SPECIFICATO (DA COMUNICARE ALLA RESTITUZIONE)',
    margin + 66,
    currentY + 13.0
  );

  currentY += boxCauzioneH + 3.5;

  // 5. DICHIARAZIONE DI COMODATO D'USO E RESPONSABILITÀ
  const boxDeclH = 17;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxDeclH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(29, 26, 96);
  doc.text('DICHIARAZIONE DI RICEVUTA, PRESA IN CARICO E COMODATO D\'USO', margin + 3, currentY + 4.0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(71, 85, 105);
  const testoDichiarazione =
    'Il/La sottoscritto/a dichiara di aver ricevuto in comodato d\'uso i capi di vestiario sopra indicati e di aver versato le relative cauzioni ove previste (€ 30 per pantalone, € 45 per giubbetto). Si impegna alla diligente custodia, pulizia e manutenzione secondo le direttive dell\'Ente, con obbligo di restituzione tempestiva in caso di cessazione del rapporto associativo per il rimborso delle cauzioni a mezzo bonifico bancario sulle coordinate IBAN indicate.';
  const splitDichiarazione = doc.splitTextToSize(testoDichiarazione, contentWidth - 6);
  doc.text(splitDichiarazione, margin + 3, currentY + 7.8);

  // 6. RIQUADRI DELLE FIRME (DUE BOX AFFIANCATI IN CALCE)
  const colFirmaW = (contentWidth - 6) / 2; // 90mm
  const boxFirmaH = 30;
  const footerH = 14;
  const footerY = pageHeight - footerH; // 297 - 14 = 283mm
  // Posiziona il box firme perfettamente sopra al footer con 4mm di spazio
  const boxFirmaY = footerY - boxFirmaH - 4; // 283 - 30 - 4 = 249mm

  // Box 1: Firma Amministratore / Responsabile Logistica
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, boxFirmaY, colFirmaW, boxFirmaH, 1.5, 1.5, 'FD');

  // Testata Box 1
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, boxFirmaY, colFirmaW, 5.5, 1.5, 1.5, 'F');
  doc.rect(margin, boxFirmaY + 2.5, colFirmaW, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(255, 255, 255);
  doc.text('FIRMA AMMINISTRATORE / RESP. LOGISTICA', margin + 3, boxFirmaY + 4.0, { maxWidth: colFirmaW - 6 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(15, 23, 42);
  doc.text('Croce Oro Massa Carrara OdV', margin + 3, boxFirmaY + 9.2, { maxWidth: colFirmaW - 6 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.0);
  doc.setTextColor(71, 85, 105);
  doc.text(`Data Consegna: ${formatDateItaly(now)}`, margin + 3, boxFirmaY + 13.0, { maxWidth: colFirmaW - 6 });

  // Linea di firma con crocetta 'X'
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.0);
  doc.setTextColor(71, 85, 105);
  doc.text('X', margin + 4, boxFirmaY + 20.5);
  doc.setDrawColor(71, 85, 105);
  doc.setLineDashPattern([2, 1], 0);
  doc.line(margin + 8, boxFirmaY + 20.5, margin + colFirmaW - 4, boxFirmaY + 20.5);
  doc.setLineDashPattern([], 0);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(5.4);
  doc.setTextColor(100, 116, 139);
  doc.text('Timbro e firma per convalida consegna materiale', margin + 3, boxFirmaY + 26.0, { maxWidth: colFirmaW - 6 });

  // Box 2: Firma Volontario / Operatore Ricevente
  const box2X = margin + colFirmaW + 6;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.35);
  doc.roundedRect(box2X, boxFirmaY, colFirmaW, boxFirmaH, 1.5, 1.5, 'FD');

  // Testata Box 2
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(box2X, boxFirmaY, colFirmaW, 5.5, 1.5, 1.5, 'F');
  doc.rect(box2X, boxFirmaY + 2.5, colFirmaW, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(255, 255, 255);
  doc.text('FIRMA VOLONTARIO / OPERATORE RICEVENTE', box2X + 3, boxFirmaY + 4.0, { maxWidth: colFirmaW - 6 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(15, 23, 42);
  doc.text(pulisciTesto(`${volontario.nome} ${volontario.cognome}`), box2X + 3, boxFirmaY + 9.2, { maxWidth: colFirmaW - 6 });

  if (volontario.firmaBase64) {
    try {
      doc.addImage(volontario.firmaBase64, 'PNG', box2X + 3, boxFirmaY + 10.5, colFirmaW - 6, 11, undefined, 'FAST');
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(box2X + 3, boxFirmaY + boxFirmaH - 4.8, colFirmaW - 6, 3.4, 0.8, 0.8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.0);
      doc.text(
        '✓ FIRMA ACQUISITA DIGITALMENTE',
        box2X + 3 + (colFirmaW - 6) / 2,
        boxFirmaY + boxFirmaH - 2.4,
        { align: 'center', maxWidth: colFirmaW - 10 }
      );
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.0);
      doc.setTextColor(71, 85, 105);
      doc.text('X', box2X + 4, boxFirmaY + 20.5);
      doc.setDrawColor(71, 85, 105);
      doc.setLineDashPattern([2, 1], 0);
      doc.line(box2X + 8, boxFirmaY + 20.5, box2X + colFirmaW - 4, boxFirmaY + 20.5);
      doc.setLineDashPattern([], 0);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.4);
      doc.setTextColor(100, 116, 139);
      doc.text('Sottoscrizione per ricevuta, presa in carico e accettazione', box2X + 3, boxFirmaY + 26.0, { maxWidth: colFirmaW - 6 });
    }
  } else {
    // Spazio per firma autografa
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.0);
    doc.setTextColor(71, 85, 105);
    doc.text('X', box2X + 4, boxFirmaY + 20.5);
    doc.setDrawColor(71, 85, 105);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(box2X + 8, boxFirmaY + 20.5, box2X + colFirmaW - 4, boxFirmaY + 20.5);
    doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.4);
    doc.setTextColor(100, 116, 139);
    doc.text('Sottoscrizione per ricevuta, presa in carico e accettazione', box2X + 3, boxFirmaY + 26.0, { maxWidth: colFirmaW - 6 });
  }

  // 7. PIÈ DI PAGINA ISTITUZIONALE UNIFICATO
  disegnaFooterIstituzionale(doc, {
    dicituraArchiviazione: 'Pagina 1 di 1 • Scheda Ufficiale Dotazione e DPI • Archiviazione Amministrativa e Magazzino',
    pageWidth,
    pageHeight,
    margin
  });

  return doc;
}

/**
 * Salva e scarica direttamente il file PDF della Scheda Vestiario
 */
export function scaricaSchedaVestiarioPDF(volontario: Volontario): string {
  const doc = generaSchedaVestiarioPDF(volontario);
  const now = new Date();
  const dataIso = formatISODateItaly(now);
  const nomePulito = `${volontario.cognome}_${volontario.nome}`.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  const nomeFile = `Scheda_Vestiario_${nomePulito}_${dataIso}.pdf`;

  doc.save(nomeFile);
  return nomeFile;
}
