import React, { useState } from 'react';
import {
  PlusCircle,
  Edit2,
  Trash2,
  Save,
  X,
  Check,
  Copy,
  CreditCard,
  Heart,
  Landmark,
  CheckCircle2,
  Power
} from 'lucide-react';
import {
  MetodoPagamentoPersonalizzato,
  TipoMetodoPagamentoCustom,
  useMetodiPagamentoCustom,
  salvaMetodiPagamentoCustom
} from '../../utils/metodiPagamentoStore';
import { inviaNotificaModificaAdmin } from '../../utils/notificaModificaAdmin';
import { formatISODateItaly } from '../../utils/italianTime';

interface GestioneMetodiPagamentoCustomPanelProps {
  operatoreCorrente?: string;
  isAdmin?: boolean;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  onAvviso?: (msg: string) => void;
  intestatarioDefault?: string;
  fonteSezione?: string;
}

export const GestioneMetodiPagamentoCustomPanel: React.FC<GestioneMetodiPagamentoCustomPanelProps> = ({
  operatoreCorrente = 'Amministratore',
  isAdmin = true,
  onNotificaRadio,
  onAvviso,
  intestatarioDefault = 'CROCE ORO MASSA CARRARA ODV',
  fonteSezione = 'Coordinate Bancarie & Postali'
}) => {
  const metodiCustom = useMetodiPagamentoCustom();

  const [formAperto, setFormAperto] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoMetodoPagamentoCustom>('entrambi');
  const [coordinateODettagli, setCoordinateODettagli] = useState('');
  const [intestatario, setIntestatario] = useState(intestatarioDefault);
  const [note, setNote] = useState('');
  const [attivo, setAttivo] = useState(true);
  const [confermaEliminaId, setConfermaEliminaId] = useState<string | null>(null);
  const [copiatoId, setCopiatoId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setNome('');
    setTipo('entrambi');
    setCoordinateODettagli('');
    setIntestatario(intestatarioDefault);
    setNote('');
    setAttivo(true);
    setFormAperto(false);
  };

  const apriNuovo = () => {
    setEditingId(null);
    setNome('');
    setTipo('entrambi');
    setCoordinateODettagli('');
    setIntestatario(intestatarioDefault);
    setNote('');
    setAttivo(true);
    setFormAperto(true);
  };

  const apriModifica = (m: MetodoPagamentoPersonalizzato) => {
    setEditingId(m.id);
    setNome(m.nome);
    setTipo(m.tipo);
    setCoordinateODettagli(m.coordinateODettagli || '');
    setIntestatario(m.intestatario || intestatarioDefault);
    setNote(m.note || '');
    setAttivo(m.attivo !== false);
    setFormAperto(true);
  };

  const handleSalva = (e: React.FormEvent) => {
    e.preventDefault();
    const nomeTrim = nome.trim();
    if (!nomeTrim) return;

    const adesso = formatISODateItaly();
    let aggiornati: MetodoPagamentoPersonalizzato[];
    if (editingId) {
      aggiornati = metodiCustom.map((m) =>
        m.id === editingId
          ? {
              ...m,
              nome: nomeTrim,
              tipo,
              coordinateODettagli: coordinateODettagli.trim(),
              intestatario: intestatario.trim() || intestatarioDefault,
              note: note.trim() || undefined,
              attivo
            }
          : m
      );
    } else {
      const nuovo: MetodoPagamentoPersonalizzato = {
        id: `mp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nome: nomeTrim,
        tipo,
        coordinateODettagli: coordinateODettagli.trim(),
        intestatario: intestatario.trim() || intestatarioDefault,
        note: note.trim() || undefined,
        attivo,
        dataCreazione: adesso
      };
      aggiornati = [nuovo, ...metodiCustom];
    }

    salvaMetodiPagamentoCustom(aggiornati);
    const msgAzione = editingId
      ? `Metodo di pagamento/donazione "${nomeTrim}" aggiornato e collegato a tutti i moduli.`
      : `Nuovo metodo di pagamento/donazione "${nomeTrim}" aggiunto e disponibile in tutto il gestionale.`;
    onAvviso?.(msgAzione);
    onNotificaRadio?.(
      `💳 METODI PAGAMENTO (${fonteSezione}): ${editingId ? 'Aggiornato' : 'Aggiunto'} metodo "${nomeTrim}" (${
        tipo === 'entrambi' ? 'Donazioni & Pagamenti' : tipo === 'donazioni' ? 'Solo Donazioni' : 'Solo Pagamenti'
      })`,
      'sistema'
    );
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'contabilita',
        editingId ? 'Modifica metodo pagamento/donazione' : 'Nuovo metodo pagamento/donazione',
        msgAzione,
        operatoreCorrente
      );
    }
    resetForm();
  };

  const handleToggleAttivo = (m: MetodoPagamentoPersonalizzato) => {
    const aggiornati = metodiCustom.map((x) =>
      x.id === m.id ? { ...x, attivo: !x.attivo } : x
    );
    salvaMetodiPagamentoCustom(aggiornati);
    onAvviso?.(`Metodo "${m.nome}" ${!m.attivo ? 'attivato' : 'disattivato'}.`);
  };

  const handleElimina = (m: MetodoPagamentoPersonalizzato) => {
    const aggiornati = metodiCustom.filter((x) => x.id !== m.id);
    salvaMetodiPagamentoCustom(aggiornati);
    setConfermaEliminaId(null);
    onAvviso?.(`Metodo "${m.nome}" rimosso dall'elenco.`);
    onNotificaRadio?.(`🗑️ METODI PAGAMENTO: Rimosso metodo "${m.nome}" da ${operatoreCorrente}`, 'sistema');
  };

  const copiaCoordinate = (testo: string, key: string) => {
    if (!testo) return;
    navigator.clipboard?.writeText(testo).catch(() => {});
    setCopiatoId(key);
    setTimeout(() => setCopiatoId(null), 2000);
  };

  const renderBadgeTipo = (t: TipoMetodoPagamentoCustom) => {
    if (t === 'donazioni') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-pink-950/80 text-pink-300 border border-pink-500/40 inline-flex items-center gap-1">
          <Heart className="w-3 h-3" />
          Solo Donazioni
        </span>
      );
    }
    if (t === 'pagamenti') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-950/80 text-blue-300 border border-blue-500/40 inline-flex items-center gap-1">
          <CreditCard className="w-3 h-3" />
          Solo Note Debito / Pagamenti
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-950/80 text-purple-300 border border-purple-500/40 inline-flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Donazioni & Pagamenti
      </span>
    );
  };

  return (
    <div className="bg-slate-900 p-5 rounded-3xl border border-purple-500/40 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-600 text-white">
              Sincronizzato Ovunque
            </span>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">
              {metodiCustom.filter((m) => m.attivo).length} metodi attivi
            </span>
          </div>
          <h4 className="text-sm sm:text-base font-black text-white uppercase flex items-center gap-2 mt-1">
            <Landmark className="w-4 h-4 text-purple-400" />
            <span>Ulteriori Metodi di Ricezione Donazioni & Pagamenti</span>
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Aggiungi ulteriori canali (es. Satispay, PayPal, SumUp, PagoPA, altri IBAN o cassa dedicata). I metodi attivi vengono collegati automaticamente in Note di Debito, Registra Donazione, Anagrafica Donatori e Fogli di Viaggio.
          </p>
        </div>

        <button
          type="button"
          onClick={formAperto ? resetForm : apriNuovo}
          className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 shadow-lg transition-all cursor-pointer shrink-0 active:scale-95 ${
            formAperto
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
          }`}
        >
          {formAperto ? <X className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
          <span>{formAperto ? 'Chiudi Modulo' : 'Nuovo Metodo Ricezione'}</span>
        </button>
      </div>

      {formAperto && (
        <form
          onSubmit={handleSalva}
          className="bg-slate-950 p-4 rounded-2xl border-2 border-purple-500/50 space-y-3 animate-in fade-in"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-black text-purple-300 uppercase">
              {editingId ? 'Modifica Metodo Personalizzato' : 'Inserisci Nuovo Metodo di Ricezione'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            <div className="md:col-span-5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Nome Metodo * (es. Satispay, PayPal, Banca Intesa)
              </label>
              <input
                type="text"
                required
                placeholder="es. Satispay Croce Oro / PayPal Ufficiale"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Ambito di Utilizzo *
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoMetodoPagamentoCustom)}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="entrambi">Entrambi (Donazioni & Pagamenti / Note Debito)</option>
                <option value="donazioni">Solo Ricezione Donazioni</option>
                <option value="pagamenti">Solo Note di Debito & Pagamenti</option>
              </select>
            </div>

            <div className="md:col-span-3 flex items-end">
              <label className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between cursor-pointer select-none">
                <span className="text-[11px] font-bold text-slate-200">Stato Attivo</span>
                <input
                  type="checkbox"
                  checked={attivo}
                  onChange={(e) => setAttivo(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 accent-purple-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
            <div className="md:col-span-6">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Coordinate / IBAN / Email / Numero / Riferimento (opzionale)
              </label>
              <input
                type="text"
                placeholder="es. IT00X0000... oppure donazioni@croceoro.org"
                value={coordinateODettagli}
                onChange={(e) => setCoordinateODettagli(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="md:col-span-6">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Intestatario Conto / Servizio
              </label>
              <input
                type="text"
                placeholder={intestatarioDefault}
                value={intestatario}
                onChange={(e) => setIntestatario(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs items-end">
            <div className="md:col-span-8">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Note Operative / Istruzioni per Operatori & Donatori
              </label>
              <input
                type="text"
                placeholder="es. Indicare causale 'Erogazione liberale' oppure numero Nota di Debito"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="md:col-span-4 flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black uppercase text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{editingId ? 'Salva Modifiche' : 'Salva Metodo'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {metodiCustom.length === 0 ? (
        <div className="bg-slate-950/70 border border-dashed border-slate-700 rounded-2xl p-6 text-center space-y-1.5">
          <div className="text-xs font-bold text-slate-300">
            Nessun ulteriore metodo personalizzato ancora configurato.
          </div>
          <p className="text-[11px] text-slate-500 max-w-xl mx-auto">
            I due conti ufficiali (Poste Italiane e Credit Agricole) e i metodi standard (Contanti, POS, Assegno) sono sempre attivi. Clicca su <strong className="text-purple-300">Nuovo Metodo Ricezione</strong> per aggiungere altri canali di incasso.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {metodiCustom.map((m) => (
            <div
              key={m.id}
              className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                m.attivo
                  ? 'bg-slate-950 border-purple-500/40 shadow-md'
                  : 'bg-slate-950/40 border-slate-800 opacity-70'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-white truncate">{m.nome}</span>
                      {!m.attivo && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-800 text-slate-400 border border-slate-700">
                          Disattivato
                        </span>
                      )}
                    </div>
                    {renderBadgeTipo(m.tipo)}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleAttivo(m)}
                      className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                        m.attivo
                          ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900'
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                      title={m.attivo ? 'Disattiva metodo dai selettori' : 'Riattiva metodo nei selettori'}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => apriModifica(m)}
                      className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-purple-400 cursor-pointer"
                      title="Modifica metodo"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {confermaEliminaId === m.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleElimina(m)}
                          className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold cursor-pointer"
                        >
                          Elimina
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfermaEliminaId(null)}
                          className="px-1.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfermaEliminaId(m.id)}
                        className="p-1.5 rounded-lg bg-red-950/60 border border-red-800/50 text-red-400 hover:bg-red-900 hover:text-white cursor-pointer"
                        title="Elimina metodo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {m.coordinateODettagli && (
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-amber-300 break-all select-all">
                      {m.coordinateODettagli}
                    </span>
                    <button
                      type="button"
                      onClick={() => copiaCoordinate(m.coordinateODettagli, m.id)}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      {copiatoId === m.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiatoId === m.id ? 'Copiato' : 'Copia'}</span>
                    </button>
                  </div>
                )}

                <div className="text-[11px] text-slate-400 space-y-0.5">
                  {m.intestatario && (
                    <div>
                      Intestatario: <strong className="text-slate-200">{m.intestatario}</strong>
                    </div>
                  )}
                  {m.note && <div className="italic text-slate-400">{m.note}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
