import React, { useState, useEffect, useMemo } from 'react';
import {
  Vote,
  CalendarClock,
  X,
  PlusCircle,
  CheckCircle2,
  Users,
  UserCheck,
  FileDown,
  Lock,
  Trash2,
  AlertCircle,
  MapPin,
  BarChart3,
} from 'lucide-react';
import { SedeAssociativaCompleta } from '../types/adminTypes';
import { Volontario } from './DatabaseVolontariModal';
import {
  ASSEMBLEE_SONDAGGI_UPDATED_EVENT,
  ConvocazioneAssembleaOdv,
  SondaggioRapidoOdv,
  TipoConvocazioneOdv,
  generaPdfConvocazioneAssemblea,
  getConvocazioniAssemblee,
  getSondaggiRapidi,
  salvaAssembleeSondaggi,
} from '../utils/assembleeSondaggiStore';
import { formatDateTimeItaly, formatISODateItaly } from '../utils/italianTime';
import { realtime } from '../services/realtime';

interface ModalAssembleeSondaggiVolontarioProps {
  aperta: boolean;
  onChiudi: () => void;
  volontarioId?: string;
  volontarioNome: string;
  sezioneVolontarioId?: string;
  canCreateDirettivo: boolean; // SOLO membri del Consiglio Direttivo o Admin!
  volontari: Volontario[];
  sedi: SedeAssociativaCompleta[];
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
}

export const ModalAssembleeSondaggiVolontario: React.FC<ModalAssembleeSondaggiVolontarioProps> = ({
  aperta,
  onChiudi,
  volontarioId,
  volontarioNome,
  sezioneVolontarioId,
  canCreateDirettivo,
  volontari,
  sedi,
  onNotificaRadio,
}) => {
  const [tab, setTab] = useState<'assemblee' | 'sondaggi'>('assemblee');
  const [convocazioni, setConvocazioni] = useState<ConvocazioneAssembleaOdv[]>(() => getConvocazioniAssemblee());
  const [sondaggi, setSondaggi] = useState<SondaggioRapidoOdv[]>(() => getSondaggiRapidi());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  // Stato creazione (SOLO Direttivo)
  const [mostraFormConv, setMostraFormConv] = useState(false);
  const [cTitolo, setCTitolo] = useState('');
  const [cTipo, setCTipo] = useState<TipoConvocazioneOdv>('Assemblea Ordinaria dei Soci');
  const [cData1, setCData1] = useState(() => formatISODateItaly());
  const [cOra1, setCOra1] = useState('20:30');
  const [cData2, setCData2] = useState('');
  const [cOra2, setCOra2] = useState('21:00');
  const [cLuogo, setCLuogo] = useState('Sede Centrale — Via delle Jare, Massa');
  const [cOdg, setCOdg] = useState('');
  const [cSezioneId, setCSezioneId] = useState('tutte');
  const [cInviaEmail, setCInviaEmail] = useState(true);

  const [mostraFormSond, setMostraFormSond] = useState(false);
  const [sDomanda, setSDomanda] = useState('');
  const [sDescrizione, setSDescrizione] = useState('');
  const [sOpzioniTesto, setSOpzioniTesto] = useState('Opzione 1\nOpzione 2\nOpzione 3');
  const [sMultipla, setSMultipla] = useState(false);
  const [sAnonimo, setSAnonimo] = useState(false);
  const [sSezioneId, setSSezioneId] = useState('tutte');
  const [sScadenza, setSScadenza] = useState('');

  // Stato delega digitale per convocazione
  const [delegaConvId, setDelegaConvId] = useState<string | null>(null);
  const [delegatoSelezionatoId, setDelegatoSelezionatoId] = useState('');

  useEffect(() => {
    const refresh = () => {
      setConvocazioni(getConvocazioniAssemblee());
      setSondaggi(getSondaggiRapidi());
    };
    window.addEventListener(ASSEMBLEE_SONDAGGI_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(ASSEMBLEE_SONDAGGI_UPDATED_EVENT, refresh);
  }, []);

  const mostraMsg = (msg: string) => {
    setFeedback(msg);
    setErrore(null);
    setTimeout(() => setFeedback(null), 4500);
  };

  const volontariAttivi = useMemo(
    () =>
      (volontari || [])
        .filter((v) => v && v.approvato !== false && !v.bloccatoPerTentativi)
        .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it')),
    [volontari]
  );

  const myKey = volontarioId || `vol-${volontarioNome.toLowerCase().replace(/\s+/g, '-')}`;

  const convVisibili = useMemo(() => {
    return convocazioni.filter((c) => {
      if (canCreateDirettivo) return true;
      return !c.sezioneTargetId || c.sezioneTargetId === 'tutte' || c.sezioneTargetId === sezioneVolontarioId;
    });
  }, [convocazioni, canCreateDirettivo, sezioneVolontarioId]);

  const sondVisibili = useMemo(() => {
    return sondaggi.filter((s) => {
      if (canCreateDirettivo) return true;
      return !s.sezioneTargetId || s.sezioneTargetId === 'tutte' || s.sezioneTargetId === sezioneVolontarioId;
    });
  }, [sondaggi, canCreateDirettivo, sezioneVolontarioId]);

  const persistiESync = (nuoveConv: ConvocazioneAssembleaOdv[], nuoviSond: SondaggioRapidoOdv[]) => {
    const now = Date.now();
    const saved = salvaAssembleeSondaggi(nuoveConv, nuoviSond, now);
    setConvocazioni(saved.convocazioni);
    setSondaggi(saved.sondaggi);
    realtime.syncAssembleeSondaggi(saved.convocazioni, saved.sondaggi, saved.updatedAt);
  };

  // Crea Convocazione (SOLO Direttivo)
  const handleCreaConvocazione = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateDirettivo) {
      setErrore('Solo i membri del Consiglio Direttivo possono creare convocazioni ufficiali.');
      return;
    }
    if (!cTitolo.trim() || !cOdg.trim()) {
      setErrore("Inserisci il titolo e l'Ordine del Giorno.");
      return;
    }
    const now = Date.now();
    const sedeObj = sedi.find((s) => s.id === cSezioneId);
    const nuova: ConvocazioneAssembleaOdv = {
      id: `conv-${now}`,
      titolo: cTitolo.trim(),
      tipo: cTipo,
      dataPrimaConvocazione: cData1,
      oraPrimaConvocazione: cOra1,
      dataSecondaConvocazione: cData2 || undefined,
      oraSecondaConvocazione: cData2 ? cOra2 : undefined,
      luogo: cLuogo.trim() || 'Sede Centrale Croce Oro',
      ordineDelGiorno: cOdg.trim(),
      sezioneTargetId: cSezioneId,
      sezioneTargetNome: cSezioneId === 'tutte' ? 'Tutte le Sezioni' : sedeObj?.nome || 'Sezione',
      maxDeleghePerSocio: 3,
      creataDa: volontarioNome,
      dataCreazione: formatDateTimeItaly(),
      stato: 'Aperta',
      risposte: [],
      updatedAt: now,
    };

    persistiESync([nuova, ...convocazioni], sondaggi);
    onNotificaRadio?.(
      `📢 CONVOCAZIONE ${cTipo.toUpperCase()}: "${nuova.titolo}" il ${cData1.split('-').reverse().join('/')} alle ${cOra1} (${nuova.luogo}). Conferma presenza o delega in app!`,
      'sistema'
    );

    if (cInviaEmail && !realtime.isServerlessStatic()) {
      const destEmails = volontariAttivi
        .filter((v) => cSezioneId === 'tutte' || v.sezioneAppartenenzaId === cSezioneId)
        .map((v) => (v.emailNotifiche || v.email || '').trim())
        .filter((em) => em.includes('@'));
      fetch(`${realtime.getApiBaseUrl()}/api/notifica-convocazione-sondaggio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'convocazione',
          titolo: nuova.titolo,
          dettagli: `${nuova.tipo} — ${cData1.split('-').reverse().join('/')} ore ${cOra1} presso ${nuova.luogo}`,
          destinatariEmails: destEmails,
        }),
      }).catch(() => {});
    }

    setMostraFormConv(false);
    setCTitolo('');
    setCOdg('');
    mostraMsg('Convocazione pubblicata e inviata ai soci/volontari.');
  };

  // Crea Sondaggio (SOLO Direttivo)
  const handleCreaSondaggio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateDirettivo) {
      setErrore('Solo i membri del Consiglio Direttivo possono creare sondaggi.');
      return;
    }
    const righe = sOpzioniTesto
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!sDomanda.trim() || righe.length < 2) {
      setErrore('Inserisci la domanda e almeno 2 opzioni (una per riga).');
      return;
    }
    const now = Date.now();
    const sedeObj = sedi.find((s) => s.id === sSezioneId);
    const nuovo: SondaggioRapidoOdv = {
      id: `sond-${now}`,
      domanda: sDomanda.trim(),
      descrizione: sDescrizione.trim() || undefined,
      opzioni: righe.slice(0, 10).map((testo, idx) => ({ id: `opt-${idx + 1}`, testo })),
      sceltaMultipla: sMultipla,
      anonimo: sAnonimo,
      sezioneTargetId: sSezioneId,
      sezioneTargetNome: sSezioneId === 'tutte' ? 'Tutte le Sezioni' : sedeObj?.nome || 'Sezione',
      dataScadenza: sScadenza || undefined,
      creatoDa: volontarioNome,
      dataCreazione: formatDateTimeItaly(),
      stato: 'Aperto',
      voti: [],
      updatedAt: now,
    };

    persistiESync(convocazioni, [nuovo, ...sondaggi]);
    onNotificaRadio?.(`🗳️ NUOVO SONDAGGIO DIRETTIVO: "${nuovo.domanda}" — Partecipa dalla sezione Assemblee & Sondaggi!`, 'sistema');
    setMostraFormSond(false);
    setSDomanda('');
    setSDescrizione('');
    mostraMsg('Sondaggio rapido pubblicato.');
  };

  // Risposta volontario a Convocazione (Presente / Assente / Delega)
  const handleRispostaConvocazione = (
    conv: ConvocazioneAssembleaOdv,
    esito: 'Presente' | 'Assente' | 'Delega',
    delegatoId?: string
  ) => {
    setErrore(null);
    let delegatoANome: string | undefined;
    if (esito === 'Delega') {
      if (!delegatoId) {
        setErrore('Seleziona il socio/volontario a cui conferire la delega.');
        return;
      }
      const maxDel = conv.maxDeleghePerSocio || 3;
      const delegheGiaRicevute = (conv.risposte || []).filter(
        (r) => r.esito === 'Delega' && r.delegatoAId === delegatoId && r.volontarioId !== myKey
      ).length;
      if (delegheGiaRicevute >= maxDel) {
        setErrore(`Questo socio ha già raggiunto il limite massimo di ${maxDel} deleghe consentite (Art. 24 CTS). Scegli un altro socio.`);
        return;
      }
      const volDel = volontariAttivi.find((v) => v.id === delegatoId);
      delegatoANome = volDel ? `${volDel.cognome} ${volDel.nome}` : 'Socio delegato';
    }

    const now = Date.now();
    const nuovaRisp = {
      volontarioId: myKey,
      volontarioNome,
      esito,
      delegatoAId: esito === 'Delega' ? delegatoId : undefined,
      delegatoANome,
      dataOra: formatDateTimeItaly(),
    };
    const aggiornate = convocazioni.map((c) => {
      if (c.id !== conv.id) return c;
      const altri = (c.risposte || []).filter((r) => r.volontarioId !== myKey);
      return { ...c, risposte: [...altri, nuovaRisp], updatedAt: now };
    });
    persistiESync(aggiornate, sondaggi);
    setDelegaConvId(null);
    setDelegatoSelezionatoId('');
    mostraMsg(
      esito === 'Delega'
        ? `Delega digitale registrata a favore di ${delegatoANome}.`
        : `Risposta "${esito}" registrata per "${conv.titolo}".`
    );
  };

  // Voto Sondaggio Rapido
  const handleVotaSondaggio = (sond: SondaggioRapidoOdv, opzioneId: string) => {
    if (sond.stato !== 'Aperto') return;
    const now = Date.now();
    const aggiornati = sondaggi.map((s) => {
      if (s.id !== sond.id) return s;
      const mioPrecedente = (s.voti || []).find((v) => v.volontarioId === myKey);
      let nuoveScelte: string[];
      if (s.sceltaMultipla) {
        const set = new Set(mioPrecedente?.opzioniIds || []);
        if (set.has(opzioneId)) set.delete(opzioneId);
        else set.add(opzioneId);
        nuoveScelte = Array.from(set);
      } else {
        nuoveScelte = [opzioneId];
      }
      const altri = (s.voti || []).filter((v) => v.volontarioId !== myKey);
      const nextVoti =
        nuoveScelte.length > 0
          ? [...altri, { volontarioId: myKey, volontarioNome, opzioniIds: nuoveScelte, dataOra: formatDateTimeItaly() }]
          : altri;
      return { ...s, voti: nextVoti, updatedAt: now };
    });
    persistiESync(convocazioni, aggiornati);
    mostraMsg('Preferenza registrata nel sondaggio.');
  };

  if (!aperta) return null;

  return (
    <div className="fixed inset-0 z-[130] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-indigo-500/70 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-[#1d1a60] to-slate-950 border-b border-indigo-500/35 px-4 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/50 text-indigo-300 flex items-center justify-center shrink-0">
              <Vote className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide truncate">
                Convocazioni Assemblee & Sondaggi Rapidi
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                Conferma presenza, delega digitale (Art. 24 CTS) e votazioni rapide di sezione
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

        {/* Sub-nav */}
        <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-900/95 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTab('assemblee')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer ${
                tab === 'assemblee' ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-300 border border-slate-800'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Convocazioni ({convVisibili.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('sondaggi')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 cursor-pointer ${
                tab === 'sondaggi' ? 'bg-indigo-600 text-white' : 'bg-slate-950 text-slate-300 border border-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Sondaggi ({sondVisibili.length})</span>
            </button>
          </div>

          {canCreateDirettivo ? (
            <button
              type="button"
              onClick={() => {
                if (tab === 'assemblee') setMostraFormConv((v) => !v);
                else setMostraFormSond((v) => !v);
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{tab === 'assemblee' ? 'Nuova Convocazione' : 'Nuovo Sondaggio'}</span>
            </button>
          ) : (
            <span className="text-[10px] text-slate-400 inline-flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-400" />
              <span>Creazione riservata al Consiglio Direttivo</span>
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {feedback && (
            <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}
          {errore && (
            <div className="p-2.5 rounded-xl bg-red-950/80 border border-red-500/60 text-red-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errore}</span>
            </div>
          )}

          {/* TAB CONVOCAZIONI */}
          {tab === 'assemblee' && (
            <div className="space-y-3">
              {mostraFormConv && canCreateDirettivo && (
                <form onSubmit={handleCreaConvocazione} className="p-4 rounded-2xl bg-slate-950 border border-amber-500/50 space-y-3">
                  <div className="text-xs font-black uppercase text-amber-300">Crea Nuova Convocazione Ufficiale (Direttivo)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Titolo *</label>
                      <input
                        type="text"
                        value={cTitolo}
                        onChange={(e) => setCTitolo(e.target.value)}
                        placeholder="Es. Assemblea Ordinaria Approvazione Bilancio"
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Tipo</label>
                      <select
                        value={cTipo}
                        onChange={(e) => setCTipo(e.target.value as TipoConvocazioneOdv)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                      >
                        <option value="Assemblea Ordinaria dei Soci">Assemblea Ordinaria dei Soci</option>
                        <option value="Assemblea Straordinaria dei Soci">Assemblea Straordinaria dei Soci</option>
                        <option value="Riunione di Sezione">Riunione di Sezione</option>
                        <option value="Consiglio Direttivo">Consiglio Direttivo</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">1ª Conv. Data *</label>
                      <input type="date" value={cData1} onChange={(e) => setCData1(e.target.value)} className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs" required />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">1ª Conv. Ora *</label>
                      <input type="time" value={cOra1} onChange={(e) => setCOra1(e.target.value)} className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs" required />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">2ª Conv. Data</label>
                      <input type="date" value={cData2} onChange={(e) => setCData2(e.target.value)} className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">2ª Conv. Ora</label>
                      <input type="time" value={cOra2} onChange={(e) => setCOra2(e.target.value)} className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Luogo *</label>
                      <input type="text" value={cLuogo} onChange={(e) => setCLuogo(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs" required />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Destinatari</label>
                      <select value={cSezioneId} onChange={(e) => setCSezioneId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs">
                        <option value="tutte">Tutte le Sezioni</option>
                        {sedi.map((s) => (
                          <option key={s.id} value={s.id}>{s.nome}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Ordine del Giorno *</label>
                    <textarea
                      rows={3}
                      value={cOdg}
                      onChange={(e) => setCOdg(e.target.value)}
                      placeholder={"1. Relazione del Presidente\n2. Approvazione rendiconto annuale\n3. Varie ed eventuali"}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                      required
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={cInviaEmail} onChange={(e) => setCInviaEmail(e.target.checked)} />
                    <span>Invia anche avviso email a tutti i soci/volontari destinatari</span>
                  </label>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setMostraFormConv(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer">Annulla</button>
                    <button type="submit" className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase cursor-pointer">Pubblica Convocazione</button>
                  </div>
                </form>
              )}

              {convVisibili.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Nessuna convocazione presente al momento.
                </div>
              ) : (
                convVisibili.map((c) => {
                  const miaRisp = (c.risposte || []).find((r) => r.volontarioId === myKey);
                  const presenti = (c.risposte || []).filter((r) => r.esito === 'Presente');
                  const deleghe = (c.risposte || []).filter((r) => r.esito === 'Delega');
                  const assenti = (c.risposte || []).filter((r) => r.esito === 'Assente');

                  return (
                    <div key={c.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/60 text-[10px] font-black uppercase">
                              {c.tipo}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${c.stato === 'Aperta' ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                              {c.stato}
                            </span>
                            <span className="text-[10px] text-slate-400">{c.sezioneTargetNome}</span>
                          </div>
                          <h4 className="text-sm sm:text-base font-black text-white">{c.titolo}</h4>
                          <div className="text-[11px] text-slate-300 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            <span>📅 1ª Conv: <strong>{c.dataPrimaConvocazione.split('-').reverse().join('/')} ore {c.oraPrimaConvocazione}</strong></span>
                            {c.dataSecondaConvocazione && (
                              <span>📅 2ª Conv: <strong>{c.dataSecondaConvocazione.split('-').reverse().join('/')} ore {c.oraSecondaConvocazione}</strong></span>
                            )}
                            <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-amber-400" /> {c.luogo}</span>
                          </div>
                        </div>

                        {canCreateDirettivo && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => generaPdfConvocazioneAssemblea(c)}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase inline-flex items-center gap-1 cursor-pointer"
                            >
                              <FileDown className="w-3.5 h-3.5" /> PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const nextStato = c.stato === 'Aperta' ? 'Chiusa' : 'Aperta';
                                persistiESync(
                                  convocazioni.map((x) => (x.id === c.id ? { ...x, stato: nextStato, updatedAt: Date.now() } : x)),
                                  sondaggi
                                );
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer"
                            >
                              {c.stato === 'Aperta' ? 'Chiudi' : 'Riapri'}
                            </button>
                            <button
                              type="button"
                              onClick={() => persistiESync(convocazioni.filter((x) => x.id !== c.id), sondaggi)}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 cursor-pointer"
                              title="Elimina convocazione"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 whitespace-pre-line">
                        <div className="text-[10px] font-black uppercase text-amber-400 mb-1">Ordine del Giorno</div>
                        {c.ordineDelGiorno}
                      </div>

                      {/* Statistiche adesioni */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-950/70 border border-emerald-800/50 text-emerald-300 font-bold">
                          ✓ Presenti: {presenti.length}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-amber-950/70 border border-amber-800/50 text-amber-300 font-bold">
                          🤝 Deleghe: {deleghe.length}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 font-bold">
                          ✗ Assenti: {assenti.length}
                        </span>
                        {miaRisp && (
                          <span className="ml-auto text-xs font-black text-sky-300">
                            La tua scelta: {miaRisp.esito}{miaRisp.delegatoANome ? ` → ${miaRisp.delegatoANome}` : ''}
                          </span>
                        )}
                      </div>

                      {/* Azioni volontario */}
                      {c.stato === 'Aperta' && (
                        <div className="space-y-2 pt-1 border-t border-slate-800/80">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleRispostaConvocazione(c, 'Presente')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase cursor-pointer inline-flex items-center gap-1.5 ${
                                miaRisp?.esito === 'Presente'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-emerald-950/70 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-700/60'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Partecipo
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDelegaConvId(delegaConvId === c.id ? null : c.id);
                                setDelegatoSelezionatoId(miaRisp?.delegatoAId || '');
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase cursor-pointer inline-flex items-center gap-1.5 ${
                                miaRisp?.esito === 'Delega'
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-amber-950/60 hover:bg-amber-500 text-amber-200 hover:text-slate-950 border border-amber-700/60'
                              }`}
                            >
                              <UserCheck className="w-3.5 h-3.5" /> Delega un Socio
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRispostaConvocazione(c, 'Assente')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase cursor-pointer ${
                                miaRisp?.esito === 'Assente'
                                  ? 'bg-slate-600 text-white'
                                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                              }`}
                            >
                              Non Partecipo
                            </button>
                          </div>

                          {delegaConvId === c.id && (
                            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/50 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                              <select
                                value={delegatoSelezionatoId}
                                onChange={(e) => setDelegatoSelezionatoId(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-amber-600/50 text-white text-xs"
                              >
                                <option value="">— Seleziona il socio delegato (max {c.maxDeleghePerSocio || 3} deleghe) —</option>
                                {volontariAttivi
                                  .filter((v) => v.id !== volontarioId)
                                  .map((v) => (
                                    <option key={v.id} value={v.id}>
                                      {v.cognome} {v.nome} {v.sezioneAppartenenzaNome ? `(${v.sezioneAppartenenzaNome})` : ''}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleRispostaConvocazione(c, 'Delega', delegatoSelezionatoId)}
                                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase cursor-pointer"
                              >
                                Conferma Delega
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB SONDAGGI RAPIDI */}
          {tab === 'sondaggi' && (
            <div className="space-y-3">
              {mostraFormSond && canCreateDirettivo && (
                <form onSubmit={handleCreaSondaggio} className="p-4 rounded-2xl bg-slate-950 border border-amber-500/50 space-y-3">
                  <div className="text-xs font-black uppercase text-amber-300">Crea Nuovo Sondaggio Rapido (Direttivo)</div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Domanda *</label>
                    <input
                      type="text"
                      value={sDomanda}
                      onChange={(e) => setSDomanda(e.target.value)}
                      placeholder="Es. Quale serata preferite per il corso aggiornamento DAE?"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Descrizione (opzionale)</label>
                    <input
                      type="text"
                      value={sDescrizione}
                      onChange={(e) => setSDescrizione(e.target.value)}
                      placeholder="Dettagli aggiuntivi..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Opzioni di risposta (una per riga) *</label>
                    <textarea
                      rows={4}
                      value={sOpzioniTesto}
                      onChange={(e) => setSOpzioniTesto(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-mono"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Sezione Destinataria</label>
                      <select value={sSezioneId} onChange={(e) => setSSezioneId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs">
                        <option value="tutte">Tutte le Sezioni</option>
                        {sedi.map((s) => (
                          <option key={s.id} value={s.id}>{s.nome}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Scadenza (opzionale)</label>
                      <input type="date" value={sScadenza} onChange={(e) => setSScadenza(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-300">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={sMultipla} onChange={(e) => setSMultipla(e.target.checked)} />
                      <span>Consenti scelta multipla</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={sAnonimo} onChange={(e) => setSAnonimo(e.target.checked)} />
                      <span>Voto anonimo</span>
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setMostraFormSond(false)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer">Annulla</button>
                    <button type="submit" className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase cursor-pointer">Pubblica Sondaggio</button>
                  </div>
                </form>
              )}

              {sondVisibili.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Nessun sondaggio attivo al momento.
                </div>
              ) : (
                sondVisibili.map((s) => {
                  const mioVoto = (s.voti || []).find((v) => v.volontarioId === myKey);
                  const totVotanti = (s.voti || []).length;
                  return (
                    <div key={s.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${s.stato === 'Aperto' ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                              {s.stato}
                            </span>
                            {s.sceltaMultipla && <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 text-[10px] font-bold">Scelta Multipla</span>}
                            {s.anonimo && <span className="px-2 py-0.5 rounded bg-violet-950 text-violet-300 text-[10px] font-bold">Anonimo</span>}
                            <span className="text-[10px] text-slate-400">{s.sezioneTargetNome}</span>
                          </div>
                          <h4 className="text-sm sm:text-base font-black text-white">{s.domanda}</h4>
                          {s.descrizione && <p className="text-xs text-slate-400 mt-0.5">{s.descrizione}</p>}
                        </div>

                        {canCreateDirettivo && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const nextStato = s.stato === 'Aperto' ? 'Chiuso' : 'Aperto';
                                persistiESync(
                                  convocazioni,
                                  sondaggi.map((x) => (x.id === s.id ? { ...x, stato: nextStato, updatedAt: Date.now() } : x))
                                );
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold cursor-pointer"
                            >
                              {s.stato === 'Aperto' ? 'Chiudi' : 'Riapri'}
                            </button>
                            <button
                              type="button"
                              onClick={() => persistiESync(convocazioni, sondaggi.filter((x) => x.id !== s.id))}
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-red-400 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        {s.opzioni.map((opt) => {
                          const votiOpt = (s.voti || []).filter((v) => v.opzioniIds.includes(opt.id));
                          const perc = totVotanti > 0 ? Math.round((votiOpt.length / totVotanti) * 100) : 0;
                          const selected = Boolean(mioVoto?.opzioniIds.includes(opt.id));
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={s.stato !== 'Aperto'}
                              onClick={() => handleVotaSondaggio(s, opt.id)}
                              className={`w-full p-2.5 rounded-xl border text-left relative overflow-hidden transition-all ${
                                s.stato === 'Aperto' ? 'cursor-pointer' : 'cursor-default opacity-80'
                              } ${
                                selected
                                  ? 'border-indigo-400 bg-indigo-950/50'
                                  : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'
                              }`}
                            >
                              <div
                                className="absolute inset-y-0 left-0 bg-indigo-500/20 transition-all duration-300"
                                style={{ width: `${perc}%` }}
                              />
                              <div className="relative flex items-center justify-between gap-2 text-xs">
                                <span className={`font-bold ${selected ? 'text-white' : 'text-slate-200'}`}>
                                  {selected ? '✓ ' : ''}{opt.testo}
                                </span>
                                <span className="font-mono font-black text-indigo-300 shrink-0">
                                  {votiOpt.length} ({perc}%)
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="text-[10.5px] text-slate-400 flex items-center justify-between flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Totale partecipanti: <strong className="text-white">{totVotanti}</strong></span>
                        </span>
                        <span>Creato da {s.creatoDa}{s.dataScadenza ? ` • Scade il ${s.dataScadenza.split('-').reverse().join('/')}` : ''}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
