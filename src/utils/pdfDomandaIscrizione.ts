import { jsPDF } from 'jspdf';
import { Volontario } from '../components/DatabaseVolontariModal';
import { DatiDomandaIscrizione } from '../data/domandaIscrizione';
import {
  disegnaHeaderIstituzionale,
  disegnaFooterIstituzionale
} from './pdfInstitutionalLayout';
import { FIRMA_PRESIDENTE_SIMONINI_BASE64 } from '../assets/firmaPresidenteBase64';
import { formatISODateItaly, getCurrentYearItaly } from './italianTime';

function pulisciTesto(str?: string): string {
  if (!str) return '';
  return str.replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ').trim();
}

/**
 * Normalizza e prepara una stringa di immagine Base64 per jsPDF
 */
function preparaImmaginePerPDF(imgStr?: string): { data: string; format: 'PNG' | 'JPEG' } | null {
  if (!imgStr || typeof imgStr !== 'string' || imgStr.trim().length < 20) return null;
  let data = imgStr.trim();
  let format: 'PNG' | 'JPEG' = 'PNG';
  const lower = data.toLowerCase();

  if (lower.startsWith('data:image/jpeg') || lower.startsWith('data:image/jpg') || data.startsWith('/9j/')) {
    format = 'JPEG';
    if (!data.startsWith('data:')) {
      data = `data:image/jpeg;base64,${data}`;
    }
  } else if (lower.startsWith('data:image/png') || data.startsWith('iVBORw0KGgo')) {
    format = 'PNG';
    if (!data.startsWith('data:')) {
      data = `data:image/png;base64,${data}`;
    }
  } else if (data.startsWith('data:')) {
    format = lower.includes('jpeg') || lower.includes('jpg') ? 'JPEG' : 'PNG';
  } else {
    format = 'PNG';
    data = `data:image/png;base64,${data}`;
  }

  return { data, format };
}

/**
 * Recupera in automatico la firma dell'account del Presidente dell'Associazione.
 * 1. Firma esplicitamente passata nelle opzioni
 * 2. Cerca nella lista passata (carica Consiglio Direttivo Presidente / qualifica Presidente / Claudio Simonini)
 * 3. Cerca nel database salvato in localStorage
 * 4. Fallback: firma autografa ufficiale di Claudio Simonini
 */
export function recuperaFirmaPresidente(
  volontari?: Volontario[],
  firmaEsplicita?: string
): string {
  if (firmaEsplicita && firmaEsplicita.trim().length > 50) {
    return firmaEsplicita.trim();
  }

  if (volontari && Array.isArray(volontari) && volontari.length > 0) {
    const pres = volontari.find(
      (v) =>
        (v.caricaConsiglioDirettivo && v.caricaConsiglioDirettivo.toLowerCase().includes('presidente')) ||
        (v.qualifica && v.qualifica.toLowerCase().includes('presidente')) ||
        (v.nome?.toLowerCase().includes('claudio') && v.cognome?.toLowerCase().includes('simonini'))
    );
    if (pres?.firmaBase64 && pres.firmaBase64.trim().length > 50) {
      return pres.firmaBase64.trim();
    }
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
              (v.nome?.toLowerCase().includes('claudio') && v.cognome?.toLowerCase().includes('simonini'))
          );
          if (pres?.firmaBase64 && pres.firmaBase64.trim().length > 50) {
            return pres.firmaBase64.trim();
          }
        }
      }
    } catch {}
  }

  return FIRMA_PRESIDENTE_SIMONINI_BASE64;
}

export interface OpzioniPDFDomandaIscrizione {
  volontari?: Volontario[];
  firmaPresidenteBase64?: string;
}

/**
 * Genera il PDF ufficiale della "Domanda di Iscrizione a Socio / Volontario"
 * contenente Anagrafica & Foto (Sez. 1), Documenti & Patente (Sez. 2),
 * Informazioni Sanitarie (punto 1), Dichiarazioni (punto 2), Tutore Minorenni (punto 3),
 * Privacy (punto 4), Consenso Dati Sanitari (punto 5), Consenso Foto/Video (punto 6),
 * e Parte Riservata all'Associazione (punto 7).
 */
export function generaPDFDomandaIscrizione(
  volontario: Volontario,
  dati: DatiDomandaIscrizione,
  opzioni?: OpzioniPDFDomandaIscrizione
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

  // Helper Header di Pagina
  const disegnaHeader = (paginaNum: number, totPagine: number) => {
    disegnaHeaderIstituzionale(doc, {
      titoloDocumento: 'DOMANDA DI ISCRIZIONE A SOCIO / VOLONTARIO OPERATIVO',
      badge: {
        riga1Tag: 'DOMANDA DI ISCRIZIONE',
        riga2Valore: 'LIBRO SOCI & VOLONTARI',
        riga3Sotto: `Pagina ${paginaNum} di ${totPagine} • RUNTS`
      },
      pageWidth,
      margin
    });
  };

  const disegnaFooter = (paginaNum: number, totPagine: number) => {
    disegnaFooterIstituzionale(doc, {
      dicituraArchiviazione: `Pagina ${paginaNum} di ${totPagine} • Domanda di Iscrizione e Consensi Trattamento • Archiviazione Ufficio Soci`,
      pageWidth,
      pageHeight,
      margin
    });
  };

  // ==========================================
  // PAGINA 1
  // ==========================================
  disegnaHeader(1, 2);

  let currentY = 33;

  // Box Sezione 1: Anagrafica & Foto
  const boxAnagH = 34;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxAnagH, 1.5, 1.5, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, contentWidth, 5.5, 1.5, 1.5, 'F');
  doc.rect(margin, currentY + 3, contentWidth, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text('SEZIONE 1 — DATI ANAGRAFICI, FISCALI & RECAPITI DEL RICHIEDENTE (RECUPERATI IN AUTOMATICO)', margin + 3, currentY + 3.8);

  // Foto a lato se presente
  let textStartX = margin + 4;
  if (volontario.fotoBase64) {
    try {
      doc.addImage(volontario.fotoBase64, 'JPEG', margin + 3, currentY + 7, 20, 24, undefined, 'FAST');
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.rect(margin + 3, currentY + 7, 20, 24, 'S');
      textStartX = margin + 26;
    } catch {
      textStartX = margin + 4;
    }
  }

  const col2X = margin + contentWidth / 2 + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 26, 96);
  doc.text('Cognome e Nome:', textStartX, currentY + 10.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`${pulisciTesto(volontario.cognome).toUpperCase()} ${pulisciTesto(volontario.nome)}`, textStartX + 26, currentY + 10.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 26, 96);
  doc.text('Codice Fiscale:', textStartX, currentY + 16);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(pulisciTesto(volontario.codiceFiscale || 'NON SPECIFICATO'), textStartX + 26, currentY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 26, 96);
  doc.text('Residenza:', textStartX, currentY + 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85);
  doc.text(pulisciTesto(volontario.indirizzoResidenza || 'N/D'), textStartX + 26, currentY + 21.5, { maxWidth: contentWidth / 2 - 20 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 26, 96);
  doc.text('Recapiti Tel/Email:', textStartX, currentY + 27);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text(`${pulisciTesto(volontario.telefono || 'N/D')} • ${pulisciTesto(volontario.email || 'N/D')}`, textStartX + 26, currentY + 27);

  // Colonna 2 Anagrafica
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 26, 96);
  doc.text('Matricola / Ruolo:', col2X, currentY + 10.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${pulisciTesto(volontario.matricola || 'VOL')} • ${pulisciTesto(volontario.qualifica || 'Volontario')}`, col2X + 26, currentY + 10.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 26, 96);
  doc.text('Carica Direttivo:', col2X, currentY + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text(pulisciTesto(volontario.caricaConsiglioDirettivo || 'Nessuna (Socio Ordinario)'), col2X + 26, currentY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 26, 96);
  doc.text('Data Presentazione:', col2X, currentY + 21.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text(dati.dataRichiesta || formatISODateItaly(), col2X + 26, currentY + 21.5);

  currentY += boxAnagH + 3.5;

  // Box Sezione 2: Documenti d'Identità & Patente
  const boxDocH = 22;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxDocH, 1.5, 1.5, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, contentWidth, 5.5, 1.5, 1.5, 'F');
  doc.rect(margin, currentY + 3, contentWidth, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text('SEZIONE 2 — ESTREMI DOCUMENTO DI IDENTITÀ & PATENTE DI GUIDA (RECUPERATI IN AUTOMATICO)', margin + 3, currentY + 3.8);

  const docId = volontario.documentoIdentita;
  const pat = volontario.patente;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 26, 96);
  doc.text('Doc. Riconoscimento:', margin + 4, currentY + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `${pulisciTesto(docId?.tipo || 'C.I.')} N. ${pulisciTesto(docId?.numero || 'N/D')} (Scadenza: ${docId?.dataScadenza || 'N/D'})`,
    margin + 34,
    currentY + 11.5
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 26, 96);
  doc.text('Patente di Guida:', margin + 4, currentY + 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  if (pat?.inPossesso) {
    doc.text(
      `In Possesso • Categoria ${pat.categoria || 'B'} • N. ${pat.numero || 'N/D'} • Scadenza: ${pat.dataScadenza || 'N/D'}`,
      margin + 34,
      currentY + 17
    );
  } else {
    doc.text('Non in possesso di patente di guida', margin + 34, currentY + 17);
  }

  currentY += boxDocH + 3.5;

  // ==========================================
  // 1. INFORMAZIONI SANITARIE PER EVENTUALI ATTIVITÀ OPERATIVE
  // ==========================================
  const boxSanitH = 38;
  doc.setFillColor(254, 249, 195); // giallo/amber tenue
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, currentY, contentWidth, boxSanitH, 1.5, 1.5, 'FD');

  doc.setFillColor(146, 64, 14);
  doc.roundedRect(margin, currentY, contentWidth, 5.5, 1.5, 1.5, 'F');
  doc.rect(margin, currentY + 3, contentWidth, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text('1. INFORMAZIONI SANITARIE PER EVENTUALI ATTIVITÀ OPERATIVE (RISERVATO E LIMITATO ALLA SICUREZZA)', margin + 3, currentY + 3.8);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(5.8);
  doc.setTextColor(120, 53, 15);
  doc.text(
    'Compilazione riservata e limitata alle informazioni effettivamente necessarie per la sicurezza e l\'organizzazione dei servizi di soccorso.',
    margin + 4,
    currentY + 9
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 26, 96);
  doc.text('Gruppo sanguigno (se conosciuto):', margin + 4, currentY + 15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9);
  doc.text(`[ ${pulisciTesto(dati.gruppoSanguigno || 'Non noto')} ]`, margin + 50, currentY + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('(Opzioni: A+, A-, B+, B-, AB+, AB-, 0+, 0-, Non noto)', margin + 75, currentY + 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 26, 96);
  doc.text('Vaccinazione antitetanica:', margin + 4, currentY + 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  const tetanoStr = `Ultima dose: ${dati.antitetanicaUltimaDose || 'Non specificata'} • Scadenza/richiamo: ${dati.antitetanicaScadenza || 'Non specificata'}`;
  doc.text(tetanoStr, margin + 40, currentY + 21);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 26, 96);
  doc.text('Limitazioni rilevanti per la sicurezza:', margin + 4, currentY + 27);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(51, 65, 85);
  const limitaz = dati.limitazioniSicurezza?.trim() || 'Nessuna limitazione segnalata dal richiedente (idoneo allo svolgimento dei servizi concordati).';
  doc.text(pulisciTesto(limitaz), margin + 50, currentY + 27, { maxWidth: contentWidth - 55 });

  currentY += boxSanitH + 3.5;

  // ==========================================
  // 2. DICHIARAZIONI DEL RICHIEDENTE
  // ==========================================
  const boxDichH = 38;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxDichH, 1.5, 1.5, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, contentWidth, 5.5, 1.5, 1.5, 'F');
  doc.rect(margin, currentY + 3, contentWidth, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text('2. DICHIARAZIONI DEL RICHIEDENTE & IMPEGNO FORMALE', margin + 3, currentY + 3.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(30, 41, 59);
  const testoDichRich =
    'Chiedo di essere ammesso/a secondo le procedure previste dallo Statuto e mi impegno, in caso di ammissione, a rispettare Statuto, ' +
    'regolamenti, disposizioni degli organi associativi e procedure di sicurezza e riservatezza.\n' +
    'Sono consapevole che la domanda non comporta l\'automatica ammissione a socio/a né l\'autorizzazione a svolgere attività operative. ' +
    'L\'eventuale quota associativa sarà quella stabilita dall\'associazione e comunicata al richiedente.';
  const splitDich = doc.splitTextToSize(testoDichRich, contentWidth - 10);
  doc.text(splitDich, margin + 4, currentY + 10);

  // Luogo, Data e Firma Richiedente
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(29, 26, 96);
  doc.text(`Luogo e data: ${pulisciTesto(dati.luogoRichiesta || 'Massa Carrara')}, ${dati.dataRichiesta || formatISODateItaly()}`, margin + 4, currentY + 31);

  doc.text('Firma del richiedente:', margin + 105, currentY + 31);

  // Recupero unificato della firma del richiedente con fallback a tutti i possibili campi
  const firmaRichiedenteStr = volontario.firmaBase64 || (volontario as any)?.domandaIscrizioneDati?.firmaRichiedente || (volontario as any)?.firma || '';
  const imgFirmaVol = preparaImmaginePerPDF(firmaRichiedenteStr);
  if (imgFirmaVol) {
    try {
      doc.addImage(imgFirmaVol.data, imgFirmaVol.format, margin + 135, currentY + 22, 40, 13, undefined, 'FAST');
    } catch {}
  } else {
    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(margin + 135, currentY + 31, margin + contentWidth - 4, currentY + 31);
    doc.setLineDashPattern([], 0);
  }

  currentY += boxDichH + 3.5;

  // ==========================================
  // 3. DICHIARAZIONE DEL GENITORE/TUTORE (SOLO PER MINORENNI)
  // ==========================================
  const isMinorenne = Boolean(dati.richiedenteMinorenne || (volontario as any)?.domandaIscrizioneDati?.richiedenteMinorenne);
  const gNome = dati.genitoreNomeCognome?.trim() || (volontario as any)?.domandaIscrizioneDati?.genitoreNomeCognome?.trim() || '';
  const gRecapiti = dati.genitoreRecapiti?.trim() || (volontario as any)?.domandaIscrizioneDati?.genitoreRecapiti?.trim() || '';
  const gLuogoData = dati.genitoreLuogoData?.trim() || (volontario as any)?.domandaIscrizioneDati?.genitoreLuogoData?.trim() || '';

  const boxGenH = 34;
  doc.setFillColor(isMinorenne ? 254 : 248, isMinorenne ? 249 : 250, isMinorenne ? 231 : 252);
  doc.setDrawColor(isMinorenne ? 245 : 203, isMinorenne ? 158 : 213, isMinorenne ? 11 : 225);
  doc.setLineWidth(isMinorenne ? 0.4 : 0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxGenH, 1.5, 1.5, 'FD');

  doc.setFillColor(isMinorenne ? 180 : 30, isMinorenne ? 83 : 41, isMinorenne ? 9 : 59);
  doc.roundedRect(margin, currentY, contentWidth, 5.5, 1.5, 1.5, 'F');
  doc.rect(margin, currentY + 3, contentWidth, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text(
    isMinorenne
      ? '3. DICHIARAZIONE DEL GENITORE / TUTORE [ X ] RICHIEDENTE MINORENNE AUTORIZZATO'
      : '3. DICHIARAZIONE DEL GENITORE / TUTORE (SOLO PER RICHIEDENTI MINORENNI)',
    margin + 3,
    currentY + 3.8
  );

  const genitoreNomeVisualizzato = gNome || '________________________________________';
  const genitoreRecapitiVisualizzato = gRecapiti || '________________________________________';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.4);
  doc.setTextColor(30, 41, 59);
  const testoGen =
    `Il/La sottoscritto/a ${genitoreNomeVisualizzato}, in qualità di genitore o esercente la responsabilità genitoriale, ` +
    'dichiara di essere informato/a della domanda presentata dal/dalla minore e autorizza la presentazione della domanda ' +
    'nei limiti previsti dallo Statuto e dalle norme applicabili.';
  const splitGen = doc.splitTextToSize(testoGen, contentWidth - 8);
  doc.text(splitGen, margin + 4, currentY + 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(29, 26, 96);
  doc.text(`Telefono/e-mail del genitore/tutore: ${genitoreRecapitiVisualizzato}`, margin + 4, currentY + 22);

  doc.text(`Luogo e data: ${pulisciTesto(gLuogoData || (isMinorenne ? 'Massa Carrara' : 'Massa Carrara'))}`, margin + 4, currentY + 28);
  doc.text('Firma del genitore/tutore:', margin + 105, currentY + 28);

  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([2, 1], 0);
  doc.line(margin + 138, currentY + 28, margin + contentWidth - 4, currentY + 28);
  doc.setLineDashPattern([], 0);

  disegnaFooter(1, 2);

  // ==========================================
  // PAGINA 2: PRIVACY, CONSENSI & PARTE RISERVATA ALL'ASSOCIAZIONE
  // ==========================================
  doc.addPage();
  disegnaHeader(2, 2);

  currentY = 33;

  // 4. INFORMATIVA PRIVACY — DATI PERSONALI
  // Altezza generosa per garantire totale separazione tra testo e firma
  const boxPrivH = 42;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxPrivH, 1.5, 1.5, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, contentWidth, 5.5, 1.5, 1.5, 'F');
  doc.rect(margin, currentY + 3, contentWidth, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text('4. INFORMATIVA PRIVACY — TRATTAMENTO DEI DATI PERSONALI (REGOLAMENTO UE 2016/679)', margin + 3, currentY + 3.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.0);
  doc.setTextColor(51, 65, 85);
  const testoPriv =
    'CROCE ORO MASSA CARRARA OdV tratterà i dati forniti per gestire la domanda, valutare l’ammissione e, se accolta, amministrare il rapporto associativo ' +
    'e l’eventuale attività di volontariato. I dati saranno trattati secondo il Regolamento (UE) 2016/679 e la normativa applicabile.\n' +
    'I dati saranno accessibili soltanto a persone autorizzate e conservati per il tempo necessario alle finalità e agli obblighi di legge. ' +
    'L’interessato può esercitare i diritti previsti dalla normativa contattando l’associazione ai recapiti ufficiali (informativa completa: www.croceoro.org).';
  const splitPriv = doc.splitTextToSize(testoPriv, contentWidth - 8);
  doc.text(splitPriv, margin + 4, currentY + 9.5);

  // Riga Dedicata inferiore: Checkbox Presa Visione a sinistra, Firma a destra (completamente sotto al testo)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(29, 26, 96);
  const pvMark = dati.presaVisionePrivacy !== false ? '[ X ]' : '[   ]';
  doc.text(`${pvMark} Dichiaro di aver preso visione dell’informativa privacy completa.`, margin + 4, currentY + 28, { maxWidth: 100 });

  doc.text('Firma per presa visione:', margin + 110, currentY + 28);

  if (imgFirmaVol) {
    try {
      doc.addImage(imgFirmaVol.data, imgFirmaVol.format, margin + 144, currentY + 22, 38, 14, undefined, 'FAST');
    } catch {}
  } else {
    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(margin + 144, currentY + 28, margin + contentWidth - 4, currentY + 28);
    doc.setLineDashPattern([], 0);
  }

  currentY += boxPrivH + 4;

  // 5. CONSENSO ESPLICITO AL TRATTAMENTO DEI DATI SANITARI
  const boxConsSanH = 54;
  doc.setFillColor(254, 249, 195); // ambra chiarissimo di fondo
  doc.setDrawColor(217, 119, 6);   // bordo arancione/ambra
  doc.setLineWidth(0.35);
  doc.roundedRect(margin, currentY, contentWidth, boxConsSanH, 1.5, 1.5, 'FD');

  doc.setFillColor(146, 64, 14); // intestazione marrone/arancione
  doc.roundedRect(margin, currentY, contentWidth, 5.5, 1.5, 1.5, 'F');
  doc.rect(margin, currentY + 3, contentWidth, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text('5. CONSENSO ESPLICITO AL TRATTAMENTO DEI DATI SANITARI (CATEGORIE PARTICOLARI)', margin + 3, currentY + 3.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(71, 85, 105);
  const testoSan =
    'I dati sanitari eventualmente forniti (ad esempio gruppo sanguigno, informazioni sulla vaccinazione antitetanica o limitazioni rilevanti ' +
    'per la sicurezza) costituiscono dati particolari. Il loro conferimento è facoltativo e limitato alle necessità di sicurezza nei servizi concordati.';
  const splitSan = doc.splitTextToSize(testoSan, contentWidth - 10);
  doc.text(splitSan, margin + 5, currentY + 9.5);

  const accSan = dati.consensoDatiSanitari === 'acconsento';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.0);
  doc.setTextColor(15, 23, 42);

  // Opzione 1: Acconsento (vincolata a sinistra per non sovrapporsi mai alla firma sulla destra)
  const testoAcc = `${accSan ? '[ X ]' : '[   ]'} Acconsento al trattamento delle informazioni sanitarie per finalità di sicurezza e servizio.`;
  const splitAcc = doc.splitTextToSize(testoAcc, 100);
  doc.text(splitAcc, margin + 5, currentY + 18.0);

  // Opzione 2: NON acconsento
  const testoNonAcc = `${!accSan ? '[ X ]' : '[   ]'} NON acconsento al trattamento di informazioni sanitarie per l'attività associativa.`;
  const splitNonAcc = doc.splitTextToSize(testoNonAcc, 100);
  doc.text(splitNonAcc, margin + 5, currentY + 26.5);

  // Riga Luogo, Data e Firma sanitaria - Posizionata in calce al riquadro con ampio respiro
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(29, 26, 96);
  doc.text(`Luogo e data: ${pulisciTesto(dati.luogoRichiesta || 'Massa Carrara')}`, margin + 5, currentY + 44);
  doc.text('Firma specifica sanitaria:', margin + 105, currentY + 44);

  if (imgFirmaVol) {
    try {
      doc.addImage(imgFirmaVol.data, imgFirmaVol.format, margin + 142, currentY + 34, 38, 14, undefined, 'FAST');
    } catch {}
  } else {
    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(margin + 143, currentY + 44, margin + contentWidth - 5, currentY + 44);
    doc.setLineDashPattern([], 0);
  }

  currentY += boxConsSanH + 4;

  // 6. CONSENSO FACOLTATIVO PER FOTO E VIDEO
  const boxFotoH = 54;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, contentWidth, boxFotoH, 1.5, 1.5, 'FD');

  doc.setFillColor(30, 41, 59);
  doc.roundedRect(margin, currentY, contentWidth, 5.5, 1.5, 1.5, 'F');
  doc.rect(margin, currentY + 3, contentWidth, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(255, 255, 255);
  doc.text('6. CONSENSO FACOLTATIVO PER FOTO, VIDEO E MATERIALI PROMOZIONALI', margin + 3, currentY + 3.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(71, 85, 105);
  const testoFV =
    'Durante attività, eventi, esercitazioni e servizi possono essere realizzate immagini e riprese video in cui il/la richiedente sia riconoscibile. ' +
    'Il consenso è facoltativo e distinto dalla domanda associativa, revocabile per il futuro contattando l’associazione.';
  const splitFV = doc.splitTextToSize(testoFV, contentWidth - 8);
  doc.text(splitFV, margin + 4, currentY + 9.5);

  const cfSito = dati.consensoFotoSito ? '[ X ]' : '[   ]';
  const cfSoc = dati.consensoFotoSocial ? '[ X ]' : '[   ]';
  const cfVol = dati.consensoFotoVolantini ? '[ X ]' : '[   ]';
  const cfInt = dati.consensoFotoComunicazioniInterne ? '[ X ]' : '[   ]';
  const cfNon = dati.consensoFotoNessuno ? '[ X ]' : '[   ]';

  // Le 5 opzioni sono rigidamente limitate a sinistra (maxWidth: 105mm) per non invadere la zona firma a destra
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(15, 23, 42);
  doc.text(`${cfSito} Pubblicazione sul sito ufficiale www.croceoro.org.`, margin + 4, currentY + 18, { maxWidth: 105 });
  doc.text(`${cfSoc} Pubblicazione sui profili social ufficiali (Facebook, Instagram).`, margin + 4, currentY + 22.5, { maxWidth: 105 });
  doc.text(`${cfVol} Utilizzo in volantini, brochure e materiali informativi.`, margin + 4, currentY + 27, { maxWidth: 105 });
  doc.text(`${cfInt} Utilizzo in comunicazioni e documentazione interna soci.`, margin + 4, currentY + 31.5, { maxWidth: 105 });
  doc.text(`${cfNon} NON acconsento ad alcuno degli utilizzi sopra indicati.`, margin + 4, currentY + 36, { maxWidth: 105 });

  // Riga firma in calce: Richiedente a sinistra, Firma a destra
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(29, 26, 96);
  doc.text(`Richiedente: ${volontario.cognome.toUpperCase()} ${volontario.nome}`, margin + 4, currentY + 44);
  doc.text('Firma finalità autorizzate:', margin + 105, currentY + 44);

  if (imgFirmaVol) {
    try {
      doc.addImage(imgFirmaVol.data, imgFirmaVol.format, margin + 142, currentY + 34, 38, 14, undefined, 'FAST');
    } catch {}
  } else {
    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(margin + 143, currentY + 44, margin + contentWidth - 4, currentY + 44);
    doc.setLineDashPattern([], 0);
  }

  currentY += boxFotoH + 4;

  // 7. PARTE RISERVATA ALL'ASSOCIAZIONE
  const boxAssH = 55;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(191, 163, 83);
  doc.setLineWidth(0.45);
  doc.roundedRect(margin, currentY, contentWidth, boxAssH, 1.5, 1.5, 'FD');

  doc.setFillColor(29, 26, 96);
  doc.roundedRect(margin, currentY, contentWidth, 5.5, 1.5, 1.5, 'F');
  doc.rect(margin, currentY + 3, contentWidth, 2.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(253, 224, 71);
  doc.text('7. PARTE RISERVATA ALL’ASSOCIAZIONE (VALIDAZIONE & DELIBERA ORGANI STATUTARI)', margin + 3, currentY + 3.8);

  const esito = dati.esitoDomanda || 'Accolta';
  const esAcc = esito === 'Accolta' ? '[ X ] Accolta' : '[   ] Accolta';
  const esNon = esito === 'Non accolta' ? '[ X ] Non accolta' : '[   ] Non accolta';
  const esAtt = esito === 'In attesa' ? '[ X ] In attesa' : '[   ] In attesa';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(29, 26, 96);
  doc.text(`Domanda ricevuta il: ${dati.domandaRicevutaIl || formatISODateItaly()}`, margin + 4, currentY + 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text(`Esito delibera:   ${esAcc}     ${esNon}     ${esAtt}`, margin + 65, currentY + 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 26, 96);
  doc.text('Organo competente / delibera n.:', margin + 4, currentY + 16.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text(`${pulisciTesto(dati.organoCompetente || 'Consiglio Direttivo')} — N. ${pulisciTesto(dati.deliberaNumero || 'DEL-2026/01')} del ${dati.deliberaData || formatISODateItaly()}`, margin + 46, currentY + 16.5);

  // Numero Tessera & Iscrizione Libro Soci
  const numTesseraStampa = dati.numeroTessera || volontario.tesseramento?.numeroTessera || dati.numeroIscrizioneLibroSoci || volontario.matricola || 'TV-101';
  const numLibroSociStampa = dati.numeroIscrizioneLibroSoci || `LS-${getCurrentYearItaly()}/${pulisciTesto(numTesseraStampa).replace(/\D/g, '') || '01'}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 26, 96);
  doc.text('N. Tessera Socio:', margin + 4, currentY + 22.5);
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(191, 163, 83);
  doc.text(pulisciTesto(numTesseraStampa), margin + 27, currentY + 22.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 26, 96);
  doc.text('Libro Soci:', margin + 65, currentY + 22.5);
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text(pulisciTesto(numLibroSociStampa), margin + 80, currentY + 22.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(29, 26, 96);
  doc.text('Quota Versata:', margin + 125, currentY + 22.5);
  doc.setFont('helvetica', 'bold');
  const isEsentePDF = Boolean(dati.esenteQuota ?? volontario.esenteQuotaAssociativa);
  if (isEsentePDF) {
    doc.setFontSize(6.8);
    doc.setTextColor(180, 83, 9);
    const mot = dati.motivoEsenzione || volontario.motivoEsenzioneQuota || 'Benemerito';
    doc.text(`ESENTE (€ 0,00) - ${pulisciTesto(mot)}`, margin + 146, currentY + 22.5, { maxWidth: contentWidth - 148 });
  } else {
    doc.setFontSize(8);
    doc.setTextColor(22, 101, 52);
    const quota = dati.quotaVersata !== undefined ? dati.quotaVersata : (volontario.profiloCentrale ? 10.0 : 5.0);
    doc.text(`€ ${quota.toFixed(2).replace('.', ',')}`, margin + 148, currentY + 22.5);
  }

  // Annotazioni su riga dedicata con larghezza vincolata, termina prima dell'inizio delle firme
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(29, 26, 96);
  doc.text('Annotazioni:', margin + 4, currentY + 28);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.3);
  doc.setTextColor(51, 65, 85);
  const annAss = dati.annotazioniAssociazione?.trim() || 'Verifica positiva dei requisiti statutari e documentali.';
  doc.text(pulisciTesto(annAss), margin + 22, currentY + 28, { maxWidth: contentWidth - 26 });

  // Riquadro inferiore firme: Totalmente separato da Annotazioni (inizia a currentY + 34)
  // Firma Presidente a sinistra, Timbro a destra
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(29, 26, 96);
  doc.text('Firma del responsabile:', margin + 4, currentY + 41.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.0);
  doc.setTextColor(71, 85, 105);
  doc.text(pulisciTesto(dati.responsabileNome || 'Presidente / Legale Rappresentante'), margin + 4, currentY + 45.5);

  // Firma autografa del Presidente caricata a sistema
  const firmaPresidenteStr = recuperaFirmaPresidente(opzioni?.volontari, opzioni?.firmaPresidenteBase64);
  const imgFirmaPres = preparaImmaginePerPDF(firmaPresidenteStr);

  if (imgFirmaPres) {
    try {
      doc.addImage(imgFirmaPres.data, imgFirmaPres.format, margin + 46, currentY + 34, 44, 15, undefined, 'FAST');
    } catch (err) {
      console.warn('Errore rendering firma presidente:', err);
    }
  } else {
    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([2, 1], 0);
    doc.line(margin + 46, currentY + 45.5, margin + 98, currentY + 45.5);
    doc.setLineDashPattern([], 0);
  }

  // Timbro Associazione
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(29, 26, 96);
  doc.text('Timbro Associazione:', margin + 104, currentY + 45.5);
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([2, 1], 0);
  doc.line(margin + 135, currentY + 45.5, margin + contentWidth - 4, currentY + 45.5);
  doc.setLineDashPattern([], 0);

  disegnaFooter(2, 2);

  return doc;
}

/**
 * Scarica direttamente il PDF della Domanda Iscrizione
 */
export function scaricaPDFDomandaIscrizione(
  volontario: Volontario,
  dati: DatiDomandaIscrizione,
  opzioni?: OpzioniPDFDomandaIscrizione
): void {
  const doc = generaPDFDomandaIscrizione(volontario, dati, opzioni);
  const cognome = (volontario.cognome || 'Socio').replace(/[^a-zA-Z0-9_-]/g, '_');
  const nome = (volontario.nome || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const nomeFile = `Domanda_Iscrizione_${cognome}_${nome}.pdf`;
  doc.save(nomeFile);
}
