import React, { useState, useMemo } from 'react';
import {
  Megaphone,
  X,
  Search,
  Pin,
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  Filter,
  ShieldCheck,
  ChevronRight,
  Trash2,
  Edit3,
  GraduationCap,
  MapPin
} from 'lucide-react';
import { ComunicazioneBacheca, CorsoFormazione, SedeAssociativaCompleta } from '../types/adminTypes';
import { CroceOroLogo } from './CroceOroLogo';
import { CommentiBachecaPost } from './bacheca/CommentiBachecaPost';
import { realtime } from '../services/realtime';
import {
  getCorsiVisibiliInBacheca,
  getDataInizioEffettivaCorso,
  formatDataItalianaCorso,
  calcolaGiorniAlCorso
} from '../utils/bachecaCorsi';

interface ModalBachecaVolontarioProps {
  aperta: boolean;
  onChiudi: () => void;
  comunicazioni: ComunicazioneBacheca[];
  onAggiornaComunicazioni?: (nuove: ComunicazioneBacheca[]) => void;
  corsiFormazione?: CorsoFormazione[];
  onApriDettaglioCorso?: (corso: CorsoFormazione) => void;
  volontarioNome?: string;
  volontarioId?: string;
  isAdmin?: boolean;
  isPresidente?: boolean;
  sezioneVolontarioNome?: string;
  sezioneVolontarioId?: string;
  sedi?: SedeAssociativaCompleta[];
}

export const ModalBachecaVolontario: React.FC<ModalBachecaVolontarioProps> = ({
  aperta,
  onChiudi,
  comunicazioni,
  onAggiornaComunicazioni,
  corsiFormazione = [],
  onApriDettaglioCorso,
  volontarioNome = 'Volontario',
  volontarioId,
  isAdmin = false,
  isPresidente = false,
  sezioneVolontarioNome,
  sezioneVolontarioId,
  sedi = []
}) => {
  const [ricerca, setRicerca] = useState('');
  const [categoriaSelezionata, setCategoriaSelezionata] = useState('tutte');
  const [soloMiaSezione, setSoloMiaSezione] = useState(false);

  // Filtra comunicazioni attive
  const comunicazioniAttive = useMemo(() => {
    return comunicazioni
      .filter((c) => {
        if (!c.attiva) return false;
        if (soloMiaSezione && sezioneVolontarioId && c.sezioneTargetId !== 'tutte' && c.sezioneTargetId !== sezioneVolontarioId) {
          return false;
        }
        if (categoriaSelezionata !== 'tutte' && c.categoria !== categoriaSelezionata) {
          return false;
        }
        if (ricerca.trim()) {
          const q = ricerca.toLowerCase().trim();
          const matchT = c.titolo.toLowerCase().includes(q);
          const matchC = c.contenuto.toLowerCase().includes(q);
          const matchA = c.autore.toLowerCase().includes(q);
          const matchS = c.sezioneTargetNome.toLowerCase().includes(q);
          if (!matchT && !matchC && !matchA && !matchS) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Evidenziate prima
        if (a.evidenziata && !b.evidenziata) return -1;
        if (!a.evidenziata && b.evidenziata) return 1;

        // Urgenti prima
        if (a.priorita === 'Urgente' && b.priorita !== 'Urgente') return -1;
        if (a.priorita !== 'Urgente' && b.priorita === 'Urgente') return 1;

        // Data decrescente
        const dtA = `${a.dataPubblicazione} ${a.oraPubblicazione}`;
        const dtB = `${b.dataPubblicazione} ${b.oraPubblicazione}`;
        return dtB.localeCompare(dtA);
      });
  }, [comunicazioni, soloMiaSezione, sezioneVolontarioId, categoriaSelezionata, ricerca]);

  // Prossimi corsi / formazione in programma (visibili fino al giorno stesso in cui iniziano, poi rimossi automaticamente)
  const corsiInBacheca = useMemo(() => {
    if (categoriaSelezionata !== 'tutte' && categoriaSelezionata !== 'Formazione & Eventi') return [];
    return getCorsiVisibiliInBacheca(corsiFormazione).filter((c) => {
      if (soloMiaSezione && sezioneVolontarioId) {
        const destIds = c.sezioniDestinatarieIds || [];
        const tutte = destIds.length === 0 || destIds.includes('TUTTE') || destIds.includes('tutte');
        if (!tutte && !destIds.includes(sezioneVolontarioId) && c.sedeSvolgimentoSedeId !== sezioneVolontarioId) {
          return false;
        }
      }
      if (ricerca.trim()) {
        const q = ricerca.toLowerCase().trim();
        const match =
          (c.titolo || '').toLowerCase().includes(q) ||
          (c.sottotitolo || '').toLowerCase().includes(q) ||
          (c.descrizione || '').toLowerCase().includes(q) ||
          (c.tipologia || '').toLowerCase().includes(q) ||
          (c.sedeCorso || '').toLowerCase().includes(q) ||
          (c.docenteFormatore || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [corsiFormazione, categoriaSelezionata, soloMiaSezione, sezioneVolontarioId, ricerca]);

  const comunicazioniUrgenti = comunicazioniAttive.filter((c) => c.priorita === 'Urgente');

  // Aggiornamento singolo post (likes, commenti, risposte) con notifica mirata e deduplicata
  const handleAggiornaSingoloPost = (
    postAggiornato: ComunicazioneBacheca,
    notificaCommento?: {
      destinatariNomi: string[];
      destinatariIds: string[];
      testoCommento: string;
    }
  ) => {
    const aggiornate = comunicazioni.map((c) => (c.id === postAggiornato.id ? postAggiornato : c));
    onAggiornaComunicazioni?.(aggiornate);

    if (notificaCommento) {
      const notifPayload = {
        tipo: 'nuovo_commento' as const,
        postId: postAggiornato.id,
        postTitolo: postAggiornato.titolo,
        autoreCommento: volontarioNome,
        testoCommento: notificaCommento.testoCommento,
        destinatariVolontariNomi: notificaCommento.destinatariNomi,
        destinatariVolontariIds: notificaCommento.destinatariIds,
        messaggio: `Nuovo commento di ${volontarioNome} su "${postAggiornato.titolo}": "${notificaCommento.testoCommento.substring(0, 80)}"`
      };
      realtime.syncBacheca(aggiornate, notifPayload);
    } else {
      realtime.syncBacheca(aggiornate);
    }
  };

  const handleEliminaPost = (postId: string) => {
    const postDaEliminare = comunicazioni.find((c) => c.id === postId);
    const puoEliminare =
      isAdmin ||
      (postDaEliminare?.autoreId && postDaEliminare.autoreId === volontarioId) ||
      (postDaEliminare?.autore && postDaEliminare.autore.trim().toLowerCase() === volontarioNome.trim().toLowerCase());

    if (!puoEliminare) {
      alert("⛔ Operazione non autorizzata: i post in bacheca possono essere cancellati solo da chi li ha creati (l'Amministratore può cancellare qualsiasi post).");
      return;
    }

    if (confirm('Sei sicuro di voler eliminare questa comunicazione dalla bacheca?')) {
      const aggiornate = comunicazioni.filter((c) => c.id !== postId);
      onAggiornaComunicazioni?.(aggiornate);
      realtime.syncBacheca(aggiornate);
    }
  };

  if (!aperta) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-slate-900 border-2 border-violet-500/80 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-4">
        
        {/* ------------------------------------------------------------- */}
        {/* HEADER MODALE BACHECA                                          */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-gradient-to-r from-slate-950 via-[#1d1a60] to-slate-950 border-b border-violet-500/40 p-4 sm:p-5 flex items-start sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-violet-500/20 border border-violet-400/50 text-violet-300 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/20">
              <Megaphone className="w-6 h-6 text-violet-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-700/60">
                  Bacheca di Sezione
                </span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>{comunicazioniAttive.length} Avvisi Attivi</span>
                </span>
                {corsiInBacheca.length > 0 && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/60 flex items-center gap-1">
                    <GraduationCap className="w-3 h-3 text-amber-400" />
                    <span>
                      {corsiInBacheca.length} {corsiInBacheca.length === 1 ? 'Corso in Programma' : 'Corsi in Programma'}
                    </span>
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide mt-0.5">
                Comunicazioni Ufficiali & Circolari ai Volontari
              </h3>
              <p className="text-[11px] text-slate-300">
                Gentile <strong>{volontarioNome}</strong>, consulta qui le disposizioni della presidenza e dei coordinatori di sezione.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onChiudi}
            className="p-2 rounded-xl bg-slate-800/90 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
            title="Chiudi bacheca"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* CONTROLLI, RICERCA & FILTRI CATEGORIA                         */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-slate-900/95 p-3.5 border-b border-slate-800 space-y-2.5 shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Input Cerca */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                placeholder="Cerca negli avvisi..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:ring-1 focus:ring-violet-500 focus:outline-none"
              />
              {ricerca && (
                <button
                  type="button"
                  onClick={() => setRicerca('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Toggle Mia Sezione */}
            {sezioneVolontarioNome && (
              <button
                type="button"
                onClick={() => setSoloMiaSezione(!soloMiaSezione)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                  soloMiaSezione
                    ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-900/30'
                    : 'bg-slate-950 text-slate-300 hover:text-white border-slate-800'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-violet-300" />
                <span>Solo Mia Sezione ({sezioneVolontarioNome.split(' ')[0]})</span>
              </button>
            )}
          </div>

          {/* Chips Categorie */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {['tutte', 'Comunicazione Generale', 'Disposizioni Operative', 'Turni & Reperibilità', 'Mezzi & Dotazioni', 'Formazione & Eventi'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoriaSelezionata(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  categoriaSelezionata === cat
                    ? 'bg-violet-900/80 text-violet-200 border-violet-500'
                    : 'bg-slate-950/70 text-slate-400 hover:text-slate-200 border-slate-800/80'
                }`}
              >
                {cat === 'tutte' ? 'Tutte le Categorie' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* CORPO MODALE: PROSSIMI CORSI + ELENCO COMUNICAZIONI           */}
        {/* ------------------------------------------------------------- */}
        <div className="flex-1 p-3.5 sm:p-5 overflow-y-auto space-y-3.5">
          {/* Blocco Prossimi Corsi & Formazione in Programma */}
          {corsiInBacheca.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-black uppercase tracking-wide text-amber-300">
                    Prossimi Corsi & Formazione in Programma ({corsiInBacheca.length})
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Visibili fino al giorno di inizio
                </span>
              </div>

              {corsiInBacheca.map((corso) => {
                const dataInizioIso = getDataInizioEffettivaCorso(corso);
                const giorni = calcolaGiorniAlCorso(dataInizioIso);
                const iniziaOggi = giorni === 0;
                const iniziaDomani = giorni === 1;
                const sezioniLabel =
                  Array.isArray(corso.sezioniDestinatarieNomi) && corso.sezioniDestinatarieNomi.length > 0
                    ? corso.sezioniDestinatarieNomi.join(', ')
                    : 'Tutte le Sezioni';

                return (
                  <div
                    key={`modale-bacheca-corso-${corso.id}`}
                    className={`p-4 rounded-2xl border-2 transition-all relative overflow-hidden ${
                      iniziaOggi
                        ? 'bg-gradient-to-r from-amber-950/50 via-slate-950 to-slate-950 border-amber-400/90 shadow-lg shadow-amber-950/40'
                        : 'bg-gradient-to-r from-amber-950/25 via-slate-950 to-slate-950 border-amber-500/60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[9.5px] font-black uppercase flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" />
                          <span>Corso / Formazione</span>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase border ${
                            iniziaOggi
                              ? 'bg-red-950 text-red-300 border-red-600/70 animate-pulse'
                              : iniziaDomani
                              ? 'bg-orange-950 text-orange-300 border-orange-600/70'
                              : 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                          }`}
                        >
                          {iniziaOggi
                            ? '🔴 Inizia Oggi'
                            : iniziaDomani
                            ? '🟠 Inizia Domani'
                            : `📅 Tra ${giorni} giorni`}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-900 text-amber-200 border border-amber-700/50 text-[10px] font-bold">
                          {corso.tipologia}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/50 text-[10px] font-bold flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-blue-400" />
                          <span>{sezioniLabel}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-amber-200 font-mono font-bold">
                        <Calendar className="w-3 h-3 text-amber-400" />
                        <span>Inizio: {formatDataItalianaCorso(dataInizioIso)}</span>
                        {corso.orarioInizioLezione && (
                          <>
                            <span>•</span>
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>
                              {corso.orarioInizioLezione}
                              {corso.orarioFineLezione ? `-${corso.orarioFineLezione}` : ''}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="py-2.5 space-y-1.5">
                      <h4 className="text-sm sm:text-base font-black text-white tracking-wide">
                        {corso.titolo}
                      </h4>
                      {corso.sottotitolo && (
                        <p className="text-[11px] font-semibold text-amber-200/90 italic">
                          {corso.sottotitolo}
                        </p>
                      )}
                      {corso.descrizione && (
                        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line font-normal">
                          {corso.descrizione}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {corso.sedeCorso && (
                          <span className="flex items-center gap-1 text-slate-300">
                            <MapPin className="w-3 h-3 text-amber-400" />
                            <strong>{corso.sedeCorso}</strong>
                          </span>
                        )}
                        {corso.docenteFormatore && (
                          <span>
                            Docente: <strong className="text-slate-200">{corso.docenteFormatore}</strong>
                          </span>
                        )}
                        {corso.oreTotali > 0 && (
                          <span>
                            Durata: <strong className="text-amber-300">{corso.oreTotali}h</strong>
                          </span>
                        )}
                      </div>

                      {onApriDettaglioCorso && (
                        <button
                          type="button"
                          onClick={() => onApriDettaglioCorso(corso)}
                          className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] uppercase flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                        >
                          <span>Dettagli Corso</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {comunicazioniAttive.length === 0 && corsiInBacheca.length === 0 ? (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <Megaphone className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm font-bold text-slate-400">Nessuna comunicazione corrispondente trovata</p>
              <p className="text-xs text-slate-500">Prova a modificare i filtri o la ricerca</p>
            </div>
          ) : (
            comunicazioniAttive.map((com) => {
              const isUrgente = com.priorita === 'Urgente';
              const isImportante = com.priorita === 'Importante';

              return (
                <div
                  key={com.id}
                  className={`p-4 rounded-2xl border-2 transition-all relative overflow-hidden ${
                    com.evidenziata
                      ? 'bg-gradient-to-r from-violet-950/40 via-slate-950 to-slate-950 border-violet-500/80 shadow-lg shadow-violet-950/40'
                      : isUrgente
                      ? 'bg-gradient-to-r from-red-950/40 via-slate-950 to-slate-950 border-red-500/80 shadow-lg shadow-red-950/30'
                      : isImportante
                      ? 'bg-slate-950/90 border-amber-500/60'
                      : 'bg-slate-950/70 border-slate-800'
                  }`}
                >
                  {/* Badge e Data */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {com.evidenziata && (
                        <span className="px-2 py-0.5 rounded-full bg-violet-500 text-slate-950 text-[9.5px] font-black uppercase flex items-center gap-1">
                          <Pin className="w-3 h-3 fill-slate-950" />
                          <span>In Evidenza</span>
                        </span>
                      )}

                      <span
                        className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase border ${
                          isUrgente
                            ? 'bg-red-950 text-red-300 border-red-700/60 animate-pulse'
                            : isImportante
                            ? 'bg-amber-950 text-amber-300 border-amber-700/60'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                        }`}
                      >
                        {isUrgente ? '🔴 Urgente' : isImportante ? '🟡 Importante' : '🟢 Ordinaria'}
                      </span>

                      <span className="px-2 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-800 text-[10px] font-bold">
                        {com.categoria}
                      </span>

                      <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/50 text-[10px] font-bold flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-blue-400" />
                        <span>{com.sezioneTargetNome}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                      <Calendar className="w-3 h-3 text-violet-400" />
                      <span>{com.dataPubblicazione}</span>
                      <span>•</span>
                      <Clock className="w-3 h-3 text-violet-400" />
                      <span>{com.oraPubblicazione}</span>
                    </div>
                  </div>

                  {/* Titolo e Testo */}
                  <div className="py-2.5 space-y-1.5">
                    <h4 className="text-sm sm:text-base font-black text-white tracking-wide">
                      {com.titolo}
                    </h4>
                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line font-normal">
                      {com.contenuto}
                    </p>
                  </div>

                  {/* Firma Autore & Azioni Post Autore/Admin */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <div>
                      Firma: <strong className="text-slate-200">{com.autore}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      {(isAdmin || (com.autoreId && com.autoreId === volontarioId) || (com.autore && com.autore.trim().toLowerCase() === volontarioNome.trim().toLowerCase())) && (
                        <button
                          type="button"
                          onClick={() => handleEliminaPost(com.id)}
                          className="px-2 py-0.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 border border-slate-800 transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                          title="Elimina post (consentito all'autore o all'Amministratore)"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                          <span>Elimina Post</span>
                        </button>
                      )}
                      <span className="text-[10px] font-bold text-violet-400/90 uppercase">
                        Croce Oro Massa Carrara OdV
                      </span>
                    </div>
                  </div>

                  {/* Sezione Commenti, Risposte Annidate e Likes del Post */}
                  <CommentiBachecaPost
                    post={com}
                    currentUserId={volontarioId || `vol-${Date.now()}`}
                    currentUserName={volontarioNome || 'Volontario'}
                    currentUserRuolo={isAdmin ? 'Amministratore' : isPresidente ? 'Presidente' : 'Volontario'}
                    isAdmin={Boolean(isAdmin)}
                    isPresidente={Boolean(isPresidente)}
                    onAggiornaPost={handleAggiornaSingoloPost}
                    mostraCommentiIniziali={true}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* FOOTER MODALE                                                 */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-slate-950 p-3 sm:p-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <CroceOroLogo size="sm" className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline">Aggiornato in tempo reale dalla Direzione Operativa</span>
          </div>

          <button
            type="button"
            onClick={onChiudi}
            className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs uppercase shadow-md active:scale-95 transition-all cursor-pointer"
          >
            Ho Letto / Chiudi
          </button>
        </div>

      </div>
    </div>
  );
};
