import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Eye,
  Printer,
  Save,
  ArrowLeft,
  Download,
  X,
  FileText,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Send
} from 'lucide-react';
import { scaricaBytesPDF, stampaBytesPDF } from '../../utils/pdfWorkflowUtils';
import { PdfCanvasViewer } from '../common/PdfCanvasViewer';

export interface PdfAnteprimaWorkflowModalProps {
  aperto: boolean;
  titoloDocumento: string;
  sottotitolo?: string;
  nomeFile: string;
  generaPdfBytes: () => Promise<Uint8Array> | Uint8Array;
  riepilogoContenuto?: React.ReactNode;
  giaSalvatoInArchivio?: boolean;
  mostraSalvaInArchivio?: boolean;
  testoSalvaInArchivio?: string;
  testoTornaModifica?: string;
  onSalvaInArchivio?: () => Promise<void> | void;
  onSalvaEInvia?: (pdfBytes: Uint8Array) => Promise<boolean | void> | boolean | void;
  salvaEInviaDisabilitato?: boolean;
  testoSalvaEInvia?: string;
  giaInviatoEmail?: boolean;
  infoInvioEmail?: React.ReactNode;
  onTornaAllaModifica: () => void;
  onChiudi: () => void;
  onFeedback?: (messaggio: string) => void;
}

export const PdfAnteprimaWorkflowModal: React.FC<PdfAnteprimaWorkflowModalProps> = ({
  aperto,
  titoloDocumento,
  sottotitolo,
  nomeFile,
  generaPdfBytes,
  riepilogoContenuto,
  giaSalvatoInArchivio = false,
  mostraSalvaInArchivio = true,
  testoSalvaInArchivio = 'Salva in Archivio',
  testoTornaModifica = 'Torna indietro alla modifica',
  onSalvaInArchivio,
  onSalvaEInvia,
  salvaEInviaDisabilitato = false,
  testoSalvaEInvia = 'Salva & Invia',
  giaInviatoEmail = false,
  infoInvioEmail,
  onTornaAllaModifica,
  onChiudi,
  onFeedback
}) => {
  const [vista, setVista] = useState<'riepilogo' | 'pdf'>('riepilogo');
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [caricamentoPdf, setCaricamentoPdf] = useState(false);
  const [errorePdf, setErrorePdf] = useState<string | null>(null);
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);
  const [invioEmailInCorso, setInvioEmailInCorso] = useState(false);
  const [stampaInCorso, setStampaInCorso] = useState(false);
  const [salvatoLocalmente, setSalvatoLocalmente] = useState(false);
  const [inviatoLocalmente, setInviatoLocalmente] = useState(false);

  const isSalvato = giaSalvatoInArchivio || salvatoLocalmente;
  const isInviato = giaInviatoEmail || inviatoLocalmente;

  // Ref stabili per evitare che i re-render periodici del genitore rigenerino in loop il PDF
  const generaPdfBytesRef = useRef(generaPdfBytes);
  generaPdfBytesRef.current = generaPdfBytes;
  const onChiudiRef = useRef(onChiudi);
  onChiudiRef.current = onChiudi;

  const compilaPdf = useCallback(async (): Promise<Uint8Array | null> => {
    setCaricamentoPdf(true);
    setErrorePdf(null);
    try {
      const bytes = await Promise.resolve(generaPdfBytesRef.current());
      setPdfBytes(bytes);
      return bytes;
    } catch (err: any) {
      console.error('Errore generazione anteprima PDF:', err);
      setErrorePdf(err?.message || 'Impossibile generare l\'anteprima del documento PDF.');
      return null;
    } finally {
      setCaricamentoPdf(false);
    }
  }, []);

  useEffect(() => {
    if (!aperto) {
      setPdfBytes(null);
      setErrorePdf(null);
      setSalvatoLocalmente(false);
      setInviatoLocalmente(false);
      setVista('riepilogo');
      return;
    }
    compilaPdf();
  }, [aperto, nomeFile, titoloDocumento, compilaPdf]);

  useEffect(() => {
    if (!aperto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChiudiRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aperto]);

  if (!aperto) return null;

  const handleVisualizzaAnteprimaPdf = async () => {
    setVista('pdf');
    if (!pdfBytes) {
      await compilaPdf();
    }
  };

  const handleAnteprimaEStampa = async () => {
    setVista('pdf');
    setStampaInCorso(true);
    try {
      const bytes = pdfBytes || (await compilaPdf());
      if (!bytes) return;
      const esito = await stampaBytesPDF(bytes, nomeFile);
      onFeedback?.(
        esito === 'printed'
          ? `Finestra di stampa aperta per ${nomeFile}.`
          : `Documento ${nomeFile} scaricato per la stampa.`
      );
    } finally {
      setStampaInCorso(false);
    }
  };

  const handleScaricaPdf = async () => {
    const bytes = pdfBytes || (await compilaPdf());
    if (!bytes) return;
    await scaricaBytesPDF(bytes, nomeFile);
    onFeedback?.(`Documento PDF ${nomeFile} scaricato.`);
  };

  const handleSalvaArchivio = async () => {
    if (!onSalvaInArchivio || isSalvato || salvataggioInCorso) return;
    setSalvataggioInCorso(true);
    try {
      await Promise.resolve(onSalvaInArchivio());
      setSalvatoLocalmente(true);
    } finally {
      setSalvataggioInCorso(false);
    }
  };

  const handleSalvaEInvia = async () => {
    if (!onSalvaEInvia || salvaEInviaDisabilitato || invioEmailInCorso) return;
    setInvioEmailInCorso(true);
    try {
      const bytes = pdfBytes || (await compilaPdf());
      if (!bytes) return;
      const esito = await Promise.resolve(onSalvaEInvia(bytes));
      if (esito !== false) {
        setSalvatoLocalmente(true);
        setInviatoLocalmente(true);
      }
    } finally {
      setInvioEmailInCorso(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onChiudi();
      }}
    >
      <div
        className="bg-slate-900 border-2 border-indigo-500/60 text-slate-100 rounded-2xl sm:rounded-3xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[94dvh] my-auto overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Compatto Fisso (titolo + chiusura sempre raggiungibile) */}
        <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-800 bg-slate-900 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-950 border border-indigo-500/50 text-indigo-300 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-indigo-300">
                Verifica & Conferma Prima della Generazione PDF
              </div>
              <h3 className="text-sm sm:text-base font-black text-white uppercase truncate">
                {titoloDocumento}
              </h3>
              {sottotitolo && (
                <p className="text-[11px] text-slate-400 truncate">{sottotitolo}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onChiudi}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
            title="Chiudi (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Area Unica Scrollabile (Switch + Anteprima PDF completa + Info Email + Pulsanti Azione) */}
        <div className="flex-1 overflow-y-auto min-h-0 px-3.5 py-3 sm:px-5 sm:py-4 space-y-3 overscroll-contain">
          {/* Barra Switch Riepilogo / Anteprima PDF Reale + Stato Archivio */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setVista('riepilogo')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5 cursor-pointer transition-all ${
                  vista === 'riepilogo'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Riepilogo Dati</span>
              </button>
              <button
                type="button"
                onClick={handleVisualizzaAnteprimaPdf}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-black uppercase flex items-center gap-1.5 cursor-pointer transition-all ${
                  vista === 'pdf'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Anteprima PDF Reale</span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {isSalvato && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-500/50 text-emerald-300 text-[11px] font-black uppercase">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Salvato in Archivio</span>
                </span>
              )}
              <button
                type="button"
                disabled={caricamentoPdf || !pdfBytes}
                onClick={handleScaricaPdf}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-300 border border-slate-700 text-[11px] font-black uppercase flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Scarica subito una copia del PDF"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Scarica PDF</span>
              </button>
            </div>
          </div>

          {errorePdf && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/60 text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorePdf}</span>
            </div>
          )}

          {/* Riepilogo Dati oppure Anteprima PDF Reale a pagina intera */}
          {vista === 'riepilogo' && riepilogoContenuto ? (
            <div className="bg-white text-slate-900 rounded-2xl p-4 sm:p-5 shadow-inner border border-slate-200">
              {riepilogoContenuto}
            </div>
          ) : (
            <div>
              {caricamentoPdf && !pdfBytes ? (
                <div className="py-16 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
                  <span>Generazione anteprima documento PDF in corso...</span>
                </div>
              ) : pdfBytes ? (
                <PdfCanvasViewer
                  pdfBytes={pdfBytes}
                  autoHeight={true}
                  className="w-full"
                />
              ) : (
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                  Anteprima PDF non ancora generata. Clicca su <strong>Anteprima Documento</strong> qui sotto.
                </div>
              )}
            </div>
          )}

          {/* Banner informativo destinatario email & CC Tesoriere (quando Salva & Invia è attivo) */}
          {infoInvioEmail && (
            <div className="pt-1">
              {infoInvioEmail}
            </div>
          )}

          {/* Pulsanti Azione (scrollabili insieme alla schermata, mai bloccati sopra il PDF) */}
          <div
            className={`pt-3 border-t border-slate-800 grid grid-cols-2 ${
              onSalvaEInvia ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
            } gap-2 pb-1`}
          >
            {/* Torna indietro alla modifica */}
            <button
              type="button"
              onClick={onTornaAllaModifica}
              className="w-full px-2.5 sm:px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-black text-[11px] uppercase flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4 shrink-0 text-amber-400" />
              <span className="leading-tight text-center">{testoTornaModifica}</span>
            </button>

            {/* Anteprima Documento */}
            <button
              type="button"
              onClick={handleVisualizzaAnteprimaPdf}
              disabled={caricamentoPdf}
              className={`w-full px-2.5 sm:px-3 py-2.5 rounded-xl border font-black text-[11px] uppercase flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all ${
                vista === 'pdf'
                  ? 'bg-sky-600 hover:bg-sky-500 border-sky-400 text-white shadow-md'
                  : 'bg-sky-950/70 hover:bg-sky-900/80 border-sky-500/60 text-sky-200'
              }`}
            >
              <Eye className="w-4 h-4 shrink-0" />
              <span className="leading-tight text-center">Anteprima Documento</span>
            </button>

            {/* Anteprima & Stampa */}
            <button
              type="button"
              disabled={stampaInCorso || caricamentoPdf}
              onClick={handleAnteprimaEStampa}
              className="w-full px-2.5 sm:px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 border border-indigo-400 text-white font-black text-[11px] uppercase flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all"
            >
              {stampaInCorso ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <Printer className="w-4 h-4 shrink-0" />
              )}
              <span className="leading-tight text-center">Anteprima & Stampa</span>
            </button>

            {/* Salva in Archivio */}
            {mostraSalvaInArchivio && onSalvaInArchivio ? (
              <button
                type="button"
                disabled={salvataggioInCorso || isSalvato}
                onClick={handleSalvaArchivio}
                className={`w-full px-2.5 sm:px-3 py-2.5 rounded-xl border font-black text-[11px] uppercase flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all ${
                  isSalvato
                    ? 'bg-emerald-950 border-emerald-500/60 text-emerald-300 cursor-default'
                    : 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white'
                }`}
              >
                {salvataggioInCorso ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : isSalvato ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <Save className="w-4 h-4 shrink-0" />
                )}
                <span className="leading-tight text-center">
                  {isSalvato ? 'Salvato in Archivio ✓' : testoSalvaInArchivio}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleScaricaPdf}
                disabled={caricamentoPdf || !pdfBytes}
                className="w-full px-2.5 sm:px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 border border-emerald-400 text-white font-black text-[11px] uppercase flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition-all"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span className="leading-tight text-center">Scarica PDF</span>
              </button>
            )}

            {/* Salva & Invia (solo per Ricevute e Note di Debito) */}
            {onSalvaEInvia && (
              <button
                type="button"
                disabled={invioEmailInCorso || caricamentoPdf || salvaEInviaDisabilitato}
                onClick={handleSalvaEInvia}
                title={
                  salvaEInviaDisabilitato
                    ? 'Inserisci un indirizzo email ordinario (non PEC) del destinatario per usare Salva & Invia'
                    : 'Salva il documento in archivio e invialo via email al destinatario con il Tesoriere in copia (CC)'
                }
                className={`col-span-2 lg:col-span-1 w-full px-2.5 sm:px-3 py-2.5 rounded-xl border font-black text-[11px] uppercase flex items-center justify-center gap-1.5 shadow-md transition-all ${
                  salvaEInviaDisabilitato
                    ? 'bg-slate-800/80 border-slate-700 text-slate-500 cursor-not-allowed'
                    : isInviato
                      ? 'bg-amber-950 border-amber-500/70 text-amber-200 hover:bg-amber-900 cursor-pointer active:scale-95'
                      : 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950 cursor-pointer active:scale-95'
                }`}
              >
                {invioEmailInCorso ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : isInviato ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <Send className="w-4 h-4 shrink-0" />
                )}
                <span className="leading-tight text-center">
                  {invioEmailInCorso
                    ? 'Invio in corso...'
                    : isInviato
                      ? 'Salvato & Inviato ✓'
                      : testoSalvaEInvia}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
