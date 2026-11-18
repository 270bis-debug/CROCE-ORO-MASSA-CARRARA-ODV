import jsPDF from 'jspdf';
import { LOGO_IPOTESI_SEMITRASP_BASE64 } from '../assets/logoBase64';
import { getDatiCartaIntestata, formattaSocialCartaIntestata } from './cartaIntestataStore';
import { formatDateItaly, formatDateTimeItaly, formatISODateItaly, formatTimeItaly, getItalianDateParts } from './italianTime';
import { sanitizeWinAnsi } from './pdfInstitutionalLayout';

export interface OperativeTimesPDF {
  partenza?: string;
  sulPosto?: string;
  partenzaObiettivo?: string;
  arrivoDestinazione?: string;
  fineMissione?: string;
  rientro?: string;
  coordinateSulPosto?: {
    lat: number;
    lng: number;
    accuracy?: number;
    time?: string;
  };
  coordinateDestinazione?: {
    lat: number;
    lng: number;
    accuracy?: number;
    time?: string;
  };
}

export interface DatiDestinazionePDF {
  animale?: {
    tipo?: string;
    tipoAltro?: string;
    microchip?: string;
    noMicrochip?: boolean;
    nonDiProprieta?: boolean;
    anagrafeRegione?: 'TOSCANA' | 'LIGURIA' | 'ALTRA REGIONE' | string;
    anagrafeAltraRegione?: string;
  };
  nonDiProprieta?: boolean;
  proprietario?: {
    nome?: string;
    cognome?: string;
    dataNascita?: string;
    codiceFiscale?: string;
    indirizzo?: string;
    cap?: string;
    comune?: string;
    provincia?: string;
    telefono?: string;
    email?: string;
    nonHaEmail?: boolean;
    regioneTipo?: string;
    regioneAltro?: string;
    regione?: string;
  };
  delega?: {
    haDelega?: boolean;
    nome?: string;
    cognome?: string;
    dataNascita?: string;
    codiceFiscale?: string;
    indirizzo?: string;
    cap?: string;
    comune?: string;
    provincia?: string;
    motivazione?: string;
    tipoDocumento?: string;
    numeroDocumento?: string;
    telefonoProprietario?: string;
    telefonoRicevente?: string;
  };
  donazione?: {
    ricevuta?: boolean;
    somma?: number;
    metodo?: 'contanti' | 'pos' | string;
    tipoDonatore?: 'proprietario' | 'chiamante' | 'altra_persona' | string;
    donatoreAltro?: {
      nome?: string;
      cognome?: string;
      codiceFiscale?: string;
      telefono?: string;
      indirizzo?: string;
    };
  };
  donatore?: {
    tipo?: 'proprietario' | 'chiamante' | 'altro';
    nome?: string;
    cognome?: string;
    codiceFiscale?: string;
    indirizzo?: string;
    telefono?: string;
  };
  manovreEffettuatePatologie?: string;
  firmaProprietario?: string | null;
  firmaRicevente?: string | null;
  firmaAccettazionePrivacy?: string | null;
  strutturaVeterinaria?: {
    isVeterinario?: boolean;
    nomeStrutturaOVeterinario?: string;
    nomeVeterinario?: string;
    firmaVeterinario?: string | null;
    tipoRuolo?: 'partenza' | 'destinazione' | 'entrambe';
    partenza?: {
      nomeStruttura?: string;
      nomeVeterinario?: string;
      firmaVeterinario?: string | null;
    };
    destinazione?: {
      nomeStruttura?: string;
      nomeVeterinario?: string;
      firmaVeterinario?: string | null;
    };
  };
  coordinateCertificazione?: {
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp?: string;
  };
}

export interface ReportDataPDF {
  codice: string;
  mezzo: string;
  data: string;
  kmInizio: number;
  kmFine: number;
  kmTotali: number;
  tempi?: OperativeTimesPDF;
  testoCompleto?: string;
  indirizzoIntervento?: string;
  destinazione?: string;
  chiamante?: string;
  telefono?: string;
  enteIstituzionale?: string;
  urgenza?: string;
  ambito?: string;
  sottoAmbitoVet?: string;
  dataInizioServizioSpecifico?: string;
  oraInizioServizioSpecifico?: string;
  dataArrivoRichiestaServizio?: string;
  oraArrivoRichiestaServizio?: string;
  proprietarioImmobile?: {
    nomeCognome?: string;
    codiceFiscale?: string;
    indirizzoResidenza?: string;
  };
  tipoAnimale?: string;
  tipoAnimaleAltro?: string;
  nonDiProprieta?: boolean;
  microchip?: string;
  noMicrochip?: boolean;
  datiProprietarioCentrale?: any;
  fotoDocumento?: {
    fronte?: string;
    retro?: string;
    dataAcquisizione?: string;
  };
  noteCritiche?: string;
  volontarioNome?: string;
  qualificaTurno?: string;
  inAttesaKm?: boolean;
  coordinateSulPosto?: {
    lat: number;
    lng: number;
    accuracy?: number;
    time?: string;
  };
  coordinateDestinazione?: {
    lat: number;
    lng: number;
    accuracy?: number;
    time?: string;
  };
  isStrutturaVeterinaria?: boolean;
  isStrutturaVeterinariaPartenza?: boolean;
  manovreEffettuatePatologie?: string;
  annullata?: boolean;
  motivoAnnullamento?: string;
  richiedenteAnnullamento?: string;
  orarioAnnullamento?: string;
  datiDestinazione?: DatiDestinazionePDF;
  firmaVolontario?: string; // Firma digitale autografa del volontario/capo turno registrata dal device
  firmaOperatoreCentrale?: string; // Firma digitale autografa dell'operatore di centrale registrata dal device
  numeroSegreteriaSoupRt?: string;
  allertaMeteo?: string;
}

export function formattaDataEOraCompleta(dataString?: string, testoCompleto?: string): string {
  // 1. Estrae la data ufficiale registrata nel testo della scheda se presente
  let dataParte = '';
  if (testoCompleto) {
    const matchData = testoCompleto.match(/DATA:\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i);
    if (matchData && matchData[1]) {
      dataParte = matchData[1];
    }
  }

  // 2. Se dataString contiene già sia data che orario (es. "01/10/2026, 10:18:01" o "01/10/2026 10:18:01")
  if (dataString && dataString.includes('/') && (dataString.includes(':') || dataString.includes(','))) {
    const cleaned = dataString.replace(/\s*,\s*/g, ', ');
    if (cleaned.includes(', ')) return cleaned;
    return cleaned.replace(' ', ', ');
  }

  // 3. Se dataString è un timestamp ISO (es. "2026-10-01T08:18:01.696Z")
  if (dataString && dataString.includes('T')) {
    const d = new Date(dataString);
    if (!isNaN(d.getTime())) {
      const p = getItalianDateParts(d);
      return `${p.dateIt}, ${p.timeIt}`;
    }
  }

  // 4. Se non è stata ancora trovata la data, usa la data corrente italiana GG/MM/AAAA
  if (!dataParte) {
    dataParte = formatDateItaly();
  }

  // 5. Se dataString è solo l'orario (es. "10:18:01" o "9:40:05")
  if (dataString && /^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$/.test(dataString.trim())) {
    return `${dataParte}, ${dataString.trim()}`;
  }

  // 6. Se dataString è solo la data (es. "01/10/2026")
  if (dataString && dataString.includes('/')) {
    return `${dataString}, ${formatTimeItaly()}`;
  }

  // 7. Fallback completo con data e ora ufficiale italiana
  return `${dataParte}, ${formatTimeItaly()}`;
}

/**
 * Rimuove emoji e caratteri surrogati non supportati dai font standard jsPDF
 * per evitare la comparsa di caratteri spuri o mojibake (es. [Ø=ÜÍ al posto di emoji 📍)
 */
export function sanitizePdfText(str?: string): string {
  return sanitizeWinAnsi(str);
}

/**
 * Esclude tassativamente le Note Critiche Operative e le allerte automatiche Meteo & Waze da tutti i file PDF.
 */
export function rimuoviNoteCriticheMeteoWaze(testo?: string): string {
  if (!testo) return '';
  return testo
    .split('\n')
    .filter(line => {
      const l = line.trim().toUpperCase();
      if (l.includes('NOTE CRITICHE')) return false;
      if (l.includes('METEO')) return false;
      if (l.includes('WAZE')) return false;
      if (l.includes('CFR TOSCANA')) return false;
      if (l.includes('ALLERTA')) return false;
      if (l.includes('AVVISO METEO')) return false;
      if (l.includes('TRAFFICO AUTO')) return false;
      if (l.startsWith('NOTE:') && (l.includes('CRITIC') || l.length <= 6)) return false;
      return true;
    })
    .join('\n')
    .replace(/\[(ALLERTA|AVVISO)\s*METEO[^\]]*\]:[^|\n]*\|\s*\[WAZE[^\]]*\]:[^\n-]*(?:-\s*)?/gi, '')
    .replace(/\[(ALLERTA|AVVISO)\s*METEO[^\]]*\]:[^\n-]*(?:-\s*)?/gi, '')
    .replace(/\[WAZE[^\]]*\]:[^\n-]*(?:-\s*)?/gi, '')
    .replace(/NOTE\s+CRITICHE(?:\s+OPERATIVE)?(?:\s*\(METEO\s*&\s*WAZE\s*AUTO\))?:\s*[^\n-]*(?:-\s*)?/gi, '')
    .replace(/NOTE:\s*(?:-\s*)?$/gmi, '')
    .replace(/^\s*-\s*$/gm, '')
    .trim();
}

/**
 * Determina in modo inequivocabile se un servizio è di tipo Veterinario / Soccorso Animale.
 * Se un servizio riguarda SERVIZIO D'ISTITUTO o PROTEZIONE CIVILE (es. codici CO-IST, CO-PC),
 * NON è un servizio veterinario e sui file PDF non deve essere presente alcun riferimento
 * né all'animale trasportato né al numero di microchip.
 */
export function isServizioVeterinario(data?: {
  ambito?: string;
  codice?: string;
  sottoAmbitoVet?: string;
  testoCompleto?: string;
  tipoAnimale?: string;
}): boolean {
  if (!data) return false;

  const ambitoUpper = (data.ambito || '').toUpperCase().trim();
  const codiceUpper = (data.codice || '').toUpperCase().trim();
  const sottoAmbitoUpper = ((data as any).sottoAmbitoVet || '').toUpperCase().trim();
  const testoUpper = (data.testoCompleto || '').toUpperCase();

  // 1. Esclusioni esplicite e prioritarie: se l'ambito o il codice indicano Istituto o Protezione Civile,
  // NON è un servizio veterinario.
  if (
    ambitoUpper.includes('ISTITUTO') ||
    codiceUpper.includes('-IST-') ||
    testoUpper.includes('AMBITO: SERVIZIO D\'ISTITUTO')
  ) {
    return false;
  }

  if (
    ambitoUpper.includes('PROTEZIONE CIVILE') ||
    codiceUpper.includes('-PC-') ||
    testoUpper.includes('AMBITO: PROTEZIONE CIVILE')
  ) {
    return false;
  }

  // 2. Criteri positivi certi di Servizio o Soccorso Veterinario
  if (
    ambitoUpper.includes('VETERINAR') ||
    ambitoUpper.includes('SOCCORSO VET') ||
    codiceUpper.includes('-VET-') ||
    sottoAmbitoUpper.includes('SOCCORSO VETERINARIO') ||
    sottoAmbitoUpper.includes('RECUPERO ANIMALE') ||
    sottoAmbitoUpper.includes('TRASPORTO ANIMALE') ||
    sottoAmbitoUpper.includes('ASSISTENZA ATTO ESECUTIVO') ||
    testoUpper.includes('AMBITO: SERVIZIO VETERINARIO') ||
    testoUpper.includes('AMBITO: SOCCORSO VETERINARIO') ||
    testoUpper.includes('SOCCORSO VETERINARIO') ||
    testoUpper.includes('TRASPORTO ANIMALE') ||
    testoUpper.includes('ASSISTENZA ATTO ESECUTIVO')
  ) {
    return true;
  }

  // 3. Fallback per schede storiche/libere dove l'ambito non è stato esplicitato
  if (!ambitoUpper && !codiceUpper) {
    if (data.tipoAnimale && data.tipoAnimale.trim() !== '') {
      return true;
    }
  }

  return false;
}

/**
 * Genera il documento PDF formattato per la Croce Oro Massa Carrara OdV
 */
export function generaDocumentoPDF(data: ReportDataPDF): jsPDF {
  if (data.inAttesaKm) {
    throw new Error('Chilometri del mezzo non inseriti. La Centrale Operativa deve prima inserire i KM comunicati dal volontario.');
  }

  const isVet = isServizioVeterinario(data);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const headerTextX = margin + 30;
  const badgeW = 46;
  const badgeH = 18;
  const badgeX = pageWidth - margin - badgeW;
  const headerMaxW = badgeX - headerTextX - 4;
  const cInfoDoc = getDatiCartaIntestata();

  const drawFoglioHeaderPage1 = (badgeTitle: string, badgeSub: string, isGreen = false) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 36, 'F');
    doc.setFillColor(217, 119, 6);
    doc.rect(0, 36, pageWidth, 2.5, 'F');
    try {
      doc.addImage(LOGO_IPOTESI_SEMITRASP_BASE64, 'PNG', margin, 5, 26, 26, undefined, 'FAST');
    } catch {}
    doc.setTextColor(251, 191, 36);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.text(sanitizeWinAnsi(cInfoDoc.denominazione || 'CROCE ORO MASSA CARRARA ODV').toUpperCase(), headerTextX, 15.5, {
      maxWidth: headerMaxW
    });
    doc.setTextColor(241, 245, 249);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.text('Associazione Volontari del Soccorso & Protezione Civile - Ente del Terzo Settore', headerTextX, 22.5, {
      maxWidth: headerMaxW
    });
    doc.setFillColor(isGreen ? 16 : 245, isGreen ? 185 : 158, isGreen ? 129 : 11);
    doc.roundedRect(badgeX, 8, badgeW, badgeH, 2, 2, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.text(sanitizeWinAnsi(badgeTitle), badgeX + 3.5, 15, { maxWidth: badgeW - 6 });
    doc.setFontSize(9.5);
    doc.text(sanitizeWinAnsi(badgeSub), badgeX + 3.5, 22, { maxWidth: badgeW - 6 });
  };

  const drawFoglioFooter = (sottoTitolo: string) => {
    const footerH = 28;
    const footerY = 269;
    doc.setFillColor(15, 23, 42);
    doc.rect(0, footerY, pageWidth, footerH, 'F');
    doc.setFillColor(217, 119, 6);
    doc.rect(0, footerY, pageWidth, 1.2, 'F');
    const centerX = pageWidth / 2;
    const cInfo = getDatiCartaIntestata();
    const socialStr = sanitizeWinAnsi(formattaSocialCartaIntestata(cInfo));

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.0);
    doc.setTextColor(251, 191, 36);
    doc.text(
      sanitizeWinAnsi(`${(cInfo.denominazione || 'CROCE ORO MASSA CARRARA ODV').toUpperCase()} - ${sottoTitolo}`),
      centerX,
      footerY + 6.0,
      { align: 'center', maxWidth: pageWidth - 16 }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(203, 213, 225);
    const dataDoc = formattaDataEOraCompleta(data.data, data.testoCompleto);
    doc.text(
      sanitizeWinAnsi(`Documento generato digitalmente il ${dataDoc} | Codice Identificativo: ${data.codice}`),
      centerX,
      footerY + 11.0,
      { align: 'center', maxWidth: pageWidth - 16 }
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(socialStr ? 4.8 : 5.2);
    doc.setTextColor(254, 240, 138);
    const sediStr = sanitizeWinAnsi(
      `Sede Legale: ${cInfo.sedeLegale} - Massa: ${cInfo.sedeMassa} - Carrara: ${cInfo.sedeCarrara} - Pietrasanta: ${cInfo.sedePietrasanta} | Tel: ${cInfo.centraleTel}` +
        (socialStr ? ` | ${socialStr}` : '')
    );
    const sediLines = doc.splitTextToSize(sediStr, pageWidth - 16).slice(0, 2);
    doc.text(sediLines, centerX, footerY + 15.8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(148, 163, 184);
    doc.text(
      sanitizeWinAnsi(`CF: ${cInfo.codiceFiscale} - ${cInfo.sitoWeb} - Email: ${cInfo.email} - Pec: ${cInfo.pec}`),
      centerX,
      footerY + 23.8,
      { align: 'center', maxWidth: pageWidth - 16 }
    );
  };

  drawFoglioHeaderPage1('FOGLIO DI VIAGGIO', 'UFFICIALE');
  let y = 42.5;

  // --- BOX 1: DATI PRINCIPALI MISSIONE (altezza dinamica senza sovrapposizioni) ---
  const dataRegistrazione = sanitizeWinAnsi(formattaDataEOraCompleta(data.data, data.testoCompleto));
  const formatPdfShortDate = (raw?: string): string => {
    const t = sanitizeWinAnsi(raw || '').trim();
    if (!t) return '-';
    const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : t;
  };
  const hasRichiestaServ = Boolean(data.dataArrivoRichiestaServizio || data.oraArrivoRichiestaServizio);
  const hasInizioSpec = Boolean(data.dataInizioServizioSpecifico || data.oraInizioServizioSpecifico);
  const hasDateProgrammate = hasRichiestaServ || hasInizioSpec;

  const colRightX = margin + contentWidth / 2 + 2;
  const leftValMaxW = colRightX - (margin + 38) - 2;
  const rightValMaxW = margin + contentWidth - (colRightX + 26) - 3;

  const capoTurno = sanitizeWinAnsi(
    data.volontarioNome ? `${data.volontarioNome} (${data.qualificaTurno || 'Autista'})` : 'Capo Turno di Servizio'
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  const capoLines = doc.splitTextToSize(capoTurno, rightValMaxW + 2);
  const kmText = sanitizeWinAnsi(`${data.kmTotali} KM (Inizio: ${data.kmInizio} - Fine: ${data.kmFine})`);
  const kmLines = doc.splitTextToSize(kmText, rightValMaxW);

  const reqStr = hasRichiestaServ
    ? `Arrivo Richiesta: ${formatPdfShortDate(data.dataArrivoRichiestaServizio)} ${sanitizeWinAnsi(data.oraArrivoRichiestaServizio || '')}`.trim()
    : '';
  const startStr = hasInizioSpec
    ? `Inizio Servizio Specifico: ${formatPdfShortDate(data.dataInizioServizioSpecifico)} ${sanitizeWinAnsi(data.oraInizioServizioSpecifico || '')}`.trim()
    : '';
  const combinedDates = [reqStr, startStr].filter(Boolean).join('   |   ');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  const dateLines: string[] = hasDateProgrammate ? doc.splitTextToSize(combinedDates, contentWidth - 8) : [];

  const extraRightH = (Math.max(1, capoLines.length) - 1) * 4 + (Math.max(1, kmLines.length) - 1) * 4;
  const datesBlockH = hasDateProgrammate ? Math.max(1, dateLines.length) * 4 + 3.5 : 0;
  const boxDatiH = 31 + extraRightH + datesBlockH;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, boxDatiH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('DATI DELLA MISSIONE E DEL MEZZO', margin + 4, y + 6);
  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 4, y + 8, margin + contentWidth - 4, y + 8);

  doc.setFontSize(8.3);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Codice Missione:', margin + 4, y + 13.5);
  doc.setTextColor(180, 83, 9);
  doc.text(sanitizeWinAnsi(data.codice || 'N/D'), margin + 35, y + 13.5, { maxWidth: leftValMaxW });

  doc.setTextColor(71, 85, 105);
  doc.text('Mezzo Operativo:', margin + 4, y + 19.5);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizeWinAnsi(data.mezzo || 'N/D'), margin + 35, y + 19.5, { maxWidth: leftValMaxW });

  doc.setTextColor(71, 85, 105);
  doc.text('Registrazione:', margin + 4, y + 25.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(dataRegistrazione, margin + 35, y + 25.5, { maxWidth: leftValMaxW });

  // Colonna destra Box 1
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Urgenza:', colRightX, y + 13.5);
  const urgenza = sanitizeWinAnsi(data.urgenza || 'ROSSO');
  if (urgenza === 'ROSSO') doc.setTextColor(220, 38, 38);
  else if (urgenza === 'GIALLO') doc.setTextColor(217, 119, 6);
  else doc.setTextColor(22, 163, 74);
  doc.text(`Codice ${urgenza}`, colRightX + 24, y + 13.5);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Capo Turno:', colRightX, y + 19.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(capoLines.slice(0, 2), colRightX + 24, y + 19.5);

  const kmY = y + 25.5 + (Math.max(1, capoLines.length) - 1) * 4;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('KM Percorsi:', colRightX, kmY);
  doc.setTextColor(16, 185, 129);
  doc.text(kmLines.slice(0, 2), colRightX + 24, kmY);

  if (hasDateProgrammate && dateLines.length > 0) {
    const rowDateY = y + 31 + extraRightH + 2.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 58, 138);
    doc.text(dateLines, margin + 4, rowDateY);
  }

  y += boxDatiH + 3.5;

  // Banner Intervento Annullato
  if (data.annullata) {
    const mot = data.motivoAnnullamento ? ` - MOTIVO: ${sanitizeWinAnsi(data.motivoAnnullamento)}` : '';
    const req = data.richiedenteAnnullamento
      ? ` (RICHIESTO DA: ${sanitizeWinAnsi(data.richiedenteAnnullamento)}${data.orarioAnnullamento ? ` ORE ${sanitizeWinAnsi(data.orarioAnnullamento)}` : ''})`
      : '';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.0);
    const bannerLines = doc.splitTextToSize(
      `STATO INTERVENTO: ANNULLATO DALLA CENTRALE OPERATIVA${mot}${req}`,
      contentWidth - 8
    );
    const bannerH = Math.max(9.5, bannerLines.length * 4.2 + 4);
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(239, 68, 68);
    doc.roundedRect(margin, y, contentWidth, bannerH, 2, 2, 'FD');
    doc.setTextColor(185, 28, 28);
    doc.text(bannerLines, margin + 4, y + 5.2);
    y += bannerH + 3;
  }

  // --- BOX 2: LUOGHI E DESTINAZIONI (calcolo altezze dinamiche per ogni riga) ---
  let indirizzoEvento = data.indirizzoIntervento || (data as any).indirizzo;
  if (!indirizzoEvento || indirizzoEvento.trim() === '' || indirizzoEvento.trim() === '-' || indirizzoEvento.toLowerCase().includes('vedi testo')) {
    const match = data.testoCompleto?.match(/INDIRIZZO(?:\s+INTERVENTO)?:\s*([^\n]+)/i);
    if (match && match[1] && match[1].trim() && match[1].trim() !== '-' && !match[1].toLowerCase().includes('vedi testo')) {
      indirizzoEvento = match[1].trim();
    }
  }
  if (!indirizzoEvento || indirizzoEvento.trim() === '' || indirizzoEvento.trim() === '-' || indirizzoEvento.toLowerCase().includes('vedi testo')) {
    indirizzoEvento = 'Marina di Massa, Viale Vespucci 12';
  }

  const effAnimaleTipo = isVet ? (data.tipoAnimale || data.datiDestinazione?.animale?.tipo) : undefined;
  const isProtezioneCivile = Boolean(
    (data.ambito && data.ambito.toUpperCase().includes('PROTEZIONE CIVILE')) ||
      (data.codice && (data.codice.includes('-PC-') || data.codice.includes('-PC_')))
  );
  const showPcRow = isProtezioneCivile || Boolean(data.numeroSegreteriaSoupRt || data.allertaMeteo);

  const indClean = sanitizeWinAnsi(indirizzoEvento);
  const destClean = sanitizeWinAnsi(data.destinazione || 'Rientro in Sede / Da definire');
  const contattoClean = sanitizeWinAnsi(
    data.enteIstituzionale
      ? `[${data.enteIstituzionale}] ${data.chiamante || ''} (${data.telefono || 'N/D'})`
      : data.chiamante
      ? `${data.chiamante} (${data.telefono || 'N/D'})`
      : 'Centrale Operativa 112 / 118'
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.0);
  const indLines = doc.splitTextToSize(indClean, contentWidth - 46).slice(0, 2);
  const destLines = doc.splitTextToSize(destClean, contentWidth - 52).slice(0, 2);
  const contLines = doc.splitTextToSize(contattoClean, contentWidth - 48).slice(0, 2);

  const sottoSpecStr = data.sottoAmbitoVet ? sanitizeWinAnsi(data.sottoAmbitoVet) : '';
  const propImmobile = data.proprietarioImmobile;
  const hasPropImm = Boolean(
    propImmobile && (propImmobile.nomeCognome || propImmobile.codiceFiscale || propImmobile.indirizzoResidenza)
  );
  const propImmStr = hasPropImm
    ? sanitizeWinAnsi(
        `Proprietario Immobile (Atto Esecutivo): ${propImmobile?.nomeCognome || '-'} | CF: ${propImmobile?.codiceFiscale || '-'} | Residenza: ${propImmobile?.indirizzoResidenza || '-'}`
      )
    : '';
  const propImmLines = propImmStr ? doc.splitTextToSize(propImmStr, contentWidth - 8) : [];

  const pcText = showPcRow
    ? sanitizeWinAnsi(
        `Numero Segreteria Soup_RT: ${data.numeroSegreteriaSoupRt?.trim() || 'Non indicato'}   |   Allerta meteo: ${data.allertaMeteo?.trim() || 'Nessuna'}`
      )
    : '';
  const pcLines = pcText ? doc.splitTextToSize(pcText, contentWidth - 8) : [];

  let vetAnimaleLines: string[] = [];
  if (isVet && effAnimaleTipo) {
    const isNonProp = Boolean(data.nonDiProprieta || data.datiDestinazione?.animale?.nonDiProprieta);
    const effChip =
      data.microchip ||
      data.datiDestinazione?.animale?.microchip ||
      (data.noMicrochip || data.datiDestinazione?.animale?.noMicrochip ? 'NO MICROCHIP' : 'Non rilevato');
    vetAnimaleLines = doc.splitTextToSize(
      sanitizeWinAnsi(
        `Animale Trasportato: ${effAnimaleTipo}${data.tipoAnimaleAltro ? ` (${data.tipoAnimaleAltro})` : ''} - [${isNonProp ? 'NON DI PROPRIETA' : 'DI PROPRIETA'}] - Chip: ${effChip}`
      ),
      contentWidth - 8
    );
  }

  const lineStep = 4.0;
  const boxLuoghiH =
    12 +
    indLines.length * lineStep + 1.5 +
    destLines.length * lineStep + 1.5 +
    contLines.length * lineStep + 1.5 +
    (sottoSpecStr ? 5.2 : 0) +
    (propImmLines.length > 0 ? propImmLines.length * 3.8 + 1.8 : 0) +
    (pcLines.length > 0 ? pcLines.length * 3.8 + 1.8 : 0) +
    (vetAnimaleLines.length > 0 ? vetAnimaleLines.length * 3.8 + 1.8 : 0) +
    2;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, boxLuoghiH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('LOCALIZZAZIONE E DETTAGLI INTERVENTO', margin + 4, y + 5.8);
  doc.line(margin + 4, y + 7.8, margin + contentWidth - 4, y + 7.8);

  let yL = y + 12.8;
  doc.setFontSize(8.0);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Indirizzo Evento:', margin + 4, yL);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(indLines, margin + 38, yL);
  yL += indLines.length * lineStep + 1.5;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Destinazione / Struttura:', margin + 4, yL);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(destLines, margin + 46, yL);
  yL += destLines.length * lineStep + 1.5;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Segnalante / Contatto:', margin + 4, yL);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(contLines, margin + 42, yL);
  yL += contLines.length * lineStep + 1.5;

  if (sottoSpecStr) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text(`Tipologia Specifica: ${sottoSpecStr}`, margin + 4, yL, { maxWidth: contentWidth - 8 });
    yL += 5.2;
  }

  if (propImmLines.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(146, 64, 14);
    doc.text(propImmLines, margin + 4, yL);
    yL += propImmLines.length * 3.8 + 1.8;
  }

  if (pcLines.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 58, 138);
    doc.text(pcLines, margin + 4, yL);
    yL += pcLines.length * 3.8 + 1.8;
  }

  if (vetAnimaleLines.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(180, 83, 9);
    doc.text(vetAnimaleLines, margin + 4, yL);
  }

  y += boxLuoghiH + 3.5;

  // --- CRONOLOGIA ORARI OPERATIVI ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('CRONOLOGIA ORARI OPERATIVI (REGISTRATI DALLA CENTRALE & BORDO MEZZO)', margin, y + 3.2);
  y += 6.0;

  const rowHeadH = 6.2;
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentWidth, rowHeadH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.text('#', margin + 3, y + 4.2);
  doc.text('FASE OPERATIVA', margin + 12, y + 4.2);
  doc.text('ORARIO REGISTRATO', margin + 92, y + 4.2);
  y += rowHeadH;

  const tempi = data.tempi || {};
  const coordSulPosto = data.coordinateSulPosto || tempi.coordinateSulPosto;
  const coordDest = data.coordinateDestinazione || tempi.coordinateDestinazione;

  const formattatoreCoord = (coord?: { lat: number; lng: number; accuracy?: number }) => {
    if (!coord) return '';
    return sanitizeWinAnsi(` [GPS Cert.: ${coord.lat.toFixed(4)}, ${coord.lng.toFixed(4)}${coord.accuracy ? ` acc. ${coord.accuracy}m` : ''}]`);
  };

  const fasiOperative = [
    { num: '1', fase: 'Partenza da Sede Operativa', ora: sanitizeWinAnsi(tempi.partenza) || '-' },
    {
      num: '2',
      fase: 'Arrivo Sul Posto / Obiettivo',
      ora: data.annullata
        ? 'NON EFFETTUATO (INTERVENTO ANNULLATO)'
        : tempi.sulPosto
        ? sanitizeWinAnsi(`${tempi.sulPosto}${formattatoreCoord(coordSulPosto)}`)
        : '-'
    },
    {
      num: '3',
      fase: 'Partenza da Obiettivo',
      ora: data.annullata
        ? 'NON EFFETTUATO (INTERVENTO ANNULLATO)'
        : sanitizeWinAnsi(tempi.partenzaObiettivo) || '-'
    },
    {
      num: '4',
      fase: 'Arrivo in Destinazione / Clinica / Struttura',
      ora: data.annullata
        ? 'NON EFFETTUATO (INTERVENTO ANNULLATO)'
        : tempi.arrivoDestinazione
        ? sanitizeWinAnsi(`${tempi.arrivoDestinazione}${formattatoreCoord(coordDest)}`)
        : '-'
    },
    { num: '5', fase: 'Fine Missione Operativa', ora: sanitizeWinAnsi(tempi.fineMissione) || '-' },
    { num: '6', fase: 'Rientro in Sede (Disponibile)', ora: sanitizeWinAnsi(tempi.rientro) || '-' }
  ];

  const oraColMaxW = contentWidth - 95;
  fasiOperative.forEach((fase, idx) => {
    const hasGps = fase.ora.includes('GPS');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(hasGps ? 6.4 : 7.4);
    const oraText = fase.ora !== '-' ? fase.ora : 'Non registrato';
    const oraLines = doc.splitTextToSize(oraText, oraColMaxW).slice(0, 2);
    const rH = Math.max(6.2, oraLines.length * 3.5 + 2.5);

    doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
    doc.rect(margin, y, contentWidth, rH, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, rH, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(100, 116, 139);
    doc.text(fase.num, margin + 3.5, y + 4.2);

    doc.setTextColor(30, 41, 59);
    doc.text(fase.fase, margin + 12, y + 4.2, { maxWidth: 77 });

    doc.setTextColor(fase.ora !== '-' ? 180 : 156, fase.ora !== '-' ? 83 : 163, fase.ora !== '-' ? 9 : 175);
    doc.setFontSize(hasGps ? 6.4 : 7.4);
    doc.text(oraLines, margin + 92, y + 4.2);

    y += rH;
  });

  const safeBottomP1 = 265;
  const boxFirmaH = 37;
  y += 3.5;

  // --- BOX MANOVRE EFFETTUATE / PATOLOGIE O NOTE NON-VET ---
  const manovreTesto = sanitizeWinAnsi(data.manovreEffettuatePatologie || data.datiDestinazione?.manovreEffettuatePatologie || '');
  const isAmbitoNonVet = Boolean(
    (data.ambito && (data.ambito.toUpperCase().includes('PROTEZIONE CIVILE') || data.ambito.toUpperCase().includes('ISTITUTO'))) ||
      (data.codice && (data.codice.includes('-PC-') || data.codice.includes('-IST-')))
  );

  if (manovreTesto && safeBottomP1 - (y + boxFirmaH + 4) >= 16) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(30, 41, 59);
    const titoloNote = isAmbitoNonVet
      ? 'NOTE E OSSERVAZIONI SUL SERVIZIO (BORDO MEZZO):'
      : 'MANOVRE EFFETTUATE / PATOLOGIE (NOTE SERVIZIO BORDO MEZZO):';
    doc.text(titoloNote, margin, y + 2);
    y += 3.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.0);
    const righeManovre = doc.splitTextToSize(manovreTesto, contentWidth - 8).slice(0, 3);
    const availH = safeBottomP1 - boxFirmaH - 6 - y;
    const boxManovreH = Math.min(Math.max(8.5, righeManovre.length * 3.8 + 4), Math.max(8.5, availH));

    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, y, contentWidth, boxManovreH, 1.5, 1.5, 'FD');

    doc.setTextColor(146, 64, 14);
    doc.text(righeManovre, margin + 4, y + 4.2);
    y += boxManovreH + 2.5;
  }

  // --- TRASCRIZIONE TESTUALE COMPLETA DELLA SCHEDA (SOLO SE C'È SPAZIO PRIMA DELLE FIRME) ---
  if (data.testoCompleto && safeBottomP1 - (y + boxFirmaH + 4) >= 14) {
    const testoFiltrato = sanitizeWinAnsi(rimuoviNoteCriticheMeteoWaze(data.testoCompleto));
    if (testoFiltrato) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.3);
      doc.setTextColor(15, 23, 42);
      doc.text('SCHEDA INTEGRALE TRASMESSA DA CENTRALE OPERATIVA:', margin, y + 1.5);
      y += 3.0;

      const availH = safeBottomP1 - boxFirmaH - 4 - y;
      const boxHeight = Math.min(14, Math.max(8, availH));
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'FD');

      doc.setFont('courier', 'normal');
      doc.setFontSize(6.0);
      doc.setTextColor(51, 65, 85);
      const splitText = doc.splitTextToSize(testoFiltrato, contentWidth - 6);
      const maxRighe = Math.max(1, Math.floor((boxHeight - 2) / 3.2));
      doc.text(splitText.slice(0, maxRighe), margin + 3, y + 3.5);
      y += boxHeight + 2.5;
    }
  }

  // Se i box superiori hanno spinto y oltre il limite sicuro, vai su nuova pagina prima delle firme
  let boxFirmaY = Math.max(y + 1, 227);
  if (boxFirmaY + boxFirmaH > safeBottomP1) {
    drawFoglioFooter('Gestionale Centrale Operativa Radio & Emergenza Territoriale');
    doc.addPage();
    drawFoglioHeaderPage1('FOGLIO DI VIAGGIO', 'FIRME & ATTESTAZIONI');
    boxFirmaY = 44;
  }

  // --- FIRME IN CALCE ---
  const colFirmaW = (contentWidth - 6) / 2;

  // Box 1: Firma Capo Turno / Autista Mezzo
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, boxFirmaY, colFirmaW, boxFirmaH, 1.5, 1.5, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, boxFirmaY, colFirmaW, 7, 1.5, 1.5, 'F');
  doc.rect(margin, boxFirmaY + 4, colFirmaW, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(255, 255, 255);
  doc.text('FIRMA CAPO TURNO / AUTISTA MEZZO', margin + 3, boxFirmaY + 4.8, { maxWidth: colFirmaW - 6 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizeWinAnsi(`Nominativo: ${capoTurno}`), margin + 3, boxFirmaY + 11.5, { maxWidth: colFirmaW - 6 });

  if (data.firmaVolontario) {
    try {
      doc.addImage(data.firmaVolontario, 'PNG', margin + 3, boxFirmaY + 13, colFirmaW - 6, 13.5, undefined, 'FAST');
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(margin + 3, boxFirmaY + boxFirmaH - 6.5, colFirmaW - 6, 4.5, 0.8, 0.8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text(
        '[OK] SOTTOSCRITTO DIGITALMENTE A BORDO MEZZO',
        margin + 3 + (colFirmaW - 6) / 2,
        boxFirmaY + boxFirmaH - 3.4,
        { align: 'center', maxWidth: colFirmaW - 10 }
      );
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text('X', margin + 4, boxFirmaY + 25);
      doc.setDrawColor(71, 85, 105);
      doc.setLineDashPattern([2, 1], 0);
      doc.line(margin + 8, boxFirmaY + 25, margin + colFirmaW - 4, boxFirmaY + 25);
      doc.setLineDashPattern([], 0);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text('Sottoscrizione e attestazione svolgimento servizio', margin + 3, boxFirmaY + 32, { maxWidth: colFirmaW - 6 });
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('X', margin + 4, boxFirmaY + 25);
    doc.setDrawColor(71, 85, 105);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(margin + 8, boxFirmaY + 25, margin + colFirmaW - 4, boxFirmaY + 25);
    doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text('Sottoscrizione e attestazione svolgimento servizio', margin + 3, boxFirmaY + 32, { maxWidth: colFirmaW - 6 });
  }

  // Box 2: Firma Operatore Centrale Operativa
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin + colFirmaW + 6, boxFirmaY, colFirmaW, boxFirmaH, 1.5, 1.5, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin + colFirmaW + 6, boxFirmaY, colFirmaW, 7, 1.5, 1.5, 'F');
  doc.rect(margin + colFirmaW + 6, boxFirmaY + 4, colFirmaW, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(255, 255, 255);
  doc.text('FIRMA OPERATORE CENTRALE OPERATIVA', margin + colFirmaW + 9, boxFirmaY + 4.8, { maxWidth: colFirmaW - 6 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.0);
  doc.setTextColor(15, 23, 42);
  doc.text('Centrale Operativa Radio - Emergenza Territoriale', margin + colFirmaW + 9, boxFirmaY + 11.5, { maxWidth: colFirmaW - 6 });

  if (data.firmaOperatoreCentrale) {
    try {
      doc.addImage(data.firmaOperatoreCentrale, 'PNG', margin + colFirmaW + 9, boxFirmaY + 13, colFirmaW - 6, 13.5, undefined, 'FAST');
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(margin + colFirmaW + 9, boxFirmaY + boxFirmaH - 6.5, colFirmaW - 6, 4.5, 0.8, 0.8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.text(
        '[OK] VISTO E FIRMA TELEMATICA CENTRALE REGISTRATA',
        margin + colFirmaW + 6 + colFirmaW / 2,
        boxFirmaY + boxFirmaH - 3.4,
        { align: 'center', maxWidth: colFirmaW - 10 }
      );
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text('X', margin + colFirmaW + 10, boxFirmaY + 25);
      doc.setDrawColor(71, 85, 105);
      doc.setLineDashPattern([2, 1], 0);
      doc.line(margin + colFirmaW + 14, boxFirmaY + 25, margin + contentWidth - 4, boxFirmaY + 25);
      doc.setLineDashPattern([], 0);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text('Visto e registrazione telematica della Centrale', margin + colFirmaW + 9, boxFirmaY + 32, { maxWidth: colFirmaW - 6 });
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('X', margin + colFirmaW + 10, boxFirmaY + 25);
    doc.setDrawColor(71, 85, 105);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(margin + colFirmaW + 14, boxFirmaY + 25, margin + contentWidth - 4, boxFirmaY + 25);
    doc.setLineDashPattern([], 0);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text('Visto e registrazione telematica della Centrale', margin + colFirmaW + 9, boxFirmaY + 32, { maxWidth: colFirmaW - 6 });
  }

  drawFoglioFooter('Gestionale Centrale Operativa Radio & Emergenza Territoriale');

  // --- PAGINA 2: ALLEGATO CONSEGNA ANIMALE, DONAZIONE & FIRME DIGITALI ACQUISITE ---
  // Generata ESCLUSIVAMENTE per i servizi e soccorsi veterinari.
  // Per Servizi d'Istituto e Protezione Civile, il documento è rigorosamente di 1 pagina senza riferimenti ad animali o microchip.
  const destData = data.datiDestinazione;
  const isVetScope = isVet;

  if (isVetScope) {
    doc.addPage();

    // 1. Header Pagina 2
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 36, 'F');
    doc.setFillColor(217, 119, 6); // amber-600
    doc.rect(0, 36, pageWidth, 2.5, 'F');

    try {
      doc.addImage(LOGO_IPOTESI_SEMITRASP_BASE64, 'PNG', margin, 5, 26, 26, undefined, 'FAST');
    } catch {}

    doc.setTextColor(251, 191, 36); // amber-400
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13.5);
    doc.text(sanitizeWinAnsi((cInfoDoc.denominazione || 'CROCE ORO MASSA CARRARA ODV').toUpperCase()), headerTextX, 15.5, {
      maxWidth: headerMaxW
    });

    doc.setTextColor(241, 245, 249); // slate-100
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.text('Associazione Volontari del Soccorso & Protezione Civile - Ente del Terzo Settore', headerTextX, 22.5, {
      maxWidth: headerMaxW
    });

    // Badge ALLEGATO CONSEGNA
    doc.setFillColor(16, 185, 129); // emerald-500
    doc.roundedRect(badgeX, 8, badgeW, badgeH, 2, 2, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('ALLEGATO UFFICIALE', badgeX + 3, 15);
    doc.setFontSize(9.5);
    doc.text('CONSEGNA & FIRME', badgeX + 3, 22);

    let y2 = 42;

    // BOX 1: DATI DELL'ANIMALE RECUPERATO E TRASPORTATO
    const boxAnimaleH = 26;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y2, contentWidth, boxAnimaleH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(30, 41, 59);
    doc.text("1. SCHEDA DELL'ANIMALE RECUPERATO E TRASPORTATO", margin + 4, y2 + 5.5);
    doc.line(margin + 4, y2 + 7.5, margin + contentWidth - 4, y2 + 7.5);

    const effTipo = data.tipoAnimale || destData?.animale?.tipo || 'Cane / Gatto';
    const effAltro = data.tipoAnimaleAltro || destData?.animale?.tipoAltro ? ` (${data.tipoAnimaleAltro || destData?.animale?.tipoAltro})` : '';
    const isNonProp = Boolean(data.nonDiProprieta || destData?.animale?.nonDiProprieta);
    const effChip = data.microchip || destData?.animale?.microchip || (data.noMicrochip || destData?.animale?.noMicrochip ? 'DICHIARATO ASSENTE (NO MICROCHIP)' : 'Non specificato');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Specie Animale:', margin + 4, y2 + 13.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${effTipo}${effAltro}`, margin + 30, y2 + 13.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Stato Proprietà:', margin + 4, y2 + 20);
    doc.setFont('helvetica', 'bold');
    if (isNonProp) {
      doc.setTextColor(220, 38, 38);
      doc.text('ANIMALE NON DI PROPRIETÀ', margin + 30, y2 + 20);
    } else {
      doc.setTextColor(16, 185, 129);
      doc.text('ANIMALE DI PROPRIETÀ PRIVATA', margin + 30, y2 + 20);
    }

    // Colonna destra Box 1
    const col2X = margin + contentWidth / 2 + 4;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Codice Microchip / Tatuaggio:', col2X, y2 + 13.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(sanitizeWinAnsi(effChip), col2X, y2 + 19.5, { maxWidth: contentWidth / 2 - 8 });

    y2 += boxAnimaleH + 3.5;

    // BOX 2: DATI ANAGRAFICI DEL PROPRIETARIO / CUSTODE
    const boxPropH = 31;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y2, contentWidth, boxPropH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(30, 41, 59);
    doc.text('2. DATI ANAGRAFICI DEL PROPRIETARIO / CUSTODE DELL\'ANIMALE', margin + 4, y2 + 5.5);
    doc.line(margin + 4, y2 + 7.5, margin + contentWidth - 4, y2 + 7.5);

    const leftBox2MaxW = col2X - (margin + 25) - 3;
    const nomeCompleto = sanitizeWinAnsi(`${destData?.proprietario?.nome || ''} ${destData?.proprietario?.cognome || ''}`.trim() || 'Non specificato');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Nominativo:', margin + 4, y2 + 13.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(nomeCompleto, margin + 25, y2 + 13.5, { maxWidth: leftBox2MaxW });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Codice Fiscale:', margin + 4, y2 + 19.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizeWinAnsi(destData?.proprietario?.codiceFiscale || 'Non specificato'), margin + 25, y2 + 19.5, { maxWidth: leftBox2MaxW });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Residenza:', margin + 4, y2 + 25.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const residenzaCompleta = sanitizeWinAnsi(`${destData?.proprietario?.indirizzo || '-'}, ${destData?.proprietario?.comune || '-'} (${destData?.proprietario?.provincia || '-'}) CAP ${destData?.proprietario?.cap || '-'}`);
    doc.text(residenzaCompleta, margin + 25, y2 + 25.5, { maxWidth: leftBox2MaxW });

    // Colonna destra Box 2
    const rightBox2MaxW = margin + contentWidth - (col2X + 33) - 3;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Recapito Telefonico:', col2X, y2 + 13.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 58, 138);
    doc.text(sanitizeWinAnsi(destData?.proprietario?.telefono || 'N/D'), col2X + 33, y2 + 13.5, { maxWidth: rightBox2MaxW });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Data di Nascita:', col2X, y2 + 19.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizeWinAnsi(destData?.proprietario?.dataNascita || '-'), col2X + 33, y2 + 19.5, { maxWidth: rightBox2MaxW });

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Email:', col2X, y2 + 25.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const emailTesto = destData?.proprietario?.nonHaEmail || destData?.proprietario?.email === 'Non presente'
      ? 'Dichiara di non avere email'
      : (destData?.proprietario?.email || 'N/D');
    doc.text(sanitizeWinAnsi(emailTesto), col2X + 33, y2 + 25.5, { maxWidth: rightBox2MaxW });

    y2 += boxPropH + 3.5;

    // BOX 3: DONAZIONE RICEVUTA
    const boxDonazioneH = 22;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y2, contentWidth, boxDonazioneH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(30, 41, 59);
    doc.text('3. ATTESTAZIONE EROGAZIONE LIBERALE / DONAZIONE RICEVUTA', margin + 4, y2 + 5.5);
    doc.line(margin + 4, y2 + 7.5, margin + contentWidth - 4, y2 + 7.5);

    doc.setFontSize(8);
    if (destData?.donazione?.ricevuta) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      const importoStr = `€ ${(destData.donazione.somma || 0).toFixed(2)}`;
      const metodoStr = destData.donazione.metodo === 'pos' ? 'POS Elettronico' : destData.donazione.metodo === 'contanti' ? 'Contanti' : (destData.donazione.metodo || 'Contanti');
      const donatoreStr = destData.donazione.tipoDonatore === 'chiamante'
        ? `Donatore: Chiamante (${data.chiamante || 'Segnalante'})`
        : destData.donazione.tipoDonatore === 'altra_persona' && destData.donazione.donatoreAltro
        ? `Donatore: ${destData.donazione.donatoreAltro.nome} ${destData.donazione.donatoreAltro.cognome}`
        : `Donatore: Proprietario (${nomeCompleto})`;
      doc.text(`Donazione Ricevuta: ${importoStr} | Metodo: ${metodoStr} | ${donatoreStr}`, margin + 4, y2 + 13.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Contributo liberale a sostegno delle attività di soccorso, tutela animale ed emergenza territoriale (ETS OdV).', margin + 4, y2 + 18.5);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Nessuna donazione economica registrata per il presente servizio di trasporto.', margin + 4, y2 + 14);
    }

    y2 += boxDonazioneH + 3.5;

    // BOX 4: FIRME DIGITALI ACQUISITE SU DISPLAY BORDO MEZZO (BEN EVIDENTI)
    const boxFirmeH = 76;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y2, contentWidth, boxFirmeH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(30, 41, 59);
    doc.text('4. FIRME DIGITALI ACQUISITE SU DISPLAY BORDO MEZZO', margin + 4, y2 + 5.5);
    doc.line(margin + 4, y2 + 7.5, margin + contentWidth - 4, y2 + 7.5);

    const cardFirmaW = (contentWidth - 8) / 2;
    const cardFirmaH = 63;
    const firmaBoxY = y2 + 10;
    const boxImgH = 38;

    // 4a. Riquadro Firma Proprietario / Intestatario
    const firmaPropX = margin + 3;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.35);
    doc.roundedRect(firmaPropX, firmaBoxY, cardFirmaW, cardFirmaH, 1.5, 1.5, 'FD');

    // Testata Riquadro Firma Proprietario
    doc.setFillColor(30, 41, 59);
    doc.roundedRect(firmaPropX, firmaBoxY, cardFirmaW, 6.5, 1.5, 1.5, 'F');
    doc.rect(firmaPropX, firmaBoxY + 3.5, cardFirmaW, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text("FIRMA PROPRIETARIO / INTESTATARIO ANIMALE", firmaPropX + 3, firmaBoxY + 4.8, { maxWidth: cardFirmaW - 6 });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(`Nominativo: ${nomeCompleto}`, firmaPropX + 3, firmaBoxY + 11.5, { maxWidth: cardFirmaW - 6 });

    if (destData?.firmaProprietario) {
      try {
        doc.addImage(destData.firmaProprietario, 'PNG', firmaPropX + 3, firmaBoxY + 13, cardFirmaW - 6, boxImgH, undefined, 'FAST');
        doc.setFillColor(16, 185, 129);
        doc.roundedRect(firmaPropX + 3, firmaBoxY + cardFirmaH - 9, cardFirmaW - 6, 6, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.text(
          '[OK] SOTTOSCRITTO DIGITALMENTE A BORDO MEZZO',
          firmaPropX + (cardFirmaW / 2),
          firmaBoxY + cardFirmaH - 4.8,
          { align: 'center', maxWidth: cardFirmaW - 10 }
        );
      } catch {
        doc.setTextColor(148, 163, 184);
        doc.text('(Firma acquisita digitalmente)', firmaPropX + (cardFirmaW / 2), firmaBoxY + 28, { align: 'center', maxWidth: cardFirmaW - 6 });
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text('X', firmaPropX + 5, firmaBoxY + 36);
      doc.setDrawColor(71, 85, 105);
      doc.setLineDashPattern([2, 1], 0);
      doc.line(firmaPropX + 9, firmaBoxY + 36, firmaPropX + cardFirmaW - 5, firmaBoxY + 36);
      doc.setLineDashPattern([], 0);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('SPAZIO RISERVATO ALLA FIRMA AUTOGRAFA', firmaPropX + (cardFirmaW / 2), firmaBoxY + 43, { align: 'center', maxWidth: cardFirmaW - 8 });
      doc.setFontSize(5.8);
      doc.text('Attestazione di presa in carico e regolarita del trasporto', firmaPropX + 3, firmaBoxY + cardFirmaH - 4, { maxWidth: cardFirmaW - 6 });
    }

    // 4b. Riquadro Firma Medico Veterinario / Clinica (Partenza o Ricevente)
    const firmaVetX = margin + 3 + cardFirmaW + 2;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.35);
    doc.roundedRect(firmaVetX, firmaBoxY, cardFirmaW, cardFirmaH, 1.5, 1.5, 'FD');

    const isVetPartenza = Boolean(
      data.isStrutturaVeterinariaPartenza ||
      destData?.strutturaVeterinaria?.tipoRuolo === 'partenza' ||
      (!data.isStrutturaVeterinaria && destData?.strutturaVeterinaria?.tipoRuolo !== 'destinazione' && data.indirizzoIntervento?.toLowerCase().includes('clinic'))
    );

    doc.setFillColor(30, 41, 59);
    doc.roundedRect(firmaVetX, firmaBoxY, cardFirmaW, 6.5, 1.5, 1.5, 'F');
    doc.rect(firmaVetX, firmaBoxY + 3.5, cardFirmaW, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(255, 255, 255);
    doc.text(
      isVetPartenza
        ? 'FIRMA MEDICO VETERINARIO / CLINICA DI PARTENZA'
        : 'FIRMA MEDICO VETERINARIO / CLINICA RICEVENTE',
      firmaVetX + 3,
      firmaBoxY + 4.8,
      { maxWidth: cardFirmaW - 6 }
    );

    const vetStruttura = destData?.strutturaVeterinaria?.nomeStrutturaOVeterinario || (isVetPartenza ? data.indirizzoIntervento : data.destinazione) || (isVetPartenza ? 'Clinica Veterinaria di Partenza' : 'Clinica Veterinaria Ricevente');
    const vetDott = destData?.strutturaVeterinaria?.nomeVeterinario
      ? ` (Dr. ${destData.strutturaVeterinaria.nomeVeterinario})`
      : '';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizeWinAnsi(`Presso: ${vetStruttura}${vetDott}`), firmaVetX + 3, firmaBoxY + 11.5, { maxWidth: cardFirmaW - 6 });

    if (destData?.strutturaVeterinaria?.firmaVeterinario) {
      try {
        doc.addImage(destData.strutturaVeterinaria.firmaVeterinario, 'PNG', firmaVetX + 3, firmaBoxY + 13, cardFirmaW - 6, boxImgH, undefined, 'FAST');
        doc.setFillColor(16, 185, 129);
        doc.roundedRect(firmaVetX + 3, firmaBoxY + cardFirmaH - 9, cardFirmaW - 6, 6, 1, 1, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.0);
        doc.text(
          isVetPartenza
            ? '[OK] PRESA IN CARICO SANITARIA CONVALIDATA'
            : '[OK] PRESA IN CONSEGNA SANITARIA CONVALIDATA',
          firmaVetX + (cardFirmaW / 2),
          firmaBoxY + cardFirmaH - 4.8,
          { align: 'center', maxWidth: cardFirmaW - 10 }
        );
      } catch {
        doc.setTextColor(148, 163, 184);
        doc.text('(Firma acquisita digitalmente)', firmaVetX + (cardFirmaW / 2), firmaBoxY + 28, { align: 'center', maxWidth: cardFirmaW - 6 });
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text('X', firmaVetX + 5, firmaBoxY + 36);
      doc.setDrawColor(71, 85, 105);
      doc.setLineDashPattern([2, 1], 0);
      doc.line(firmaVetX + 9, firmaBoxY + 36, firmaVetX + cardFirmaW - 5, firmaBoxY + 36);
      doc.setLineDashPattern([], 0);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text('SPAZIO RISERVATO AL MEDICO VETERINARIO', firmaVetX + (cardFirmaW / 2), firmaBoxY + 43, { align: 'center', maxWidth: cardFirmaW - 8 });
      doc.setFontSize(5.8);
      doc.text("Attestazione di presa in consegna sanitaria dell'animale", firmaVetX + 3, firmaBoxY + cardFirmaH - 4, { maxWidth: cardFirmaW - 6 });
    }

    y2 += boxFirmeH + 3.5;

    // BOX 5: CERTIFICAZIONE TECNOLOGICA BORDO MEZZO E COORDINATE GPS
    const boxGpsH = 18;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y2, contentWidth, boxGpsH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(30, 41, 59);
    doc.text('5. CERTIFICAZIONE TECNOLOGICA BORDO MEZZO E COORDINATE GPS', margin + 4, y2 + 4.8);
    doc.line(margin + 4, y2 + 6.5, margin + contentWidth - 4, y2 + 6.5);

    doc.setFontSize(7.2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('GPS Arrivo sul Posto:', margin + 4, y2 + 11.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const txtGpsPosto = coordSulPosto
      ? sanitizeWinAnsi(`Lat ${coordSulPosto.lat.toFixed(5)}, Lng ${coordSulPosto.lng.toFixed(5)} [Ore ${tempi.sulPosto || '-'}]`)
      : 'Coordinate non trasmesse';
    doc.text(txtGpsPosto, margin + 35, y2 + 11.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('GPS Arrivo Destinazione:', margin + 4, y2 + 15.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const txtGpsDest = coordDest
      ? sanitizeWinAnsi(`Lat ${coordDest.lat.toFixed(5)}, Lng ${coordDest.lng.toFixed(5)} [Ore ${tempi.arrivoDestinazione || '-'}]`)
      : 'Coordinate non trasmesse';
    doc.text(txtGpsDest, margin + 40, y2 + 15.5);

    drawFoglioFooter('Allegato Tecnico Consegna, Ricevuta & Firme Digitali');
  }

  return doc;
}

/**
 * Scarica direttamente il file .pdf sul dispositivo dell'utente
 */
export function scaricaPDF(data: ReportDataPDF) {
  const doc = generaDocumentoPDF(data);
  const codicePulito = (data.codice || 'REPORT').replace(/[^a-zA-Z0-9_-]/g, '_');
  const nomeFile = `Foglio_Viaggio_${codicePulito}.pdf`;
  doc.save(nomeFile);
  return nomeFile;
}

/**
 * Genera il file .pdf e apre il client di posta predefinito del dispositivo (con mailto:)
 * Inoltre, se il browser/device supporta la condivisione file nativa (navigator.share con file),
 * apre direttamente la schermata di condivisione con il PDF allegato.
 * Se è presente una donazione economica, indirizza automaticamente l'email a tesoreria@croceoro.org.
 */
export async function inviaPerEmailPDF(data: ReportDataPDF): Promise<{ method: 'share' | 'mailto'; nomeFile: string }> {
  const doc = generaDocumentoPDF(data);
  const codicePulito = (data.codice || 'REPORT').replace(/[^a-zA-Z0-9_-]/g, '_');
  const nomeFile = `Foglio_Viaggio_${codicePulito}.pdf`;

  // 1. Genera blob del PDF
  const pdfBlob = doc.output('blob');
  const pdfFile = new File([pdfBlob], nomeFile, { type: 'application/pdf' });

  // 2. Prepara dati email precompilati (specifici per Tesoreria se è presente una donazione)
  const haDonazione = Boolean(data.datiDestinazione?.donazione?.ricevuta);
  const destinatario = haDonazione ? 'tesoreria@croceoro.org' : '';
  const importo = data.datiDestinazione?.donazione?.somma || 0;
  const rawMetodo = data.datiDestinazione?.donazione?.metodo;
  const metodo = rawMetodo === 'pos' ? 'POS Elettronico' : rawMetodo === 'contanti' ? 'Contanti' : (rawMetodo || 'Contanti');

  const oggetto = encodeURIComponent(
    haDonazione
      ? `[DONAZIONE RICEVUTA € ${importo.toFixed(2)}] Foglio di Viaggio ${data.codice} - Croce Oro Massa Carrara OdV`
      : `Foglio di Viaggio ${data.codice} - Croce Oro Massa Carrara OdV`
  );

  const corpo = encodeURIComponent(
    haDonazione
      ? `All'attenzione dell'Ufficio Tesoreria (tesoreria@croceoro.org) / Segreteria Generale,\n\n` +
        `Si trasmette in allegato il Foglio di Viaggio ufficiale con attestazione di DONAZIONE ECONOMICA registrata dall'equipaggio:\n\n` +
        `- Codice Missione: ${data.codice}\n` +
        `- Data Registrazione: ${data.data}\n` +
        `- Mezzo Assegnato: ${data.mezzo}\n` +
        `- Donazione Ricevuta: € ${importo.toFixed(2)} (${metodo})\n` +
        `- Donatore / Proprietario: ${(data.datiDestinazione?.proprietario?.nome || '') + ' ' + (data.datiDestinazione?.proprietario?.cognome || '')}\n` +
        `- Indirizzo Intervento: ${data.indirizzoIntervento || '-'}\n` +
        `- Chilometri Percorsi: ${data.kmTotali} KM (Inizio: ${data.kmInizio} - Fine: ${data.kmFine})\n\n` +
        `CRONOLOGIA ORARI REGISTRATI:\n` +
        `- Partenza da Sede: ${data.tempi?.partenza || '-'}\n` +
        `- Sul Posto / Obiettivo: ${data.tempi?.sulPosto || '-'}\n` +
        `- Partenza Obiettivo: ${data.tempi?.partenzaObiettivo || '-'}\n` +
        `- Arrivo Destinazione: ${data.tempi?.arrivoDestinazione || '-'}\n` +
        `- Fine Missione: ${data.tempi?.fineMissione || '-'}\n` +
        `- Rientro in Sede: ${data.tempi?.rientro || '-'}\n\n` +
        `Il file PDF "${nomeFile}" firmato digitalmente è stato generato e salvato automaticamente per essere allegato alla presente comunicazione.\n\n` +
        `Cordiali saluti,\n` +
        `Croce Oro Massa Carrara OdV\n` +
        `Associazione Volontari del Soccorso & Protezione Civile`
      : `All'attenzione della Centrale Operativa / Segreteria,\n\n` +
        `Si trasmette in allegato il Foglio di Viaggio ufficiale relativo alla missione di soccorso:\n\n` +
        `- Codice Missione: ${data.codice}\n` +
        `- Mezzo Assegnato: ${data.mezzo}\n` +
        `- Data Registrazione: ${data.data}\n` +
        `- Chilometri Percorsi: ${data.kmTotali} KM (Inizio: ${data.kmInizio} - Fine: ${data.kmFine})\n\n` +
        `CRONOLOGIA ORARI REGISTRATI:\n` +
        `- Partenza da Sede: ${data.tempi?.partenza || '-'}\n` +
        `- Sul Posto / Obiettivo: ${data.tempi?.sulPosto || '-'}\n` +
        `- Partenza Obiettivo: ${data.tempi?.partenzaObiettivo || '-'}\n` +
        `- Arrivo Destinazione: ${data.tempi?.arrivoDestinazione || '-'}\n` +
        `- Fine Missione: ${data.tempi?.fineMissione || '-'}\n` +
        `- Rientro in Sede: ${data.tempi?.rientro || '-'}\n\n` +
        `Il file PDF "${nomeFile}" è stato generato e scaricato automaticamente sul dispositivo per essere allegato a questa email.\n\n` +
        `Cordiali saluti,\n` +
        `Capo Turno Croce Oro Massa Carrara OdV\n` +
        `Associazione Volontari del Soccorso & Protezione Civile`
  );

  const mailtoLink = `mailto:${destinatario}?subject=${oggetto}&body=${corpo}`;

  // 3. Prova prima con Web Share API (se supportata con file su smartphone/tablet)
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
    try {
      await navigator.share({
        title: `Foglio di Viaggio ${data.codice}`,
        text: haDonazione
          ? `Foglio di Viaggio ${data.codice} - Donazione € ${importo.toFixed(2)} (${data.mezzo}) per tesoreria@croceoro.org`
          : `Foglio di Viaggio ${data.codice} - Mezzo ${data.mezzo} (${data.kmTotali} KM)`,
        files: [pdfFile]
      });
      return { method: 'share', nomeFile };
    } catch (err: any) {
      console.log('[Email PDF] Fallback a mailto e download automatico:', err?.message);
    }
  }

  // 4. Download automatico del file .pdf per averlo pronto nei "Download"
  doc.save(nomeFile);

  // 5. Apertura immediata del programma di posta predefinito del dispositivo
  const link = document.createElement('a');
  link.href = mailtoLink;
  link.click();

  return { method: 'mailto', nomeFile };
}

/**
 * Invia in automatico il Foglio di Viaggio PDF finito come allegato alla Tesoreria (tesoreria@croceoro.org)
 * quando viene indicata una donazione economica.
 * Chiama l'endpoint server /api/invia-email-tesoreria trasmettendo il PDF in formato Base64.
 */
export async function inviaAutomaticamenteEmailTesoreria(
  data: ReportDataPDF
): Promise<{ success: boolean; message: string; method?: string; nomeFile: string }> {
  const doc = generaDocumentoPDF(data);
  const codicePulito = (data.codice || 'REPORT').replace(/[^a-zA-Z0-9_-]/g, '_');
  const nomeFile = `Foglio_Viaggio_${codicePulito}.pdf`;

  try {
    const rawUri = doc.output('datauristring');
    // Estrai la stringa Base64 pura senza prefissi mime/filename (es. data:application/pdf;filename=...;base64,)
    const pdfBase64 = rawUri.includes('base64,') ? rawUri.substring(rawUri.indexOf('base64,') + 7) : rawUri;

    const res = await fetch('/api/invia-email-tesoreria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        codice: data.codice,
        data: data.data,
        mezzo: data.mezzo,
        kmInizio: data.kmInizio,
        kmFine: data.kmFine,
        kmTotali: data.kmTotali,
        donazione: data.datiDestinazione?.donazione,
        proprietario: data.datiDestinazione?.proprietario,
        volontarioNome: data.volontarioNome,
        indirizzoIntervento: data.indirizzoIntervento,
        destinazione: data.destinazione,
        pdfBase64,
        nomeFile
      })
    });

    const json = await res.json();
    return {
      success: json.success ?? true,
      message: json.message || `Foglio di Viaggio inviato a tesoreria@croceoro.org con allegato ${nomeFile}`,
      method: json.speditoViaSmtp ? 'smtp' : 'notifica',
      nomeFile
    };
  } catch (err: any) {
    console.error('[Tesoreria PDF] Errore invio automatico endpoint:', err);
    return {
      success: false,
      message: err?.message || 'Errore di rete invio Tesoreria',
      nomeFile
    };
  }
}

/**
 * Genera il secondo documento PDF ufficiale richiesto:
 * "VERBALE DI SOCCORSO E RECUPERO ANIMALE NON DI PROPRIETÀ"
 * Da compilare e conservare per tutti i servizi veterinari di animali vaganti o senza proprietario noto.
 */
export function generaVerbaleAnimaleNonProprietaPDF(data: ReportDataPDF): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const destData = data.datiDestinazione;

  // --- HEADER SUPERIORE ---
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 36, 'F');
  doc.setFillColor(220, 38, 38); // red-600 accento emergenza recupero
  doc.rect(0, 36, pageWidth, 2.5, 'F');

  try {
    doc.addImage(LOGO_IPOTESI_SEMITRASP_BASE64, 'PNG', margin, 5, 26, 26, undefined, 'FAST');
  } catch {}

  const cInfoVerb = getDatiCartaIntestata();
  const headerTextX = margin + 30;
  doc.setTextColor(251, 191, 36); // amber-400
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text((cInfoVerb.denominazione || 'CROCE ORO MASSA CARRARA ODV').toUpperCase(), headerTextX, 15);

  doc.setTextColor(241, 245, 249);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.3);
  doc.text('Associazione Volontari del Soccorso & Protezione Civile - Ente del Terzo Settore', headerTextX, 21.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.2);
  doc.setTextColor(254, 202, 202);
  doc.text('Nucleo Tutela e Soccorso Animali - Convenzione Territoriale', headerTextX, 27);

  // Badge Destra: VERBALE ANIMALE NON DI PROPRIETÀ (spostato a destra per non sovrapporsi con Ente del Terzo Settore)
  const badgeW = 46;
  const badgeH = 20;
  const badgeX = pageWidth - 6 - badgeW;
  doc.setFillColor(220, 38, 38);
  doc.roundedRect(badgeX, 7, badgeW, badgeH, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.text('VERBALE UFFICIALE', badgeX + 3.5, 12.5);
  doc.setFontSize(8.5);
  doc.text('ANIMALE NON DI', badgeX + 3.5, 18);
  doc.text('PROPRIETÀ', badgeX + 3.5, 23);

  let y = 42;

  // --- BOX 1: DATI MISSIONE E MEZZO ---
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 24, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('1. RIFERIMENTI MISSIONE OPERATIVA DI RECUPERO', margin + 4, y + 5);
  doc.line(margin + 4, y + 6.8, margin + contentWidth - 4, y + 6.8);

  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Codice Verbale:', margin + 4, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text(sanitizePdfText(data.codice || 'N/D'), margin + 30, y + 12, { maxWidth: (contentWidth / 2) - 32 });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Mezzo Bordo:', margin + 4, y + 18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(data.mezzo || 'N/D'), margin + 30, y + 18, { maxWidth: (contentWidth / 2) - 32 });

  const col2 = margin + (contentWidth / 2) + 4;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Data & Ora:', col2, y + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(formattaDataEOraCompleta(data.data, data.testoCompleto)), col2 + 35, y + 12, { maxWidth: (contentWidth / 2) - 41 });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Capo Turno:', col2, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const capoNome = data.volontarioNome ? `${data.volontarioNome} (${data.qualificaTurno || 'Autista'})` : 'Capo Turno';
  doc.text(sanitizePdfText(capoNome), col2 + 35, y + 18, { maxWidth: (contentWidth / 2) - 41 });

  y += 27;

  // --- BOX 2: SCHEDA IDENTIFICATIVA DELL'ANIMALE RECUPERATO ---
  const box2H = 34;
  doc.setFillColor(254, 242, 242); // red-50
  doc.setDrawColor(252, 165, 165); // red-300
  doc.roundedRect(margin, y, contentWidth, box2H, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(153, 27, 27);
  doc.text("2. SCHEDA IDENTIFICATIVA DELL'ANIMALE RECUPERATO (NON DI PROPRIETÀ)", margin + 4, y + 5);
  doc.line(margin + 4, y + 6.8, margin + contentWidth - 4, y + 6.8);

  const effTipo = data.tipoAnimale || destData?.animale?.tipo || 'Cane / Gatto';
  const effAltro = data.tipoAnimaleAltro || destData?.animale?.tipoAltro ? ` (${data.tipoAnimaleAltro || destData?.animale?.tipoAltro})` : '';
  const effChip = data.microchip || destData?.animale?.microchip || (data.noMicrochip || destData?.animale?.noMicrochip ? 'DICHIARATO ASSENTE (NO MICROCHIP)' : 'Non rilevato');

  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Specie Animale:', margin + 4, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(`${effTipo}${effAltro}`), margin + 30, y + 12, { maxWidth: (contentWidth / 2) - 34 });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Stato e Tipologia:', margin + 4, y + 18.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38);
  doc.setFontSize(7);
  doc.text('ANIMALE VAGANTE / SENZA PROPRIETARIO NOTO SUL POSTO', margin + 30, y + 18.5, { maxWidth: (contentWidth / 2) - 34 });

  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Dettagli / Razza:', margin + 4, y + 27.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const dett = (data as any).specifiche || destData?.animale?.tipoAltro || 'Recupero e soccorso sul territorio';
  doc.text(sanitizePdfText(dett), margin + 30, y + 27.5, { maxWidth: (contentWidth / 2) - 34 });

  // Colonna destra Box 2: MICROCHIP IN EVIDENZA (senza caratteri emoji per prevenire mojibake)
  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Rilevazione Microchip:', col2, y + 12);
  doc.setFont('helvetica', 'bold');
  if (effChip.includes('NO')) {
    doc.setTextColor(220, 38, 38);
    doc.text('NO MICROCHIP (Lettore Negativo)', col2 + 35, y + 12, { maxWidth: (contentWidth / 2) - 41 });
  } else {
    doc.setTextColor(30, 58, 138);
    doc.text(sanitizePdfText(effChip), col2 + 35, y + 12, { maxWidth: (contentWidth / 2) - 41 });
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Orario Rilevazione:', col2, y + 18.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(`Arrivo sul posto ore ${data.tempi?.sulPosto || '-'}`), col2 + 35, y + 18.5, { maxWidth: (contentWidth / 2) - 41 });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  const manovreVerbale = (data.manovreEffettuatePatologie || data.datiDestinazione?.manovreEffettuatePatologie || '').trim();
  doc.text(manovreVerbale ? 'Manovre / Patologie:' : 'Note Sanitarie:', col2, y + 27.5);
  doc.setFont('helvetica', manovreVerbale ? 'bold' : 'normal');
  doc.setTextColor(15, 23, 42);
  const noteSanitarieBordo = manovreVerbale || 'Animale preso in carico in sicurezza con parametri vitali stabili';
  doc.text(sanitizePdfText(noteSanitarieBordo), col2 + 35, y + 27.5, { maxWidth: (contentWidth / 2) - 41 });

  y += box2H + 3;

  // --- BOX 3: LUOGO DI RITROVAMENTO & DATI SEGNALANTE (CHIAMANTE) ---
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 26, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('3. LUOGO DI RITROVAMENTO E SEGNALANTE (CHIAMANTE)', margin + 4, y + 5);
  doc.line(margin + 4, y + 6.8, margin + contentWidth - 4, y + 6.8);

  const indEvento = data.indirizzoIntervento || 'Massa Carrara';
  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Luogo Ritrovamento:', margin + 4, y + 12.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(indEvento), margin + 35, y + 12.5, { maxWidth: (contentWidth / 2) - 38 });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Coordinate GPS Cert.:', margin + 4, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(16, 185, 129);
  const gpsTxt = data.coordinateSulPosto ? `Lat ${data.coordinateSulPosto.lat.toFixed(5)}, Lng ${data.coordinateSulPosto.lng.toFixed(5)}` : 'Registrate da centrale';
  doc.text(sanitizePdfText(gpsTxt), margin + 35, y + 21, { maxWidth: (contentWidth / 2) - 38 });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Segnalante / Chiamante:', col2, y + 12.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(data.chiamante || 'Non specificato'), col2 + 37, y + 12.5, { maxWidth: (contentWidth / 2) - 43 });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Telefono Segnalante:', col2, y + 21);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text(sanitizePdfText(data.telefono || 'N/D'), col2 + 37, y + 21, { maxWidth: (contentWidth / 2) - 43 });

  y += 29;

  // --- BOX 4: DATI INTESTATARIO MICROCHIP DA ANAGRAFE (SE IDENTIFICATO) ---
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 26, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('4. INTESTATARIO MICROCHIP DA BANCA DATI ANAGRAFE CANINA / FELINA', margin + 4, y + 5);

  const regChip4 = destData?.proprietario?.regioneTipo === 'TOSCANA'
    ? 'TOSCANA'
    : (destData?.proprietario?.regioneAltro || destData?.proprietario?.regione || destData?.animale?.anagrafeAltraRegione || destData?.animale?.anagrafeRegione || '');
  if (regChip4) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(180, 83, 9);
    doc.text(sanitizePdfText(`Regione: ${regChip4.toUpperCase()}`), margin + contentWidth - 4, y + 5, { align: 'right' });
  }

  doc.line(margin + 4, y + 6.8, margin + contentWidth - 4, y + 6.8);

  const prop = destData?.proprietario;
  const propNome = `${prop?.nome || ''} ${prop?.cognome || ''}`.trim() || 'Non ancora identificato o in attesa di visura';
  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Intestatario:', margin + 4, y + 12.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(propNome), margin + 35, y + 12.5, { maxWidth: (contentWidth / 2) - 38 });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('C.F. & Nascita:', margin + 4, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(`${prop?.codiceFiscale || '-'} | Nato il: ${prop?.dataNascita || '-'}`), margin + 35, y + 21, { maxWidth: (contentWidth / 2) - 38 });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Residenza:', col2, y + 12.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  const resStr = `${prop?.indirizzo || '-'}, ${prop?.comune || '-'} (${prop?.provincia || '-'})`;
  doc.text(sanitizePdfText(resStr), col2 + 35, y + 12.5, { maxWidth: (contentWidth / 2) - 41 });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Telefono:', col2, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(sanitizePdfText(prop?.telefono || '-'), col2 + 35, y + 21, { maxWidth: (contentWidth / 2) - 41 });

  y += 29;

  // --- BOX 5: STRUTTURA DI CONSEGNA / CLINICA O RIFUGIO RICEVENTE O PARTENZA ---
  const isVetPartenzaBox = Boolean(
    data.isStrutturaVeterinariaPartenza ||
    destData?.strutturaVeterinaria?.tipoRuolo === 'partenza' ||
    (!data.isStrutturaVeterinaria && destData?.strutturaVeterinaria?.tipoRuolo !== 'destinazione' && data.indirizzoIntervento?.toLowerCase().includes('clinic'))
  );

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 20, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    isVetPartenzaBox
      ? '5. PARTENZA & PRESA IN CARICO SANITARIA'
      : '5. DESTINAZIONE & AFFIDO / PRESA IN CONSEGNA SANITARIA',
    margin + 4,
    y + 5
  );
  doc.line(margin + 4, y + 6.8, margin + contentWidth - 4, y + 6.8);

  const destStruttura = destData?.strutturaVeterinaria?.nomeStrutturaOVeterinario || (isVetPartenzaBox ? data.indirizzoIntervento : data.destinazione) || (isVetPartenzaBox ? 'Clinica Veterinaria di Partenza' : 'Clinica Veterinaria Ricevente');
  const vetNome = destData?.strutturaVeterinaria?.nomeVeterinario ? ` (Dr. ${destData.strutturaVeterinaria.nomeVeterinario})` : '';

  doc.setFontSize(7.8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(isVetPartenzaBox ? 'Struttura di Partenza:' : 'Struttura Ricevente:', margin + 4, y + 13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${destStruttura}${vetNome}`, margin + 35, y + 13, { maxWidth: (contentWidth / 2) - 40 });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text(isVetPartenzaBox ? 'Orario Partenza Obiettivo:' : 'Orario Presa in Carico:', col2, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(
    isVetPartenzaBox
      ? `Partenza ore ${data.tempi?.partenzaObiettivo || data.tempi?.sulPosto || '-'}`
      : `Arrivo destinazione ore ${data.tempi?.arrivoDestinazione || '-'}`,
    col2 + 35,
    y + 13
  );

  y += 23;

  // --- BOX 6: 4 CAMPI FIRMA UFFICIALI CHIARI E BEN VISIBILI ---
  const boxFirmeH = 58;
  const colW = (contentWidth - 6) / 2;
  const hCardFirma = 27;

  // 6a. Firma Capo Turno
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, y, colW, hCardFirma, 1.5, 1.5, 'FD');
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, y, colW, 5.5, 1.5, 1.5, 'F');
  doc.rect(margin, y + 3, colW, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('1. FIRMA VOLONTARIO / CAPO TURNO', margin + 3, y + 3.8, { maxWidth: colW - 6 });
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(6.8);
  doc.text(sanitizePdfText(`Nominativo: ${capoNome}`), margin + 3, y + 9.5, { maxWidth: colW - 6 });

  if (data.firmaVolontario) {
    try {
      doc.addImage(data.firmaVolontario, 'PNG', margin + 3, y + 10.5, colW - 6, 11.5, undefined, 'FAST');
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(margin + 3, y + hCardFirma - 4.5, colW - 6, 4, 0.5, 0.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.3);
      doc.text(
        '[FIRMA OK] SOTTOSCRITTO DIGITALMENTE A BORDO MEZZO',
        margin + 3 + (colW - 6) / 2,
        y + hCardFirma - 1.8,
        { align: 'center', maxWidth: colW - 8 }
      );
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('X', margin + 4, y + 19);
      doc.setDrawColor(71, 85, 105);
      doc.setLineDashPattern([2, 1], 0);
      doc.line(margin + 8, y + 19, margin + colW - 4, y + 19);
      doc.setLineDashPattern([], 0);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.6);
      doc.setTextColor(100, 116, 139);
      doc.text('Attestazione esecuzione recupero animale', margin + 3, y + 24, { maxWidth: colW - 6 });
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('X', margin + 4, y + 19);
    doc.setDrawColor(71, 85, 105);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(margin + 8, y + 19, margin + colW - 4, y + 19);
    doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.6);
    doc.setTextColor(100, 116, 139);
    doc.text('Attestazione esecuzione recupero animale', margin + 3, y + 24, { maxWidth: colW - 6 });
  }

  // 6b. Firma Segnalante / Ritrovatore
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin + colW + 6, y, colW, hCardFirma, 1.5, 1.5, 'FD');
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin + colW + 6, y, colW, 5.5, 1.5, 1.5, 'F');
  doc.rect(margin + colW + 6, y + 3, colW, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('2. FIRMA SEGNALANTE / AFFIDATARIO SUL POSTO', margin + colW + 9, y + 3.8, { maxWidth: colW - 6 });
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(6.8);
  doc.text(sanitizePdfText(`Nominativo: ${data.chiamante || 'Segnalante sul posto'}`), margin + colW + 9, y + 9.5, { maxWidth: colW - 6 });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('X', margin + colW + 10, y + 19);
  doc.setDrawColor(71, 85, 105);
  doc.setLineDashPattern([2, 1], 0);
  doc.line(margin + colW + 14, y + 19, margin + contentWidth - 4, y + 19);
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(5.6);
  doc.setTextColor(100, 116, 139);
  doc.text('Sottoscrizione per consegna animale ai soccorritori', margin + colW + 9, y + 24, { maxWidth: colW - 6 });

  y += hCardFirma + 3;

  // 6c. Firma Medico Veterinario / Clinica (Partenza o Ricevente)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, y, colW, hCardFirma, 1.5, 1.5, 'FD');
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, y, colW, 5.5, 1.5, 1.5, 'F');
  doc.rect(margin, y + 3, colW, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text(
    isVetPartenzaBox
      ? '3. FIRMA VETERINARIO / CLINICA PARTENZA'
      : '3. FIRMA VETERINARIO / CLINICA RICEVENTE',
    margin + 3,
    y + 3.8,
    { maxWidth: colW - 6 }
  );
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(6.8);
  doc.text(sanitizePdfText(`Presso: ${destStruttura}`), margin + 3, y + 9.5, { maxWidth: colW - 6 });

  if (destData?.strutturaVeterinaria?.firmaVeterinario) {
    try {
      doc.addImage(destData.strutturaVeterinaria.firmaVeterinario, 'PNG', margin + 3, y + 10.5, colW - 6, 11.5, undefined, 'FAST');
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(margin + 3, y + hCardFirma - 4.5, colW - 6, 4, 0.5, 0.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.3);
      doc.text(
        isVetPartenzaBox
          ? '[OK] PRESA IN CARICO SANITARIA CONVALIDATA'
          : '[OK] PRESA IN CONSEGNA SANITARIA CONVALIDATA',
        margin + 3 + (colW - 6) / 2,
        y + hCardFirma - 1.8,
        { align: 'center', maxWidth: colW - 8 }
      );
    } catch {
      doc.text('X', margin + 4, y + 19);
      doc.line(margin + 8, y + 19, margin + colW - 4, y + 19);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('X', margin + 4, y + 19);
    doc.setDrawColor(71, 85, 105);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(margin + 8, y + 19, margin + colW - 4, y + 19);
    doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.6);
    doc.setTextColor(100, 116, 139);
    doc.text('Timbro e firma per presa in carico sanitaria', margin + 3, y + 24, { maxWidth: colW - 6 });
  }

  // 6d. Firma / Visto Operatore Centrale Operativa
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin + colW + 6, y, colW, hCardFirma, 1.5, 1.5, 'FD');
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin + colW + 6, y, colW, 5.5, 1.5, 1.5, 'F');
  doc.rect(margin + colW + 6, y + 3, colW, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('4. VISTO CENTRALE OPERATIVA RADIO', margin + colW + 9, y + 3.8, { maxWidth: colW - 6 });
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(6.8);
  doc.text('Centrale Emergenza Territoriale & Radio', margin + colW + 9, y + 9.5, { maxWidth: colW - 6 });

  if (data.firmaOperatoreCentrale) {
    try {
      doc.addImage(data.firmaOperatoreCentrale, 'PNG', margin + colW + 9, y + 10.5, colW - 6, 11.5, undefined, 'FAST');
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(margin + colW + 9, y + hCardFirma - 4.5, colW - 6, 4, 0.5, 0.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.3);
      doc.text(
        '[OK] VISTO E FIRMA TELEMATICA CENTRALE REGISTRATA',
        margin + colW + 6 + (colW / 2),
        y + hCardFirma - 1.8,
        { align: 'center', maxWidth: colW - 8 }
      );
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text('X', margin + colW + 10, y + 19);
      doc.setDrawColor(71, 85, 105);
      doc.setLineDashPattern([2, 1], 0);
      doc.line(margin + colW + 14, y + 19, margin + contentWidth - 4, y + 19);
      doc.setLineDashPattern([], 0);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.6);
      doc.setTextColor(100, 116, 139);
      doc.text('Visto di convalida e archiviazione telematica', margin + colW + 9, y + 24, { maxWidth: colW - 6 });
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('X', margin + colW + 10, y + 19);
    doc.setDrawColor(71, 85, 105);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(margin + colW + 14, y + 19, margin + contentWidth - 4, y + 19);
    doc.setLineDashPattern([], 0);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.6);
    doc.setTextColor(100, 116, 139);
    doc.text('Visto di convalida e archiviazione telematica', margin + colW + 9, y + 24, { maxWidth: colW - 6 });
  }

  // --- FOOTER UFFICIALE ---
  const footerH = 28;
  const footerY = 269;
  doc.setFillColor(15, 23, 42);
  doc.rect(0, footerY, pageWidth, footerH, 'F');
  doc.setFillColor(220, 38, 38);
  doc.rect(0, footerY, pageWidth, 1.2, 'F');

  const centerX = pageWidth / 2;
  const cInfo = getDatiCartaIntestata();
  const socialStrVerb = formattaSocialCartaIntestata(cInfo);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(251, 191, 36);
  doc.text(
    `${(cInfo.denominazione || 'CROCE ORO MASSA CARRARA ODV').toUpperCase()} - Verbale Ufficiale di Soccorso e Recupero Animale Non di Proprietà`,
    centerX,
    footerY + 6.5,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Verbale generato per la missione ${data.codice} (Mezzo ${data.mezzo}) - Archiviazione Telematica a norma di legge`,
    centerX,
    footerY + 11.5,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(socialStrVerb ? 5.0 : 5.5);
  doc.setTextColor(254, 240, 138);
  doc.text(
    sanitizePdfText(
      `Sede Legale: ${cInfo.sedeLegale} | Sede Massa: ${cInfo.sedeMassa} | Sede Carrara: ${cInfo.sedeCarrara} | Sede Pietrasanta: ${cInfo.sedePietrasanta} | Tel: ${cInfo.centraleTel}` +
        (socialStrVerb ? ` | ${socialStrVerb}` : '')
    ),
    centerX,
    footerY + 16.5,
    { align: 'center', maxWidth: pageWidth - 16 }
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(sanitizePdfText(`CF: ${cInfo.codiceFiscale} | ${cInfo.sitoWeb} | Email: ${cInfo.email} | Pec: ${cInfo.pec}`), centerX, footerY + 22.5, { align: 'center', maxWidth: pageWidth - 16 });

  return doc;
}

/**
 * Scarica direttamente il Verbale di Soccorso e Recupero Animale Non di Proprietà
 */
export function scaricaVerbaleAnimaleNonProprietaPDF(data: ReportDataPDF) {
  const doc = generaVerbaleAnimaleNonProprietaPDF(data);
  const codicePulito = (data.codice || 'RECUPERO').replace(/[^a-zA-Z0-9_-]/g, '_');
  const nomeFile = `Verbale_Recupero_Animale_${codicePulito}.pdf`;
  doc.save(nomeFile);
  return nomeFile;
}

/**
 * Genera il file PDF del Documento di Identità dell'Intestatario del Microchip
 * acquisito dal volontario a bordo mezzo (Fronte e Retro).
 */
export function generaDocumentoIdentitaPDF(data: ReportDataPDF): jsPDF {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  // Intestazione Istituzionale Croce Oro
  doc.setFillColor(29, 26, 96);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setFillColor(191, 163, 83);
  doc.rect(0, 28, pageWidth, 2, 'F');

  // Logo Croce Oro
  try {
    doc.addImage(LOGO_IPOTESI_SEMITRASP_BASE64, 'PNG', margin, 3, 22, 22, undefined, 'FAST');
  } catch {}

  const cInfoDocIdHdr = getDatiCartaIntestata();
  // Titolo Header
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text((cInfoDocIdHdr.denominazione || 'CROCE ORO MASSA CARRARA ODV').toUpperCase(), margin + 26, 11);

  doc.setFontSize(9);
  doc.setTextColor(253, 224, 71);
  doc.text('ALLEGATO DOCUMENTO DI IDENTITÀ INTESTATARIO MICROCHIP', margin + 26, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(226, 232, 240);
  doc.text('Acquisizione fotografica a bordo mezzo (Fronte / Retro) a norma di legge', margin + 26, 22.5);

  // Badge Destra Servizio
  const badgeW = 55;
  const badgeH = 22;
  const badgeX = pageWidth - margin - badgeW;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(badgeX, 3, badgeW, badgeH, 2, 2, 'F');
  doc.setDrawColor(251, 191, 36);
  doc.setLineWidth(0.5);
  doc.roundedRect(badgeX, 3, badgeW, badgeH, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(251, 191, 36);
  doc.text('RIFERIMENTO MISSIONE', badgeX + 4, 8);

  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(data.codice || 'CO-2026', badgeX + 4, 13.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Mezzo: ${data.mezzo || 'T4606'} | ${data.data || formatDateItaly()}`, badgeX + 4, 18.5);

  let currentY = 35;

  // Box 1: Dettagli Servizio & Microchip
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(29, 26, 96);
  doc.text('1. DATI DEL SERVIZIO ED ANIMALE RECUPERATO', margin + 4, currentY + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);

  doc.text(`Codice Servizio: ${data.codice || '-'}`, margin + 4, currentY + 11);
  doc.text(`Data e Orario: ${data.data || '-'}`, margin + 4, currentY + 16);
  doc.text(`Mezzo: ${data.mezzo || '-'} (${data.volontarioNome ? `Equipaggio: ${data.volontarioNome}` : 'Equipaggio in turno'})`, margin + 4, currentY + 21);

  const col2X = margin + 65;
  const indIntervento = (data.indirizzoIntervento || '-').substring(0, 36);
  const destIntervento = (data.destinazione || 'In attesa o rientro').substring(0, 36);
  doc.text(`Indirizzo Obiettivo: ${indIntervento}`, col2X, currentY + 11);
  doc.text(`Destinazione: ${destIntervento}`, col2X, currentY + 16);
  doc.text(`Ambito: ${data.ambito || 'SERVIZIO VETERINARIO'}`, col2X, currentY + 21);

  const col3X = margin + 130;
  const chipW = contentWidth - 132;
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(col3X, currentY + 3, chipW, 18, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(180, 83, 9);
  doc.text('MICROCHIP RILEVATO', col3X + 3, currentY + 8);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const chipCod = data.microchip ? data.microchip : (data.noMicrochip ? 'NO MICROCHIP' : 'NON RILEVATO');
  doc.text(chipCod, col3X + 3, currentY + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Specie: ${data.tipoAnimale || 'Cane'}${data.tipoAnimaleAltro ? ` (${data.tipoAnimaleAltro})` : ''}`, col3X + 3, currentY + 18);

  currentY += 28;

  // Box 2: Dati Intestatario Microchip
  const datiProp = data.datiProprietarioCentrale || {};
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, contentWidth, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(29, 26, 96);
  doc.text('2. ANAGRAFICA INTESTATARIO DEL MICROCHIP (RICAVATA DA ANAGRAFE CANINA/FELINA ASL)', margin + 4, currentY + 5.5);

  const regChipDoc = datiProp.regioneTipo === 'TOSCANA'
    ? 'TOSCANA'
    : (datiProp.regioneAltro || datiProp.regione || '');
  if (regChipDoc) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(180, 83, 9);
    doc.text(`Regione: ${regChipDoc.toUpperCase()}`, margin + contentWidth - 4, currentY + 5.5, { align: 'right' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);

  const nomeComp = `${datiProp.nome || '-'} ${datiProp.cognome || ''}`.trim();
  doc.text(`Nome e Cognome: `, margin + 4, currentY + 12);
  doc.setFont('helvetica', 'bold');
  doc.text(nomeComp, margin + 30, currentY + 12);
  doc.setFont('helvetica', 'normal');

  doc.text(`Data di Nascita: ${datiProp.dataNascita || '-'}`, margin + 4, currentY + 17.5);
  doc.text(`Codice Fiscale: ${datiProp.codiceFiscale || '-'}`, margin + 4, currentY + 23);
  doc.text(`Telefono: ${datiProp.telefono || '-'}`, margin + 4, currentY + 28.5);

  const col2PropX = margin + 85;
  const residenzaStr = `${datiProp.indirizzo || '-'}, ${datiProp.comune || ''} (${datiProp.provincia || 'MS'}) ${datiProp.cap || ''}`;
  doc.text(`Residenza Completa:`, col2PropX, currentY + 12);
  doc.setFont('helvetica', 'bold');
  doc.text(residenzaStr.substring(0, 48), col2PropX, currentY + 17);
  doc.setFont('helvetica', 'normal');

  if (datiProp.email) {
    doc.text(`Email: ${datiProp.email}`, col2PropX, currentY + 23);
  } else {
    doc.text(`Email: Non specificata / Non ha email`, col2PropX, currentY + 23);
  }

  if (datiProp.note) {
    doc.setFontSize(7);
    doc.setTextColor(180, 83, 9);
    doc.text(`Note ASL: ${datiProp.note.substring(0, 55)}`, col2PropX, currentY + 28.5);
    doc.setTextColor(51, 65, 85);
  }

  currentY += 38;

  // Box 3: FOTOGRAFIE DEL DOCUMENTO DI IDENTITÀ (FRONTE E RETRO)
  const fotoDoc = data.fotoDocumento || datiProp.fotoDocumento || {};
  const boxW = (contentWidth - 6) / 2;
  const boxH = 92;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(29, 26, 96);
  doc.text('3. FOTOGRAFIE DEL DOCUMENTO DI IDENTITÀ ESIBITO (Fronte e Retro)', margin, currentY + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Acquisite a bordo mezzo dall\'equipaggio con terminale fotografico', margin + 105, currentY + 3);

  currentY += 6;

  // --- BOX FRONTE ---
  const fronteX = margin;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(fronteX, currentY, boxW, boxH, 2, 2, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(fronteX, currentY, boxW, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('FRONTE (Davanti del Documento)', fronteX + 4, currentY + 5.5);

  if (fotoDoc.fronte) {
    try {
      const imgProps = (doc as any).getImageProperties ? (doc as any).getImageProperties(fotoDoc.fronte) : { width: 16, height: 10 };
      const maxImgW = boxW - 6;
      const maxImgH = boxH - 14;
      let imgW = maxImgW;
      let imgH = maxImgH;
      if (imgProps && imgProps.width && imgProps.height) {
        const ratio = imgProps.width / imgProps.height;
        if (ratio > maxImgW / maxImgH) {
          imgW = maxImgW;
          imgH = maxImgW / ratio;
        } else {
          imgH = maxImgH;
          imgW = maxImgH * ratio;
        }
      }
      const imgX = fronteX + (boxW - imgW) / 2;
      const imgY = currentY + 10 + (maxImgH - imgH) / 2;
      doc.addImage(fotoDoc.fronte, 'JPEG', imgX, imgY, imgW, imgH, undefined, 'FAST');
    } catch {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(220, 38, 38);
      doc.text('Errore caricamento immagine fronte', fronteX + boxW / 2, currentY + boxH / 2, { align: 'center' });
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Foto Fronte non acquisita (Opzionale)', fronteX + boxW / 2, currentY + boxH / 2, { align: 'center' });
  }

  // --- BOX RETRO ---
  const retroX = margin + boxW + 6;
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(retroX, currentY, boxW, boxH, 2, 2, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(retroX, currentY, boxW, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('RETRO (Dietro del Documento)', retroX + 4, currentY + 5.5);

  if (fotoDoc.retro) {
    try {
      const imgProps = (doc as any).getImageProperties ? (doc as any).getImageProperties(fotoDoc.retro) : { width: 16, height: 10 };
      const maxImgW = boxW - 6;
      const maxImgH = boxH - 14;
      let imgW = maxImgW;
      let imgH = maxImgH;
      if (imgProps && imgProps.width && imgProps.height) {
        const ratio = imgProps.width / imgProps.height;
        if (ratio > maxImgW / maxImgH) {
          imgW = maxImgW;
          imgH = maxImgW / ratio;
        } else {
          imgH = maxImgH;
          imgW = maxImgH * ratio;
        }
      }
      const imgX = retroX + (boxW - imgW) / 2;
      const imgY = currentY + 10 + (maxImgH - imgH) / 2;
      doc.addImage(fotoDoc.retro, 'JPEG', imgX, imgY, imgW, imgH, undefined, 'FAST');
    } catch {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(220, 38, 38);
      doc.text('Errore caricamento immagine retro', retroX + boxW / 2, currentY + boxH / 2, { align: 'center' });
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Foto Retro non acquisita (Opzionale)', retroX + boxW / 2, currentY + boxH / 2, { align: 'center' });
  }

  currentY += boxH + 6;

  // Box Dichiarazione / Privacy GDPR
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(29, 26, 96);
  doc.text('CONFORMITÀ E TRATTAMENTO DATI (REGOLAMENTO UE 2016/679 - GDPR):', margin + 4, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(71, 85, 105);
  const privacyTxt = "Le copie dei documenti di identità allegate al presente verbale vengono acquisite esclusivamente a fini identificativi dell'intestatario del microchip per la corretta gestione del soccorso o riconsegna dell'animale e sono conservate negli archivi telematici della Centrale Operativa Croce Oro Massa Carrara ODV nel rispetto delle misure di sicurezza previste dal Regolamento UE 2016/679 (GDPR). Vietata la diffusione o uso per scopi differenti.";
  doc.text(doc.splitTextToSize(privacyTxt, contentWidth - 8), margin + 4, currentY + 9);

  const dataAcq = fotoDoc.dataAcquisizione || data.data || formatDateTimeItaly();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Data e Ora di Acquisizione Telematica: ${dataAcq}`, margin + 4, currentY + 20);
  doc.text(`Operatore / Terminale: Mezzo ${data.mezzo || 'T4606'} (${data.volontarioNome || 'Volontario Croce Oro'})`, margin + 105, currentY + 20);

  // Footer di pagina
  const footerY = pageHeight - 16;
  doc.setFillColor(29, 26, 96);
  doc.rect(0, footerY, pageWidth, 16, 'F');

  const cInfoDocId = getDatiCartaIntestata();
  const socialStrDocId = formattaSocialCartaIntestata(cInfoDocId);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(253, 224, 71);
  doc.text(
    `${(cInfoDocId.denominazione || 'CROCE ORO MASSA CARRARA ODV').toUpperCase()} - Documento di Identità Intestatario Microchip`,
    pageWidth / 2,
    footerY + 5.5,
    { align: 'center' }
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(socialStrDocId ? 5.0 : 5.5);
  doc.setTextColor(226, 232, 240);
  doc.text(
    `Servizio ${data.codice || ''} - Sede Legale: ${cInfoDocId.sedeLegale} • Sede Massa: ${cInfoDocId.sedeMassa} • Sede Carrara: ${cInfoDocId.sedeCarrara} • Sede Pietrasanta: ${cInfoDocId.sedePietrasanta} • Tel: ${cInfoDocId.centraleTel}` +
      (socialStrDocId ? ` • ${socialStrDocId}` : ''),
    pageWidth / 2,
    footerY + 10.5,
    { align: 'center', maxWidth: pageWidth - 16 }
  );

  return doc;
}

/**
 * Scarica direttamente il PDF con il Documento di Identità dell'Intestatario Microchip.
 * Il nome file fa necessariamente riferimento al servizio effettuato.
 */
export function scaricaDocumentoIdentitaPDF(data: ReportDataPDF) {
  const doc = generaDocumentoIdentitaPDF(data);
  const codicePulito = (data.codice || 'SERVIZIO').replace(/[^a-zA-Z0-9_-]/g, '_');
  const nomeFile = `Documento_Identita_Servizio_${codicePulito}.pdf`;
  doc.save(nomeFile);
  return nomeFile;
}

/**
 * Genera il Registro Ufficiale Cartaceo (A4 Orizzontale / Landscape) di tutti i servizi e missioni.
 * Evidenzia con sfondo lilla chiaro (#f3e8ff) e bordo viola tutte le righe dei servizi con erogazione liberale / donazione.
 */
export function generaRegistroCartaceoPDF(servizi: ReportDataPDF[], infoFiltro?: string): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2); // 277mm

  let currentPage = 1;

  const drawHeaderAndFooter = (pageDoc: jsPDF, pageNum: number) => {
    // 1. Banner Superiore Istituzionale (Navy Blue)
    pageDoc.setFillColor(15, 23, 42); // slate-900
    pageDoc.rect(0, 0, pageWidth, 26, 'F');
    // Striscia Oro
    pageDoc.setFillColor(245, 158, 11); // amber-500
    pageDoc.rect(0, 26, pageWidth, 1.8, 'F');

    // Logo Croce Oro (20x20 mm)
    try {
      pageDoc.addImage(LOGO_IPOTESI_SEMITRASP_BASE64, 'PNG', margin, 3, 20, 20, undefined, 'FAST');
    } catch {
      // fallback silenzioso se il logo non fosse disponibile
    }

    const cInfoReg = getDatiCartaIntestata();
    const socialStrReg = formattaSocialCartaIntestata(cInfoReg);
    // Titoli
    pageDoc.setFont('helvetica', 'bold');
    pageDoc.setFontSize(13);
    pageDoc.setTextColor(255, 255, 255);
    pageDoc.text((cInfoReg.denominazione || 'CROCE ORO MASSA CARRARA ETS — ODV').toUpperCase(), margin + 24, 10);

    pageDoc.setFontSize(9.5);
    pageDoc.setTextColor(253, 224, 71); // amber-300
    pageDoc.text('REGISTRO GENERALE DEI SERVIZI & DELLE MISSIONI OPERATIVE DI SOCCORSO', margin + 24, 16);

    pageDoc.setFont('helvetica', 'normal');
    pageDoc.setFontSize(7.2);
    pageDoc.setTextColor(203, 213, 225);
    const now = new Date();
    const dataStampa = `${now.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' })} ore ${now.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })}`;
    const filtroTesto = infoFiltro ? ` • Filtro attivo: ${infoFiltro}` : '';
    pageDoc.text(`Documento Ufficiale Registro Operativo • Stampato il ${dataStampa}${filtroTesto}`, margin + 24, 21);

    // Badge Conteggio Destra
    pageDoc.setFillColor(30, 41, 59);
    pageDoc.roundedRect(pageWidth - margin - 52, 5.5, 52, 15, 1.5, 1.5, 'F');
    pageDoc.setFont('helvetica', 'bold');
    pageDoc.setFontSize(7);
    pageDoc.setTextColor(148, 163, 184);
    pageDoc.text('TOTALE REGISTRATI', pageWidth - margin - 26, 10.5, { align: 'center' });
    pageDoc.setFontSize(10);
    pageDoc.setTextColor(255, 255, 255);
    pageDoc.text(`${servizi.length} Servizi`, pageWidth - margin - 26, 16.5, { align: 'center' });

    // Footer di Pagina
    const footerY = pageHeight - 11;
    pageDoc.setFillColor(15, 23, 42);
    pageDoc.rect(0, footerY, pageWidth, 11, 'F');

    pageDoc.setFont('helvetica', 'normal');
    pageDoc.setFontSize(socialStrReg ? 5.6 : 6.2);
    pageDoc.setTextColor(203, 213, 225);
    pageDoc.text(
      `${cInfoReg.denominazione} • Sede Legale: ${cInfoReg.sedeLegale} • Sede Massa: ${cInfoReg.sedeMassa} • Sede Carrara: ${cInfoReg.sedeCarrara} • Sede Pietrasanta: ${cInfoReg.sedePietrasanta} • Tel: ${cInfoReg.centraleTel} • CF: ${cInfoReg.codiceFiscale}` +
        (socialStrReg ? ` • ${socialStrReg}` : ''),
      margin,
      footerY + 6.5,
      { maxWidth: contentWidth - 22 }
    );

    pageDoc.setFont('helvetica', 'bold');
    pageDoc.setTextColor(253, 224, 71);
    pageDoc.text(
      `Pagina ${pageNum}`,
      pageWidth - margin,
      footerY + 6.5,
      { align: 'right' }
    );
  };

  drawHeaderAndFooter(doc, currentPage);

  // Colonne Tabella:
  // 1. Data & Ora: 26mm
  // 2. Codice: 24mm
  // 3. Mezzo: 20mm
  // 4. Ambito / Specie: 42mm
  // 5. Indirizzo Intervento & Destinazione: 78mm
  // 6. Equipaggio / Volontario: 43mm
  // 7. Donazione Ricevuta: 44mm
  // Totale: 26 + 24 + 20 + 42 + 78 + 43 + 44 = 277mm
  const colWidths = [26, 24, 20, 42, 78, 43, 44];
  const colX = [
    margin,
    margin + 26,
    margin + 26 + 24,
    margin + 26 + 24 + 20,
    margin + 26 + 24 + 20 + 42,
    margin + 26 + 24 + 20 + 42 + 78,
    margin + 26 + 24 + 20 + 42 + 78 + 43
  ];

  const drawTableHead = (yHead: number) => {
    doc.setFillColor(30, 41, 59); // slate-800
    doc.rect(margin, yHead, contentWidth, 7, 'F');
    doc.setDrawColor(71, 85, 105);
    doc.setLineWidth(0.2);
    doc.rect(margin, yHead, contentWidth, 7, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(255, 255, 255);

    doc.text('DATA & ORARIO', colX[0] + 2, yHead + 4.8);
    doc.text('CODICE', colX[1] + 2, yHead + 4.8);
    doc.text('MEZZO', colX[2] + 2, yHead + 4.8);
    doc.text('AMBITO / SPECIE', colX[3] + 2, yHead + 4.8);
    doc.text('INDIRIZZO & DESTINAZIONE', colX[4] + 2, yHead + 4.8);
    doc.text('EQUIPAGGIO / AUTISTA', colX[5] + 2, yHead + 4.8);
    doc.text('DONAZIONE (LILLA)', colX[6] + 2, yHead + 4.8);
  };

  let currentY = 32;
  drawTableHead(currentY);
  currentY += 7;

  servizi.forEach((item, index) => {
    const destInfo = item.datiDestinazione;
    const haDonazione = Boolean(
      destInfo?.donazione?.ricevuta ||
      (destInfo?.donazione?.somma && destInfo.donazione.somma > 0) ||
      item.testoCompleto?.includes('DONAZIONE RICEVUTA:')
    );
    const sommaDonata = destInfo?.donazione?.somma || 0;
    const rawMetodo = destInfo?.donazione?.metodo;
    const metodoDonazione = rawMetodo === 'pos' ? 'POS' : rawMetodo === 'contanti' ? 'Contanti' : (rawMetodo || 'Contanti');

    // Testo per le colonne
    const dataOraStr = formattaDataEOraCompleta(item.data, item.testoCompleto);
    const codiceStr = item.codice || `N° ${index + 1}`;
    const mezzoStr = item.mezzo || 'N/D';
    const isVetItem = isServizioVeterinario(item);
    const ambitoStr = item.ambito || (isVetItem && item.tipoAnimale ? `Animale: ${item.tipoAnimale}` : 'Servizio Operativo');
    const luogoStr = `${item.indirizzoIntervento || 'N/D'} -> ${item.destinazione || 'Sede'}`;
    const equipaggioStr = item.volontarioNome
      ? `${item.volontarioNome} (${item.qualificaTurno || 'Autista'})`
      : 'Personale in turno';
    const donazioneStr = haDonazione
      ? `€ ${sommaDonata.toFixed(2)} (${metodoDonazione})`
      : 'Nessuna (€ 0.00)';

    // Calcolo righe wrapped per determinare l'altezza della riga
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    const splitLuogo = doc.splitTextToSize(sanitizePdfText(luogoStr), colWidths[4] - 4);
    const maxLines = Math.max(1, splitLuogo.length, 1);
    const rowHeight = Math.max(7.5, maxLines * 3.8 + 2.5);

    // Controllo fine pagina
    if (currentY + rowHeight > pageHeight - 16) {
      doc.addPage('a4', 'landscape');
      currentPage += 1;
      drawHeaderAndFooter(doc, currentPage);
      currentY = 32;
      drawTableHead(currentY);
      currentY += 7;
    }

    // Sfondo della riga: LILLA CHIARO per donazione, altrimenti alternato bianco / grigio tenue
    if (haDonazione) {
      doc.setFillColor(243, 232, 255); // #f3e8ff (lilla chiaro donazione)
      doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      // Bordo laterale lilla solido per risalto
      doc.setFillColor(147, 51, 234); // #9333ea
      doc.rect(margin, currentY, 2.5, rowHeight, 'F');
      doc.setDrawColor(216, 180, 254); // border-purple-300
    } else {
      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      } else {
        doc.setFillColor(255, 255, 255);
        doc.rect(margin, currentY, contentWidth, rowHeight, 'F');
      }
      doc.setDrawColor(226, 232, 240); // slate-200
    }

    doc.setLineWidth(0.15);
    doc.rect(margin, currentY, contentWidth, rowHeight, 'S');

    // Testi Celle
    const textY = currentY + 4.5;

    // 1. Data e Ora
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(30, 41, 59);
    doc.text(sanitizePdfText(dataOraStr), colX[0] + 3.5, textY, { maxWidth: colWidths[0] - 5 });

    // 2. Codice
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(sanitizePdfText(codiceStr), colX[1] + 2, textY, { maxWidth: colWidths[1] - 4 });

    // 3. Mezzo
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9); // amber-700
    doc.text(sanitizePdfText(mezzoStr), colX[2] + 2, textY, { maxWidth: colWidths[2] - 4 });

    // 4. Ambito / Specie
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(sanitizePdfText(ambitoStr), colX[3] + 2, textY, { maxWidth: colWidths[3] - 4 });

    // 5. Indirizzo & Destinazione
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(splitLuogo.slice(0, 3), colX[4] + 2, currentY + 3.8);

    // 6. Equipaggio
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(sanitizePdfText(equipaggioStr), colX[5] + 2, textY, { maxWidth: colWidths[5] - 4 });

    // 7. Donazione Ricevuta
    if (haDonazione) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(107, 33, 168);
      doc.text(sanitizeWinAnsi(`* ${donazioneStr}`), colX[6] + 2, textY, { maxWidth: colWidths[6] - 4 });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text('- Nessuna', colX[6] + 2, textY);
    }

    currentY += rowHeight;
  });

  return doc;
}

/**
 * Genera il Registro Cartaceo in PDF, avvia la stampa diretta del documento e ne effettua il download salvandolo su file.
 */
export function stampaRegistroCartaceoPDF(servizi: ReportDataPDF[], infoFiltro?: string): string {
  const doc = generaRegistroCartaceoPDF(servizi, infoFiltro);
  const dataIso = formatISODateItaly();
  const nomeFile = `Registro_Cartaceo_Servizi_Croce_Oro_${dataIso}.pdf`;

  // 1. Esegui sempre il salvataggio / download del file PDF
  doc.save(nomeFile);

  // 2. Avvia la stampa del documento via Blob URL
  try {
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.src = blobUrl;
    document.body.appendChild(printFrame);

    printFrame.onload = () => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (err) {
        console.warn('Stampa automatica iframe non disponibile, salvataggio PDF completato:', err);
      }
    };
  } catch (err) {
    console.warn('Impossibile aprire iframe di stampa:', err);
  }

  return nomeFile;
}

export { generaSchedaVestiarioPDF, scaricaSchedaVestiarioPDF } from './pdfSchedaVestiario';
