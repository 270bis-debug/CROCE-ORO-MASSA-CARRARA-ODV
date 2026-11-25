import React, { useMemo, useState, useEffect } from 'react';
import {
  Sliders,
  Bell,
  Clock,
  RefreshCw,
  ShieldCheck,
  Scissors,
  EyeOff,
  ArrowLeftRight,
  Monitor,
  Save,
  CheckCircle2,
  Users,
  Search,
  AlertCircle,
} from 'lucide-react';
import {
  TipoTurnoConfig,
  RegoleStrumentiTipoTurno,
  NotificheUtenteTipoTurno,
} from '../../types/adminTypes';
import { Volontario } from '../DatabaseVolontariModal';
import {
  useTipiTurno,
  salvaTipiTurnoCatalogo,
  normalizzaRegoleStrumentiTipoTurno,
  DEFAULT_REGOLE_STRUMENTI_TIPO_TURNO,
} from '../../utils/tipiTurno';
import { getAllowedSubtabsForDatabase } from '../../constants/macroCategorie';
import { realtime } from '../../services/realtime';
import { notificaModificaGestionale } from '../../utils/notificaModificaAdmin';

interface PannelloStrumentiTurniProps {
  volontari: Volontario[];
  onNotificaRadio?: (messaggio: string) => void;
}

export const PannelloStrumentiTurni: React.FC<PannelloStrumentiTurniProps> = ({
  volontari,
  onNotificaRadio,
}) => {
  const tipiTurno = useTipiTurno();
  const [selectedTipoId, setSelectedTipoId] = useState<string>(() => tipiTurno[0]?.id || '');
  const [regoleDraft, setRegoleDraft] = useState<RegoleStrumentiTipoTurno>({
    ...DEFAULT_REGOLE_STRUMENTI_TIPO_TURNO,
  });
  const [dirty, setDirty] = useState(false);
  const [salvatoToast, setSalvatoToast] = useState<string | null>(null);
  const [ricercaDestinatario, setRicercaDestinatario] = useState('');

  const tipoSelezionato: TipoTurnoConfig | undefined = useMemo(() => {
    return tipiTurno.find((t) => t.id === selectedTipoId) || tipiTurno[0];
  }, [tipiTurno, selectedTipoId]);

  useEffect(() => {
    if (!selectedTipoId && tipiTurno.length > 0) {
      setSelectedTipoId(tipiTurno[0].id);
    }
  }, [selectedTipoId, tipiTurno]);

  useEffect(() => {
    if (tipoSelezionato) {
      setRegoleDraft(normalizzaRegoleStrumentiTipoTurno(tipoSelezionato.regoleStrumenti));
      setDirty(false);
    }
  }, [tipoSelezionato?.id, tipoSelezionato?.regoleStrumenti]);

  // Elenco delle persone che hanno effettivamente accesso al database Calendario Turni
  const personeConAccessoTurni = useMemo(() => {
    return volontari
      .filter((v) => {
        if (!v || !v.id) return false;
        const allowed = getAllowedSubtabsForDatabase(v, 'turni');
        // null = accesso completo (Admin, Presidente, ecc.); array non vuoto = accesso delegato al db turni
        if (allowed === null) return true;
        if (Array.isArray(allowed) && allowed.length > 0) return true;
        // Include anche il Segretario del direttivo
        const carica = (v.caricaConsiglioDirettivo || '').toLowerCase();
        if (carica.includes('segretari') || carica.includes('presidente')) return true;
        return false;
      })
      .sort((a, b) =>
        `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it', { sensitivity: 'base' })
      );
  }, [volontari]);

  const personeFiltrate = useMemo(() => {
    const q = ricercaDestinatario.trim().toLowerCase();
    if (!q) return personeConAccessoTurni;
    return personeConAccessoTurni.filter(
      (v) =>
        `${v.nome} ${v.cognome}`.toLowerCase().includes(q) ||
        `${v.cognome} ${v.nome}`.toLowerCase().includes(q) ||
        (v.qualifica || '').toLowerCase().includes(q) ||
        (v.caricaConsiglioDirettivo || '').toLowerCase().includes(q) ||
        (v.email || '').toLowerCase().includes(q)
    );
  }, [personeConAccessoTurni, ricercaDestinatario]);

  const updateRegole = (patch: Partial<RegoleStrumentiTipoTurno>) => {
    setRegoleDraft((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  const getNotificaUtente = (volontarioId: string): NotificheUtenteTipoTurno => {
    const existing = regoleDraft.notifichePerUtente.find((n) => n.volontarioId === volontarioId);
    if (existing) return existing;
    return {
      volontarioId,
      suRichiestaTurno: false,
      suFoglioServizio: false,
      suCancellazioneTurno: false,
    };
  };

  const toggleNotificaUtente = (
    volontarioId: string,
    campo: 'suRichiestaTurno' | 'suFoglioServizio' | 'suCancellazioneTurno'
  ) => {
    setRegoleDraft((prev) => {
      const current = prev.notifichePerUtente.find((n) => n.volontarioId === volontarioId) || {
        volontarioId,
        suRichiestaTurno: false,
        suFoglioServizio: false,
        suCancellazioneTurno: false,
      };
      const updatedEntry: NotificheUtenteTipoTurno = {
        ...current,
        [campo]: !current[campo],
      };
      const others = prev.notifichePerUtente.filter((n) => n.volontarioId !== volontarioId);
      const keep =
        updatedEntry.suRichiestaTurno ||
        updatedEntry.suFoglioServizio ||
        updatedEntry.suCancellazioneTurno;
      return {
        ...prev,
        notifichePerUtente: keep ? [...others, updatedEntry] : others,
      };
    });
    setDirty(true);
  };

  const toggleTuttiEventiUtente = (volontarioId: string) => {
    const curr = getNotificaUtente(volontarioId);
    const allOn = curr.suRichiestaTurno && curr.suFoglioServizio && curr.suCancellazioneTurno;
    setRegoleDraft((prev) => {
      const others = prev.notifichePerUtente.filter((n) => n.volontarioId !== volontarioId);
      if (allOn) {
        return { ...prev, notifichePerUtente: others };
      }
      return {
        ...prev,
        notifichePerUtente: [
          ...others,
          {
            volontarioId,
            suRichiestaTurno: true,
            suFoglioServizio: true,
            suCancellazioneTurno: true,
          },
        ],
      };
    });
    setDirty(true);
  };

  const handleSalvaRegole = () => {
    if (!tipoSelezionato) return;
    const regolePulite = normalizzaRegoleStrumentiTipoTurno(regoleDraft);
    const nuovaLista = tipiTurno.map((t) =>
      t.id === tipoSelezionato.id ? { ...t, regoleStrumenti: regolePulite } : t
    );
    const salvati = salvaTipiTurnoCatalogo(nuovaLista);
    realtime.syncTipiTurno(salvati);
    setDirty(false);
    setSalvatoToast(`Regole salvate per "${tipoSelezionato.nome}"`);
    setTimeout(() => setSalvatoToast(null), 3500);
    notificaModificaGestionale({
      macroCategoria: 'Calendario Turni — Strumenti',
      azione: 'Modifica Regole Tipo Turno',
      elementoNome: tipoSelezionato.nome,
      dettaglio: `Aggiornate le regole operative per il tipo turno "${tipoSelezionato.nome}".`,
    });
    onNotificaRadio?.(
      `⚙️ Strumenti Turni: regole aggiornate per il tipo turno "${tipoSelezionato.nome}".`
    );
  };

  const contaRegoleAttive = (tipo: TipoTurnoConfig): number => {
    const r = normalizzaRegoleStrumentiTipoTurno(tipo.regoleStrumenti);
    let c = 0;
    if (r.notificheAbilitate) c++;
    if (r.consentiAutoCancellazioneVolontario) c++;
    if (r.annullaDisponibilitaSuModificaOrario) c++;
    if (r.richiedeApprovazioneStaffODirettivo) c++;
    if (r.consentiDisponibilitaDurataInferiore) c++;
    if (r.nascondiDipendentiAiVolontari) c++;
    if (r.consentiPropostaCessioneOScambio) c++;
    if (r.visibileInModalitaMonitor) c++;
    return c;
  };

  const conteggioDestinatariNotifiche = useMemo(() => {
    return regoleDraft.notifichePerUtente.filter(
      (n) => n.suRichiestaTurno || n.suFoglioServizio || n.suCancellazioneTurno
    ).length;
  }, [regoleDraft.notifichePerUtente]);

  if (tipiTurno.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h3 className="text-base font-black text-white uppercase">Nessun Tipo di Turno Configurato</h3>
        <p className="text-xs text-slate-400 mt-1">
          Aggiungi almeno un tipo di turno nella sottosezione "3. Tipi di Turni" per configurarne gli strumenti.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Strumenti Turni */}
      <div className="bg-gradient-to-r from-indigo-950/90 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shrink-0">
            <Sliders className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                Strumenti &amp; Regole per Tipo di Turno
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase">
                Riservato: Admin • Presidente • Segretario
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Ogni tipologia di turno può avere regole indipendenti su notifiche, auto-cancellazione, approvazioni, scambi tra colleghi e visibilità monitor.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSalvaRegole}
          disabled={!dirty}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase transition-all shrink-0 ${
            dirty
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 cursor-pointer'
              : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
          }`}
        >
          <Save className="w-4 h-4" />
          Salva Regole Turno
        </button>
      </div>

      {salvatoToast && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 rounded-xl px-4 py-3 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          {salvatoToast}
        </div>
      )}

      {/* Selettore Tipo di Turno */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4">
        <div className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2.5">
          Seleziona il Tipo di Turno da Configurare ({tipiTurno.length})
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {tipiTurno.map((tipo) => {
            const isSelected = tipo.id === tipoSelezionato?.id;
            const nAttive = contaRegoleAttive(tipo);
            return (
              <button
                key={tipo.id}
                type="button"
                onClick={() => setSelectedTipoId(tipo.id)}
                className={`text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-400 text-white shadow-md shadow-indigo-900/40'
                    : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg shrink-0">{tipo.icona || '📅'}</span>
                  <div className="min-w-0">
                    <div className="font-black text-xs sm:text-sm truncate">{tipo.nome}</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {nAttive} regole attive
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500 text-white text-[10px] font-black uppercase shrink-0">
                    Attivo
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {tipoSelezionato && (
        <div className="space-y-4">
          {/* 1. NOTIFICHE PER UTENTE CON ACCESSO AL DATABASE TURNI */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase">
                    1. Notifiche Operative ({tipoSelezionato.nome})
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Scegli chi tra le persone con accesso al Database Turni riceve notifiche per richieste turno, fogli di servizio e cancellazioni.
                  </p>
                </div>
              </div>
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none shrink-0 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2">
                <input
                  type="checkbox"
                  checked={regoleDraft.notificheAbilitate}
                  onChange={(e) => updateRegole({ notificheAbilitate: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
                <span className="text-xs font-black text-white uppercase">
                  {regoleDraft.notificheAbilitate ? 'Notifiche Attive' : 'Notifiche Disattive'}
                </span>
              </label>
            </div>

            {regoleDraft.notificheAbilitate && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs text-slate-300 font-bold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-amber-400" />
                    Persone con accesso al Database Turni: {personeConAccessoTurni.length} ({conteggioDestinatariNotifiche} con notifiche attive)
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={ricercaDestinatario}
                      onChange={(e) => setRicercaDestinatario(e.target.value)}
                      placeholder="Filtra persona o ruolo..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-left border-collapse min-w-[540px]">
                    <thead>
                      <tr className="bg-slate-900/90 border-b border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Account con Accesso Turni</th>
                        <th className="py-2.5 px-2 text-center">Richiesta Segnarsi di Turno</th>
                        <th className="py-2.5 px-2 text-center">Inserimento Foglio di Servizio</th>
                        <th className="py-2.5 px-2 text-center">Cancellazione dal Turno</th>
                        <th className="py-2.5 px-2 text-center">Tutti</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-xs">
                      {personeFiltrate.map((v) => {
                        const prefs = getNotificaUtente(v.id);
                        const allOn =
                          prefs.suRichiestaTurno &&
                          prefs.suFoglioServizio &&
                          prefs.suCancellazioneTurno;
                        return (
                          <tr key={v.id} className="hover:bg-slate-900/50 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-white">
                                {v.cognome} {v.nome}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {v.caricaConsiglioDirettivo || v.qualifica}
                                {v.email ? ` • ${v.email}` : ' • (nessuna email)'}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={prefs.suRichiestaTurno}
                                onChange={() => toggleNotificaUtente(v.id, 'suRichiestaTurno')}
                                className="w-4 h-4 accent-amber-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={prefs.suFoglioServizio}
                                onChange={() => toggleNotificaUtente(v.id, 'suFoglioServizio')}
                                className="w-4 h-4 accent-emerald-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={prefs.suCancellazioneTurno}
                                onChange={() => toggleNotificaUtente(v.id, 'suCancellazioneTurno')}
                                className="w-4 h-4 accent-rose-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => toggleTuttiEventiUtente(v.id)}
                                className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                                  allOn
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                              >
                                {allOn ? 'Attivi' : 'Selez.'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {personeFiltrate.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-xs text-slate-500">
                            Nessun account trovato con il filtro attuale.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 2-6. REGOLE OPERATIVE E DISPONIBILITÀ */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <h4 className="text-sm font-black text-white uppercase tracking-wide mb-1">
              2. Regole di Gestione &amp; Disponibilità Turno
            </h4>

            {/* Auto-cancellazione + Ore preavviso */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={regoleDraft.consentiAutoCancellazioneVolontario}
                  onChange={(e) =>
                    updateRegole({ consentiAutoCancellazioneVolontario: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 accent-indigo-500 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white">
                    <Clock className="w-4 h-4 text-sky-400 shrink-0" />
                    Consenti al volontario di togliersi dal turno autonomamente
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Imposta se il volontario può rimuoversi da solo dal turno e il numero minimo di ore di preavviso prima dell&apos;inizio.
                  </p>
                </div>
              </label>

              {regoleDraft.consentiAutoCancellazioneVolontario && (
                <div className="pl-7 flex flex-wrap items-center gap-3 pt-1">
                  <label className="text-xs font-bold text-slate-300">
                    Ore di preavviso prima dell&apos;inizio del turno:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={720}
                      value={regoleDraft.orePreavvisoCancellazione}
                      onChange={(e) =>
                        updateRegole({
                          orePreavvisoCancellazione: Math.max(
                            0,
                            Math.min(720, Math.floor(Number(e.target.value) || 0))
                          ),
                        })
                      }
                      className="w-24 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm font-black text-amber-300 text-center focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-xs text-slate-400 font-semibold">ore</span>
                  </div>
                </div>
              )}
            </div>

            {/* Comportamento modifica orario */}
            <label className="flex items-start gap-3 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={regoleDraft.annullaDisponibilitaSuModificaOrario}
                onChange={(e) =>
                  updateRegole({ annullaDisponibilitaSuModificaOrario: e.target.checked })
                }
                className="mt-1 w-4 h-4 accent-indigo-500 shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white">
                  <RefreshCw className="w-4 h-4 text-amber-400 shrink-0" />
                  Comportamento di modifica dell&apos;orario del turno
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Dopo ogni modifica dell&apos;orario dei turni, annulla automaticamente le disponibilità/assegnazioni precedenti e invita nuovamente i partecipanti a riconfermare.
                </p>
              </div>
            </label>

            {/* Approvazione staff o direttivo */}
            <label className="flex items-start gap-3 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={regoleDraft.richiedeApprovazioneStaffODirettivo}
                onChange={(e) =>
                  updateRegole({ richiedeApprovazioneStaffODirettivo: e.target.checked })
                }
                className="mt-1 w-4 h-4 accent-indigo-500 shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  La disponibilità per un turno deve essere approvata da un membro dello staff o del direttivo
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Se disattivato, il volontario che si candida per un posto libero viene inserito subito in turno senza attendere approvazione.
                </p>
              </div>
            </label>

            {/* Durata inferiore */}
            <label className="flex items-start gap-3 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={regoleDraft.consentiDisponibilitaDurataInferiore}
                onChange={(e) =>
                  updateRegole({ consentiDisponibilitaDurataInferiore: e.target.checked })
                }
                className="mt-1 w-4 h-4 accent-indigo-500 shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white">
                  <Scissors className="w-4 h-4 text-cyan-400 shrink-0" />
                  Permettere di creare disponibilità con durata inferiore a quella del turno
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Consente al volontario di indicare una fascia oraria parziale (es. dalle 08:00 alle 11:00 su un turno 08:00–14:00) al momento della disponibilità.
                </p>
              </div>
            </label>

            {/* Nasconde dipendenti ai volontari */}
            <label className="flex items-start gap-3 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={regoleDraft.nascondiDipendentiAiVolontari}
                onChange={(e) =>
                  updateRegole({ nascondiDipendentiAiVolontari: e.target.checked })
                }
                className="mt-1 w-4 h-4 accent-indigo-500 shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white">
                  <EyeOff className="w-4 h-4 text-rose-400 shrink-0" />
                  Nasconde ai volontari i dipendenti nel calendario
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  I nominativi dei dipendenti restano visibili ad Amministratore, Direttivo e Centrale ma vengono nascosti nella vista calendario dei volontari.
                </p>
              </div>
            </label>
          </div>

          {/* 3. VISIBILITÀ DEI TURNI */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
            <h4 className="text-sm font-black text-white uppercase tracking-wide mb-1">
              3. Visibilità dei Turni
            </h4>

            {/* Proposta cessione / scambio a collega */}
            <label className="flex items-start gap-3 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={regoleDraft.consentiPropostaCessioneOScambio}
                onChange={(e) =>
                  updateRegole({ consentiPropostaCessioneOScambio: e.target.checked })
                }
                className="mt-1 w-4 h-4 accent-indigo-500 shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white">
                  <ArrowLeftRight className="w-4 h-4 text-violet-400 shrink-0" />
                  Permettere a un volontario di proporre un proprio turno a un collega (cessione o scambio)
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Il collega scelto riceverà una notifica della richiesta e potrà accettare o rifiutare. Quando il destinatario accetta, la cessione o lo scambio diventa effettivo <strong>solo dopo l&apos;approvazione di un responsabile del calendario</strong>.
                </p>
              </div>
            </label>

            {/* Visibile in modalità monitor */}
            <label className="flex items-start gap-3 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 cursor-pointer hover:border-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={regoleDraft.visibileInModalitaMonitor}
                onChange={(e) =>
                  updateRegole({ visibileInModalitaMonitor: e.target.checked })
                }
                className="mt-1 w-4 h-4 accent-indigo-500 shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white">
                  <Monitor className="w-4 h-4 text-emerald-400 shrink-0" />
                  Possibilità di rendere questo calendario visibile in modalità monitor
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Se disattivato, i turni appartenenti a questa tipologia vengono esclusi dalla vista pubblica Modalità Monitor di sede.
                </p>
              </div>
            </label>
          </div>

          {/* Pulsante Salva inferiore */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSalvaRegole}
              disabled={!dirty}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs uppercase transition-all ${
                dirty
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              {dirty ? `Salva Regole per "${tipoSelezionato.nome}"` : 'Tutte le modifiche salvate'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
