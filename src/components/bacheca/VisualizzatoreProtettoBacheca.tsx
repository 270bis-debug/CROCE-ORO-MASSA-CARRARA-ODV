import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ShieldCheck,
  Lock,
  Eye,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { TipoAllegatoBacheca, formatDimensioneFile } from '../../utils/bachecaMedia';
import { PdfCanvasViewer } from '../common/PdfCanvasViewer';

// ---------------------------------------------------------------------------
// Estrattore leggero client-side (ZERO download) per anteprima protetta di
// DOCX / XLSX (ZIP + deflate-raw via Web DecompressionStream) e fallback DOC/XLS
// ---------------------------------------------------------------------------
function base64DataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const b64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

async function inflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream non disponibile');
  }
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const copy = new Uint8Array(compressed.byteLength);
  copy.set(compressed);
  writer.write(copy).catch(() => {});
  writer.close().catch(() => {});
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const ch of chunks) {
    out.set(ch, offset);
    offset += ch.byteLength;
  }
  return out;
}

async function readZipEntries(bytes: Uint8Array): Promise<Map<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const entries = new Map<string, string>();

  // Trova End of Central Directory (0x06054b50)
  let eocdOffset = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) return entries;

  const cdCount = view.getUint16(eocdOffset + 10, true);
  let cdOffset = view.getUint32(eocdOffset + 16, true);

  for (let i = 0; i < cdCount; i++) {
    if (cdOffset + 46 > bytes.length || view.getUint32(cdOffset, true) !== 0x02014b50) break;
    const method = view.getUint16(cdOffset + 10, true);
    const compSize = view.getUint32(cdOffset + 20, true);
    const nameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const localHeaderOffset = view.getUint32(cdOffset + 42, true);
    const name = decoder.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen));
    cdOffset += 46 + nameLen + extraLen + commentLen;

    const isInteresting =
      name === 'word/document.xml' ||
      name === 'xl/sharedStrings.xml' ||
      (name.startsWith('xl/worksheets/sheet') && name.endsWith('.xml'));
    if (!isInteresting) continue;

    if (localHeaderOffset + 30 > bytes.length) continue;
    const lhNameLen = view.getUint16(localHeaderOffset + 26, true);
    const lhExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + lhNameLen + lhExtraLen;
    const compSlice = bytes.subarray(dataStart, dataStart + compSize);

    try {
      let raw: Uint8Array;
      if (method === 0) {
        raw = compSlice;
      } else if (method === 8) {
        raw = await inflateRaw(compSlice);
      } else {
        continue;
      }
      entries.set(name, decoder.decode(raw));
    } catch {
      // ignora singolo file non estraibile
    }
  }

  return entries;
}

function extractReadableTextFallback(bytes: Uint8Array): string[] {
  // Estrazione testuale sicura per vecchi binari .doc / .xls (UTF-16LE o Latin-1 leggibile)
  const lines: string[] = [];
  let buf = '';
  for (let i = 0; i < Math.min(bytes.length, 300000); i++) {
    const c = bytes[i];
    if ((c >= 32 && c <= 126) || (c >= 192 && c <= 255)) {
      buf += String.fromCharCode(c);
    } else if (c === 10 || c === 13 || c === 9) {
      if (buf.trim().length >= 4) lines.push(buf.trim());
      buf = '';
    } else {
      if (buf.trim().length >= 6) lines.push(buf.trim());
      buf = '';
    }
  }
  if (buf.trim().length >= 4) lines.push(buf.trim());
  const cleaned = lines
    .filter((l) => /[a-zA-Z0-9àèéìòùÀÈÉÌÒÙ]{3,}/.test(l) && !/^[A-Za-z0-9+/=]{24,}$/.test(l))
    .slice(0, 120);
  return cleaned;
}

interface ParsedOfficePreview {
  kind: 'paragraphs' | 'sheets' | 'fallback';
  paragraphs?: string[];
  sheets?: Array<{ name: string; rows: string[][] }>;
  note?: string;
}

async function parseOfficeAttachmentForProtectedView(
  dataUrl: string,
  fileName: string,
  tipo: 'word' | 'excel'
): Promise<ParsedOfficePreview> {
  const bytes = base64DataUrlToUint8Array(dataUrl);
  const ext = (fileName.split('.').pop() || '').toLowerCase();

  // Controlla se è un archivio ZIP (OOXML: .docx / .xlsx)
  const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (isZip) {
    const entries = await readZipEntries(bytes);
    if (tipo === 'word' && entries.has('word/document.xml')) {
      const xml = entries.get('word/document.xml') || '';
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const pNodes = Array.from(doc.getElementsByTagName('*')).filter((el) => el.localName === 'p');
      const paragraphs = pNodes
        .map((p) => {
          const texts = Array.from(p.getElementsByTagName('*'))
            .filter((el) => el.localName === 't' || el.localName === 'tab')
            .map((el) => (el.localName === 'tab' ? '    ' : el.textContent || ''));
          return texts.join('').trim();
        })
        .filter(Boolean);
      return {
        kind: 'paragraphs',
        paragraphs: paragraphs.length > 0 ? paragraphs : ['(Documento Word vuoto o composto solo da elementi grafici)'],
      };
    }

    if (tipo === 'excel') {
      const sharedStrings: string[] = [];
      const ssXml = entries.get('xl/sharedStrings.xml');
      if (ssXml) {
        const ssDoc = new DOMParser().parseFromString(ssXml, 'application/xml');
        const siNodes = Array.from(ssDoc.getElementsByTagName('*')).filter((el) => el.localName === 'si');
        siNodes.forEach((si) => {
          const txt = Array.from(si.getElementsByTagName('*'))
            .filter((el) => el.localName === 't')
            .map((el) => el.textContent || '')
            .join('');
          sharedStrings.push(txt);
        });
      }

      const sheetKeys = Array.from(entries.keys())
        .filter((k) => k.startsWith('xl/worksheets/sheet') && k.endsWith('.xml'))
        .sort();

      const sheets: Array<{ name: string; rows: string[][] }> = [];
      sheetKeys.forEach((key, idx) => {
        const sXml = entries.get(key) || '';
        const sDoc = new DOMParser().parseFromString(sXml, 'application/xml');
        const rowNodes = Array.from(sDoc.getElementsByTagName('*')).filter((el) => el.localName === 'row');
        const rows: string[][] = [];
        rowNodes.slice(0, 200).forEach((rNode) => {
          const cells = Array.from(rNode.getElementsByTagName('*')).filter((el) => el.localName === 'c');
          const rowVals: string[] = [];
          cells.forEach((cNode) => {
            const tAttr = cNode.getAttribute('t');
            const vNode = Array.from(cNode.children).find((ch) => ch.localName === 'v');
            const isNode = Array.from(cNode.children).find((ch) => ch.localName === 'is');
            let val = '';
            if (tAttr === 's' && vNode?.textContent) {
              const ssIdx = Number(vNode.textContent);
              val = sharedStrings[ssIdx] ?? '';
            } else if (tAttr === 'inlineStr' && isNode) {
              val = isNode.textContent || '';
            } else if (vNode?.textContent) {
              val = vNode.textContent;
            }
            rowVals.push(val);
          });
          if (rowVals.some((v) => v.trim() !== '')) {
            rows.push(rowVals);
          }
        });
        sheets.push({ name: `Foglio ${idx + 1}`, rows });
      });

      if (sheets.length > 0) {
        return { kind: 'sheets', sheets };
      }
    }
  }

  // Fallback per formati binari legacy .doc / .xls
  const fallbackLines = extractReadableTextFallback(bytes);
  return {
    kind: 'fallback',
    paragraphs: fallbackLines,
    note: `File binario legacy (.${ext || tipo}). Visualizzazione protetta in sola lettura senza download.`,
  };
}

// ---------------------------------------------------------------------------
// 1. IMMAGINE POST RESPONSIVE & PROTETTA (disegnata su <canvas> anti-salvataggio)
// ---------------------------------------------------------------------------
interface ImmaginePostProtettaProps {
  dataUrl: string;
  nome?: string;
  titoloPost?: string;
  utenteWatermark?: string;
  onApriProtetto?: () => void;
}

export const ImmaginePostProtetta: React.FC<ImmaginePostProtettaProps> = ({
  dataUrl,
  nome,
  titoloPost,
  utenteWatermark = 'Croce Oro — Solo Visione',
  onApriProtetto,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!dataUrl || !canvasRef.current) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const w = img.naturalWidth || img.width || 640;
      const h = img.naturalHeight || img.height || 400;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      // Filigrana discreta anti-screenshot/condivisione non autorizzata
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = Math.max(1, Math.round(w / 420));
      const fontSize = Math.max(12, Math.min(24, Math.round(w / 32)));
      ctx.font = `700 ${fontSize}px sans-serif`;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-Math.PI / 7);
      const label = `${utenteWatermark} • SOLO VISIONE`;
      ctx.textAlign = 'center';
      ctx.strokeText(label, 0, 0);
      ctx.fillText(label, 0, 0);
      ctx.restore();
      setLoaded(true);
    };
    img.src = dataUrl;
    return () => {
      cancelled = true;
    };
  }, [dataUrl, utenteWatermark]);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onClick={onApriProtetto}
      role={onApriProtetto ? 'button' : undefined}
      tabIndex={onApriProtetto ? 0 : undefined}
      onKeyDown={(e) => {
        if (onApriProtetto && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onApriProtetto();
        }
      }}
      title={onApriProtetto ? 'Clicca per aprire in visualizzazione protetta ingrandita (download disabilitato)' : undefined}
      className={`bacheca-protetta-surface bacheca-protetta-no-print relative group rounded-2xl overflow-hidden bg-slate-950/90 border border-slate-700/80 flex items-center justify-center p-1.5 sm:p-2 ${
        onApriProtetto ? 'cursor-pointer hover:border-violet-400/70 transition-colors' : ''
      }`}
    >
      {/* Immagine adattiva a smartphone, tablet e PC senza ingombrare l'intero schermo */}
      <canvas
        ref={canvasRef}
        aria-label={titoloPost || nome || 'Immagine comunicazione bacheca'}
        className={`block max-w-full w-auto max-h-[210px] sm:max-h-[290px] lg:max-h-[340px] object-contain rounded-xl pointer-events-none select-none ${
          loaded ? 'opacity-100' : 'opacity-0'
        } transition-opacity duration-200`}
      />
      {!loaded && (
        <div className="h-36 w-full flex items-center justify-center text-xs text-slate-400">
          Caricamento immagine protetta...
        </div>
      )}
      {/* Barriera trasparente anti-salvataggio / long-press */}
      <div
        className="absolute inset-0 z-10 bg-transparent"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />
      {/* Badge discreto "Ambiente Protetto" */}
      <div className="absolute bottom-2 right-2 z-20 px-2 py-0.5 rounded-lg bg-slate-950/85 border border-violet-500/50 text-[9.5px] font-bold text-violet-200 flex items-center gap-1 shadow-md pointer-events-none">
        <Lock className="w-2.5 h-2.5 text-violet-300" />
        <span>Solo Visione</span>
        {onApriProtetto && <Eye className="w-2.5 h-2.5 text-emerald-300 ml-0.5" />}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. MODALE VISUALIZZATORE PROTETTO (Immagini + PDF + Word + Excel)
//    - Zero pulsanti download per volontari
//    - Anti-screenshot (PrintScreen, scorciatoie, perdita focus, blur, stampa)
//    - Filigrana utente dinamica
// ---------------------------------------------------------------------------
export interface ContenutoProtettoBacheca {
  titolo: string;
  nomeFile: string;
  dataUrl: string;
  tipo: TipoAllegatoBacheca;
  dimensione?: number;
}

interface ModalVisualizzatoreProtettoProps {
  contenuto: ContenutoProtettoBacheca | null;
  onChiudi: () => void;
  utenteLabel: string;
}

export const ModalVisualizzatoreProtetto: React.FC<ModalVisualizzatoreProtettoProps> = ({
  contenuto,
  onChiudi,
  utenteLabel,
}) => {
  const [oscuratoSicurezza, setOscuratoSicurezza] = useState(false);
  const [motivoOscuramento, setMotivoOscuramento] = useState<string>(
    'Acquisizione schermata, stampa e download non sono consentiti in ambiente protetto.'
  );
  const [zoom, setZoom] = useState(1);
  const [officePreview, setOfficePreview] = useState<ParsedOfficePreview | null>(null);
  const [officeLoading, setOfficeLoading] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Reset stato ad ogni cambio contenuto
  useEffect(() => {
    setOscuratoSicurezza(false);
    setZoom(1);
    setOfficePreview(null);
    setOfficeLoading(false);
  }, [contenuto]);

  // Crea Blob URL temporaneo per PDF (revocato subito alla chiusura, senza attributo download)
  useEffect(() => {
    if (!contenuto || contenuto.tipo !== 'pdf') {
      setPdfBlobUrl(null);
      return;
    }
    try {
      const bytes = base64DataUrlToUint8Array(contenuto.dataUrl);
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      const blob = new Blob([copy], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } catch {
      setPdfBlobUrl(contenuto.dataUrl);
    }
  }, [contenuto]);

  // Parsing protetto per Word / Excel
  useEffect(() => {
    if (!contenuto || (contenuto.tipo !== 'word' && contenuto.tipo !== 'excel')) return;
    let active = true;
    setOfficeLoading(true);
    parseOfficeAttachmentForProtectedView(contenuto.dataUrl, contenuto.nomeFile, contenuto.tipo)
      .then((res) => {
        if (active) setOfficePreview(res);
      })
      .catch(() => {
        if (active) {
          setOfficePreview({
            kind: 'fallback',
            paragraphs: [],
            note: 'Impossibile decodificare il contenuto in anteprima rapida. Il download resta disabilitato per sicurezza.',
          });
        }
      })
      .finally(() => {
        if (active) setOfficeLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contenuto]);

  // Rendering immagine protetta su canvas con filigrana diagonale
  useEffect(() => {
    if (!contenuto || contenuto.tipo !== 'image' || !imageCanvasRef.current) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled || !imageCanvasRef.current) return;
      const canvas = imageCanvasRef.current;
      const w = img.naturalWidth || img.width || 800;
      const h = img.naturalHeight || img.height || 600;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      // Griglia filigrana diagonale
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = Math.max(1, Math.round(w / 500));
      const fontSize = Math.max(14, Math.min(26, Math.round(w / 28)));
      ctx.font = `800 ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      const wm = `${utenteLabel} • CROCE ORO • RISERVATO`;
      const stepX = Math.max(260, Math.round(w / 2.2));
      const stepY = Math.max(150, Math.round(h / 2.6));
      for (let y = -h; y < h * 2; y += stepY) {
        for (let x = -w; x < w * 2; x += stepX) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(-Math.PI / 6);
          ctx.strokeText(wm, 0, 0);
          ctx.fillText(wm, 0, 0);
          ctx.restore();
        }
      }
      ctx.restore();
    };
    img.src = contenuto.dataUrl;
    return () => {
      cancelled = true;
    };
  }, [contenuto, utenteLabel, oscuratoSicurezza]);

  // Protezione attiva anti-screenshot / anti-salvataggio / anti-stampa / cambio finestra
  useEffect(() => {
    if (!contenuto) return;

    const triggerShield = (reason: string) => {
      setMotivoOscuramento(reason);
      setOscuratoSicurezza(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const k = (e.key || '').toLowerCase();
      const ctrlOrMeta = e.ctrlKey || e.metaKey;

      if (e.key === 'Escape') {
        onChiudi();
        return;
      }
      // PrintScreen / Snipping Tool / macOS screenshot shortcuts / Salva / Stampa / Copia / Sorgente / DevTools
      const isPrintScreen = e.key === 'PrintScreen' || e.code === 'PrintScreen';
      const isMacShot = e.metaKey && e.shiftKey && ['3', '4', '5'].includes(k);
      const isWinSnip = (e.metaKey || e.ctrlKey) && e.shiftKey && k === 's';
      const isSavePrintCopy = ctrlOrMeta && ['s', 'p', 'c', 'u'].includes(k);
      const isDevTools = e.key === 'F12' || (ctrlOrMeta && e.shiftKey && ['i', 'j'].includes(k));

      if (isPrintScreen || isMacShot || isWinSnip || isSavePrintCopy || isDevTools) {
        e.preventDefault();
        e.stopPropagation();
        if (isPrintScreen && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText('').catch(() => {});
        }
        triggerShield('Tentativo di acquisizione schermata, copia o salvataggio bloccato.');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText('').catch(() => {});
        }
        triggerShield('Cattura schermata bloccata in ambiente protetto.');
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        triggerShield('Contenuto protetto oscurato al cambio scheda o acquisizione schermo.');
      }
    };

    const handleBlur = () => {
      triggerShield('Contenuto protetto oscurato per perdita focus finestra (protezione anti-screenshot).');
    };

    const handleBeforePrint = () => {
      triggerShield('La stampa dei documenti riservati della bacheca non è consentita.');
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeprint', handleBeforePrint);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeprint', handleBeforePrint);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [contenuto, onChiudi]);

  if (!contenuto) return null;

  const badgeIcon =
    contenuto.tipo === 'excel' ? (
      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
    ) : contenuto.tipo === 'image' ? (
      <ImageIcon className="w-4 h-4 text-sky-400" />
    ) : (
      <FileText className="w-4 h-4 text-violet-400" />
    );

  const modalNode = (
    <div
      className="bacheca-protetta-surface bacheca-protetta-no-print fixed inset-0 z-[260] bg-black/92 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div className="bg-slate-950 border-2 border-violet-500/70 rounded-2xl w-full max-w-5xl h-[92dvh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header Fisso */}
        <div className="px-3.5 py-2.5 sm:px-5 sm:py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-violet-950 border border-violet-500/50 flex items-center justify-center shrink-0">
              {badgeIcon}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-600/60 text-rose-200 text-[9.5px] font-black uppercase inline-flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Ambiente Protetto • No Download • Anti-Screenshot</span>
                </span>
              </div>
              <h4 className="text-xs sm:text-sm font-black text-white truncate mt-0.5">
                {contenuto.nomeFile || contenuto.titolo}
                {contenuto.dimensione ? (
                  <span className="ml-2 text-[10px] font-mono text-slate-400">
                    ({formatDimensioneFile(contenuto.dimensione)})
                  </span>
                ) : null}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {contenuto.tipo === 'image' && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  title="Riduci zoom"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono text-slate-300 w-10 text-center hidden sm:inline">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  title="Ingrandisci"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  title="Ripristina zoom"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onChiudi}
              className="p-2 rounded-xl bg-slate-800 hover:bg-red-600 text-slate-200 hover:text-white transition-colors cursor-pointer"
              title="Chiudi visualizzatore protetto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Area Contenuto Protetto */}
        <div className="relative flex-1 min-h-0 overflow-auto bg-slate-950 flex items-center justify-center p-3 sm:p-5">
          {/* Oscuramento Anti-Screenshot */}
          {oscuratoSicurezza ? (
            <div className="max-w-md w-full p-6 rounded-2xl bg-slate-900 border-2 border-rose-500/70 text-center space-y-3 shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-rose-950 border border-rose-500/50 text-rose-300 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h5 className="text-sm font-black uppercase text-white">Contenuto Temporaneamente Oscurato</h5>
              <p className="text-xs text-slate-300 leading-relaxed">{motivoOscuramento}</p>
              <button
                type="button"
                onClick={() => setOscuratoSicurezza(false)}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs uppercase cursor-pointer"
              >
                Riprendi Visualizzazione Protetta
              </button>
            </div>
          ) : (
            <>
              {/* Filigrana dinamica non-interattiva sopra documenti */}
              <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center overflow-hidden opacity-10 select-none"
              >
                <div className="-rotate-24 text-center text-white font-black uppercase tracking-widest text-sm sm:text-xl whitespace-nowrap">
                  {utenteLabel} • CROCE ORO MASSA CARRARA • SOLO VISIONE PROTETTA
                </div>
              </div>

              {/* 1. IMMAGINE (JPEG / PNG / BMP) su Canvas */}
              {contenuto.tipo === 'image' && (
                <div className="relative flex items-center justify-center w-full h-full overflow-auto">
                  <canvas
                    ref={imageCanvasRef}
                    style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: 'center center',
                    }}
                    className="max-w-full max-h-full object-contain rounded-xl shadow-2xl pointer-events-none select-none transition-transform duration-150"
                  />
                </div>
              )}

              {/* 2. PDF protetto (rendering canvas su smartphone e PC, zero download) */}
              {contenuto.tipo === 'pdf' && (
                <div className="relative w-full h-full rounded-xl overflow-hidden bg-slate-900">
                  {pdfBlobUrl ? (
                    <PdfCanvasViewer
                      pdfUrl={pdfBlobUrl}
                      protectedMode={true}
                      className="w-full h-full border-slate-800"
                    />
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400">Caricamento PDF protetto...</div>
                  )}
                </div>
              )}

              {/* 3. WORD / EXCEL (anteprima sola lettura, zero download) */}
              {(contenuto.tipo === 'word' || contenuto.tipo === 'excel') && (
                <div className="w-full h-full overflow-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
                  {officeLoading ? (
                    <div className="py-12 text-center text-xs text-slate-300 font-bold">
                      Decodifica documento protetto in corso...
                    </div>
                  ) : officePreview?.kind === 'sheets' && officePreview.sheets ? (
                    <div className="space-y-5">
                      {officePreview.sheets.map((sheet, sIdx) => (
                        <div key={sIdx} className="space-y-2">
                          <div className="text-xs font-black uppercase text-emerald-300 flex items-center gap-1.5">
                            <FileSpreadsheet className="w-4 h-4" />
                            <span>{sheet.name}</span>
                          </div>
                          {sheet.rows.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">Foglio vuoto.</p>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-700">
                              <table className="w-full text-left border-collapse text-xs">
                                <tbody>
                                  {sheet.rows.map((row, rIdx) => (
                                    <tr
                                      key={rIdx}
                                      className={
                                        rIdx === 0
                                          ? 'bg-slate-800 text-white font-bold'
                                          : rIdx % 2 === 0
                                          ? 'bg-slate-900/70 text-slate-200'
                                          : 'bg-slate-950/70 text-slate-200'
                                      }
                                    >
                                      {row.map((cell, cIdx) => (
                                        <td
                                          key={cIdx}
                                          className="px-2.5 py-1.5 border border-slate-800 whitespace-pre-wrap"
                                        >
                                          {cell}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-w-3xl mx-auto">
                      {officePreview?.note && (
                        <div className="p-2.5 rounded-xl bg-amber-950/50 border border-amber-600/40 text-[11px] text-amber-200 font-semibold">
                          ℹ️ {officePreview.note}
                        </div>
                      )}
                      {(officePreview?.paragraphs || []).length > 0 ? (
                        officePreview!.paragraphs!.map((p, idx) => (
                          <p key={idx} className="text-xs sm:text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">
                            {p}
                          </p>
                        ))
                      ) : (
                        <div className="py-10 text-center text-xs text-slate-400">
                          Nessun testo estraibile in anteprima rapida per questo file. Il download rimane bloccato per tutela dei dati associativi.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Sicurezza */}
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-2 text-[10.5px] text-slate-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Visione riservata a <strong className="text-slate-200">{utenteLabel}</strong> • Download, copia e screenshot disabilitati</span>
          </span>
          <button
            type="button"
            onClick={onChiudi}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
};
