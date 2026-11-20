import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { eseguiDownloadSicuroPDF } from './pdfAttestatoCorso';

export function generaBytesDaJsPDF(doc: jsPDF): Uint8Array {
  const ab = doc.output('arraybuffer');
  return new Uint8Array(ab);
}

export async function scaricaBytesPDF(bytes: Uint8Array, nomeFile: string): Promise<void> {
  const safeName = nomeFile.toLowerCase().endsWith('.pdf') ? nomeFile : `${nomeFile}.pdf`;
  await eseguiDownloadSicuroPDF(bytes, safeName);
}

/**
 * Avvia la stampa diretta di un PDF tramite iframe nascosto (compatibile con iframe/SPA, senza window.open).
 */
export async function stampaBytesPDF(bytes: Uint8Array, nomeFallback = 'Documento.pdf'): Promise<'printed' | 'fallback_download'> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return 'fallback_download';
  }
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const blob = new Blob([ab as ArrayBuffer], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);

  return new Promise<'printed' | 'fallback_download'>((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');

    let settled = false;
    const cleanup = () => {
      setTimeout(() => {
        try {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        } catch {}
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {}
      }, 60000);
    };

    const failSafe = setTimeout(async () => {
      if (settled) return;
      settled = true;
      try {
        await scaricaBytesPDF(bytes, nomeFallback);
      } catch {}
      cleanup();
      resolve('fallback_download');
    }, 6000);

    iframe.onload = () => {
      if (settled) return;
      clearTimeout(failSafe);
      settled = true;
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        cleanup();
        resolve('printed');
      } catch (err) {
        console.warn('Stampa tramite iframe non disponibile, avvio download fallback:', err);
        scaricaBytesPDF(bytes, nomeFallback)
          .catch(() => {})
          .finally(() => {
            cleanup();
            resolve('fallback_download');
          });
      }
    };

    iframe.onerror = () => {
      if (settled) return;
      clearTimeout(failSafe);
      settled = true;
      scaricaBytesPDF(bytes, nomeFallback)
        .catch(() => {})
        .finally(() => {
          cleanup();
          resolve('fallback_download');
        });
    };

    iframe.src = blobUrl;
    document.body.appendChild(iframe);
  });
}

/**
 * Unisce più PDF in un unico documento multipagina tramite pdf-lib.
 */
export async function unisciPDFBytes(listaBytes: Uint8Array[]): Promise<Uint8Array> {
  if (listaBytes.length === 0) {
    throw new Error('Nessun documento PDF da unire.');
  }
  if (listaBytes.length === 1) {
    return listaBytes[0];
  }
  const merged = await PDFDocument.create();
  for (const raw of listaBytes) {
    const src = await PDFDocument.load(raw);
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const p of pages) {
      merged.addPage(p);
    }
  }
  return await merged.save();
}

export interface PdfBatchItem {
  nomeFile: string;
  bytes: Uint8Array;
}

/**
 * Scarica o stampa uno o più PDF selezionati nella stessa sottosezione.
 * Se i documenti sono più di uno, li unisce in un unico PDF multipagina per evitare blocchi browser
 * e consentire una stampa/download in blocco pulita su PC e smartphone.
 */
export async function scaricaOStampaMultipliPDF(
  lista: PdfBatchItem[],
  azione: 'download' | 'print',
  nomeBundle: string
): Promise<{ count: number; mode: 'single' | 'merged' }> {
  if (lista.length === 0) {
    throw new Error('Seleziona almeno un documento PDF.');
  }
  const mode: 'single' | 'merged' = lista.length === 1 ? 'single' : 'merged';
  const finalBytes = lista.length === 1 ? lista[0].bytes : await unisciPDFBytes(lista.map((x) => x.bytes));
  const rawName = lista.length === 1 ? lista[0].nomeFile : `${nomeBundle}_${lista.length}_documenti.pdf`;
  const finalName = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`;

  if (azione === 'print') {
    await stampaBytesPDF(finalBytes, finalName);
  } else {
    await scaricaBytesPDF(finalBytes, finalName);
  }
  return { count: lista.length, mode };
}
