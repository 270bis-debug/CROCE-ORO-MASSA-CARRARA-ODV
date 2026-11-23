import React, { useState } from 'react';
import {
  Phone,
  Copy,
  Check,
  Search,
  Edit2,
  Trash2,
  PlusCircle,
  Save,
  X,
  RotateCcw,
  FolderPlus,
  CheckCircle2,
  Settings2,
} from 'lucide-react';
import { CroceOroLogo } from './CroceOroLogo';
import {
  CategoriaRubricaUtile,
  VoceRubricaUtile,
  useRubricaNumeriUtili,
  salvaRubricaNumeriUtili,
  ripristinaRubricaNumeriUtiliDefault,
} from '../utils/rubricaNumeriUtiliStore';
import { realtime } from '../services/realtime';

interface ModalNumeriUtiliProps {
  isOpen: boolean;
  onClose: () => void;
  canManage?: boolean;
  operatoreCorrente?: string;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
}

export const ModalNumeriUtili: React.FC<ModalNumeriUtiliProps> = ({
  isOpen,
  onClose,
  canManage = false,
  operatoreCorrente = 'Operatore',
  onNotificaRadio,
}) => {
  const rubrica = useRubricaNumeriUtili();
  const [filtro, setFiltro] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modalitaModifica, setModalitaModifica] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Stato aggiunta nuova categoria
  const [nuovaCatNome, setNuovaCatNome] = useState('');
  const [mostraFormNuovaCat, setMostraFormNuovaCat] = useState(false);

  // Stato rinomina categoria esistente
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatNome, setEditingCatNome] = useState('');

  // Stato aggiunta nuovo numero dentro una categoria
  const [addingVoceCatId, setAddingVoceCatId] = useState<string | null>(null);
  const [newVoceNome, setNewVoceNome] = useState('');
  const [newVoceNumero, setNewVoceNumero] = useState('');
  const [newVoceNote, setNewVoceNote] = useState('');

  // Stato modifica numero esistente
  const [editingVoce, setEditingVoce] = useState<{ catId: string; voceId: string } | null>(null);
  const [editVoceNome, setEditVoceNome] = useState('');
  const [editVoceNumero, setEditVoceNumero] = useState('');
  const [editVoceNote, setEditVoceNote] = useState('');

  // Conferme inline (senza window.confirm / window.alert)
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<string | null>(null);
  const [confirmResetDefault, setConfirmResetDefault] = useState(false);

  if (!isOpen) return null;

  const mostraMsg = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const propagaRubrica = (nuovaLista: CategoriaRubricaUtile[], azioneDesc: string) => {
    const salvata = salvaRubricaNumeriUtili(nuovaLista, true);
    realtime.syncRubricaNumeriUtili(salvata);
    mostraMsg(azioneDesc);
    onNotificaRadio?.(`📞 NUMERI UTILI: ${azioneDesc} (da ${operatoreCorrente})`, 'sistema');
  };

  const handleAggiungiCategoria = (e: React.FormEvent) => {
    e.preventDefault();
    const titolo = nuovaCatNome.trim();
    if (!titolo) return;
    const nuovaCat: CategoriaRubricaUtile = {
      id: `rub-cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      categoria: titolo,
      voci: [],
    };
    propagaRubrica([...rubrica, nuovaCat], `Aggiunta categoria "${titolo}"`);
    setNuovaCatNome('');
    setMostraFormNuovaCat(false);
    setAddingVoceCatId(nuovaCat.id);
  };

  const handleSalvaRinominaCategoria = (catId: string) => {
    const nuovoTitolo = editingCatNome.trim();
    if (!nuovoTitolo) return;
    const aggiornata = rubrica.map((c) =>
      c.id === catId ? { ...c, categoria: nuovoTitolo } : c
    );
    propagaRubrica(aggiornata, `Rinominata categoria in "${nuovoTitolo}"`);
    setEditingCatId(null);
    setEditingCatNome('');
  };

  const handleEliminaCategoria = (catId: string) => {
    const target = rubrica.find((c) => c.id === catId);
    const aggiornata = rubrica.filter((c) => c.id !== catId);
    propagaRubrica(aggiornata, `Rimossa categoria "${target?.categoria || catId}"`);
    setConfirmDeleteCatId(null);
  };

  const handleAggiungiVoce = (e: React.FormEvent, catId: string) => {
    e.preventDefault();
    const nome = newVoceNome.trim();
    const numero = newVoceNumero.trim();
    if (!nome || !numero) return;
    const nuovaVoce: VoceRubricaUtile = {
      id: `rub-v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nome,
      numero,
      note: newVoceNote.trim() || undefined,
    };
    const aggiornata = rubrica.map((c) =>
      c.id === catId ? { ...c, voci: [...c.voci, nuovaVoce] } : c
    );
    propagaRubrica(aggiornata, `Aggiunto numero "${nome}" (${numero})`);
    setNewVoceNome('');
    setNewVoceNumero('');
    setNewVoceNote('');
    setAddingVoceCatId(null);
  };

  const handleAvviaModificaVoce = (catId: string, voce: VoceRubricaUtile) => {
    setEditingVoce({ catId, voceId: voce.id });
    setEditVoceNome(voce.nome);
    setEditVoceNumero(voce.numero);
    setEditVoceNote(voce.note || '');
  };

  const handleSalvaModificaVoce = (catId: string, voceId: string) => {
    const nome = editVoceNome.trim();
    const numero = editVoceNumero.trim();
    if (!nome || !numero) return;
    const aggiornata = rubrica.map((c) => {
      if (c.id !== catId) return c;
      return {
        ...c,
        voci: c.voci.map((v) =>
          v.id === voceId
            ? { ...v, nome, numero, note: editVoceNote.trim() || undefined }
            : v
        ),
      };
    });
    propagaRubrica(aggiornata, `Modificato contatto "${nome}" (${numero})`);
    setEditingVoce(null);
  };

  const handleEliminaVoce = (catId: string, voce: VoceRubricaUtile) => {
    const aggiornata = rubrica.map((c) => {
      if (c.id !== catId) return c;
      return {
        ...c,
        voci: c.voci.filter((v) => v.id !== voce.id),
      };
    });
    propagaRubrica(aggiornata, `Rimosso numero "${voce.nome}"`);
  };

  const handleRipristinaDefault = () => {
    const ripristinata = ripristinaRubricaNumeriUtiliDefault();
    realtime.syncRubricaNumeriUtili(ripristinata);
    setConfirmResetDefault(false);
    mostraMsg('Rubrica Numeri Utili ripristinata ai valori predefiniti e sincronizzata!');
    onNotificaRadio?.(`📞 NUMERI UTILI: Rubrica ripristinata ai valori predefiniti da ${operatoreCorrente}`, 'sistema');
  };

  const query = filtro.trim().toLowerCase();

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border-2 border-[#bfa353] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Intestazione Modale Unificata */}
        <div className="bg-[#1d1a60] text-white p-3.5 sm:p-4 flex items-start sm:items-center justify-between gap-2 border-b-2 border-[#bfa353]">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
            <CroceOroLogo size="sm" className="shrink-0 mt-0.5 sm:mt-0" />
            <div className="min-w-0 flex-1">
              <span className="font-black text-xs sm:text-sm uppercase tracking-wide block text-amber-300 whitespace-normal break-words leading-snug">
                Numeri Utili di Emergenza & Interni
              </span>
              <span className="text-[10px] sm:text-xs text-slate-300 block whitespace-normal break-words leading-snug mt-0.5">
                {modalitaModifica
                  ? 'Modalità Modifica: aggiungi, modifica o rimuovi numeri in tempo reale'
                  : 'Massa-Carrara, NUE 112/118, C.O.C. & Interni Croce Oro'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  setModalitaModifica((prev) => !prev);
                  setConfirmDeleteCatId(null);
                  setConfirmResetDefault(false);
                }}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer border shadow-sm ${
                  modalitaModifica
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-200'
                }`}
                title="Aggiungi, modifica o rimuovi numeri utili e categorie"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>{modalitaModifica ? 'Fine Modifica' : 'Gestisci Numeri'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-amber-300 flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
              title="Chiudi Numeri Utili"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Barra Ricerca + Azioni Rapide Modifica */}
        <div className="p-2.5 sm:p-3 bg-slate-100 border-b border-slate-200 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                placeholder="Cerca comando, C.O.C., Questura, interno o numero..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1d1a60]"
              />
            </div>
            {filtro && (
              <button
                type="button"
                onClick={() => setFiltro('')}
                className="text-[11px] text-slate-700 hover:text-slate-950 px-2.5 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl font-bold cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {canManage && modalitaModifica && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setMostraFormNuovaCat((v) => !v)}
                  className="px-3 py-1.5 rounded-xl bg-[#1d1a60] hover:bg-blue-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-amber-300" />
                  <span>+ Nuova Categoria</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {!confirmResetDefault ? (
                  <button
                    type="button"
                    onClick={() => setConfirmResetDefault(true)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Ripristina Predefiniti</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-amber-100 border border-amber-400 px-2.5 py-1 rounded-xl text-[11px]">
                    <span className="font-bold text-amber-900">Confermi ripristino?</span>
                    <button
                      type="button"
                      onClick={handleRipristinaDefault}
                      className="px-2 py-0.5 rounded bg-amber-600 text-white font-bold cursor-pointer"
                    >
                      Sì
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmResetDefault(false)}
                      className="px-2 py-0.5 rounded bg-white text-slate-700 font-bold cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {canManage && modalitaModifica && mostraFormNuovaCat && (
            <form
              onSubmit={handleAggiungiCategoria}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-indigo-300 shadow-sm"
            >
              <input
                type="text"
                value={nuovaCatNome}
                onChange={(e) => setNuovaCatNome(e.target.value)}
                placeholder="Nome nuova categoria (es. 🏥 Ospedali & Cliniche)..."
                className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#1d1a60]"
                autoFocus
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
              >
                Crea
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostraFormNuovaCat(false);
                  setNuovaCatNome('');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Annulla
              </button>
            </form>
          )}

          {feedback && (
            <div className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}
        </div>

        {/* Lista Categorie & Numeri */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-4 text-xs text-slate-800 flex-1 bg-white">
          {rubrica.map((cat) => {
            const catMatch = !query || cat.categoria.toLowerCase().includes(query);
            const vociFiltrate = query
              ? catMatch
                ? cat.voci
                : cat.voci.filter(
                    (v) =>
                      v.nome.toLowerCase().includes(query) ||
                      v.numero.toLowerCase().includes(query) ||
                      (v.note || '').toLowerCase().includes(query)
                  )
              : cat.voci;

            if (!modalitaModifica && vociFiltrate.length === 0) return null;
            if (modalitaModifica && query && !catMatch && vociFiltrate.length === 0) return null;

            const isEditingCat = editingCatId === cat.id;

            return (
              <div key={cat.id} className="space-y-2">
                {/* Header Categoria */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500/15 px-2.5 py-1.5 rounded-xl border border-amber-500/30">
                  {isEditingCat ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="text"
                        value={editingCatNome}
                        onChange={(e) => setEditingCatNome(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs font-bold rounded border border-amber-500 bg-white text-slate-900 focus:outline-none"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleSalvaRinominaCategoria(cat.id)}
                        className="px-2 py-1 rounded bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
                      >
                        Salva
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCatId(null)}
                        className="px-2 py-1 rounded bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] sm:text-xs font-black uppercase text-[#1d1a60] tracking-wide min-w-0 flex-1 whitespace-normal break-words leading-snug">
                      {cat.categoria} ({vociFiltrate.length})
                    </span>
                  )}

                  {canManage && modalitaModifica && !isEditingCat && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setAddingVoceCatId(cat.id);
                          setNewVoceNome('');
                          setNewVoceNumero('');
                          setNewVoceNote('');
                        }}
                        className="px-2 py-1 rounded-lg bg-[#1d1a60] hover:bg-blue-900 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Aggiungi numero a questa categoria"
                      >
                        <PlusCircle className="w-3 h-3 text-amber-300" />
                        <span>+ Numero</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCatId(cat.id);
                          setEditingCatNome(cat.categoria);
                        }}
                        className="p-1.5 rounded-lg bg-white hover:bg-amber-100 text-slate-700 border border-slate-300 cursor-pointer"
                        title="Rinomina categoria"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {confirmDeleteCatId === cat.id ? (
                        <div className="flex items-center gap-1 bg-red-100 border border-red-400 rounded-lg px-1.5 py-0.5 text-[10px]">
                          <span className="font-bold text-red-800">Elimina?</span>
                          <button
                            type="button"
                            onClick={() => handleEliminaCategoria(cat.id)}
                            className="px-1.5 py-0.5 rounded bg-red-600 text-white font-bold cursor-pointer"
                          >
                            Sì
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteCatId(null)}
                            className="px-1.5 py-0.5 rounded bg-white text-slate-700 font-bold cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteCatId(cat.id)}
                          className="p-1.5 rounded-lg bg-white hover:bg-red-100 text-red-600 border border-red-200 cursor-pointer"
                          title="Elimina categoria"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Form inline Aggiungi Numero in questa categoria */}
                {canManage && modalitaModifica && addingVoceCatId === cat.id && (
                  <form
                    onSubmit={(e) => handleAggiungiVoce(e, cat.id)}
                    className="p-2.5 rounded-xl bg-blue-50 border border-blue-300 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                  >
                    <input
                      type="text"
                      value={newVoceNome}
                      onChange={(e) => setNewVoceNome(e.target.value)}
                      placeholder="Nome (es. Ospedale Apuane)"
                      className="sm:col-span-5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900"
                      required
                      autoFocus
                    />
                    <input
                      type="text"
                      value={newVoceNumero}
                      onChange={(e) => setNewVoceNumero(e.target.value)}
                      placeholder="Numero telefono"
                      className="sm:col-span-3 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 font-mono"
                      required
                    />
                    <input
                      type="text"
                      value={newVoceNote}
                      onChange={(e) => setNewVoceNote(e.target.value)}
                      placeholder="Note (opz.)"
                      className="sm:col-span-2 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900"
                    />
                    <div className="sm:col-span-2 flex items-center gap-1 justify-end">
                      <button
                        type="submit"
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                      >
                        Salva
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingVoceCatId(null)}
                        className="p-1.5 rounded-lg bg-slate-200 text-slate-700 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                )}

                {/* Elenco Voci */}
                <div className="space-y-1.5">
                  {vociFiltrate.length === 0 ? (
                    <div className="text-[11px] text-slate-400 italic px-2 py-1">
                      Nessun numero in questa categoria. Clicca &quot;+ Numero&quot; per aggiungerne uno.
                    </div>
                  ) : (
                    vociFiltrate.map((voce) => {
                      const isCopied = copiedId === voce.id;
                      const isEditingThis =
                        editingVoce?.catId === cat.id && editingVoce?.voceId === voce.id;

                      if (isEditingThis && canManage && modalitaModifica) {
                        return (
                          <div
                            key={voce.id}
                            className="p-2.5 rounded-xl bg-amber-50 border-2 border-amber-400 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                          >
                            <input
                              type="text"
                              value={editVoceNome}
                              onChange={(e) => setEditVoceNome(e.target.value)}
                              placeholder="Nome contatto"
                              className="sm:col-span-5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-semibold text-slate-900"
                            />
                            <input
                              type="text"
                              value={editVoceNumero}
                              onChange={(e) => setEditVoceNumero(e.target.value)}
                              placeholder="Numero"
                              className="sm:col-span-3 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono text-slate-900"
                            />
                            <input
                              type="text"
                              value={editVoceNote}
                              onChange={(e) => setEditVoceNote(e.target.value)}
                              placeholder="Note (opz.)"
                              className="sm:col-span-2 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900"
                            />
                            <div className="sm:col-span-2 flex items-center gap-1 justify-end">
                              <button
                                type="button"
                                onClick={() => handleSalvaModificaVoce(cat.id, voce.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Save className="w-3 h-3" />
                                <span>Salva</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingVoce(null)}
                                className="p-1.5 rounded-lg bg-slate-200 text-slate-700 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={voce.id}
                          className="flex flex-wrap sm:flex-nowrap items-center justify-between p-2.5 rounded-xl bg-slate-50 border-l-4 border-[#1d1a60] hover:bg-slate-100 transition-all shadow-sm gap-x-2.5 gap-y-2"
                        >
                          <div className="min-w-[140px] flex-1">
                            <div className="font-bold text-slate-900 text-xs whitespace-normal break-words leading-snug">
                              {voce.nome}
                            </div>
                            <div className="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap mt-0.5">
                              <span className="font-mono text-[11.5px] font-semibold text-slate-700 tracking-wide whitespace-normal break-words">
                                {voce.numero}
                              </span>
                              {voce.note && (
                                <span className="text-[10.5px] text-slate-500 italic whitespace-normal break-words leading-snug">
                                  • {voce.note}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center flex-wrap gap-1.5 shrink-0 ml-auto">
                            {canManage && modalitaModifica && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleAvviaModificaVoce(cat.id, voce)}
                                  className="h-7 px-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  title="Modifica nome o numero"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span className="hidden sm:inline">Modifica</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEliminaVoce(cat.id, voce)}
                                  className="h-7 px-2 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  title="Rimuovi questo numero"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span className="hidden sm:inline">Rimuovi</span>
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  navigator.clipboard.writeText(voce.numero);
                                } catch {}
                                setCopiedId(voce.id);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              className={`h-7 px-2.5 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-sm active:scale-95 ${
                                isCopied
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                              }`}
                              title="Copia numero"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>{isCopied ? 'Copiato' : 'Copia'}</span>
                            </button>

                            <a
                              href={`tel:${voce.numero}`}
                              className="h-7 bg-[#1d1a60] hover:bg-blue-900 text-white font-bold px-2.5 rounded-lg text-[11px] flex items-center justify-center gap-1 shadow-sm transition-transform active:scale-95"
                            >
                              <Phone className="w-3.5 h-3.5 text-amber-400" />
                              <span>Chiama</span>
                            </a>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          {rubrica.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-xs">
              Nessuna categoria presente. Clicca &quot;+ Nuova Categoria&quot; oppure &quot;Ripristina Predefiniti&quot;.
            </div>
          )}

          {rubrica.length > 0 &&
            query &&
            rubrica.every((cat) => {
              const catMatch = cat.categoria.toLowerCase().includes(query);
              const matched = catMatch
                ? cat.voci
                : cat.voci.filter(
                    (v) =>
                      v.nome.toLowerCase().includes(query) ||
                      v.numero.toLowerCase().includes(query) ||
                      (v.note || '').toLowerCase().includes(query)
                  );
              return matched.length === 0;
            }) && (
              <div className="text-center py-6 text-slate-500 text-xs">
                Nessun contatto trovato per &quot;{filtro}&quot;.
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-2.5 sm:p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span className="font-semibold text-slate-600">
            Centrale Operativa Croce Oro • Rubrica Sincronizzata
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-[#1d1a60] hover:bg-blue-900 text-white font-bold text-xs cursor-pointer"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
};
