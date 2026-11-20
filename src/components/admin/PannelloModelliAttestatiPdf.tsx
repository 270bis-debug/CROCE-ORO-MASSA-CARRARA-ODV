import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Upload,
  Trash2,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Hash,
  Sliders,
  Eye,
  Loader2,
  Plus,
  Minus,
  MapPin,
  Sparkles,
  RefreshCw,
  FileCheck2
} from 'lucide-react';
import { PdfCanvasViewer } from '../common/PdfCanvasViewer';
import {
  CorsoFormazione,
  ModelloAttestatoCategoria,
  PosizioneCampoPdfPrestampato,
  TipologiaCorso
} from '../../types/adminTypes';
import {
  TIPOLOGIE_ATTESTATI_DEFAULT,
  EVENTO_MODELLI_ATTESTATI_UPDATED,
  getModelliAttestatiCategoria,
  creaModelloDefaultPerTipologia,
  getPosizioniDefaultPdf,
  salvaModelliAttestatiCategoria,
  uploadPdfPrestampatoPerCategoria,
  rimuoviPdfPrestampatoPerCategoria,
  caricaPdfPrestampatoBytes,
  formattaMatricolaDaModello,
  trovaMassimoProgressivoNeiCorsi,
  getProssimoNumeroEffettivoCategoria
} from '../../utils/modelliAttestatiStore';
import {
  compilaPdfPrestampatoCategoria,
  eseguiDownloadSicuroPDF
} from '../../utils/pdfAttestatoCorso';
import { formatISODateItaly } from '../../utils/italianTime';
import { realtime } from '../../services/realtime';

interface PannelloModelliAttestatiPdfProps {
  corsi: CorsoFormazione[];
  operatoreCorrente?: string;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  onAvviso?: (messaggio: string) => void;
}

type CampoSelezionato = 'campoNomeCognome' | 'campoDataLuogo' | 'campoMatricola';

const COLORI_PRESET = [
  { label: 'Nero', hex: '#000000' },
  { label: 'Blu Istituzionale', hex: '#1d1a60' },
  { label: 'Oro Scuro', hex: '#78350f' },
  { label: 'Grigio Antracite', hex: '#334155' }
];

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const PannelloModelliAttestatiPdf: React.FC<PannelloModelliAttestatiPdfProps> = ({
  corsi,
  operatoreCorrente = 'Operatore Formazione',
  onNotificaRadio,
  onAvviso
}) => {
  const [mappaModelli, setMappaModelli] = useState<Record<string, ModelloAttestatoCategoria>>(() =>
    getModelliAttestatiCategoria()
  );

  // Tutte le tipologie standard + eventuali tipologie personalizzate presenti nei corsi
  const categorieDisponibili = useMemo<TipologiaCorso[]>(() => {
    const set = new Set<TipologiaCorso>(TIPOLOGIE_ATTESTATI_DEFAULT);
    (corsi || []).forEach((c) => {
      if (c.tipologia) set.add(c.tipologia);
    });
    return Array.from(set);
  }, [corsi]);

  const [categoriaSelezionata, setCategoriaSelezionata] = useState<TipologiaCorso>(
    categorieDisponibili[0] || 'Seminario PSV'
  );

  const [draft, setDraft] = useState<ModelloAttestatoCategoria>(() => {
    const initial = getModelliAttestatiCategoria();
    return initial[categorieDisponibili[0] || 'Seminario PSV'] || creaModelloDefaultPerTipologia('Seminario PSV');
  });

  const [dirty, setDirty] = useState(false);
  const [campoAttivo, setCampoAttivo] = useState<CampoSelezionato>('campoNomeCognome');
  const [caricamentoPdf, setCaricamentoPdf] = useState(false);
  const [erroreLocale, setErroreLocale] = useState<string | null>(null);
  const [confermaRimozione, setConfermaRimozione] = useState(false);

  // Dati fittizi per anteprima live PDF
  const [testNome, setTestNome] = useState('MARIO ROSSI');
  const [testLuogo, setTestLuogo] = useState('');
  const [testData, setTestData] = useState(() => formatISODateItaly());

  // Bytes del PDF originale caricato per la categoria corrente
  const [pdfBytesOriginali, setPdfBytesOriginali] = useState<Uint8Array | null>(null);
  const [loadingBytes, setLoadingBytes] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [compilingPreview, setCompilingPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Ascolta aggiornamenti remoti o emissioni attestati da altri tab/operatori
  useEffect(() => {
    const onUpdated = () => {
      const fresh = getModelliAttestatiCategoria();
      setMappaModelli(fresh);
      if (!dirty) {
        const mod = fresh[categoriaSelezionata] || creaModelloDefaultPerTipologia(categoriaSelezionata);
        setDraft(mod);
      }
    };
    window.addEventListener(EVENTO_MODELLI_ATTESTATI_UPDATED, onUpdated);
    return () => window.removeEventListener(EVENTO_MODELLI_ATTESTATI_UPDATED, onUpdated);
  }, [categoriaSelezionata, dirty]);

  // Quando cambia la categoria selezionata, carica il relativo modello e i byte PDF
  useEffect(() => {
    const mod = mappaModelli[categoriaSelezionata] || creaModelloDefaultPerTipologia(categoriaSelezionata);
    setDraft(mod);
    setDirty(false);
    setConfermaRimozione(false);
    setErroreLocale(null);
    setTestLuogo(mod.luogoRilascioDefault || 'Massa');
  }, [categoriaSelezionata]);

  // Carica i byte del PDF quando cambiano categoria, fileName o hasPdfFile
  useEffect(() => {
    let cancelled = false;
    const carica = async () => {
      if (!draft.hasPdfFile) {
        setPdfBytesOriginali(null);
        return;
      }
      setLoadingBytes(true);
      try {
        const bytes = await caricaPdfPrestampatoBytes(draft, realtime.getApiBaseUrl());
        if (!cancelled) {
          setPdfBytesOriginali(bytes);
        }
      } catch {
        if (!cancelled) setPdfBytesOriginali(null);
      } finally {
        if (!cancelled) setLoadingBytes(false);
      }
    };
    carica();
    return () => {
      cancelled = true;
    };
  }, [draft.tipologia, draft.hasPdfFile, draft.fileName, draft.pdfSlug]);

  const prossimoNumeroEffettivo = useMemo(
    () => getProssimoNumeroEffettivoCategoria(draft, corsi),
    [draft, corsi]
  );

  const prossimaMatricolaPreview = useMemo(
    () => formattaMatricolaDaModello(draft, prossimoNumeroEffettivo),
    [draft, prossimoNumeroEffettivo]
  );

  const maxNeiCorsi = useMemo(
    () => trovaMassimoProgressivoNeiCorsi(categoriaSelezionata, corsi),
    [categoriaSelezionata, corsi]
  );

  // Compilazione live (debounced) del PDF di anteprima
  useEffect(() => {
    if (!pdfBytesOriginali || pdfBytesOriginali.length < 100) {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPreviewBlobUrl(null);
      setPreviewBytes(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setCompilingPreview(true);
      try {
        const compiled = await compilaPdfPrestampatoCategoria(pdfBytesOriginali, draft, {
          nomeCognome: testNome || 'MARIO ROSSI',
          luogoRilascio: (testLuogo || draft.luogoRilascioDefault || 'Massa').trim(),
          dataRilascio: testData || formatISODateItaly(),
          matricola: prossimaMatricolaPreview
        });
        if (cancelled) return;
        const blob = new Blob([compiled as any], { type: 'application/pdf' });
        const nextUrl = URL.createObjectURL(blob);
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
        }
        previewUrlRef.current = nextUrl;
        setPreviewBlobUrl(nextUrl);
        setPreviewBytes(compiled);
      } catch (err: any) {
        if (!cancelled) {
          setErroreLocale(err?.message || 'Impossibile generare anteprima del PDF selezionato.');
        }
      } finally {
        if (!cancelled) setCompilingPreview(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pdfBytesOriginali, draft, testNome, testLuogo, testData, prossimaMatricolaPreview]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const aggiornaDraft = (patch: Partial<ModelloAttestatoCategoria>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const aggiornaCampo = (
    campo: CampoSelezionato,
    patch: Partial<PosizioneCampoPdfPrestampato>
  ) => {
    setDraft((prev) => ({
      ...prev,
      [campo]: {
        ...prev[campo],
        ...patch
      }
    }));
    setDirty(true);
  };

  const salvaModelloCorrente = (
    override?: Partial<ModelloAttestatoCategoria>,
    messaggioCustom?: string
  ) => {
    const updatedAt = Date.now();
    const modelloFinale: ModelloAttestatoCategoria = {
      ...draft,
      ...(override || {}),
      tipologia: categoriaSelezionata,
      updatedAt,
      updatedBy: operatoreCorrente
    };
    const mappaCorrente = getModelliAttestatiCategoria();
    const nuovaMappa = {
      ...mappaCorrente,
      [categoriaSelezionata]: modelloFinale
    };
    const saved = salvaModelliAttestatiCategoria(nuovaMappa, updatedAt);
    setMappaModelli(saved.mappa);
    setDraft(saved.mappa[categoriaSelezionata] || modelloFinale);
    setDirty(false);
    realtime.syncModelliAttestatiCategoria(saved.mappa, saved.updatedAt);

    const msg =
      messaggioCustom ||
      `Impostazioni prestampato e matricola salvate per "${categoriaSelezionata}" (prossima: ${formattaMatricolaDaModello(
        modelloFinale,
        getProssimoNumeroEffettivoCategoria(modelloFinale, corsi)
      )}).`;
    onAvviso?.(msg);
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErroreLocale(null);
    setCaricamentoPdf(true);
    try {
      const res = await uploadPdfPrestampatoPerCategoria(
        categoriaSelezionata,
        file,
        realtime.getApiBaseUrl(),
        operatoreCorrente
      );
      // Preserva eventuali modifiche di numerazione/posizioni ancora nel draft
      const modelloUnito: ModelloAttestatoCategoria = {
        ...draft,
        ...res.modello,
        prefissoMatricola: draft.prefissoMatricola,
        cifrePadding: draft.cifrePadding,
        prossimoProgressivo: draft.prossimoProgressivo,
        progressivoImpostatoManualmente: draft.progressivoImpostatoManualmente,
        luogoRilascioDefault: draft.luogoRilascioDefault,
        formatoDataLuogo: draft.formatoDataLuogo,
        campoNomeCognome: draft.campoNomeCognome,
        campoDataLuogo: draft.campoDataLuogo,
        campoMatricola: draft.campoMatricola
      };
      const mappaUnita = {
        ...res.mappa,
        [categoriaSelezionata]: modelloUnito
      };
      const saved = salvaModelliAttestatiCategoria(mappaUnita, res.updatedAt);
      setMappaModelli(saved.mappa);
      setDraft(saved.mappa[categoriaSelezionata] || modelloUnito);
      setPdfBytesOriginali(res.pdfBytes);
      setDirty(false);
      realtime.syncModelliAttestatiCategoria(saved.mappa, saved.updatedAt);

      onAvviso?.(
        `PDF prestampato "${file.name}" caricato e attivato per la categoria "${categoriaSelezionata}".`
      );
      onNotificaRadio?.(
        `📄 PRESTAMPATO ATTESTATI AGGIORNATO: ${operatoreCorrente} ha caricato "${file.name}" per la categoria "${categoriaSelezionata}".`,
        'sistema'
      );
    } catch (err: any) {
      setErroreLocale(err?.message || 'Errore durante il caricamento del file PDF.');
    } finally {
      setCaricamentoPdf(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRimuoviPdf = async () => {
    setCaricamentoPdf(true);
    setErroreLocale(null);
    try {
      const res = await rimuoviPdfPrestampatoPerCategoria(
        categoriaSelezionata,
        realtime.getApiBaseUrl(),
        operatoreCorrente
      );
      setMappaModelli(res.mappa);
      setDraft(res.modello);
      setPdfBytesOriginali(null);
      setDirty(false);
      setConfermaRimozione(false);
      realtime.syncModelliAttestatiCategoria(res.mappa, res.updatedAt);
      onAvviso?.(
        `PDF prestampato rimosso per "${categoriaSelezionata}". La numerazione progressiva è stata conservata.`
      );
    } catch (err: any) {
      setErroreLocale(err?.message || 'Errore durante la rimozione del PDF.');
    } finally {
      setCaricamentoPdf(false);
    }
  };

  const handleRipristinaPosizioni = () => {
    const def = getPosizioniDefaultPdf();
    aggiornaDraft({
      campoNomeCognome: def.campoNomeCognome,
      campoDataLuogo: def.campoDataLuogo,
      campoMatricola: def.campoMatricola
    });
  };

  const handleScaricaProva = async () => {
    if (!previewBytes) return;
    const slug = (draft.pdfSlug || 'prova').replace(/[^a-zA-Z0-9_-]/g, '_');
    await eseguiDownloadSicuroPDF(previewBytes, `Prova_Prestampato_${slug}_${prossimaMatricolaPreview.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
    onAvviso?.('PDF di prova scaricato sul dispositivo.');
  };

  const contaAttestatiCategoria = (tip: TipologiaCorso): number => {
    let count = 0;
    (corsi || []).forEach((c) => {
      if (c.tipologia !== tip) return;
      (c.iscritti || []).forEach((i) => {
        if (i.numeroAttestato && i.esito === 'Idoneo / Superato') count++;
      });
    });
    return count;
  };

  const cfgCampoAttivo = draft[campoAttivo];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Banner Introduttivo */}
      <div className="bg-gradient-to-r from-indigo-950/90 via-slate-900 to-slate-950 p-4 rounded-2xl border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wide">
              Modelli PDF Prestampati per Categoria & Registro Matricole Progressive
            </h3>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              Carica un PDF prestampato per ogni <strong className="text-white">tipologia di corso/formazione</strong> (non per singolo evento). Al rilascio dell&apos;attestato il sistema lascerà intatto il tuo file PDF e compilerà <strong className="text-amber-300">esclusivamente</strong>: <span className="text-white font-semibold">1) Nome e Cognome del corsista</span>, <span className="text-white font-semibold">2) Data e Luogo di rilascio</span> e <span className="text-white font-semibold">3) Numero di Matricola</span> (incrementato automaticamente di +1 ad ogni emissione).
            </p>
          </div>
        </div>
      </div>

      {/* Selettore Categorie (una scheda per ogni tipologia di corso) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categorieDisponibili.map((tip) => {
          const mod = mappaModelli[tip] || creaModelloDefaultPerTipologia(tip);
          const selezionata = tip === categoriaSelezionata;
          const isAttivo = Boolean(mod.attivo && mod.hasPdfFile);
          const nextNum = getProssimoNumeroEffettivoCategoria(mod, corsi);
          const nextMat = formattaMatricolaDaModello(mod, nextNum);
          const emessi = contaAttestatiCategoria(tip);

          return (
            <button
              key={tip}
              type="button"
              onClick={() => setCategoriaSelezionata(tip)}
              className={`text-left p-3.5 rounded-2xl border transition-all cursor-pointer ${
                selezionata
                  ? 'bg-indigo-950/70 border-indigo-400 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-400/50'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-600 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-black text-xs text-white uppercase leading-tight">
                  {tip}
                </div>
                {isAttivo ? (
                  <span className="shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    PDF Attivo
                  </span>
                ) : mod.hasPdfFile ? (
                  <span className="shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    PDF in Pausa
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    Standard
                  </span>
                )}
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Prossima matricola:</span>
                <span className="font-mono font-black text-amber-300 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                  {nextMat}
                </span>
              </div>

              <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400">
                <span className="truncate max-w-[165px]">
                  {mod.hasPdfFile && mod.fileName ? `📄 ${mod.fileName}` : 'Nessun PDF caricato'}
                </span>
                <span className="shrink-0 font-bold text-slate-300">
                  {emessi} emessi
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {erroreLocale && (
        <div className="bg-red-950/70 border border-red-500/60 text-red-200 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{erroreLocale}</span>
        </div>
      )}

      {/* Pannello Configurazione Categoria Selezionata (2 colonne: controlli sx + anteprima live dx) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* COLONNA SINISTRA: Upload, Progressivo Matricola, Posizionamento Campi */}
        <div className="xl:col-span-7 space-y-4">
          {/* SEZIONE A: File PDF Prestampato di Categoria */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-black text-white uppercase tracking-wide">
                  1. File PDF Prestampato — {categoriaSelezionata}
                </h4>
              </div>

              {draft.hasPdfFile && (
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={draft.attivo}
                    onChange={(e) => {
                      const attivo = e.target.checked;
                      salvaModelloCorrente(
                        { attivo },
                        attivo
                          ? `Prestampato PDF attivato per "${categoriaSelezionata}".`
                          : `Prestampato PDF disattivato per "${categoriaSelezionata}" (verrà usato il layout standard).`
                      );
                    }}
                    className="w-4 h-4 rounded accent-emerald-500"
                  />
                  <span className={draft.attivo ? 'text-emerald-300' : 'text-slate-400'}>
                    {draft.attivo ? 'Usa questo PDF Prestampato' : 'Prestampato disattivato'}
                  </span>
                </label>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/80 p-3.5 rounded-xl border border-slate-800">
              <div className="min-w-0">
                {draft.hasPdfFile ? (
                  <div className="space-y-0.5">
                    <div className="text-xs font-black text-emerald-300 flex items-center gap-1.5 truncate">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span className="truncate">{draft.fileName || 'prestampato.pdf'}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Dimensione: {formatBytes(draft.fileSize)}
                      {draft.updatedBy ? ` • Aggiornato da ${draft.updatedBy}` : ''}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-200">
                      Nessun PDF prestampato caricato per questa categoria
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Attualmente viene utilizzato il modello regionale A4 standard. Carica un PDF (max 15 MB) per sostituirlo.
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleUploadFile}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={caricamentoPdf}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  {caricamentoPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{draft.hasPdfFile ? 'Sostituisci PDF' : 'Carica PDF'}</span>
                </button>

                {draft.hasPdfFile && !confermaRimozione && (
                  <button
                    type="button"
                    disabled={caricamentoPdf}
                    onClick={() => setConfermaRimozione(true)}
                    className="px-3 py-2 rounded-xl bg-red-950/70 hover:bg-red-900 text-red-300 border border-red-800/60 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    title="Rimuovi il file PDF prestampato (la numerazione progressiva resta invariata)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Rimuovi</span>
                  </button>
                )}

                {draft.hasPdfFile && confermaRimozione && (
                  <div className="flex items-center gap-1.5 bg-red-950/90 border border-red-500/60 px-2.5 py-1.5 rounded-xl">
                    <span className="text-[11px] font-bold text-red-200">Confermi?</span>
                    <button
                      type="button"
                      onClick={handleRimuoviPdf}
                      className="px-2 py-0.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[11px] font-black cursor-pointer"
                    >
                      Sì, elimina
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfermaRimozione(false)}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                    >
                      Annulla
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SEZIONE B: Controllo & Modifica Numero Progressivo Matricola */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/30 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-black text-white uppercase tracking-wide">
                  2. Controllo & Modifica Numero Progressivo Matricola
                </h4>
              </div>
              <div className="flex items-center gap-2 bg-amber-500/15 border border-amber-500/40 px-3 py-1 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-amber-200">Prossima Matricola:</span>
                <span className="font-mono text-sm font-black text-amber-300">
                  {prossimaMatricolaPreview}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Prossimo Numero Progressivo *
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      aggiornaDraft({
                        prossimoProgressivo: Math.max(0, prossimoNumeroEffettivo - 1),
                        progressivoImpostatoManualmente: true
                      })
                    }
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
                    title="Diminuisci di 1"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={prossimoNumeroEffettivo}
                    onChange={(e) => {
                      const val = Math.max(0, Math.floor(Number(e.target.value) || 0));
                      aggiornaDraft({
                        prossimoProgressivo: val,
                        progressivoImpostatoManualmente: true
                      });
                    }}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-amber-500/50 text-amber-300 font-mono font-black text-center text-sm focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      aggiornaDraft({
                        prossimoProgressivo: prossimoNumeroEffettivo + 1,
                        progressivoImpostatoManualmente: true
                      })
                    }
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
                    title="Aumenta di 1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Si incrementa automaticamente di +1 ad ogni attestato rilasciato.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Prefisso Matricola
                </label>
                <input
                  type="text"
                  value={draft.prefissoMatricola}
                  onChange={(e) => aggiornaDraft({ prefissoMatricola: e.target.value })}
                  placeholder="es. GEV-, BLSD- o vuoto"
                  className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold text-xs focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Lascia vuoto per stampare solo il numero.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Cifre Minime (Zeri)
                </label>
                <select
                  value={draft.cifrePadding}
                  onChange={(e) => aggiornaDraft({ cifrePadding: Number(e.target.value) || 3 })}
                  className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value={1}>1 cifra (es. 5)</option>
                  <option value={2}>2 cifre (es. 05)</option>
                  <option value={3}>3 cifre (es. 005)</option>
                  <option value={4}>4 cifre (es. 0005)</option>
                  <option value={5}>5 cifre (es. 00005)</option>
                  <option value={6}>6 cifre (es. 000005)</option>
                </select>
              </div>
            </div>

            {/* Info stato registro matricole */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/70 px-3 py-2 rounded-xl border border-slate-800 text-[11px]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-300">
                <span>
                  Ultimo emesso:{' '}
                  <strong className="font-mono text-emerald-300">
                    {draft.ultimoNumeroEmesso || 'Nessuno'}
                  </strong>
                </span>
                <span>
                  Massimo registrato nei corsi:{' '}
                  <strong className="font-mono text-indigo-300">
                    {maxNeiCorsi > 0 ? maxNeiCorsi : 'Nessuno'}
                  </strong>
                </span>
              </div>
              {maxNeiCorsi > 0 && prossimoNumeroEffettivo !== maxNeiCorsi + 1 && (
                <button
                  type="button"
                  onClick={() =>
                    aggiornaDraft({
                      prossimoProgressivo: maxNeiCorsi + 1,
                      progressivoImpostatoManualmente: true
                    })
                  }
                  className="px-2.5 py-1 rounded-lg bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 border border-indigo-600/40 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Allinea a {maxNeiCorsi + 1}</span>
                </button>
              )}
            </div>

            {/* Luogo e formato data/luogo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Luogo di Rilascio Predefinito (opzionale)</span>
                </label>
                <input
                  type="text"
                  value={draft.luogoRilascioDefault || ''}
                  onChange={(e) => {
                    aggiornaDraft({ luogoRilascioDefault: e.target.value });
                    if (e.target.value.trim()) setTestLuogo(e.target.value);
                  }}
                  placeholder="Vuoto = città sede prevalente del corso"
                  className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Formato Data e Luogo
                </label>
                <select
                  value={draft.formatoDataLuogo || 'con_li'}
                  onChange={(e) =>
                    aggiornaDraft({
                      formatoDataLuogo: e.target.value === 'virgola' ? 'virgola' : 'con_li'
                    })
                  }
                  className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="con_li">Città, lì GG/MM/AAAA (es. Massa, lì 19/11/2026)</option>
                  <option value="virgola">Città, GG/MM/AAAA (es. Massa, 19/11/2026)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SEZIONE C: Posizionamento dei 3 campi sul prestampato */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-black text-white uppercase tracking-wide">
                  3. Posizionamento dei 3 Campi sul Prestampato PDF
                </h4>
              </div>
              <button
                type="button"
                onClick={handleRipristinaPosizioni}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Ripristina Default</span>
              </button>
            </div>

            {/* Sub-tab 3 campi */}
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'campoNomeCognome', label: '1. Nome e Cognome' },
                  { id: 'campoDataLuogo', label: '2. Data e Luogo' },
                  { id: 'campoMatricola', label: '3. Matricola' }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCampoAttivo(tab.id)}
                  className={`py-2 px-2.5 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer border ${
                    campoAttivo === tab.id
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sliders & Controlli per il campo selezionato */}
            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-bold">Posizione Orizzontale X (%)</label>
                    <span className="font-mono text-indigo-300 font-black">{cfgCampoAttivo.xPercent}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={0.5}
                      value={cfgCampoAttivo.xPercent}
                      onChange={(e) =>
                        aggiornaCampo(campoAttivo, { xPercent: parseFloat(e.target.value) })
                      }
                      className="flex-1 accent-indigo-500"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={cfgCampoAttivo.xPercent}
                      onChange={(e) =>
                        aggiornaCampo(campoAttivo, {
                          xPercent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                        })
                      }
                      className="w-16 p-1 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-center text-xs"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-bold">Posizione Verticale Y (% dall&apos;alto)</label>
                    <span className="font-mono text-indigo-300 font-black">{cfgCampoAttivo.yPercent}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={0.5}
                      value={cfgCampoAttivo.yPercent}
                      onChange={(e) =>
                        aggiornaCampo(campoAttivo, { yPercent: parseFloat(e.target.value) })
                      }
                      className="flex-1 accent-indigo-500"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={cfgCampoAttivo.yPercent}
                      onChange={(e) =>
                        aggiornaCampo(campoAttivo, {
                          yPercent: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                        })
                      }
                      className="w-16 p-1 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-center text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Dimensione Testo (pt)
                  </label>
                  <input
                    type="number"
                    min={7}
                    max={48}
                    step={1}
                    value={cfgCampoAttivo.fontSize}
                    onChange={(e) =>
                      aggiornaCampo(campoAttivo, {
                        fontSize: Math.max(7, Math.min(48, Number(e.target.value) || 14))
                      })
                    }
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Allineamento</label>
                  <select
                    value={cfgCampoAttivo.align}
                    onChange={(e) =>
                      aggiornaCampo(campoAttivo, {
                        align: e.target.value as 'left' | 'center' | 'right'
                      })
                    }
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-xs"
                  >
                    <option value="left">Sinistra</option>
                    <option value="center">Centrato</option>
                    <option value="right">Destra</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Prefisso Testo (opz.)
                  </label>
                  <input
                    type="text"
                    value={cfgCampoAttivo.prefisso || ''}
                    onChange={(e) => aggiornaCampo(campoAttivo, { prefisso: e.target.value })}
                    placeholder={campoAttivo === 'campoMatricola' ? 'es. MATRICOLA: ' : 'Vuoto'}
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-slate-200 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(cfgCampoAttivo.bold)}
                      onChange={(e) => aggiornaCampo(campoAttivo, { bold: e.target.checked })}
                      className="w-4 h-4 accent-indigo-500"
                    />
                    <span>Grassetto</span>
                  </label>

                  <label className="flex items-center gap-1.5 text-slate-200 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(cfgCampoAttivo.uppercase)}
                      onChange={(e) => aggiornaCampo(campoAttivo, { uppercase: e.target.checked })}
                      className="w-4 h-4 accent-indigo-500"
                    />
                    <span>Maiuscolo</span>
                  </label>

                  <label
                    className="flex items-center gap-1.5 text-slate-200 font-bold cursor-pointer"
                    title="Disegna un rettangolo bianco dietro il testo per coprire eventuali segnaposto già stampati sul PDF"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(cfgCampoAttivo.sfondoBianco)}
                      onChange={(e) =>
                        aggiornaCampo(campoAttivo, { sfondoBianco: e.target.checked })
                      }
                      className="w-4 h-4 accent-indigo-500"
                    />
                    <span>Sfondo bianco coprente</span>
                  </label>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-bold">Colore:</span>
                  {COLORI_PRESET.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => aggiornaCampo(campoAttivo, { colorHex: c.hex })}
                      className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform ${
                        (cfgCampoAttivo.colorHex || '#000000').toLowerCase() === c.hex.toLowerCase()
                          ? 'border-amber-400 scale-110'
                          : 'border-slate-600'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    />
                  ))}
                  <input
                    type="color"
                    value={cfgCampoAttivo.colorHex || '#000000'}
                    onChange={(e) => aggiornaCampo(campoAttivo, { colorHex: e.target.value })}
                    className="w-7 h-6 rounded bg-transparent border border-slate-700 cursor-pointer"
                    title="Colore personalizzato"
                  />
                </div>
              </div>
            </div>

            {/* Barra Salvataggio */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="text-[11px] text-slate-400">
                {dirty ? (
                  <span className="text-amber-300 font-bold">
                    ● Modifiche non salvate per &ldquo;{categoriaSelezionata}&rdquo;
                  </span>
                ) : (
                  <span className="text-emerald-400 font-semibold">
                    ✓ Configurazione sincronizzata
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => salvaModelloCorrente()}
                className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 ${
                  dirty
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400/40'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>Salva Progressivo & Posizioni</span>
              </button>
            </div>
          </div>
        </div>

        {/* COLONNA DESTRA: Anteprima Live del PDF Prestampato Compilato */}
        <div className="xl:col-span-5 bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 xl:sticky xl:top-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-black text-white uppercase tracking-wide">
                Anteprima Live Prestampato Compilato
              </h4>
            </div>
            {previewBytes && (
              <button
                type="button"
                onClick={handleScaricaProva}
                className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-black text-[11px] uppercase flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Scarica Prova</span>
              </button>
            )}
          </div>

          {draft.hasPdfFile ? (
            <>
              {/* Campi di prova per verificare il posizionamento */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <div>
                  <label className="block text-slate-400 font-bold mb-0.5">Corsista di prova</label>
                  <input
                    type="text"
                    value={testNome}
                    onChange={(e) => setTestNome(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-0.5">Luogo di prova</label>
                  <input
                    type="text"
                    value={testLuogo}
                    onChange={(e) => setTestLuogo(e.target.value)}
                    placeholder="Massa"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-0.5">Data di prova</label>
                  <input
                    type="date"
                    value={testData}
                    onChange={(e) => setTestData(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold"
                  />
                </div>
              </div>

              <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900 h-[520px] flex items-center justify-center">
                {(loadingBytes || compilingPreview) && (
                  <div className="absolute inset-0 z-10 bg-slate-950/70 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 text-xs text-slate-200 font-bold">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                    <span>
                      {loadingBytes ? 'Caricamento file PDF...' : 'Aggiornamento anteprima...'}
                    </span>
                  </div>
                )}

                {previewBlobUrl ? (
                  <PdfCanvasViewer
                    pdfUrl={previewBlobUrl}
                    className="w-full h-full border-0 rounded-none"
                  />
                ) : (
                  <div className="p-6 text-center space-y-2 text-slate-400 text-xs">
                    <AlertTriangle className="w-7 h-7 mx-auto text-amber-400" />
                    <p className="font-bold text-slate-200">
                      File PDF non ancora disponibile nella cache locale.
                    </p>
                    <p>
                      Ricarica il file PDF usando il pulsante &ldquo;Sostituisci PDF&rdquo; per visualizzare l&apos;anteprima immediata.
                    </p>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                <Sparkles className="w-3.5 h-3.5 inline text-amber-400 mr-1" />
                Regola le coordinate <strong className="text-slate-200">X (%)</strong> e <strong className="text-slate-200">Y (%)</strong> a sinistra finché i 3 testi non combaciano esattamente con gli spazi del tuo PDF prestampato, poi clicca <strong className="text-emerald-300">Salva Progressivo &amp; Posizioni</strong>.
              </p>
            </>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/50 p-8 text-center space-y-3 h-[380px] flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-xs">
                <div className="text-sm font-black text-white">
                  Carica il PDF Prestampato per &ldquo;{categoriaSelezionata}&rdquo;
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Una volta caricato, vedrai qui l&apos;anteprima reale del tuo PDF con i 3 campi (Nome e Cognome, Data e Luogo, Matricola <span className="font-mono text-amber-300">{prossimaMatricolaPreview}</span>) posizionabili al millimetro.
                </p>
              </div>
              <button
                type="button"
                disabled={caricamentoPdf}
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Seleziona File PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
