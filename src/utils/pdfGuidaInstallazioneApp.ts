import { jsPDF } from 'jspdf';
import { formatDateItaly } from './italianTime';

export const GUIDA_APP_OFFICIAL_URL = 'https://croce-oro-massa-carrarra.vercel.app/';
export const GUIDA_APP_PDF_FILENAME = 'Guida_Installazione_App_Croce_Oro.pdf';
export const GUIDA_APP_PRESIDENZA_EMAIL = 'presidenza@croceoro.org';

export function buildGuidaInstallazionePdfDoc(): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const dateStr = formatDateItaly();

  const drawHeader = (isContinuation = false) => {
    // Sfondo blu istituzionale Croce Oro
    doc.setFillColor(29, 26, 96); // #1d1a60
    doc.rect(0, 0, pageW, isContinuation ? 22 : 34, 'F');
    // Fascia oro inferiore
    doc.setFillColor(231, 184, 11); // #e7b80b
    doc.rect(0, isContinuation ? 22 : 34, pageW, 2.2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isContinuation ? 12 : 16);
    doc.text('CROCE ORO MASSA CARRARA OdV', margin, isContinuation ? 10 : 13);

    doc.setTextColor(253, 224, 71);
    doc.setFontSize(isContinuation ? 9 : 11);
    doc.text(
      isContinuation
        ? 'SOP-00 - Guida Installazione App (Segue)'
        : 'SOP-00 - GUIDA INSTALLAZIONE APPLICAZIONE OPERATIVA',
      margin,
      isContinuation ? 16.5 : 21
    );

    if (!isContinuation) {
      doc.setTextColor(226, 232, 240);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(
        'Procedura ufficiale per Apple (iPhone / iPad) e Android - Google Chrome e Safari',
        margin,
        28.5
      );
    }

    doc.setTextColor(226, 232, 240);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(`Rev. ${dateStr}`, pageW - margin, isContinuation ? 13 : 13, { align: 'right' });
  };

  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 13, pageW - margin, pageH - 13);

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      'Croce Oro Massa Carrara OdV  |  Archivio Documenti & Procedure Operative (SOP)  |  Centrale H24: 0585 625410',
      margin,
      pageH - 8
    );
    doc.setFont('helvetica', 'bold');
    doc.text(`Pagina ${pageNum} di ${totalPages}`, pageW - margin, pageH - 8, { align: 'right' });
  };

  let y = 42;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageH - 18) {
      doc.addPage();
      drawHeader(true);
      y = 30;
    }
  };

  const drawSectionBox = (options: {
    badge: string;
    title: string;
    accentRgb: [number, number, number];
    steps: Array<{ heading: string; body: string }>;
    note?: string;
  }) => {
    // Calcolo altezza dinamica della scheda per evitare spezzature scomode
    doc.setFontSize(9);
    let estimatedH = 14;
    const preparedSteps = options.steps.map((s) => {
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(s.body, contentW - 18);
      const h = 5 + lines.length * 4.1 + 2.5;
      estimatedH += h;
      return { heading: s.heading, lines, h };
    });
    let noteLines: string[] = [];
    if (options.note) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      noteLines = doc.splitTextToSize(options.note, contentW - 12);
      estimatedH += noteLines.length * 3.9 + 7;
    }
    estimatedH += 4;

    ensureSpace(estimatedH);

    // Cornice esterna card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, y, contentW, estimatedH, 3, 3, 'FD');

    // Barra intestazione colorata
    const [r, g, b] = options.accentRgb;
    doc.setFillColor(r, g, b);
    doc.roundedRect(margin, y, contentW, 9.5, 3, 3, 'F');
    doc.rect(margin, y + 5, contentW, 4.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(`${options.badge}  |  ${options.title}`, margin + 4, y + 6.4);

    let innerY = y + 14.5;

    preparedSteps.forEach((step, idx) => {
      // Numero cerchiato
      doc.setFillColor(r, g, b);
      doc.circle(margin + 6.5, innerY - 1.2, 2.8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(String(idx + 1), margin + 6.5, innerY - 0.1, { align: 'center' });

      // Titolo passo
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.2);
      doc.text(step.heading, margin + 12, innerY);

      // Descrizione passo
      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.7);
      doc.text(step.lines, margin + 12, innerY + 4.3);

      innerY += step.h;
    });

    if (options.note && noteLines.length > 0) {
      const boxH = noteLines.length * 3.9 + 4.5;
      doc.setFillColor(254, 249, 195);
      doc.setDrawColor(234, 179, 8);
      doc.setLineWidth(0.25);
      doc.roundedRect(margin + 4, innerY - 1, contentW - 8, boxH, 2, 2, 'FD');
      doc.setTextColor(113, 63, 18);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.3);
      doc.text(noteLines, margin + 6.5, innerY + 3.2);
    }

    y += estimatedH + 5;
  };

  // --- PAGINA 1 ---
  drawHeader(false);

  // Box Indirizzo Ufficiale
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(231, 184, 11);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, contentW, 20, 3, 3, 'FD');

  doc.setTextColor(29, 26, 96);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('INDIRIZZO UFFICIALE DA APRIRE SUL TELEFONO O TABLET:', margin + 4, y + 6);

  doc.setTextColor(2, 132, 199);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text(GUIDA_APP_OFFICIAL_URL, margin + 4, y + 12.2);

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.text(
    'Non serve scaricare nulla da App Store o Google Play Store: si installa dal browser e si aggiorna da sola.',
    margin + 4,
    y + 17.3
  );
  y += 25;

  // 1. APPLE + SAFARI
  drawSectionBox({
    badge: 'APPLE iPhone / iPad',
    title: 'INSTALLAZIONE CON SAFARI (Consigliato su iOS)',
    accentRgb: [3, 105, 161],
    steps: [
      {
        heading: 'Apri il sito ufficiale con Safari',
        body: `Avvia il browser Safari sul tuo iPhone o iPad e digita l'indirizzo: ${GUIDA_APP_OFFICIAL_URL}`,
      },
      {
        heading: 'Tocca il pulsante Condividi in basso',
        body: 'Nella barra inferiore di Safari tocca l\'icona Condividi (il quadrato con la freccia rivolta verso l\'alto).',
      },
      {
        heading: 'Seleziona "Aggiungi alla schermata Home"',
        body: 'Scorri verso il basso il menu di condivisione e tocca la voce "Aggiungi alla schermata Home".',
      },
      {
        heading: 'Conferma toccando "Aggiungi"',
        body: 'Tocca "Aggiungi" in alto a destra. Troverai subito l\'icona Croce Oro sulla schermata Home del telefono.',
      },
    ],
  });

  // 2. APPLE + GOOGLE CHROME
  drawSectionBox({
    badge: 'APPLE iPhone / iPad',
    title: 'INSTALLAZIONE CON GOOGLE CHROME',
    accentRgb: [180, 83, 9],
    steps: [
      {
        heading: 'Apri il sito ufficiale con Google Chrome su iPhone / iPad',
        body: `Avvia Google Chrome sul dispositivo Apple e vai su: ${GUIDA_APP_OFFICIAL_URL}`,
      },
      {
        heading: 'Tocca l\'icona Condividi nella barra indirizzi in alto',
        body: 'Tocca l\'icona Condividi (quadrato con freccia verso l\'alto) a destra della barra indirizzi in alto (o nel menu "..." in basso a destra su alcuni modelli).',
      },
      {
        heading: 'Scegli "Aggiungi alla schermata Home"',
        body: 'Scorri le opzioni del foglio di condivisione iOS e seleziona "Aggiungi alla schermata Home".',
      },
      {
        heading: 'Conferma toccando "Aggiungi"',
        body: 'Tocca "Aggiungi" in alto a destra per creare l\'icona dell\'applicazione sulla Home del tuo iPhone/iPad.',
      },
    ],
    note: 'Nota iOS: su versioni di iOS anteriori alla 16.4 la voce "Aggiungi alla schermata Home" potrebbe non comparire in Chrome; in tal caso aprire il link con Safari.',
  });

  // 3. ANDROID + GOOGLE CHROME
  drawSectionBox({
    badge: 'ANDROID Smartphone / Tablet',
    title: 'INSTALLAZIONE CON GOOGLE CHROME (Consigliato)',
    accentRgb: [5, 150, 105],
    steps: [
      {
        heading: 'Apri il sito ufficiale con Google Chrome',
        body: `Avvia Google Chrome sul tuo telefono Android e vai su: ${GUIDA_APP_OFFICIAL_URL}`,
      },
      {
        heading: 'Tocca "Installa App" oppure il menu in alto a destra',
        body: 'Se appare il pulsante verde "Installa App" in alto (o il banner in basso), toccalo. Altrimenti tocca i 3 puntini verticali in alto a destra di Chrome.',
      },
      {
        heading: 'Seleziona "Installa app" o "Aggiungi a schermata Home"',
        body: 'Nel menu scegli "Installa app" (oppure "Aggiungi a schermata Home" -> "Installa", evitando "Crea scorciatoia").',
      },
      {
        heading: 'Conferma "Installa"',
        body: 'Attendi pochi secondi: l\'app Croce Oro comparirà tra le tue applicazioni Android e sulla schermata Home.',
      },
    ],
  });

  // 4. ANDROID + SAFARI / ALTRI BROWSER
  drawSectionBox({
    badge: 'ANDROID - NOTA SAFARI',
    title: 'USO DI SAFARI O ALTRI BROWSER SU ANDROID',
    accentRgb: [71, 85, 105],
    steps: [
      {
        heading: 'Safari non è disponibile su Android',
        body: 'Il browser Safari è esclusivo per dispositivi Apple (iPhone, iPad, Mac). Sui dispositivi Android si raccomanda Google Chrome per la massima compatibilità con notifiche, radio e GPS.',
      },
      {
        heading: 'Installazione con altri browser Android (Samsung Internet / Microsoft Edge)',
        body: `Apri ${GUIDA_APP_OFFICIAL_URL}, tocca il menu del browser (icona con tre linee o tre puntini) e seleziona "Aggiungi pagina a -> Schermata Home" oppure "Installa app".`,
      },
    ],
  });

  // 5. CHECKLIST PRIMO AVVIO & PERMESSI
  drawSectionBox({
    badge: 'OPERATIVITÀ & PERMESSI',
    title: 'PRIMO ACCESSO E AGGIORNAMENTI AUTOMATICI',
    accentRgb: [29, 26, 96],
    steps: [
      {
        heading: 'Apri sempre l\'app dall\'icona Croce Oro sulla Home',
        body: 'L\'applicazione installata sulla Home funziona a schermo intero, mantiene attiva la sessione e si aggiorna automaticamente ad ogni rilascio senza interventi manuali.',
      },
      {
        heading: 'Accesso Account e Permessi Dispositivo',
        body: 'Accedi con il tuo PIN personale e concedi le autorizzazioni richieste (Notifiche Push, Posizione GPS, Microfono/Audio) per ricevere avvisi bacheca, turni, chiamate operative e radio PTT.',
      },
    ],
  });

  // Disegna footer su tutte le pagine con conteggio esatto
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  return doc;
}

export function getGuidaInstallazionePdfBase64(): string {
  const doc = buildGuidaInstallazionePdfDoc();
  const dataUri = doc.output('datauristring');
  return dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
}

export function scaricaGuidaInstallazionePdf(): void {
  const doc = buildGuidaInstallazionePdfDoc();
  doc.save(GUIDA_APP_PDF_FILENAME);
}

export async function inviaGuidaInstallazionePdfEmail(options?: {
  destinatario?: string;
  operatore?: string;
}): Promise<{ ok: boolean; message: string }> {
  const destinatario = (options?.destinatario || GUIDA_APP_PRESIDENZA_EMAIL).trim();
  const pdfBase64 = getGuidaInstallazionePdfBase64();
  try {
    const { authFetch } = await import('./apiAuthFetch');
    const response = await authFetch('/api/invia-email-guida-installazione', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destinatario,
        oggetto: 'Guida Installazione App Croce Oro (Apple & Android - Chrome & Safari) — PDF Ufficiale',
        appUrl: GUIDA_APP_OFFICIAL_URL,
        operatore: options?.operatore || 'Croce Oro Massa Carrara OdV',
        nomeFile: GUIDA_APP_PDF_FILENAME,
        pdfBase64,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && (data?.ok || data?.success || data?.inviata)) {
      return {
        ok: true,
        message: `Guida PDF inviata con successo a ${destinatario}.`,
      };
    }
    return {
      ok: false,
      message:
        data?.error ||
        `Invio email non riuscito (HTTP ${response.status}). Verifica configurazione SMTP del server o scarica il PDF direttamente.`,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Errore di rete durante l\'invio email. Puoi comunque scaricare il PDF direttamente.',
    };
  }
}
