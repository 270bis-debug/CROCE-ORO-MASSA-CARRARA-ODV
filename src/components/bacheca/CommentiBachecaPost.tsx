import React, { useState, useEffect } from 'react';
import {
  Heart,
  MessageSquare,
  Send,
  CornerDownRight,
  Trash2,
  Shield,
  Crown,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { ComunicazioneBacheca, CommentoBacheca } from '../../types/adminTypes';
import { soundEngine } from '../../services/soundEngine';
import { formatDateTimeItaly } from '../../utils/italianTime';

export interface BachecaInteractionMeta {
  actionType: 'comment' | 'like_post' | 'unlike_post' | 'like_comment' | 'unlike_comment';
  commentId?: string;
  parentCommentId?: string;
  parentAutoreNome?: string;
  autoreNome: string;
  autoreRuolo?: string;
  testo?: string;
  dataOra: string;
}

interface CommentiBachecaPostProps {
  post: ComunicazioneBacheca;
  currentUserId?: string;
  currentUserName: string;
  currentUserRuolo?: string;
  isAdmin: boolean;
  isPresidente: boolean;
  onAggiornaPost: (
    postAggiornato: ComunicazioneBacheca,
    notificaCommento?: {
      destinatariNomi: string[];
      destinatariIds: string[];
      testoCommento: string;
      autoreCommentoId?: string;
    },
    interactionMeta?: BachecaInteractionMeta
  ) => void;
  mostraCommentiIniziali?: boolean;
}

export const CommentiBachecaPost: React.FC<CommentiBachecaPostProps> = ({
  post,
  currentUserId,
  currentUserName,
  currentUserRuolo = 'Volontario',
  isAdmin,
  isPresidente,
  onAggiornaPost,
  mostraCommentiIniziali = true
}) => {
  const [aperto, setAperto] = useState(mostraCommentiIniziali);
  const [nuovoCommento, setNuovoCommento] = useState('');
  const [nomePersonalizzato, setNomePersonalizzato] = useState(currentUserName || '');
  const [mostraModificaNome, setMostraModificaNome] = useState(false);

  useEffect(() => {
    if (currentUserName && !mostraModificaNome) {
      setNomePersonalizzato(currentUserName);
    }
  }, [currentUserName, mostraModificaNome]);
  const [feedbackInviato, setFeedbackInviato] = useState<string | null>(null);
  const [rispostaAId, setRispostaAId] = useState<string | null>(null);
  const [rispostaANome, setRispostaANome] = useState<string | null>(null);
  const [testoRisposta, setTestoRisposta] = useState('');
  const [commentoDaEliminareId, setCommentoDaEliminareId] = useState<string | null>(null);

  // Normalizza array dei commenti e dei likes
  const commenti = post.commenti || [];
  const likesPost = post.likes || [];
  const postPiaciuto = likesPost.some(
    (u) => u === currentUserId || u.toLowerCase() === currentUserName.toLowerCase()
  );

  // 1. GESTIONE LIKE AL POST PRINCIPALE
  const handleToggleLikePost = () => {
    let nuoviLikes: string[];
    const userIdentifier = currentUserId || currentUserName;
    if (postPiaciuto) {
      nuoviLikes = likesPost.filter(
        (u) => u !== currentUserId && u.toLowerCase() !== currentUserName.toLowerCase()
      );
    } else {
      nuoviLikes = [...likesPost, userIdentifier];
      // Feedback aptico/sonoro morbido standard
      soundEngine.playStandardNotificationChime();
    }

    const postAggiornato: ComunicazioneBacheca = {
      ...post,
      likes: nuoviLikes
    };
    onAggiornaPost(postAggiornato, undefined, {
      actionType: postPiaciuto ? 'unlike_post' : 'like_post',
      autoreNome: currentUserName || 'Volontario',
      autoreRuolo: currentUserRuolo,
      dataOra: formatDateTimeItaly(undefined, false),
    });
  };

  // 2. GESTIONE LIKE A UN SINGOLO COMMENTO
  const handleToggleLikeCommento = (commentoId: string) => {
    const userIdentifier = currentUserId || currentUserName;
    let wasLiked = false;
    const commentiAggiornati = commenti.map((c) => {
      if (c.id === commentoId) {
        const cLikes = c.likes || [];
        const giaPiaciuto = cLikes.some(
          (u) => u === currentUserId || u.toLowerCase() === currentUserName.toLowerCase()
        );
        wasLiked = giaPiaciuto;
        let nuoviLikesCommento: string[];
        if (giaPiaciuto) {
          nuoviLikesCommento = cLikes.filter(
            (u) => u !== currentUserId && u.toLowerCase() !== currentUserName.toLowerCase()
          );
        } else {
          nuoviLikesCommento = [...cLikes, userIdentifier];
          soundEngine.playStandardNotificationChime();
        }
        return {
          ...c,
          likes: nuoviLikesCommento
        };
      }
      return c;
    });

    onAggiornaPost(
      {
        ...post,
        commenti: commentiAggiornati
      },
      undefined,
      {
        actionType: wasLiked ? 'unlike_comment' : 'like_comment',
        commentId: commentoId,
        autoreNome: currentUserName || 'Volontario',
        autoreRuolo: currentUserRuolo,
        dataOra: formatDateTimeItaly(undefined, false),
      }
    );
  };

  // 3. INVIA NUOVO COMMENTO DIRETTO O RISPOSTA A COMMENTO
  const handleInviaCommento = (parentCommentoId?: string, parentAutoreNome?: string) => {
    const testoDaInviare = parentCommentoId ? testoRisposta.trim() : nuovoCommento.trim();
    if (!testoDaInviare) return;

    const dataOraStr = formatDateTimeItaly(undefined, false);

    // Determina il ruolo visibile
    let ruoloEffettivo = currentUserRuolo;
    if (isAdmin) ruoloEffettivo = 'Amministratore';
    else if (isPresidente) ruoloEffettivo = 'Presidente';

    const nomeAutoreEffettivo = (nomePersonalizzato.trim() || currentUserName || 'Volontario').trim();

    const nuovoItem: CommentoBacheca = {
      id: `comm-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      postPadreId: post.id,
      rispostaACommentoId: parentCommentoId || undefined,
      rispostaANominativo: parentAutoreNome || undefined,
      autoreId: currentUserId || `vol-${Date.now()}`,
      autoreNome: nomeAutoreEffettivo,
      autoreRuolo: ruoloEffettivo,
      testo: testoDaInviare,
      dataOra: dataOraStr,
      timestamp: Date.now(),
      likes: []
    };

    const commentiAggiornati = [...commenti, nuovoItem];

    // =========================================================================
    // CALCOLO DESTINATARI NOTIFICHE SECONDO REQUISITO UTENTE:
    // "Ogni volta che viene inserito un commento sotto ad un post invia una
    // notifica a chi ha creato il post ed anche a chi ha scritto un commento.
    // Se una persona ha scritto più commenti riceve sempre comunque solo una notifica."
    // =========================================================================
    const destinatariNomiSet = new Set<string>();
    const destinatariIdsSet = new Set<string>();

    const nomeMittente = nomeAutoreEffettivo.toLowerCase();
    const idMittente = currentUserId;

    // 1. Autore del post (se diverso da chi sta commentando)
    if (post.autore && post.autore.trim().toLowerCase() !== nomeMittente) {
      destinatariNomiSet.add(post.autore.trim());
      if (post.autoreId && post.autoreId !== idMittente) {
        destinatariIdsSet.add(post.autoreId);
      }
    }

    // 2. Tutti coloro che hanno già scritto un commento sotto questo post
    commenti.forEach((c) => {
      const autoreC = (c.autoreNome || '').trim();
      const autoreCId = c.autoreId;
      if (autoreC && autoreC.toLowerCase() !== nomeMittente) {
        destinatariNomiSet.add(autoreC);
      }
      if (autoreCId && autoreCId !== idMittente) {
        destinatariIdsSet.add(autoreCId);
      }
    });

    const destinatariNomi = Array.from(destinatariNomiSet);
    const destinatariIds = Array.from(destinatariIdsSet);

    onAggiornaPost(
      {
        ...post,
        commenti: commentiAggiornati
      },
      {
        destinatariNomi,
        destinatariIds,
        testoCommento: testoDaInviare,
        autoreCommentoId: currentUserId
      },
      {
        actionType: 'comment',
        commentId: nuovoItem.id,
        parentCommentId: parentCommentoId || undefined,
        parentAutoreNome: parentAutoreNome || undefined,
        autoreNome: nomeAutoreEffettivo,
        autoreRuolo: ruoloEffettivo,
        testo: testoDaInviare,
        dataOra: dataOraStr,
      }
    );

    // Resetta campi
    if (parentCommentoId) {
      setTestoRisposta('');
      setRispostaAId(null);
      setRispostaANome(null);
    } else {
      setNuovoCommento('');
    }

    setFeedbackInviato('✓ Commento pubblicato con successo!');
    setTimeout(() => setFeedbackInviato(null), 3500);

    // Suono notifica standard locale
    soundEngine.playStandardNotificationChime();
  };

  // 4. ELIMINA COMMENTO (RISERVATO A ADMIN E PRESIDENTE)
  const handleConfermaEliminaCommento = () => {
    if (!isAdmin && !isPresidente) {
      setFeedbackInviato('⛔ Solo Amministratore e Presidente possono eliminare i commenti.');
      setTimeout(() => setFeedbackInviato(null), 3500);
      setCommentoDaEliminareId(null);
      return;
    }

    if (!commentoDaEliminareId) return;

    // Rimuove il commento e le eventuali risposte dirette a quel commento
    const commentiFiltrati = commenti.filter(
      (c) => c.id !== commentoDaEliminareId && c.rispostaACommentoId !== commentoDaEliminareId
    );

    onAggiornaPost({
      ...post,
      commenti: commentiFiltrati
    });

    setCommentoDaEliminareId(null);
  };

  // Separa commenti principali (senza genitore) e risposte
  const commentiPrincipali = commenti.filter((c) => !c.rispostaACommentoId);
  const risposteMap: Record<string, CommentoBacheca[]> = {};
  commenti.forEach((c) => {
    if (c.rispostaACommentoId) {
      if (!risposteMap[c.rispostaACommentoId]) {
        risposteMap[c.rispostaACommentoId] = [];
      }
      risposteMap[c.rispostaACommentoId].push(c);
    }
  });

  return (
    <div className="mt-3 pt-3 border-t border-slate-800/80">
      {/* ------------------------------------------------------------- */}
      {/* BARRA AZIONI POST: MI PIACE & CONTEGGIO COMMENTI             */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-2">
          {/* Pulsante Like Post */}
          <button
            type="button"
            onClick={handleToggleLikePost}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              postPiaciuto
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 shadow-sm shadow-rose-950'
                : 'bg-slate-800/70 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
            }`}
            title={postPiaciuto ? 'Rimuovi Mi Piace' : 'Metti Mi Piace a questo post'}
          >
            <Heart
              className={`w-3.5 h-3.5 ${
                postPiaciuto ? 'fill-rose-500 text-rose-500 animate-bounce' : 'text-slate-400'
              }`}
            />
            <span>{postPiaciuto ? 'Ti piace' : 'Mi piace'}</span>
            {likesPost.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-slate-900 text-[10px] text-rose-300 font-black">
                {likesPost.length}
              </span>
            )}
          </button>

          {/* Toggle visualizzazione commenti */}
          <button
            type="button"
            onClick={() => setAperto(!aperto)}
            className="px-3 py-1.5 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
            <span>
              {commenti.length === 0
                ? 'Commenta'
                : `${commenti.length} ${commenti.length === 1 ? 'Commento' : 'Commenti'}`}
            </span>
            {aperto ? (
              <ChevronUp className="w-3 h-3 text-slate-400" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            )}
          </button>
        </div>

        {/* Badge autorizzazione eliminazione commenti */}
        {(isAdmin || isPresidente) && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400/90 font-medium bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-800/40">
            <Shield className="w-3 h-3 text-amber-400" />
            <span>Modera Commenti ({isAdmin ? 'Admin' : 'Presidente'})</span>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SEZIONE APERTA DEI COMMENTI E DELLE RISPOSTE                  */}
      {/* ------------------------------------------------------------- */}
      {aperto && (
        <div className="mt-3.5 space-y-3 animate-in fade-in">
          {/* Elenco commenti esistenti */}
          {commenti.length === 0 ? (
            <div className="text-center py-4 bg-slate-950/50 rounded-2xl border border-dashed border-slate-800 text-slate-400 text-xs">
              <MessageSquare className="w-6 h-6 mx-auto mb-1.5 text-slate-600" />
              <p className="font-medium text-slate-300">Nessun commento finora.</p>
              <p className="text-[11px] text-slate-500">
                Sii il primo a commentare questa comunicazione della bacheca.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {commentiPrincipali.map((comm) => {
                const commLikes = comm.likes || [];
                const giaPiaciutoComm = commLikes.some(
                  (u) => u === currentUserId || u.toLowerCase() === currentUserName.toLowerCase()
                );
                const risposteAQuesto = risposteMap[comm.id] || [];

                return (
                  <div
                    key={comm.id}
                    className="p-3 rounded-2xl bg-slate-900/90 border border-slate-800/90 space-y-2 relative group hover:border-violet-500/40 transition-colors"
                  >
                    {/* Header commento: Autore, Ruolo, Data e Pulsante Elimina (solo Admin/Presidente) */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 text-white font-black text-[10px] flex items-center justify-center shadow">
                          {comm.autoreNome ? comm.autoreNome.charAt(0).toUpperCase() : 'V'}
                        </div>
                        <span className="font-bold text-white text-xs">{comm.autoreNome}</span>
                        {comm.autoreRuolo && (
                          <span
                            className={`text-[9.5px] px-2 py-0.2 rounded-full font-black uppercase border ${
                              comm.autoreRuolo.toLowerCase().includes('admin')
                                ? 'bg-red-950 text-red-300 border-red-800/60'
                                : comm.autoreRuolo.toLowerCase().includes('presidente')
                                ? 'bg-amber-950 text-amber-300 border-amber-700/60'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {comm.autoreRuolo}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{comm.dataOra}</span>
                        </span>
                      </div>

                      {/* Solo Amministratore e Presidente possono cancellare commenti */}
                      {(isAdmin || isPresidente) && (
                        <button
                          type="button"
                          onClick={() => setCommentoDaEliminareId(comm.id)}
                          className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                          title="Elimina commento (Riservato Admin & Presidente)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Testo commento */}
                    <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line pl-8 font-normal">
                      {comm.testo}
                    </p>

                    {/* Barra azioni sotto commento: Mi piace & Rispondi */}
                    <div className="pl-8 flex items-center gap-3 text-[11px] pt-1">
                      <button
                        type="button"
                        onClick={() => handleToggleLikeCommento(comm.id)}
                        className={`font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                          giaPiaciutoComm ? 'text-rose-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Heart
                          className={`w-3 h-3 ${
                            giaPiaciutoComm ? 'fill-rose-500 text-rose-500' : ''
                          }`}
                        />
                        <span>{giaPiaciutoComm ? 'Ti piace' : 'Mi piace'}</span>
                        {commLikes.length > 0 && (
                          <span className="text-[10px] font-black text-rose-300">
                            ({commLikes.length})
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (rispostaAId === comm.id) {
                            setRispostaAId(null);
                            setRispostaANome(null);
                            setTestoRisposta('');
                          } else {
                            setRispostaAId(comm.id);
                            setRispostaANome(comm.autoreNome);
                            setTestoRisposta(`@${comm.autoreNome} `);
                          }
                        }}
                        className="text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <CornerDownRight className="w-3 h-3" />
                        <span>Rispondi</span>
                      </button>
                    </div>

                    {/* Form Risposta Annidata aperto per questo commento */}
                    {rispostaAId === comm.id && (
                      <div className="ml-8 mt-2.5 p-2.5 rounded-xl bg-slate-950 border border-violet-500/50 space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-between text-[11px] text-violet-300">
                          <span className="flex items-center gap-1 font-bold">
                            <CornerDownRight className="w-3 h-3" />
                            Risposta a @{rispostaANome}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setRispostaAId(null);
                              setRispostaANome(null);
                              setTestoRisposta('');
                            }}
                            className="text-slate-400 hover:text-white text-[10px] cursor-pointer"
                          >
                            Annulla
                          </button>
                        </div>
                        <div className="flex items-end gap-2">
                          <textarea
                            rows={2}
                            value={testoRisposta}
                            onChange={(e) => setTestoRisposta(e.target.value)}
                            placeholder={`Scrivi una risposta a ${rispostaANome}...`}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleInviaCommento(comm.id, comm.autoreNome);
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleInviaCommento(comm.id, comm.autoreNome)}
                            disabled={!testoRisposta.trim()}
                            className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shrink-0"
                          >
                            <Send className="w-3 h-3" />
                            <span>Invia</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Elenco risposte annidate sotto questo commento */}
                    {risposteAQuesto.length > 0 && (
                      <div className="ml-8 mt-2 space-y-2 border-l-2 border-violet-500/30 pl-3">
                        {risposteAQuesto.map((risp) => {
                          const rispLikes = risp.likes || [];
                          const giaPiaciutoRisp = rispLikes.some(
                            (u) => u === currentUserId || u.toLowerCase() === currentUserName.toLowerCase()
                          );

                          return (
                            <div
                              key={risp.id}
                              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5 hover:border-violet-500/30 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <div className="w-5 h-5 rounded bg-indigo-700 text-white font-black text-[9px] flex items-center justify-center">
                                    {risp.autoreNome ? risp.autoreNome.charAt(0).toUpperCase() : 'V'}
                                  </div>
                                  <span className="font-bold text-white text-xs">{risp.autoreNome}</span>
                                  {risp.rispostaANominativo && (
                                    <span className="text-[10px] text-violet-400 font-medium">
                                      → @{risp.rispostaANominativo}
                                    </span>
                                  )}
                                  {risp.autoreRuolo && (
                                    <span
                                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase border ${
                                        risp.autoreRuolo.toLowerCase().includes('admin')
                                          ? 'bg-red-950 text-red-300 border-red-800/60'
                                          : risp.autoreRuolo.toLowerCase().includes('presidente')
                                          ? 'bg-amber-950 text-amber-300 border-amber-700/60'
                                          : 'bg-slate-800 text-slate-300 border-slate-700'
                                      }`}
                                    >
                                      {risp.autoreRuolo}
                                    </span>
                                  )}
                                  <span className="text-[9.5px] text-slate-500 font-mono">
                                    {risp.dataOra}
                                  </span>
                                </div>

                                {/* Solo Admin e Presidente possono eliminare */}
                                {(isAdmin || isPresidente) && (
                                  <button
                                    type="button"
                                    onClick={() => setCommentoDaEliminareId(risp.id)}
                                    className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                                    title="Elimina risposta (Riservato Admin & Presidente)"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line font-normal">
                                {risp.testo}
                              </p>

                              {/* Azioni risposta: Like e Rispondi ulteriormente */}
                              <div className="flex items-center gap-3 text-[10.5px] pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleLikeCommento(risp.id)}
                                  className={`font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                    giaPiaciutoRisp ? 'text-rose-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  <Heart
                                    className={`w-3 h-3 ${
                                      giaPiaciutoRisp ? 'fill-rose-500 text-rose-500' : ''
                                    }`}
                                  />
                                  <span>{giaPiaciutoRisp ? 'Ti piace' : 'Mi piace'}</span>
                                  {rispLikes.length > 0 && (
                                    <span className="text-[9.5px] font-black text-rose-300">
                                      ({rispLikes.length})
                                    </span>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setRispostaAId(comm.id);
                                    setRispostaANome(risp.autoreNome);
                                    setTestoRisposta(`@${risp.autoreNome} `);
                                  }}
                                  className="text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <CornerDownRight className="w-3 h-3" />
                                  <span>Rispondi</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ----------------------------------------------------------- */}
          {/* FORM INSERIMENTO NUOVO COMMENTO PRINCIPALE (INFINITI COMMENTI) */}
          {/* ----------------------------------------------------------- */}
          <div className="pt-2">
            {feedbackInviato && (
              <div className="mb-2 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/80 text-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                <span>{feedbackInviato}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 mb-1.5 text-[11px] text-slate-300 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-violet-600 text-white font-black text-[9px] flex items-center justify-center">
                  {(nomePersonalizzato || currentUserName || 'V').charAt(0).toUpperCase()}
                </div>
                <span>
                  Commenta come <strong>{nomePersonalizzato || currentUserName || 'Volontario'}</strong>
                  {isAdmin ? ' (Admin)' : isPresidente ? ' (Presidente)' : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMostraModificaNome(!mostraModificaNome)}
                className="text-[10px] text-violet-400 hover:text-violet-300 underline cursor-pointer"
              >
                {mostraModificaNome ? 'Chiudi' : 'Modifica firma nome'}
              </button>
            </div>

            {mostraModificaNome && (
              <div className="mb-2 p-2 rounded-xl bg-slate-900 border border-violet-500/40 flex items-center gap-2">
                <label className="text-[10px] text-slate-400 shrink-0">Il tuo Nome:</label>
                <input
                  type="text"
                  value={nomePersonalizzato}
                  onChange={(e) => setNomePersonalizzato(e.target.value)}
                  placeholder="Nome e Cognome..."
                  className="flex-1 bg-slate-950 px-2.5 py-1 rounded-lg text-xs text-white border border-slate-700 focus:outline-none focus:border-violet-500"
                />
              </div>
            )}

            <div className="flex items-end gap-2 bg-slate-950 p-2 rounded-2xl border border-slate-800 focus-within:border-violet-500 transition-colors">
              <textarea
                rows={2}
                value={nuovoCommento}
                onChange={(e) => setNuovoCommento(e.target.value)}
                placeholder="Scrivi un commento su questo avviso... (Premi Invio per inviare)"
                className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none resize-none px-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleInviaCommento();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => handleInviaCommento()}
                disabled={!nuovoCommento.trim()}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-bold text-xs uppercase flex items-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Commenta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODALE CONFERMA ELIMINAZIONE COMMENTO (ADMIN / PRESIDENTE)     */}
      {/* ------------------------------------------------------------- */}
      {commentoDaEliminareId && (
        <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-red-500/80 rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-bold text-sm text-white">Conferma Eliminazione</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sei sicuro di voler eliminare questo commento e le eventuali risposte collegate?
              L'operazione è riservata ad Amministratore e Presidente.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCommentoDaEliminareId(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-bold cursor-pointer transition-colors"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleConfermaEliminaCommento}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase cursor-pointer transition-colors"
              >
                Elimina Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
