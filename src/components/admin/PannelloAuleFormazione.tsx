import React, { useState } from 'react';
import {
  MapPin,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  Power,
  Users,
  ShieldAlert,
  Building2,
} from 'lucide-react';
import { AulaFormazione, SedeAssociativaCompleta } from '../../types/adminTypes';
import {
  useAuleFormazione,
  salvaAuleFormazioneCatalogo,
} from '../../utils/auleFormazione';
import { MappaSelezioneLuogoTimbratura } from './MappaSelezioneLuogoTimbratura';
import { formatDateItaly } from '../../utils/italianTime';
import { realtime } from '../../services/realtime';
import { notificaModificaGestionale } from '../../utils/notificaModificaAdmin';

interface PannelloAuleFormazioneProps {
  sedi: SedeAssociativaCompleta[];
  isAdmin?: boolean;
  operatoreNome?: string;
}

export const PannelloAuleFormazione: React.FC<PannelloAuleFormazioneProps> = ({
  sedi,
  isAdmin = false,
  operatoreNome = 'Formazione',
}) => {
  const aule = useAuleFormazione();
  const [modalAperta, setModalAperta] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [formNome, setFormNome] = useState('');
  const [formCodice, setFormCodice] = useState('');
  const [formSedeId, setFormSedeId] = useState('');
  const [formIndirizzo, setFormIndirizzo] = useState('');
  const [formLat, setFormLat] = useState<number>(43.99419);
  const [formLng, setFormLng] = useState<number>(10.12367);
  const [formRaggio, setFormRaggio] = useState<number>(150);
  const [formCapienza, setFormCapienza] = useState<string>('25');
  const [formAttiva, setFormAttiva] = useState<boolean>(true);
  const [formNote, setFormNote] = useState<string>('');

  const mostraToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const persisti = (nuoveAule: AulaFormazione[]) => {
    const salvate = salvaAuleFormazioneCatalogo(nuoveAule);
    realtime.syncAuleFormazione(salvate);
    return salvate;
  };

  const apriNuovaAula = () => {
    setEditingId(null);
    setFormNome('');
    setFormCodice(`AULA-${String(aule.length + 1).padStart(2, '0')}`);
    setFormSedeId('');
    setFormIndirizzo('');
    setFormLat(43.99419);
    setFormLng(10.12367);
    setFormRaggio(150);
    setFormCapienza('25');
    setFormAttiva(true);
    setFormNote('');
    setModalAperta(true);
  };

  const apriModificaAula = (a: AulaFormazione) => {
    setEditingId(a.id);
    setFormNome(a.nome);
    setFormCodice(a.codice || '');
    setFormSedeId(a.sedeRiferimentoId || '');
    setFormIndirizzo(a.indirizzo);
    setFormLat(a.coordinate.lat);
    setFormLng(a.coordinate.lng);
    setFormRaggio(a.raggioMetri || 150);
    setFormCapienza(a.capienza ? String(a.capienza) : '');
    setFormAttiva(a.attiva !== false);
    setFormNote(a.note || '');
    setModalAperta(true);
  };

  const handleSelezionaSedeRiferimento = (sedeId: string) => {
    setFormSedeId(sedeId);
    const sede = sedi.find((s) => s.id === sedeId);
    if (sede) {
      if (!formIndirizzo.trim()) {
        setFormIndirizzo(sede.indirizzoCompleto || '');
      }
      if (sede.coordinate?.lat && sede.coordinate?.lng) {
        setFormLat(sede.coordinate.lat);
        setFormLng(sede.coordinate.lng);
      }
    }
  };

  const handleSalvaAula = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim()) return;
    const sedeObj = sedi.find((s) => s.id === formSedeId);
    const prev = editingId ? aule.find((x) => x.id === editingId) : undefined;
    const nuova: AulaFormazione = {
      id: editingId || `aula-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nome: formNome.trim(),
      codice: formCodice.trim().toUpperCase() || undefined,
      sedeRiferimentoId: sedeObj?.id || undefined,
      sedeRiferimentoNome: sedeObj?.nome || undefined,
      indirizzo: formIndirizzo.trim() || sedeObj?.indirizzoCompleto || 'Massa-Carrara',
      coordinate: { lat: formLat, lng: formLng },
      raggioMetri: Math.max(20, Math.min(1000, Math.round(formRaggio || 150))),
      capienza: formCapienza ? Math.max(1, Math.round(Number(formCapienza) || 20)) : undefined,
      attiva: formAttiva,
      note: formNote.trim() || undefined,
      creataDa: prev?.creataDa || operatoreNome,
      dataCreazione: prev?.dataCreazione || formatDateItaly(),
    };

    const next = editingId ? aule.map((x) => (x.id === editingId ? nuova : x)) : [...aule, nuova];
    persisti(next);
    setModalAperta(false);
    mostraToast(editingId ? `Aula "${nuova.nome}" aggiornata.` : `Aula "${nuova.nome}" aggiunta e geolocalizzata.`);
    notificaModificaGestionale({
      macroCategoria: 'Formazione — Aule Didattiche',
      azione: editingId ? 'Modifica Aula Formazione' : 'Nuova Aula Formazione',
      elementoNome: nuova.nome,
      dettaglio: `Indirizzo: ${nuova.indirizzo} • GPS: ${nuova.coordinate.lat.toFixed(5)}, ${nuova.coordinate.lng.toFixed(5)} (raggio ${nuova.raggioMetri}m)`,
    });
  };

  const toggleAttiva = (a: AulaFormazione) => {
    persisti(aule.map((x) => (x.id === a.id ? { ...x, attiva: !x.attiva } : x)));
  };

  const eliminaAula = (a: AulaFormazione) => {
    if (!isAdmin) return;
    persisti(aule.filter((x) => x.id !== a.id));
    mostraToast(`Aula "${a.nome}" rimossa.`);
  };

  return (
    <div className="space-y-4">
      {/* Header & Regola Timbratura Esclusiva */}
      <div className="bg-gradient-to-r from-purple-950/70 via-slate-900 to-slate-900 border border-purple-500/35 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 text-purple-300" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
              Aule Formazione &amp; Geolocalizzazione Timbrature
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              Inserisci e geolocalizza le aule didattiche valide per le timbrature di entrata e uscita dei corsi formativi.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={apriNuovaAula}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase transition-colors shadow-lg shadow-purple-600/25 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nuova Aula Formazione
        </button>
      </div>

      <div className="bg-purple-950/35 border border-purple-500/40 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-purple-200">
        <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-white">Regola di Esclusività Aula Didattica:</strong> una persona iscritta ad un corso timbra entrata ed uscita{' '}
          <strong className="text-purple-200 underline">sempre e solo nell&apos;aula didattica del corso</strong>, anche se nello stesso edificio o alle stesse coordinate è presente un altro luogo timbratura di servizio.
        </div>
      </div>

      {toast && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 rounded-xl px-4 py-2.5 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {toast}
        </div>
      )}

      {/* Griglia Aule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {aule.map((a) => (
          <div
            key={a.id}
            className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 ${
              a.attiva
                ? 'bg-slate-900 border-slate-800'
                : 'bg-slate-950/60 border-slate-800/70 opacity-70'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    {a.codice && (
                      <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-black uppercase">
                        {a.codice}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        a.attiva
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {a.attiva ? 'Attiva per Timbratura' : 'Disattiva'}
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-white">{a.nome}</h4>
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-300">
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <span>{a.indirizzo}</span>
                </div>
                {a.sedeRiferimentoNome && (
                  <div className="flex items-start gap-1.5 text-slate-400">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span>Sede collegata: {a.sedeRiferimentoNome}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-emerald-300">
                  GPS: {a.coordinate.lat.toFixed(5)}, {a.coordinate.lng.toFixed(5)}
                </span>
                <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 font-bold text-amber-300">
                  Raggio: {a.raggioMetri} m
                </span>
                {a.capienza && (
                  <span className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 font-bold text-sky-300 inline-flex items-center gap-1">
                    <Users className="w-3 h-3" /> {a.capienza} posti
                  </span>
                )}
              </div>

              {a.note && <p className="text-[11px] text-slate-400 italic">{a.note}</p>}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => toggleAttiva(a)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase border ${
                  a.attiva
                    ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                {a.attiva ? 'Attiva' : 'Disattivata'}
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => apriModificaAula(a)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-purple-600 text-slate-200 hover:text-white text-xs font-bold transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Modifica &amp; GPS
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => eliminaAula(a)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors"
                    title="Elimina aula"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modale Crea / Modifica Aula con Mappa GPS */}
      {modalAperta && (
        <div className="fixed inset-0 z-[125] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4">
          <form
            onSubmit={handleSalvaAula}
            className="w-full max-w-3xl bg-slate-900 border border-purple-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-sm sm:text-base font-black text-white uppercase">
                {editingId ? 'Modifica Aula Formazione & Coordinate GPS' : 'Nuova Aula Formazione Geolocalizzata'}
              </h4>
              <button
                type="button"
                onClick={() => setModalAperta(false)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1"
              >
                Chiudi
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-black text-slate-300 uppercase mb-1">
                    Nome Aula Didattica *
                  </label>
                  <input
                    type="text"
                    required
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    placeholder="Es. Aula Didattica Magna — Sede Ronchi"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-300 uppercase mb-1">
                    Codice Aula
                  </label>
                  <input
                    type="text"
                    value={formCodice}
                    onChange={(e) => setFormCodice(e.target.value)}
                    placeholder="AULA-01"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white uppercase focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-300 uppercase mb-1">
                    Sede Associativa di Riferimento (opzionale)
                  </label>
                  <select
                    value={formSedeId}
                    onChange={(e) => handleSelezionaSedeRiferimento(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">-- Aula esterna / indipendente --</option>
                    {sedi.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-300 uppercase mb-1">
                    Indirizzo Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={formIndirizzo}
                    onChange={(e) => setFormIndirizzo(e.target.value)}
                    placeholder="Via, Civico, CAP, Città"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-300 uppercase mb-1">
                    Latitudine
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    value={formLat}
                    onChange={(e) => setFormLat(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-emerald-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-300 uppercase mb-1">
                    Longitudine
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    value={formLng}
                    onChange={(e) => setFormLng(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-emerald-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-300 uppercase mb-1">
                    Raggio GPS (metri)
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={1000}
                    value={formRaggio}
                    onChange={(e) => setFormRaggio(Math.max(20, Math.min(1000, Number(e.target.value) || 150)))}
                    className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-black text-amber-300"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-300 uppercase mb-1">
                    Capienza Posti
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={formCapienza}
                    onChange={(e) => setFormCapienza(e.target.value)}
                    placeholder="25"
                    className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              {/* Mappa interattiva per geolocalizzare l'aula */}
              <div className="rounded-xl overflow-hidden border border-purple-500/30">
                <MappaSelezioneLuogoTimbratura
                  lat={formLat}
                  lng={formLng}
                  raggioMetri={formRaggio}
                  nomeLuogo={formNome || 'Aula Formazione'}
                  indirizzoAttuale={formIndirizzo}
                  onPosizioneChange={({ lat, lng, indirizzo }) => {
                    setFormLat(Number(lat.toFixed(6)));
                    setFormLng(Number(lng.toFixed(6)));
                    if (indirizzo && !formIndirizzo.trim()) {
                      setFormIndirizzo(indirizzo);
                    }
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Note aula (piano, accesso, proiettore...)"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
                />
                <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAttiva}
                    onChange={(e) => setFormAttiva(e.target.checked)}
                    className="w-4 h-4 accent-purple-500"
                  />
                  Aula attiva e selezionabile nei corsi
                </label>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalAperta(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black uppercase"
              >
                {editingId ? 'Salva Modifiche Aula' : 'Salva Aula Formazione'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
