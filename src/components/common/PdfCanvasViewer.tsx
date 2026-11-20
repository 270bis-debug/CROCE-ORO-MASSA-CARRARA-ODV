import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ZoomIn, ZoomOut, RotateCcw, AlertTriangle, FileText } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export interface PdfCanvasViewerProps {
  pdfBytes?: Uint8Array | null;
  pdfUrl?: string | null;
  className?: string;
  protectedMode?: boolean;
  emptyMessage?: string;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  pdfBytes,
  pdfUrl,
  className = '',
  protectedMode = false,
  emptyMessage = 'Anteprima PDF non ancora disponibile.'
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pagesHostRef = useRef<HTMLDivElement | null>(null);

  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Misura la larghezza reale del contenitore per adattare perfettamente il PDF su smartphone e PC
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      const w = Math.floor(el.clientWidth);
      if (w > 60) {
        setContainerWidth((prev) => (Math.abs(prev - w) >= 8 ? w : prev));
      }
    };

    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateWidth);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Rendering diretto su Canvas ad alta definizione (compatibile al 100% con Android Chrome, iOS Safari e Desktop)
  useEffect(() => {
    const hasBytes = pdfBytes && pdfBytes.byteLength > 0;
    const hasUrl = Boolean(pdfUrl);
    if (!hasBytes && !hasUrl) {
      setNumPages(0);
      setError(null);
      if (pagesHostRef.current) pagesHostRef.current.replaceChildren();
      return;
    }

    let cancelled = false;
    let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;

    const renderPdf = async () => {
      setLoading(true);
      setError(null);

      try {
        // IMPORTANTE: passare una copia (.slice()) perché PDF.js trasferisce l'ArrayBuffer al Web Worker
        loadingTask = hasBytes
          ? pdfjsLib.getDocument({ data: pdfBytes!.slice() })
          : pdfjsLib.getDocument({ url: pdfUrl! });

        pdfDoc = await loadingTask.promise;
        if (cancelled) return;

        const total = pdfDoc.numPages;
        setNumPages(total);

        const host = pagesHostRef.current;
        if (!host) return;
        host.replaceChildren();

        const fallbackW = typeof window !== 'undefined' ? Math.min(window.innerWidth - 40, 760) : 600;
        const availableW = Math.max(220, (containerWidth || fallbackW) - 20);
        const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.2) : 1;

        for (let pageNum = 1; pageNum <= total; pageNum++) {
          if (cancelled) break;

          const page = await pdfDoc.getPage(pageNum);
          if (cancelled) break;

          const unscaledViewport = page.getViewport({ scale: 1 });
          const fitScale = availableW / unscaledViewport.width;
          const displayScale = Math.max(0.35, fitScale * zoom);
          const viewport = page.getViewport({ scale: displayScale });

          const wrapper = document.createElement('div');
          wrapper.className = 'flex flex-col items-center gap-1.5 w-full';

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
          canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.className =
            'bg-white shadow-xl rounded-md border border-slate-700/80 block shrink-0' +
            (protectedMode ? ' select-none pointer-events-none' : '');

          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          const renderTask = page.render({
            canvasContext: ctx,
            viewport,
            canvas
          });
          await renderTask.promise;
          if (cancelled) break;

          wrapper.appendChild(canvas);

          if (total > 1) {
            const label = document.createElement('div');
            label.className = 'text-[10px] font-mono text-slate-400';
            label.textContent = `Pagina ${pageNum} di ${total}`;
            wrapper.appendChild(label);
          }

          host.appendChild(wrapper);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Errore rendering anteprima PDF su canvas:', err);
          setError(err?.message || 'Impossibile visualizzare l\'anteprima del PDF.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
      try {
        pdfDoc?.cleanup();
      } catch {}
      try {
        loadingTask?.destroy();
      } catch {}
    };
  }, [pdfBytes, pdfUrl, containerWidth, zoom, protectedMode]);

  const hasSource = (pdfBytes && pdfBytes.byteLength > 0) || Boolean(pdfUrl);

  return (
    <div
      ref={containerRef}
      onContextMenu={protectedMode ? (e) => e.preventDefault() : undefined}
      className={`flex flex-col rounded-2xl border-2 border-slate-700 bg-slate-950 overflow-hidden ${className}`}
    >
      {/* Toolbar Anteprima PDF (Zoom e Conteggio Pagine) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900/95 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
          <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>
            {numPages > 0
              ? numPages === 1
                ? '1 pagina A4'
                : `${numPages} pagine`
              : 'Anteprima PDF'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
            disabled={zoom <= 0.75}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 cursor-pointer transition-colors"
            title="Riduci zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-200 cursor-pointer transition-colors"
            title="Adatta allo schermo (100%)"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.25, Number((z + 0.25).toFixed(2))))}
            disabled={zoom >= 2.25}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 cursor-pointer transition-colors"
            title="Ingrandisci"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {zoom !== 1 && (
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 cursor-pointer transition-colors"
              title="Ripristina adattamento"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Area Scrollabile Pagine Renderizzate */}
      <div className="relative flex-1 overflow-auto p-2.5 sm:p-3 bg-slate-900/70 min-h-[260px]">
        {loading && (
          <div className="absolute inset-0 z-10 bg-slate-950/75 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 text-xs text-slate-300 font-bold">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
            <span>Rendering pagine PDF in corso...</span>
          </div>
        )}

        {error ? (
          <div className="p-6 text-center space-y-2 text-rose-300 text-xs">
            <AlertTriangle className="w-6 h-6 mx-auto text-rose-400" />
            <p className="font-bold">{error}</p>
          </div>
        ) : !hasSource ? (
          <div className="p-6 text-center text-xs text-slate-400">{emptyMessage}</div>
        ) : (
          <div ref={pagesHostRef} className="flex flex-col items-center gap-3 min-w-fit" />
        )}
      </div>
    </div>
  );
};
