import jsPDF from 'jspdf';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { CorsoFormazione, ModelloAttestatoCategoria, PartecipanteCorso, PosizioneCampoPdfPrestampato, TipologiaCorso } from '../types/adminTypes';
import { getDatiCartaIntestata } from './cartaIntestataStore';
import { formatDateItaly, formatISODateItaly, getCurrentYearItaly, getItalianDateParts } from './italianTime';
import { LOGO_IPOTESI_SEMITRASP_BASE64 as LOGO_CROCE_ORO_BASE64 } from '../assets/logoBase64';
import { TEMPLATE_ATTESTATO_PSV_BASE64 } from '../assets/templateAttestatoPSVBase64';
import { FIRMA_PRESIDENTE_SIMONINI_BASE64 } from '../assets/firmaPresidenteBase64';
import {
  caricaPdfPrestampatoBytes,
  formattaMatricolaDaModello,
  getModelloPerTipologia,
  getProssimoNumeroEffettivoCategoria
} from './modelliAttestatiStore';

export interface OpzioniAttestato {
  presidenteNome?: string;
  presidenteFirmaBase64?: string;
  dataRilascio?: string;
  luogoRilascio?: string;
  downloadImmediato?: boolean;
  modelloPrestampato?: ModelloAttestatoCategoria;
  pdfPrestampatoBytes?: Uint8Array;
  apiBaseUrl?: string;
}

/**
 * Converte una stringa base64 in Uint8Array sia in ambiente Browser che in Node.js
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const cleanB64 = base64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  if (typeof atob === 'function') {
    const binaryString = atob(cleanB64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } else if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(cleanB64, 'base64'));
  }
  throw new Error('Ambiente di decodifica Base64 non disponibile');
}

/**
 * Formatta una data ISO (YYYY-MM-DD) nel formato italiano standard DD/MM/YYYY
 */
export function formattaDataSlash(dStr?: string): string {
  if (!dStr) {
    return formatDateItaly();
  }
  if (dStr.includes('/')) return dStr;
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  }
  return dStr;
}

/**
 * Determina la città della sezione territoriale dove sono state svolte almeno più del 50% delle lezioni.
 * Se nessuna città ha > 50%, viene scelta la città con il maggior numero di lezioni,
 * oppure la città della sede principale del corso (default: Carrara).
 */
export function determinaCittaPrevalenteCorso(corso: CorsoFormazione): string {
  const lezioni = corso.lezioni || [];
  if (lezioni.length === 0) {
    const sede = (corso.sedeCorso || '').toLowerCase();
    if (sede.includes('massa') && !sede.includes('massa carrara')) return 'Massa';
    if (sede.includes('montignoso')) return 'Montignoso';
    return 'Carrara';
  }

  const conteggioCitta: Record<string, number> = {};

  lezioni.forEach((l) => {
    const testo = `${l.sedeNome || ''} ${l.indirizzoCompleto || ''}`.toLowerCase();
    let citta = 'Carrara';
    if (testo.includes('massa') && !testo.includes('massa carrara')) {
      citta = 'Massa';
    } else if (testo.includes('carrara')) {
      citta = 'Carrara';
    } else if (testo.includes('montignoso')) {
      citta = 'Montignoso';
    } else if (testo.includes('ronchi') || testo.includes('jare')) {
      citta = 'Massa';
    } else if (testo.includes('fossone') || testo.includes('avenza') || testo.includes('marina di carrara')) {
      citta = 'Carrara';
    }
    conteggioCitta[citta] = (conteggioCitta[citta] || 0) + 1;
  });

  const soglia50Percento = lezioni.length / 2;
  // Cerca la città con STRETTAMENTE PIÙ del 50% delle lezioni
  for (const [citta, count] of Object.entries(conteggioCitta)) {
    if (count > soglia50Percento) {
      return citta;
    }
  }

  // Se nessuna supera il 50%, prendi la città con il massimo numero di lezioni
  let maxCount = -1;
  let cittaMax = 'Carrara';
  for (const [citta, count] of Object.entries(conteggioCitta)) {
    if (count > maxCount) {
      maxCount = count;
      cittaMax = citta;
    }
  }

  return cittaMax;
}

/**
 * Formatta l'intervallo di date in formato discorsivo italiano:
 * es. "dal 05 al 19 Maggio 2025" o "dal 25 Aprile al 10 Maggio 2025"
 */
export function formattaIntervalloDateItaliano(dataInizioStr?: string, dataFineStr?: string): string {
  const mesi = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  if (!dataInizioStr && !dataFineStr) {
    return 'dal 05 al 19 Maggio 2025';
  }

  const parseDateParts = (raw?: string): { day: number; monthIdx: number; year: number } | null => {
    if (!raw) return null;
    const trimmed = raw.trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return {
        year: parseInt(isoMatch[1], 10),
        monthIdx: parseInt(isoMatch[2], 10) - 1,
        day: parseInt(isoMatch[3], 10)
      };
    }
    const itMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (itMatch) {
      return {
        day: parseInt(itMatch[1], 10),
        monthIdx: parseInt(itMatch[2], 10) - 1,
        year: parseInt(itMatch[3], 10)
      };
    }
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return null;
    const p = getItalianDateParts(d);
    return { day: p.day, monthIdx: p.month - 1, year: p.year };
  };

  const pInizio = parseDateParts(dataInizioStr);
  const pFine = parseDateParts(dataFineStr);

  if (!pInizio) {
    return `dal ${dataInizioStr || ''} al ${dataFineStr || ''}`;
  }

  const g1 = String(pInizio.day).padStart(2, '0');
  const m1 = pInizio.monthIdx;
  const a1 = pInizio.year;

  if (!pFine) {
    return `il ${g1} ${mesi[m1] || ''} ${a1}`;
  }

  const g2 = String(pFine.day).padStart(2, '0');
  const m2 = pFine.monthIdx;
  const a2 = pFine.year;

  if (a1 === a2 && m1 === m2) {
    return `dal ${g1} al ${g2} ${mesi[m2] || ''} ${a2}`;
  } else if (a1 === a2) {
    return `dal ${g1} ${mesi[m1] || ''} al ${g2} ${mesi[m2] || ''} ${a2}`;
  } else {
    return `dal ${g1} ${mesi[m1] || ''} ${a1} al ${g2} ${mesi[m2] || ''} ${a2}`;
  }
}

/**
 * Recupera in automatico la firma dell'account del Presidente dell'Associazione.
 * 1. Opzione passata esplicitamente
 * 2. Cerca nel database volontari salvato in localStorage
 * 3. Fallback: firma autografa ufficiale di Claudio Simonini
 */
export function recuperaFirmaPresidente(opzioni?: OpzioniAttestato): string {
  if (opzioni?.presidenteFirmaBase64 && opzioni.presidenteFirmaBase64.length > 50) {
    return opzioni.presidenteFirmaBase64;
  }

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('CROCE_ORO_VOLONTARI_DB');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const pres = parsed.find(
            (v: any) =>
              (v.caricaConsiglioDirettivo && v.caricaConsiglioDirettivo.toLowerCase().includes('presidente')) ||
              (v.qualifica && v.qualifica.toLowerCase().includes('presidente')) ||
              (v.nome && v.nome.toLowerCase().includes('claudio') && v.cognome && v.cognome.toLowerCase().includes('simonini'))
          );
          if (pres?.firmaBase64 && pres.firmaBase64.length > 50) {
            return pres.firmaBase64;
          }
        }
      }
    } catch {}
  }

  return FIRMA_PRESIDENTE_SIMONINI_BASE64;
}

/**
 * Genera il numero progressivo ufficiale per l'attestato:
 * - Per "Seminario PSV": Acronimo GEV con numero di matricola che INIZIA DA 099 (es. GEV-099, GEV-100, ecc.)
 * - Per "Seminario Autisti": Acronimo AUT-PART (es. AUT-PART-001)
 * - Per altri corsi: Protocollo ATT-BLSD / ATT-PC
 */
export function generaNumeroAttestato(tipologia: TipologiaCorso, tuttiCorsi: CorsoFormazione[] = []): string {
  const modello = getModelloPerTipologia(tipologia);
  const prossimoNum = getProssimoNumeroEffettivoCategoria(modello, tuttiCorsi);
  return formattaMatricolaDaModello(modello, prossimoNum);
}

function hexToPdfRgb(hex?: string) {
  const clean = String(hex || '#000000').replace('#', '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return rgb(r, g, b);
  }
  return rgb(0, 0, 0);
}

function pulisciTestoWinAnsi(str: string): string {
  if (!str) return '';
  return str
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\xFF]/g, '');
}

/**
 * Compila un PDF prestampato caricato per la categoria modificando SOLAMENTE:
 * 1) Nome e Cognome del corsista che ha frequentato
 * 2) Data e Luogo di rilascio
 * 3) Numero di matricola progressivo
 * Tutto il resto del PDF prestampato resta intatto al 100%.
 */
export async function compilaPdfPrestampatoCategoria(
  pdfBytes: Uint8Array,
  modello: ModelloAttestatoCategoria,
  dati: {
    nomeCognome: string;
    luogoRilascio: string;
    dataRilascio: string;
    matricola: string;
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  if (!pages || pages.length === 0) {
    throw new Error('Il file PDF prestampato non contiene pagine.');
  }
  const page = pages[0];
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const disegnaCampo = (valoreRaw: string, cfg: PosizioneCampoPdfPrestampato) => {
    const prefisso = cfg.prefisso || '';
    let testo = pulisciTestoWinAnsi(`${prefisso}${valoreRaw}`.trim());
    if (!testo) return;
    if (cfg.uppercase) {
      testo = testo.toUpperCase();
    }

    const font = cfg.bold ? fontBold : fontRegular;
    let size = Math.max(7, Math.min(48, Number(cfg.fontSize) || 14));
    const maxWidth = width * 0.9;
    let textWidth = font.widthOfTextAtSize(testo, size);
    while (textWidth > maxWidth && size > 8) {
      size -= 0.5;
      textWidth = font.widthOfTextAtSize(testo, size);
    }

    const xAnchor = width * (Math.max(0, Math.min(100, Number(cfg.xPercent) || 50)) / 100);
    const yFromTop = Math.max(0, Math.min(100, Number(cfg.yPercent) || 50)) / 100;
    const yPdf = height * (1 - yFromTop) - size * 0.35;

    let xPdf = xAnchor;
    if (cfg.align === 'center') {
      xPdf = xAnchor - textWidth / 2;
    } else if (cfg.align === 'right') {
      xPdf = xAnchor - textWidth;
    }

    // Assicura che il testo non esca dai bordi pagina
    xPdf = Math.max(12, Math.min(width - textWidth - 12, xPdf));
    const ySafe = Math.max(10, Math.min(height - size - 6, yPdf));

    if (cfg.sfondoBianco) {
      const padX = 6;
      const padY = 4;
      page.drawRectangle({
        x: Math.max(4, xPdf - padX),
        y: Math.max(4, ySafe - padY),
        width: Math.min(width - 8, textWidth + padX * 2),
        height: size + padY * 2,
        color: rgb(1, 1, 1)
      });
    }

    page.drawText(testo, {
      x: xPdf,
      y: ySafe,
      size,
      font,
      color: hexToPdfRgb(cfg.colorHex)
    });
  };

  const dataFormat = formattaDataSlash(dati.dataRilascio);
  const luogoPulito = (dati.luogoRilascio || '').trim();
  const dataLuogoText = luogoPulito
    ? modello.formatoDataLuogo === 'virgola'
      ? `${luogoPulito}, ${dataFormat}`
      : `${luogoPulito}, lì ${dataFormat}`
    : dataFormat;

  disegnaCampo(dati.nomeCognome || 'PARTECIPANTE', modello.campoNomeCognome);
  disegnaCampo(dataLuogoText, modello.campoDataLuogo);
  disegnaCampo(dati.matricola || '', modello.campoMatricola);

  return await pdfDoc.save();
}

/**
 * Scarica l'attestato sfruttando il motore server (ultraveloce ~70ms, zero carico sul dispositivo client).
 * Su Android e desktop avvia il download nativo via HTTP GET senza bloccare il browser né il device.
 * Se la chiamata server non fosse disponibile, effettua il fallback locale immediato.
 */
export async function avviaDownloadAttestatoUniversale(
  corso: CorsoFormazione,
  partecipante: PartecipanteCorso,
  opzioni?: OpzioniAttestato
): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const modelloCat = opzioni?.modelloPrestampato || getModelloPerTipologia(corso.tipologia);
  const opzioniComplete: OpzioniAttestato = {
    ...(opzioni || {}),
    modelloPrestampato: modelloCat?.attivo && modelloCat?.hasPdfFile ? modelloCat : undefined
  };

  try {
    const base = opzioni?.apiBaseUrl ? opzioni.apiBaseUrl.replace(/\/$/, '') : '';
    const res = await fetch(`${base}/api/prepara-attestato-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        corso,
        partecipante,
        opzioni: {
          ...opzioniComplete,
          pdfPrestampatoBytes: undefined
        }
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.downloadUrl) {
        const a = document.createElement('a');
        a.href = `${base}${data.downloadUrl}`;
        a.download = data.filename || 'Attestato.pdf';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try {
            if (document.body.contains(a)) document.body.removeChild(a);
          } catch {}
        }, 5000);
        return;
      }
    }
  } catch (errServer) {
    console.warn('Preparazione server non disponibile, passo al motore locale:', errServer);
  }

  // Fallback client-side se il server non risponde
  await scaricaAttestatoPDF(corso, partecipante, opzioniComplete);
}

/**
 * Converte un Blob in stringa base64 (DataURL)
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Esegue il download sicuro tramite form POST inviato al server /api/download-pdf.
 * Il server risponde con Content-Disposition: attachment, costringendo Android Chrome
 * ad avviare il Download Manager nativo di Android salvando il file in /Download.
 */
export function downloadTramiteFormServer(base64Data: string, nomeFile: string): boolean {
  try {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/api/download-pdf';
    form.style.display = 'none';

    // Se siamo su Android, target="_self" assicura che il Download Manager
    // intercetti la risposta attachment senza aprire schermate vuote
    form.target = '_self';

    const inputB64 = document.createElement('input');
    inputB64.type = 'hidden';
    inputB64.name = 'pdfBase64';
    inputB64.value = base64Data;
    form.appendChild(inputB64);

    const inputName = document.createElement('input');
    inputName.type = 'hidden';
    inputName.name = 'filename';
    inputName.value = nomeFile;
    form.appendChild(inputName);

    document.body.appendChild(form);
    form.submit();

    setTimeout(() => {
      try {
        if (document.body.contains(form)) {
          document.body.removeChild(form);
        }
      } catch {}
    }, 10000);
    return true;
  } catch (err) {
    console.warn('Invio form server download non riuscito:', err);
    return false;
  }
}

/**
 * Esegue il download sicuro e universale del file PDF sia su desktop che su dispositivi mobili (iOS / Android),
 * anche all'interno di iframe, PWA o webview, senza bloccare il browser né fallire su Android.
 */
export async function eseguiDownloadSicuroPDF(data: Uint8Array | Blob, nomeFile: string): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  try {
    const blob = data instanceof Blob ? data : new Blob([data as any], { type: 'application/pdf' });
    const userAgent = window.navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isAndroid = /Android/i.test(userAgent);

    // 1. Supporto legacy IE/Edge
    if (typeof (window.navigator as any).msSaveOrOpenBlob === 'function') {
      (window.navigator as any).msSaveOrOpenBlob(blob, nomeFile);
      return;
    }

    // 2. DISPOSITIVI ANDROID (Smartphone & Tablet Android)
    // Chrome su Android blocca programmaticamente i click su <a href="blob:...">.
    // L'unico modo 100% universale è l'invio HTTP con Content-Disposition: attachment
    // oppure l'API di sistema WebShare con File object.
    if (isAndroid) {
      try {
        const base64Data = await blobToBase64(blob);
        const inviato = downloadTramiteFormServer(base64Data, nomeFile);
        if (inviato) {
          return;
        }
      } catch (errAnd) {
        console.warn('Errore form server Android, tento WebShare o URL diretto:', errAnd);
      }

      // Se il form fallisce, tenta WebShare nativo di Android
      if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
        try {
          const file = new File([blob], nomeFile, { type: 'application/pdf' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: nomeFile,
              text: `Attestato di partecipazione: ${nomeFile}`
            });
            return;
          }
        } catch (errShare: any) {
          if (errShare.name === 'AbortError') return;
        }
      }

      // Fallback finale Android: apertura URL
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }

    // 3. DISPOSITIVI APPLE iOS (Safari mobile)
    if (isIOS) {
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank');
      if (!win) {
        const base64Data = await blobToBase64(blob);
        window.location.href = base64Data;
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      return;
    }

    // 4. DESKTOP (Chrome, Edge, Firefox, Safari Mac)
    // Prova prima tramite form server garantito per bypassare eventuali restrizioni sandbox iframe
    try {
      const base64Data = await blobToBase64(blob);
      const ok = downloadTramiteFormServer(base64Data, nomeFile);
      if (ok) return;
    } catch {}

    // Fallback classico browser desktop
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = nomeFile;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);

    try {
      link.click();
    } catch (errClick) {
      console.warn('Click download automatico bloccato, apro nuova scheda:', errClick);
      window.open(blobUrl, '_blank');
    }

    setTimeout(() => {
      try {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(blobUrl);
      } catch {}
    }, 15000);
  } catch (err) {
    console.error('Errore durante download PDF:', err);
  }
}

/**
 * Permette la condivisione / salvataggio diretto dell'attestato PDF tramite l'API WebShare nativa
 * di Android e iOS (salvataggio su Google Drive, invio su WhatsApp, Salva su File).
 */
export async function condividiAttestatoPDF(
  corso: CorsoFormazione,
  partecipante: PartecipanteCorso,
  opzioni?: OpzioniAttestato
): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) {
    return false;
  }
  try {
    const bytes = await scaricaAttestatoPDF(corso, partecipante, { ...(opzioni || {}), downloadImmediato: false });
    const blob = new Blob([bytes as any], { type: 'application/pdf' });
    const numAtt = (partecipante.numeroAttestato || generaNumeroAttestato(corso.tipologia)).trim();
    const matricolaClean = numAtt.replace(/[^a-zA-Z0-9_-]/g, '_');
    const nomeClean = (partecipante.volontarioNome || 'Partecipante').replace(/[^a-zA-Z0-9_-]/g, '_');
    const nomeFile = `Attestato_${matricolaClean}_${nomeClean}.pdf`;

    const file = new File([blob], nomeFile, { type: 'application/pdf' });
    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      return false;
    }
    await navigator.share({
      files: [file],
      title: `Attestato: ${nomeFile}`,
      text: `Attestato Croce Oro per ${partecipante.volontarioNome || 'partecipante'}`
    });
    return true;
  } catch (err: any) {
    if (err.name === 'AbortError') return true;
    console.warn('Errore condividiAttestatoPDF:', err);
    return false;
  }
}

/**
 * Genera l'Attestato Ufficiale per tutti i corsi formativi e seminari partendo ESATTAMENTE dal PDF della matrice regionale A4.
 * Tutti gli attestati (Seminario PSV, Formazione PSV, Seminario Autisti, BLSD, Protezione Civile Corso 0, Protezione Civile Corso Base)
 * adottano l'identico layout elegante ufficiale (cornice istituzionale, emblemi, intestazioni, firme).
 * Dinamicamente vengono personalizzati:
 * 1. Nome e cognome della persona che ha effettuato il corso / seminario
 * 2. Dicitura del Corso: Titolo e Sottotitolo (es. "TUTELA, SOCCORSO E BENESSERE ANIMALE" per PSV, oppure il titolo specifico del corso)
 * 3. Frase introduttiva: "Ha frequentato con assiduità il Seminario" o "Ha frequentato con assiduità il Corso Formativo"
 * 4. Frase: "Organizzato da Croce Oro Massa Carrara OdV presso la sede operativa di [città > 50% lezioni] dal [inizio] al [fine compreso anno]."
 * 5. Matricola ufficiale (GEV da 099 per PSV, AUT-PART per Autisti, ATT per gli altri percorsi)
 * 6. Data di stampa dell'attestato: "[città], lì DD/MM/YYYY"
 * 7. Firma automatica dell'account del Presidente dell'Associazione.
 */
export async function scaricaAttestatoPSVUfficialePDF(
  corso: CorsoFormazione,
  partecipante: PartecipanteCorso,
  opzioni?: OpzioniAttestato
): Promise<Uint8Array> {
  // Normalizzazione caratteri speciali per evitare errori di encoding
  const pulisciCaratteri = (str: string) => {
    if (!str) return '';
    return str
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...');
  };

  try {
    const templateBytes = base64ToUint8Array(TEMPLATE_ATTESTATO_PSV_BASE64);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const page = pdfDoc.getPages()[0];
    const { width } = page.getSize();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // ---------------------------------------------------------------------------
    // 1. NOME E COGNOME DEL PARTECIPANTE
    // ---------------------------------------------------------------------------
    page.drawRectangle({
      x: 35,
      y: 600,
      width: width - 70,
      height: 52,
      color: rgb(1, 1, 1),
    });

    const nomeVolontario = pulisciCaratteri((partecipante.volontarioNome || 'PARTECIPANTE').toUpperCase().trim());
    const nameFontSize = nomeVolontario.length > 25 ? 22 : 26;
    const nameWidth = fontBold.widthOfTextAtSize(nomeVolontario, nameFontSize);

    page.drawText(nomeVolontario, {
      x: (width - nameWidth) / 2,
      y: 618,
      size: nameFontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    // Riga continua di sottolineatura conforme al template originale
    page.drawLine({
      start: { x: 38, y: 604 },
      end: { x: width - 38, y: 604 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });

    // ---------------------------------------------------------------------------
    // 2. DICITURA DEL CORSO (TITOLO, SOTTOTITOLO E INTRODUZIONE)
    // ---------------------------------------------------------------------------
    const isSeminarioPSV = corso.tipologia === 'Seminario PSV';

    if (!isSeminarioPSV) {
      // 2A. Frase di introduzione: "Ha frequentato con assiduità il Seminario" o "Ha frequentato con assiduità il Corso Formativo"
      page.drawRectangle({
        x: 40,
        y: 556,
        width: width - 80,
        height: 22,
        color: rgb(1, 1, 1),
      });

      const isSeminario = corso.tipologia.toLowerCase().includes('seminario');
      const introText = isSeminario
        ? 'Ha frequentato con assiduità il Seminario'
        : 'Ha frequentato con assiduità il Corso Formativo';
      const introSize = 19;
      const introWidth = fontRegular.widthOfTextAtSize(introText, introSize);
      page.drawText(introText, {
        x: (width - introWidth) / 2,
        y: 565,
        size: introSize,
        font: fontRegular,
        color: rgb(0, 0, 0),
      });

      // 2B. Titolo e Sottotitolo del Corso
      page.drawRectangle({
        x: 20,
        y: 445,
        width: width - 40,
        height: 102,
        color: rgb(1, 1, 1),
      });

      let titolo = (corso.titolo || '').trim();
      if (!titolo) {
        if (corso.tipologia === 'Formazione PSV') {
          titolo = 'FORMAZIONE PRIMO SOCCORSO VETERINARIO (PSV)';
        } else if (corso.tipologia === 'Seminario Autisti') {
          titolo = 'SEMINARIO AUTISTI SOCCORRITORI MEZZI EMERGENZA';
        } else if (corso.tipologia === 'BLSD') {
          titolo = 'CORSO BLSD - SUPPORTO VITALE DI BASE';
        } else if (corso.tipologia === 'Protezione Civile Corso 0') {
          titolo = 'PROTEZIONE CIVILE - CORSO 0';
        } else if (corso.tipologia === 'Protezione Civile Corso Base') {
          titolo = 'PROTEZIONE CIVILE - CORSO BASE';
        } else {
          titolo = corso.tipologia || 'CORSO DI FORMAZIONE';
        }
      }
      titolo = pulisciCaratteri(titolo.toUpperCase());

      let sottotitolo = (corso.sottotitolo || '').trim();
      if (!sottotitolo) {
        if (corso.tipologia === 'Formazione PSV') {
          sottotitolo = '"Procedure Operative, Soccorso e Cura Animali d\'Affezione"';
        } else if (corso.tipologia === 'Seminario Autisti') {
          sottotitolo = '"Guida Sicura, Manovre in Emergenza e Mezzi Sanitari 118"';
        } else if (corso.tipologia === 'BLSD') {
          sottotitolo = '"Rianimazione Cardio-Polmonare Precoce e Uso DAE"';
        } else if (corso.tipologia === 'Protezione Civile Corso 0') {
          sottotitolo = '"Introduzione al Sistema Nazionale di Protezione Civile"';
        } else if (corso.tipologia === 'Protezione Civile Corso Base') {
          sottotitolo = '"Formazione Operativa di Base per Volontari di Protezione Civile"';
        }
      }
      sottotitolo = pulisciCaratteri(sottotitolo);

      if (sottotitolo) {
        const titleFontSize = titolo.length > 44 ? 16 : titolo.length > 30 ? 18 : 22;
        const titleWidth = fontBold.widthOfTextAtSize(titolo, titleFontSize);
        page.drawText(titolo, {
          x: (width - titleWidth) / 2,
          y: 512,
          size: titleFontSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });

        const subFontSize = sottotitolo.length > 55 ? 13 : sottotitolo.length > 38 ? 15 : 17;
        const subWidth = fontRegular.widthOfTextAtSize(sottotitolo, subFontSize);
        page.drawText(sottotitolo, {
          x: (width - subWidth) / 2,
          y: 470,
          size: subFontSize,
          font: fontRegular,
          color: rgb(0, 0, 0),
        });
      } else {
        const titleFontSize = titolo.length > 38 ? 18 : 23;
        const titleWidth = fontBold.widthOfTextAtSize(titolo, titleFontSize);
        page.drawText(titolo, {
          x: (width - titleWidth) / 2,
          y: 495,
          size: titleFontSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
      }
    }

    // ---------------------------------------------------------------------------
    // 3. FRASE ORGANIZZAZIONE, SEDE (CITTÀ >50% LEZIONI) E DATE
    // ---------------------------------------------------------------------------
    const cittaPrevalente = pulisciCaratteri(determinaCittaPrevalenteCorso(corso));
    const testoDate = pulisciCaratteri(formattaIntervalloDateItaliano(corso.dataInizio, corso.dataFine));

    page.drawRectangle({
      x: 28,
      y: 236,
      width: width - 56,
      height: 62,
      color: rgb(1, 1, 1),
    });

    const cInfoCarta = getDatiCartaIntestata();
    const denomClean = pulisciCaratteri(cInfoCarta.denominazione || 'Croce Oro Massa Carrara OdV');
    const line1 = `Organizzato da ${denomClean} presso`;
    const line1Size = line1.length > 52 ? 18 : 21;
    const line1Width = fontBold.widthOfTextAtSize(line1, line1Size);
    page.drawText(line1, {
      x: (width - line1Width) / 2,
      y: 275,
      size: line1Size,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    const line2 = `la sede operativa di ${cittaPrevalente} ${testoDate}.`;
    const line2Size = line2.length > 58 ? 18 : 20;
    const line2Width = fontBold.widthOfTextAtSize(line2, line2Size);
    page.drawText(line2, {
      x: (width - line2Width) / 2,
      y: 247,
      size: line2Size,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    // ---------------------------------------------------------------------------
    // 4. MATRICOLA ATTESTATO
    // ---------------------------------------------------------------------------
    page.drawRectangle({
      x: 100,
      y: 202,
      width: width - 200,
      height: 24,
      color: rgb(1, 1, 1),
    });

    let numAtt: string;
    if (corso.tipologia === 'Seminario PSV') {
      numAtt = (partecipante.numeroAttestato || 'GEV 099').trim();
      if (!numAtt.toUpperCase().startsWith('GEV')) {
        numAtt = `GEV ${numAtt}`;
      }
      numAtt = numAtt.replace(/GEV[-_ ]+/i, 'GEV ');
    } else {
      numAtt = (partecipante.numeroAttestato || generaNumeroAttestato(corso.tipologia)).trim();
    }

    const matricolaText = `MATRICOLA: ${numAtt}`;
    const matSize = 17;
    const matWidth = fontBold.widthOfTextAtSize(matricolaText, matSize);
    page.drawText(matricolaText, {
      x: (width - matWidth) / 2,
      y: 208,
      size: matSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    // ---------------------------------------------------------------------------
    // 5. DATA DI STAMPA DELL'ATTESTATO
    // ---------------------------------------------------------------------------
    page.drawRectangle({
      x: 350,
      y: 168,
      width: 215,
      height: 22,
      color: rgb(1, 1, 1),
    });

    const dataStampaRaw = opzioni?.dataRilascio || partecipante.dataRilascioAttestato || formatISODateItaly();
    const dataStampaFormat = formattaDataSlash(dataStampaRaw);
    const dataStampaText = `${cittaPrevalente}, lì ${dataStampaFormat}`;
    const dataStampaSize = 17;
    const dataStampaWidth = fontBold.widthOfTextAtSize(dataStampaText, dataStampaSize);
    page.drawText(dataStampaText, {
      x: width - 38 - dataStampaWidth,
      y: 173,
      size: dataStampaSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    // ---------------------------------------------------------------------------
    // 6. FIRMA DEL PRESIDENTE CROCE ORO MASSA CARRARA
    // ---------------------------------------------------------------------------
    page.drawRectangle({
      x: 170,
      y: 65,
      width: 255,
      height: 55,
      color: rgb(1, 1, 1),
    });

    page.drawText('___________________', {
      x: 218,
      y: 92,
      size: 18,
      font: fontRegular,
      color: rgb(0, 0, 0),
    });

    // Inserisce in automatico la firma dell'account del Presidente
    const firmaPresidente = recuperaFirmaPresidente(opzioni);
    try {
      let sigImg;
      if (firmaPresidente.toLowerCase().includes('image/png') || firmaPresidente.startsWith('iVBORw0KGgo')) {
        const bytes = base64ToUint8Array(firmaPresidente);
        sigImg = await pdfDoc.embedPng(bytes);
      } else {
        const bytes = base64ToUint8Array(firmaPresidente);
        sigImg = await pdfDoc.embedJpg(bytes);
      }
      if (sigImg) {
        page.drawImage(sigImg, {
          x: 180,
          y: 78,
          width: 228,
          height: 46.65,
        });
      }
    } catch (err) {
      console.warn('Avviso: fallback firma autografa presidente:', err);
      try {
        const fallbackBytes = base64ToUint8Array(FIRMA_PRESIDENTE_SIMONINI_BASE64);
        const fallbackImg = await pdfDoc.embedJpg(fallbackBytes);
        page.drawImage(fallbackImg, {
          x: 180,
          y: 78,
          width: 228,
          height: 46.65,
        });
      } catch {}
    }

    // Genera i byte finali del documento
    const pdfBytes = await pdfDoc.save();

    // Se eseguito nel browser, avvia il download del file PDF universale e sicuro
    if (opzioni?.downloadImmediato !== false && typeof window !== 'undefined' && typeof document !== 'undefined') {
      const matricolaClean = (numAtt || 'ATTESTATO').replace(/[^a-zA-Z0-9_-]/g, '_');
      const nomeClean = (nomeVolontario || 'Partecipante').replace(/[^a-zA-Z0-9_-]/g, '_');
      const nomeFile = `Attestato_${matricolaClean}_${nomeClean}.pdf`;
      eseguiDownloadSicuroPDF(pdfBytes, nomeFile);
    }

    return pdfBytes;
  } catch (errMain) {
    console.error('Errore durante rendering PDF con pdf-lib, uso motore di fallback:', errMain);
    return await generaAttestatoPSVConJsPDF(corso, partecipante, opzioni);
  }
}

/**
 * Motore di fallback 100% garantito basato su jsPDF per generare l'attestato PSV ufficiale
 * in caso di limitazioni dell'ambiente browser o del motore di rendering PDF.
 */
async function generaAttestatoPSVConJsPDF(
  corso: CorsoFormazione,
  partecipante: PartecipanteCorso,
  opzioni?: OpzioniAttestato
): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;

  // Sfondo pergamena tenue istituzionale
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Bordi eleganti
  doc.setDrawColor(29, 26, 96);
  doc.setLineWidth(1.4);
  doc.rect(margin, margin, pageWidth - margin * 2, pageHeight - margin * 2);

  doc.setDrawColor(191, 163, 83);
  doc.setLineWidth(0.7);
  doc.rect(margin + 2.5, margin + 2.5, pageWidth - margin * 2 - 5, pageHeight - margin * 2 - 5);

  // Logo Croce Oro
  try {
    doc.addImage(LOGO_CROCE_ORO_BASE64, 'PNG', (pageWidth - 28) / 2, margin + 8, 28, 28);
  } catch {}

  const cInfoAtt = getDatiCartaIntestata();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(29, 26, 96);
  doc.text((cInfoAtt.denominazione || 'CROCE ORO MASSA CARRARA ODV').toUpperCase(), pageWidth / 2, margin + 44, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Associazione di Volontariato • ${cInfoAtt.sedeLegale || 'Sede Legale Massa Carrara'} • CF: ${cInfoAtt.codiceFiscale || '92035360459'}`, pageWidth / 2, margin + 50, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(191, 163, 83);
  doc.text('ATTESTATO DI PARTECIPAZIONE', pageWidth / 2, margin + 68, { align: 'center' });

  const isSeminarioPSV = corso.tipologia === 'Seminario PSV';
  const titoloMostrato = isSeminarioPSV
    ? 'TUTELA, SOCCORSO E BENESSERE ANIMALE'
    : (corso.titolo || corso.tipologia || 'CORSO DI FORMAZIONE').toUpperCase();
  const sottotitoloMostrato = isSeminarioPSV
    ? '"Dal Soccorso alla tutela degli animali"'
    : (corso.sottotitolo || '');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(titoloMostrato.length > 36 ? 12 : 14);
  doc.setTextColor(29, 26, 96);
  doc.text(titoloMostrato, pageWidth / 2, margin + 82, { align: 'center' });

  if (sottotitoloMostrato) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10.5);
    doc.setTextColor(100, 116, 139);
    doc.text(sottotitoloMostrato, pageWidth / 2, margin + 89, { align: 'center' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text('Si attesta che il volontario / operatore:', pageWidth / 2, margin + 110, { align: 'center' });

  const nomeVolontario = (partecipante.volontarioNome || 'PARTECIPANTE').toUpperCase().trim();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(29, 26, 96);
  doc.text(nomeVolontario, pageWidth / 2, margin + 124, { align: 'center' });

  doc.setDrawColor(29, 26, 96);
  doc.setLineWidth(0.6);
  doc.line(margin + 20, margin + 128, pageWidth - margin - 20, margin + 128);

  const cittaPrevalente = determinaCittaPrevalenteCorso(corso);
  const testoDate = formattaIntervalloDateItaliano(corso.dataInizio, corso.dataFine);

  const isSeminario = corso.tipologia.toLowerCase().includes('seminario');
  const fraseIntro = isSeminario
    ? 'ha partecipato con profitto al percorso didattico del seminario'
    : 'ha frequentato con profitto e completato il corso formativo';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(fraseIntro, pageWidth / 2, margin + 144, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(29, 26, 96);
  doc.text(`Organizzato da ${cInfoAtt.denominazione || 'Croce Oro Massa Carrara OdV'} presso`, pageWidth / 2, margin + 158, { align: 'center' });
  doc.text(`la sede operativa di ${cittaPrevalente} ${testoDate}.`, pageWidth / 2, margin + 166, { align: 'center' });

  // Matricola Attestato
  let numAtt: string;
  if (corso.tipologia === 'Seminario PSV') {
    numAtt = (partecipante.numeroAttestato || 'GEV 099').trim();
    if (!numAtt.toUpperCase().startsWith('GEV')) {
      numAtt = `GEV ${numAtt}`;
    }
    numAtt = numAtt.replace(/GEV[-_ ]+/i, 'GEV ');
  } else {
    numAtt = (partecipante.numeroAttestato || generaNumeroAttestato(corso.tipologia)).trim();
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(pageWidth / 2 - 45, margin + 182, 90, 11, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(191, 163, 83);
  doc.text(`MATRICOLA: ${numAtt}`, pageWidth / 2, margin + 189.5, { align: 'center' });

  // Data di stampa
  const dataStampaRaw = opzioni?.dataRilascio || partecipante.dataRilascioAttestato || formatISODateItaly();
  const dataStampaFormat = formattaDataSlash(dataStampaRaw);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`${cittaPrevalente}, lì ${dataStampaFormat}`, pageWidth - margin - 15, margin + 215, { align: 'right' });

  // Firma Presidente
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Il Presidente ${cInfoAtt.denominazione || 'Croce Oro Massa Carrara'}`, margin + 25, margin + 235);

  try {
    doc.addImage(FIRMA_PRESIDENTE_SIMONINI_BASE64, 'JPEG', margin + 20, margin + 238, 48, 16);
  } catch {}

  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(margin + 20, margin + 255, margin + 80, margin + 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(29, 26, 96);
  doc.text('Claudio Simonini', margin + 35, margin + 260);

  const nomeFile = `Attestato_${numAtt.replace(/[^a-zA-Z0-9_-]/g, '_')}_${nomeVolontario.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

  if (opzioni?.downloadImmediato !== false) {
    try {
      const arrayBuffer = doc.output('arraybuffer');
      eseguiDownloadSicuroPDF(new Uint8Array(arrayBuffer), nomeFile);
    } catch {
      try {
        doc.save(nomeFile);
      } catch {}
    }
  }

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

/**
 * Invia l'attestato direttamente in stampa nel browser attraverso un iframe invisibile o print dialog sicuro
 */
export async function stampaAttestatoPDF(
  corso: CorsoFormazione,
  partecipante: PartecipanteCorso,
  opzioni?: OpzioniAttestato
): Promise<void> {
  const opz = { ...opzioni, downloadImmediato: false };
  const res = await scaricaAttestatoPDF(corso, partecipante, opz);

  let blob: Blob;
  if (res instanceof jsPDF) {
    blob = res.output('blob');
  } else if (res instanceof Uint8Array) {
    const arrayBuffer = res.buffer.slice(res.byteOffset, res.byteOffset + res.byteLength);
    blob = new Blob([arrayBuffer as any], { type: 'application/pdf' });
  } else {
    throw new Error('Formato attestato non riconosciuto per la stampa');
  }

  const blobUrl = URL.createObjectURL(blob);

  // Stampa sicura tramite iframe invisibile per non interrompere la sessione dell'app
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.border = '0';
  iframe.src = blobUrl;

  document.body.appendChild(iframe);

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (errPrint) {
      console.warn('Stampa iframe diretta non supportata dal browser, apro finestra PDF:', errPrint);
      const w = window.open(blobUrl, '_blank');
      w?.focus();
    }
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(blobUrl);
      } catch {}
    }, 60000);
  };
}

/**
 * Genera e scarica il PDF dell'Attestato.
 * Se per la tipologia/categoria del corso è stato caricato un file PDF prestampato attivo,
 * utilizza quel prestampato compilando SOLAMENTE:
 * - Nome e Cognome del corsista
 * - Data e Luogo di rilascio
 * - Numero di matricola progressivo
 * Altrimenti utilizza il layout regionale ufficiale A4 predefinito.
 */
export async function scaricaAttestatoPDF(
  corso: CorsoFormazione,
  partecipante: PartecipanteCorso,
  opzioni?: OpzioniAttestato
): Promise<Uint8Array> {
  const modello = opzioni?.modelloPrestampato || getModelloPerTipologia(corso.tipologia);

  if (modello && modello.attivo && modello.hasPdfFile) {
    try {
      const templateBytes =
        opzioni?.pdfPrestampatoBytes ||
        (await caricaPdfPrestampatoBytes(modello, opzioni?.apiBaseUrl || ''));

      if (templateBytes && templateBytes.length > 100) {
        const luogoRilascio =
          (opzioni?.luogoRilascio || '').trim() ||
          (partecipante.luogoRilascioAttestato || '').trim() ||
          (modello.luogoRilascioDefault || '').trim() ||
          determinaCittaPrevalenteCorso(corso);

        const dataRilascio =
          opzioni?.dataRilascio ||
          partecipante.dataRilascioAttestato ||
          formatISODateItaly();

        const matricola =
          (partecipante.numeroAttestato || '').trim() ||
          formattaMatricolaDaModello(modello);

        const nomeCognome = (partecipante.volontarioNome || 'PARTECIPANTE').trim();

        const pdfBytes = await compilaPdfPrestampatoCategoria(templateBytes, modello, {
          nomeCognome,
          luogoRilascio,
          dataRilascio,
          matricola
        });

        if (opzioni?.downloadImmediato !== false && typeof window !== 'undefined' && typeof document !== 'undefined') {
          const matricolaClean = (matricola || 'ATTESTATO').replace(/[^a-zA-Z0-9_-]/g, '_');
          const nomeClean = (nomeCognome || 'Partecipante').replace(/[^a-zA-Z0-9_-]/g, '_');
          const nomeFile = `Attestato_${matricolaClean}_${nomeClean}.pdf`;
          eseguiDownloadSicuroPDF(pdfBytes, nomeFile);
        }

        return pdfBytes;
      }
    } catch (errCustom) {
      console.error('Errore compilazione PDF prestampato di categoria, fallback a modello standard:', errCustom);
    }
  }

  return await scaricaAttestatoPSVUfficialePDF(corso, partecipante, opzioni);
}
