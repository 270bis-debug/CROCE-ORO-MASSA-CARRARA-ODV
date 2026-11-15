import React, { useState } from 'react';
import { X, FileText, PenTool, CheckCircle2, ChevronRight, Eye, ShieldCheck, Download, AlertTriangle } from 'lucide-react';

interface PdfArchiveItemPreview {
  id: string;
  codice: string;
  anno: number;
  mezzo: string;
  data: string;
  kmInizio: number;
  kmFine: number;
  kmTotali: number;
  inAttesaKm: boolean;
  testoCompleto: string;
  indirizzoIntervento?: string;
  destinazione?: string;
  volontarioNome?: string;
  firmaVolontario?: string;
  firmaOperatoreCentrale?: string;
  operatoreCentraleNome?: string;
  dataFirmaCentrale?: string;
  visionatoDaCentrale?: boolean;
  manovreEffettuatePatologie?: string;
}

interface ModalAnteprimaMultiplaProps {
  items: PdfArchiveItemPreview[];
  nomeOperatore: string;
  onClose: () => void;
  onFirmaTutti: (ids: string[]) => void;
  onFirmaSingolo: (item: PdfArchiveItemPreview) => void;
}

export const ModalAnteprimaMultipla: React.FC<ModalAnteprimaMultiplaProps> = ({
  items,
  nomeOperatore,
  onClose,
  onFirmaTutti,
  onFirmaSingolo
}) => {
  const [indiceAttivo, setIndiceAttivo] = useState<number>(0);
  const [visionatiSet, setVisionatiSet] = useState<Set<string>>(() => {
    const s = new Set<string>();
    items.forEach(it => {
      if (it.visionatoDaCentrale) s.add(it.id || it.codice);
    });
    // Il primo elemento aperto è automaticamente visionato
    if (items.length > 0) s.add(items[0].id || items[0].codice);
    return s;
  });

  const itemCorrente = items[indiceAttivo] || items[0];

  const selezionaElemento = (idx: number) => {
    setIndiceAttivo(idx);
    const target = items[idx];
    if (target) {
      setVisionatiSet(prev => new Set(prev).add(target.id || target.codice));
    }
  };

  const segnaTuttiVisionati = () => {
    const all = new Set<string>();
    items.forEach(it => all.add(it.id || it.codice));
    setVisionatiSet(all);
  };

  const daFirmare = items.filter(it => !it.firmaOperatoreCentrale);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-amber-500/80 rounded-3xl max-w-4xl w-full text-white shadow-2xl relative my-auto flex flex-col max-h-[92vh] overflow-hidden">
        {/* Intestazione */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-md">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm text-white uppercase tracking-wide">
                  Visione Anteprima & Firma Simultanea Documenti
                </h3>
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                  {items.length} {items.length === 1 ? 'file selezionato' : 'file selezionati'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Operatore: <strong className="text-amber-400">{nomeOperatore}</strong> • Visiona i documenti prima di apporre la firma precaricata (senza obbligo di download)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo Principale: Lista di Navigazione a sinistra e Dettaglio Anteprima a destra */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Colonna Sinistra: Selettore Documenti Selezionati */}
          <div className="w-full md:w-72 bg-slate-950/80 border-r border-slate-800 p-3 overflow-y-auto shrink-0 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 pb-1">
              <span>Documenti in Revisione</span>
              <button
                type="button"
                onClick={segnaTuttiVisionati}
                className="text-[10px] text-amber-400 hover:text-amber-300 underline font-bold"
              >
                Segna tutti visionati
              </button>
            </div>

            {items.map((it, idx) => {
              const isAttivo = idx === indiceAttivo;
              const isVisionato = visionatiSet.has(it.id || it.codice);
              const isFirmato = Boolean(it.firmaOperatoreCentrale);

              return (
                <button
                  key={it.id || it.codice}
                  type="button"
                  onClick={() => selezionaElemento(idx)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex flex-col gap-1 cursor-pointer ${
                    isAttivo
                      ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono font-bold">
                    <span className={isAttivo ? 'text-amber-400' : 'text-slate-200'}>{it.codice}</span>
                    <span className="text-[10px] text-slate-400">{it.anno}</span>
                  </div>
                  <div className="text-[11px] text-slate-300 flex items-center justify-between">
                    <span>🚑 {it.mezzo}</span>
                    <span className="text-[10px] text-slate-400">{it.kmTotali} KM</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-1 text-[9.5px]">
                    <span className="text-slate-400 truncate max-w-[120px]">
                      👤 {it.volontarioNome || 'Capo Turno'}
                    </span>
                    {isFirmato ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shrink-0">
                        ✓ Firmato
                      </span>
                    ) : isVisionato ? (
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold shrink-0">
                        👁️ Visionato
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shrink-0">
                        ✍️ Da Visionare
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Colonna Destra: Contenuto Anteprima del Documento Attivo */}
          {itemCorrente ? (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-900 overflow-hidden">
              {/* Stato di Firma per il documento corrente */}
              <div className="p-3 sm:p-4 bg-slate-950/40 border-b border-slate-800 shrink-0">
                {itemCorrente.firmaOperatoreCentrale ? (
                  <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400 text-emerald-300 flex items-center justify-center font-bold">
                        ✓
                      </div>
                      <div>
                        <strong className="text-emerald-300 font-bold">FOGLIO DI VIAGGIO FIRMATO DA CENTRALE</strong>
                        <div className="text-[11px] text-slate-300">
                          Operatore: {itemCorrente.operatoreCentraleNome || 'Centrale'} {itemCorrente.dataFirmaCentrale ? `(${itemCorrente.dataFirmaCentrale})` : ''}
                        </div>
                      </div>
                    </div>
                    {itemCorrente.firmaOperatoreCentrale && (
                      <div className="bg-white/90 p-1 rounded border border-emerald-400 shrink-0">
                        <img
                          src={itemCorrente.firmaOperatoreCentrale}
                          alt="Firma Centrale"
                          className="h-6 w-auto max-w-[80px] object-contain"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-950/50 border border-amber-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">👁️</span>
                      <div>
                        <strong className="text-amber-300 font-bold">DOCUMENTO IN ANTEPRIMA • IN ATTESA DI FIRMA</strong>
                        <div className="text-[11px] text-slate-300">
                          Visionato a video dall'Operatore di Centrale. Nessun download richiesto.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onFirmaSingolo(itemCorrente)}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-md active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                      <PenTool className="w-3.5 h-3.5" />
                      <span>Firma Questo Documento</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Riquadro Testo Completo / Dettagli Scheda */}
              <div className="flex-1 overflow-y-auto p-4 font-mono text-xs text-slate-200 whitespace-pre-wrap leading-relaxed bg-slate-950/70 border-b border-slate-800">
                {itemCorrente.testoCompleto}
              </div>

              {/* Sezione Firme e Certificazioni */}
              <div className="p-3 bg-slate-950/90 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs shrink-0">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Firma Volontario / Capo Turno</span>
                    <span className="text-slate-200 font-bold">{itemCorrente.volontarioNome || 'Volontario Bordo'}</span>
                  </div>
                  {itemCorrente.firmaVolontario ? (
                    <div className="bg-white/90 p-0.5 rounded border border-slate-300 shrink-0">
                      <img src={itemCorrente.firmaVolontario} alt="Firma Volontario" className="h-5 w-auto max-w-[70px] object-contain" />
                    </div>
                  ) : (
                    <span className="text-[10px] text-emerald-400 font-bold">✓ Acquisita su Device</span>
                  )}
                </div>

                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Firma Operatore Centrale</span>
                    <span className="text-slate-200 font-bold">{itemCorrente.operatoreCentraleNome || nomeOperatore}</span>
                  </div>
                  {itemCorrente.firmaOperatoreCentrale ? (
                    <div className="bg-white/90 p-0.5 rounded border border-emerald-400 shrink-0">
                      <img src={itemCorrente.firmaOperatoreCentrale} alt="Firma Centrale" className="h-5 w-auto max-w-[70px] object-contain" />
                    </div>
                  ) : (
                    <span className="text-[10px] text-amber-400 font-bold">✍️ In attesa di firma</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs p-6">
              Nessun documento selezionato.
            </div>
          )}
        </div>

        {/* Barra di Azione Inferiore: Firma Simultanea di tutti i documenti */}
        <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Documenti visionati: <strong className="text-white">{visionatiSet.size}</strong> su <strong className="text-white">{items.length}</strong>
              {daFirmare.length > 0 ? ` (${daFirmare.length} da firmare con firma precaricata)` : ' (Tutti già firmati)'}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              Chiudi
            </button>

            {daFirmare.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  segnaTuttiVisionati();
                  onFirmaTutti(daFirmare.map(d => d.id || d.codice));
                }}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                <PenTool className="w-4 h-4" />
                <span>Apponi Firma Simultanea a Tutti i Documenti ({daFirmare.length})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
