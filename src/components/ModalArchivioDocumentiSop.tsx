import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  X,
  Search,
  PlusCircle,
  CheckCircle2,
  FileText,
  ExternalLink,
  Upload,
  Trash2,
  ShieldCheck,
  Eye,
  Users,
  AlertCircle,
  Download,
} from 'lucide-react';
import { SedeAssociativaCompleta } from '../types/adminTypes';
import { Volontario } from './DatabaseVolontariModal';
import {
  CATEGORIE_DOCUMENTI_SOP,
  CategoriaDocumentoSop,
  DOCUMENTI_SOP_UPDATED_EVENT,
  DocumentoAssociativoSop,
  getDocumentiSop,
  salvaDocumentiSop,
} from '../utils/documentiSopStore';
import { leggiAllegatoDocumentoSop } from '../utils/fotoCompressione';
import { formatDateTimeItaly, formatISODateItaly } from '../utils/italianTime';
import { realtime } from '../services/realtime';

interface ModalArchivioDocumentiSopProps {
  aperta: boolean;
  onChiudi: () => void;
  volontarioId?: string;
  volontarioNome: string;
  sezioneVolontarioId?: string;
  canManage: boolean; // Admin o Direttivo
  volontari?: Volontario[];
  sedi?: SedeAssociativaCompleta[];
}

export const ModalArchivioDocumentiSop: React.FC<ModalArchivioDocumentiSopProps> = ({
  aperta,
  onChiudi,
  volontarioId,
  volontarioNome,
  sezioneVolontarioId,
  canManage,
  volontari = [],
  sedi = [],
}) => {
  const [documenti, setDocumenti] = useState<DocumentoAssociativoSop[]>(() => getDocumentiSop());
  const [ricerca, setRicerca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('tutte');
  const [docSelezionato, setDocSelezionato] = useState<DocumentoAssociativoSop | null>(null);
  const [mostraFormNuovo, setMostraFormNuovo] = useState(false);
  const [confermaEliminaId, setConfermaEliminaId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Form nuovo documento
  const [fTitolo, setFTitolo] = useState('');
  const [fCategoria, setFCategoria] = useState<CategoriaDocumentoSop>('Procedure Operative (SOP)');
  const [fVersione, setFVersione] = useState('Rev. 1.0');
  const [fDescrizione, setFDescrizione] = useState('');
  const [fTesto, setFTesto] = useState('');
  const [fUrlEsterno, setFUrlEsterno] = useState('');
  const [fObbligatorio, setFObbligatorio] = useState(true);
  const [fSezioneId, setFSezioneId] = useState('tutte');
  const [fAllegato, setFAllegato] = useState<{ dataUrl: string; nome: string; mime: string; dimensione: number } | null>(null);
  const [erroreForm, setErroreForm] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setDocumenti(getDocumentiSop());
    window.addEventListener(DOCUMENTI_SOP_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(DOCUMENTI_SOP_UPDATED_EVENT, refresh);
  }, []);

  const mostraMsg = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const documentiVisibili = useMemo(() => {
    return documenti.filter((d) => {
      if (!canManage && sezioneVolontarioId && d.sezioneTargetId && d.sezioneTargetId !== 'tutte' && d.sezioneTargetId !== sezioneVolontarioId) {
        return false;
      }
      if (categoriaFiltro !== 'tutte' && d.categoria !== categoriaFiltro) return false;
      if (ricerca.trim()) {
        const q = ricerca.toLowerCase().trim();
        const hit =
          d.titolo.toLowerCase().includes(q) ||
          d.descrizione.toLowerCase().includes(q) ||
          d.categoria.toLowerCase().includes(q) ||
          (d.contenutoTesto || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [documenti, canManage, sezioneVolontarioId, categoriaFiltro, ricerca]);

  const volontariAttiviCount = useMemo(
    () => (volontari || []).filter((v) => v && v.approvato !== false && !v.bloccatoPerTentativi).length,
    [volontari]
  );

  const hasConfermato = (doc: DocumentoAssociativoSop) => {
    const key = volontarioId || volontarioNome;
    return (doc.confermeLettura || []).some(
      (c) => (volontarioId && c.volontarioId === volontarioId) || c.volontarioNome.toLowerCase() === volontarioNome.toLowerCase() || c.volontarioId === key
    );
  };

  const handleConfermaLettura = (doc: DocumentoAssociativoSop) => {
    if (hasConfermato(doc)) return;
    const now = Date.now();
    const nuovaConf = {
      volontarioId: volontarioId || `vol-${volontarioNome.toLowerCase().replace(/\s+/g, '-')}`,
      volontarioNome,
      dataOra: formatDateTimeItaly(),
    };
    const aggiornati = documenti.map((d) =>
      d.id === doc.id
        ? { ...d, confermeLettura: [...(d.confermeLettura || []), nuovaConf], updatedAt: now }
        : d
    );
    const saved = salvaDocumentiSop(aggiornati, now);
    setDocumenti(saved.lista);
    realtime.syncDocumentiSop(saved.lista, saved.updatedAt);
    if (docSelezionato?.id === doc.id) {
      setDocSelezionato(saved.lista.find((x) => x.id === doc.id) || null);
    }
    mostraMsg(`Presa visione confermata su "${doc.titolo}".`);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErroreForm(null);
    try {
      const res = await leggiAllegatoDocumentoSop(file);
      setFAllegato(res);
    } catch (err: any) {
      setErroreForm(err?.message || 'Errore nel caricamento del file.');
    }
  };

  const handleSalvaNuovo = (e: React.FormEvent) => {
    e.preventDefault();
    setErroreForm(null);
    if (!fTitolo.trim()) {
      setErroreForm('Inserisci il titolo del documento.');
      return;
    }
    if (!fTesto.trim() && !fAllegato && !fUrlEsterno.trim()) {
      setErroreForm('Inserisci il testo della procedura, un file allegato (PDF/immagine) oppure un link esterno.');
      return;
    }
    const now = Date.now();
    const sedeObj = sedi.find((s) => s.id === fSezioneId);
    const nuovo: DocumentoAssociativoSop = {
      id: `doc-sop-${now}`,
      titolo: fTitolo.trim(),
      categoria: fCategoria,
      versione: fVersione.trim() || 'Rev. 1.0',
      descrizione: fDescrizione.trim() || fCategoria,
      contenutoTesto: fTesto.trim() || undefined,
      allegatoNome: fAllegato?.nome,
      allegatoDataUrl: fAllegato?.dataUrl,
      allegatoMime: fAllegato?.mime,
      allegatoDimensione: fAllegato?.dimensione,
      urlEsterno: fUrlEsterno.trim() || undefined,
      obbligatorio: fObbligatorio,
      sezioneTargetId: fSezioneId,
      sezioneTargetNome: fSezioneId === 'tutte' ? 'Tutte le Sezioni' : sedeObj?.nome || 'Sezione',
      caricatoDa: volontarioNome,
      dataPubblicazione: formatISODateItaly(),
      confermeLettura: [],
      updatedAt: now,
    };
    const saved = salvaDocumentiSop([nuovo, ...documenti], now);
    setDocumenti(saved.lista);
    realtime.syncDocumentiSop(saved.lista, saved.updatedAt);
    setMostraFormNuovo(false);
    setFTitolo('');
    setFDescrizione('');
    setFTesto('');
    setFUrlEsterno('');
    setFAllegato(null);
    mostraMsg('Documento aggiunto all\'Archivio Documenti & SOP e sincronizzato sul cloud.');
  };

  const handleElimina = (id: string) => {
    if (!canManage) return;
    const now = Date.now();
    const aggiornati = documenti.filter((d) => d.id !== id);
    const saved = salvaDocumentiSop(aggiornati, now);
    setDocumenti(saved.lista);
    realtime.syncDocumentiSop(saved.lista, saved.updatedAt);
    if (docSelezionato?.id === id) setDocSelezionato(null);
    setConfermaEliminaId(null);
    mostraMsg('Documento eliminato dall\'archivio.');
  };

  if (!aperta) return null;

  return (
    <div className="fixed inset-0 z-[130] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-sky-500/70 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-[#1d1a60] to-slate-950 border-b border-sky-500/35 px-4 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/50 text-sky-300 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide truncate">
                Archivio Documenti & Procedure Operative (SOP)
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                Statuto, Regolamento Interno, Polizze Assicurative, Modulistica e Protocolli Operativi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onChiudi}
            className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-3.5 border-b border-slate-800 bg-slate-900/95 space-y-2.5 shrink-0">
          {feedback && (
            <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                placeholder="Cerca procedura, statuto, polizza, modulo..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:ring-1 focus:ring-sky-400"
              />
            </div>

            {canManage && (
              <button
                type="button"
                onClick={() => {
                  setDocSelezionato(null);
                  setMostraFormNuovo((v) => !v);
                }}
                className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{mostraFormNuovo ? 'Chiudi Modulo' : 'Carica Documento / SOP'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setCategoriaFiltro('tutte')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold whitespace-nowrap cursor-pointer ${
                categoriaFiltro === 'tutte' ? 'bg-sky-600 text-white' : 'bg-slate-950 text-slate-300 border border-slate-800'
              }`}
            >
              Tutti ({documenti.length})
            </button>
            {CATEGORIE_DOCUMENTI_SOP.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoriaFiltro(cat)}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold whitespace-nowrap cursor-pointer ${
                  categoriaFiltro === cat ? 'bg-sky-600 text-white' : 'bg-slate-950 text-slate-300 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {mostraFormNuovo && canManage && (
            <form onSubmit={handleSalvaNuovo} className="p-4 rounded-2xl bg-slate-950 border border-sky-500/50 space-y-3">
              <div className="text-xs font-black uppercase text-sky-300">Nuovo Documento / Procedura Operativa (SOP)</div>
              {erroreForm && (
                <div className="p-2 rounded-xl bg-red-950/70 border border-red-500/60 text-red-200 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{erroreForm}</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Titolo Documento *</label>
                  <input
                    type="text"
                    value={fTitolo}
                    onChange={(e) => setFTitolo(e.target.value)}
                    placeholder="Es. SOP-04 Gestione Defibrillatore DAE"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Versione</label>
                  <input
                    type="text"
                    value={fVersione}
                    onChange={(e) => setFVersione(e.target.value)}
                    placeholder="Rev. 1.0"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Categoria</label>
                  <select
                    value={fCategoria}
                    onChange={(e) => setFCategoria(e.target.value as CategoriaDocumentoSop)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                  >
                    {CATEGORIE_DOCUMENTI_SOP.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Destinatari</label>
                  <select
                    value={fSezioneId}
                    onChange={(e) => setFSezioneId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                  >
                    <option value="tutte">Tutte le Sezioni</option>
                    {sedi.map((s) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Breve Descrizione</label>
                <input
                  type="text"
                  value={fDescrizione}
                  onChange={(e) => setFDescrizione(e.target.value)}
                  placeholder="Sintesi del contenuto per i volontari..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Testo Procedura / Circolare</label>
                <textarea
                  rows={4}
                  value={fTesto}
                  onChange={(e) => setFTesto(e.target.value)}
                  placeholder="Inserisci qui il testo consultabile direttamente in app..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Allega PDF o Immagine (max 350 KB)</label>
                  <label className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-dashed border-sky-500/50 text-sky-200 text-xs font-bold flex items-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="truncate">{fAllegato ? fAllegato.nome : 'Seleziona file PDF / JPG / PNG'}</span>
                    <input type="file" accept=".pdf,image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Oppure Link Esterno (Drive / Sito)</label>
                  <input
                    type="url"
                    value={fUrlEsterno}
                    onChange={(e) => setFUrlEsterno(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fObbligatorio}
                  onChange={(e) => setFObbligatorio(e.target.checked)}
                />
                <span>Richiedi conferma di lettura ai volontari (Presa Visione SOP)</span>
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMostraFormNuovo(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black uppercase cursor-pointer"
                >
                  Pubblica in Archivio
                </button>
              </div>
            </form>
          )}

          {docSelezionato ? (
            <div className="p-4 rounded-2xl bg-slate-950 border border-sky-500/50 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-700/60 text-[10px] font-black uppercase">
                      {docSelezionato.categoria}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono">
                      {docSelezionato.versione}
                    </span>
                    {docSelezionato.obbligatorio && (
                      <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/60 text-[10px] font-black uppercase">
                        Lettura Obbligatoria
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-black text-white">{docSelezionato.titolo}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Pubblicato il {docSelezionato.dataPubblicazione} da {docSelezionato.caricatoDa} • {docSelezionato.sezioneTargetNome || 'Tutte le Sezioni'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDocSelezionato(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer shrink-0"
                >
                  ← Elenco
                </button>
              </div>

              {docSelezionato.contenutoTesto && (
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                  {docSelezionato.contenutoTesto}
                </div>
              )}

              {docSelezionato.allegatoDataUrl && (
                <div className="p-3 rounded-xl bg-slate-900 border border-sky-500/40 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-5 h-5 text-sky-400 shrink-0" />
                    <span className="text-xs font-bold text-white truncate">{docSelezionato.allegatoNome || 'Documento allegato'}</span>
                  </div>
                  <a
                    href={docSelezionato.allegatoDataUrl}
                    download={docSelezionato.allegatoNome || 'documento_croce_oro.pdf'}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-black uppercase inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Scarica Allegato</span>
                  </a>
                </div>
              )}

              {docSelezionato.urlEsterno && (
                <a
                  href={docSelezionato.urlEsterno}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-950 border border-indigo-500/50 text-indigo-200 hover:text-white text-xs font-bold"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Apri Documento Esterno</span>
                </a>
              )}

              {/* Conferma lettura */}
              <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                {hasConfermato(docSelezionato) ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-black">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Lettura confermata</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleConfermaLettura(docSelezionato)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Conferma Lettura & Presa Visione</span>
                  </button>
                )}

                {canManage && (
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-sky-400" />
                    <span>
                      Conferme: <strong className="text-white">{(docSelezionato.confermeLettura || []).length}</strong>
                      {volontariAttiviCount > 0 ? ` / ${volontariAttiviCount}` : ''}
                    </span>
                  </span>
                )}
              </div>

              {canManage && (docSelezionato.confermeLettura || []).length > 0 && (
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <div className="text-[10px] font-black uppercase text-slate-400">Volontari che hanno confermato la lettura:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(docSelezionato.confermeLettura || []).map((c) => (
                      <span key={c.volontarioId} className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/60 text-emerald-200 text-[10px]">
                        {c.volontarioNome} ({c.dataOra})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : documentiVisibili.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Nessun documento trovato per i filtri selezionati.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {documentiVisibili.map((doc) => {
                const confermato = hasConfermato(doc);
                return (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-sky-500/50 transition-colors flex flex-col justify-between gap-2.5"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-sky-950/90 text-sky-300 border border-sky-800/60 text-[9.5px] font-black uppercase">
                          {doc.categoria}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">{doc.versione}</span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-black text-white leading-snug">{doc.titolo}</h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{doc.descrizione}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {doc.obbligatorio && (
                          confermato ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[9.5px] font-black inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Letto
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/60 text-[9.5px] font-black">
                              Da leggere
                            </span>
                          )
                        )}
                        {canManage && (
                          <span className="text-[10px] text-slate-400">
                            {(doc.confermeLettura || []).length} conferme
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDocSelezionato(doc)}
                          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-black text-[10.5px] uppercase inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Apri</span>
                        </button>
                        {canManage && (
                          confermaEliminaId === doc.id ? (
                            <button
                              type="button"
                              onClick={() => handleElimina(doc.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-[10px] font-black cursor-pointer"
                            >
                              Conferma
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfermaEliminaId(doc.id)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 cursor-pointer"
                              title="Elimina documento"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
