import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  Trash2,
  GraduationCap,
  MapPin,
  Eye,
  Lock,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Users,
  ExternalLink
} from 'lucide-react';
import { ComunicazioneBacheca, CorsoFormazione, SedeAssociativaCompleta } from '../types/adminTypes';
import { CroceOroLogo } from './CroceOroLogo';
import { CommentiBachecaPost, BachecaInteractionMeta } from './bacheca/CommentiBachecaPost';
import {
  ImmaginePostProtetta,
  ModalVisualizzatoreProtetto,
  ContenutoProtettoBacheca
} from './bacheca/VisualizzatoreProtettoBacheca';
import { formatDimensioneFile } from '../utils/bachecaMedia';
import { realtime } from '../services/realtime';
import {
  getCorsiVisibiliInBacheca,
  getDataInizioEffettivaCorso,
  formatDataItalianaCorso,
  calcolaGiorniAlCorso
} from '../utils/bachecaCorsi';
import { formatDateTimeItaly } from '../utils/italianTime';
import { sortComunicazioniBacheca } from '../utils/bachecaSort';

interface ModalBachecaVolontarioProps {
  aperta: boolean;
  onChiudi: () => void;
  comunicazioni: ComunicazioneBacheca[];
  onAggiornaComunicazioni?: (nuove: ComunicazioneBacheca[], opts?: { notifica?: any; deletedId?: string }) => void;
  corsiFormazione?: CorsoFormazione[];
  onApriDettaglioCorso?: (corso: CorsoFormazione) => void;
  volontarioNome?: string;
  volontarioId?: string;
  volontarioPinHash?: string;
  isAdmin?: boolean;
  isPresidente?: boolean;
  sezioneVolontarioNome?: string;
  sezioneVolontarioId?: string;
  sedi?: SedeAssociativaCompleta[];
  highlightPostId?: string | null;
  onClearHighlight?: () => void;
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
  volontarioPinHash,
  isAdmin = false,
  isPresidente = false,
  sezioneVolontarioNome,
  sezioneVolontarioId,
  highlightPostId = null,
  onClearHighlight
}) => {
  const [ricerca, setRicerca] = useState('');
  const [categoriaSelezionata, setCategoriaSelezionata] = useState('tutte');
  const [soloMiaSezione, setSoloMiaSezione] = useState(false);
  const [focusedPostId, setFocusedPostId] = useState<string | null>(null);
  const [contenutoProtettoAperto, setContenutoProtettoAperto] = useState<ContenutoProtettoBacheca | null>(null);
  const [confermaEliminaPostId, setConfermaEliminaPostId] = useState<string | null>(null);
  const [dettaglioLettoriPostId, setDettaglioLettoriPostId] = useState<string | null>(null);
  const [avvisoBacheca, setAvvisoBacheca] = useState<string | null>(null);
  const [aggiornamentoLive, setAggiornamentoLive] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // All'apertura della bacheca forza SEMPRE un refresh live dal server; se aperta da notifica, apri direttamente il post
  useEffect(() => {
    if (!aperta) {
      setFocusedPostId(null);
      return;
    }
    if (highlightPostId) {
      setFocusedPostId(highlightPostId);
      setRicerca('');
      setCategoriaSelezionata('tutte');
      setSoloMiaSezione(false);
    } else {
      setFocusedPostId(null);
    }
    let cancelled = false;
    setAggiornamentoLive(true);
    realtime
      .refreshPublicRaspberryBoard()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAggiornamentoLive(false);
      });
    return () => {
      cancelled = true;
    };
  }, [aperta, highlightPostId]);

  // Ripristina lo scroll in cima quando si apre un singolo post o si torna alla lista
  useEffect(() => {
    if (!aperta) return;
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = 0;
    }
  }, [aperta, focusedPostId]);

  // Filtra comunicazioni attive e ordina: prima i fissati in alto (evidenziata), poi strettamente cronologico decrescente
  const comunicazioniAttive = useMemo(() => {
    const filtered = comunicazioni.filter((c) => {
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
    });
    return sortComunicazioniBacheca(filtered);
  }, [comunicazioni, soloMiaSezione, sezioneVolontarioId, categoriaSelezionata, ricerca]);

  // Post aperto direttamente (da notifica o da clic su un singolo avviso)
  const postFocalizzato = useMemo(() => {
    if (!focusedPostId) return null;
    return comunicazioni.find((c) => c.id === focusedPostId && c.attiva !== false) || null;
  }, [comunicazioni, focusedPostId]);

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

  const haConfermatoPresaVisione = (com: ComunicazioneBacheca) => {
    const lista = com.preseVisione || [];
    const nomeNorm = (volontarioNome || '').trim().toLowerCase();
    return lista.find(
      (p) =>
        (volontarioId && p.volontarioId && p.volontarioId === volontarioId) ||
        (nomeNorm && (p.volontarioNome || '').trim().toLowerCase() === nomeNorm)
    );
  };

  const comunicazioniDaConfermare = useMemo(
    () =>
      comunicazioniAttive.filter((c) => c.richiedePresaVisione && !haConfermatoPresaVisione(c)),
    [comunicazioniAttive, volontarioId, volontarioNome]
  );

  const handleConfermaPresaVisione = (com: ComunicazioneBacheca) => {
    if (haConfermatoPresaVisione(com)) return;
    const nowTs = Date.now();
    const nuovaConferma = {
      volontarioId: volontarioId || `vol-${nowTs}`,
      volontarioNome: volontarioNome || 'Volontario',
      sezione: sezioneVolontarioNome,
      dataOra: formatDateTimeItaly(),
      timestamp: nowTs,
    };
    const aggiornate = comunicazioni.map((c) =>
      c.id === com.id
        ? {
            ...c,
            preseVisione: [...(c.preseVisione || []), nuovaConferma],
            updatedAt: nowTs,
          }
        : c
    );
    onAggiornaComunicazioni?.(aggiornate);
    if (volontarioId) {
      const ackPayload = {
        postId: com.id,
        volontarioId,
        volontarioNome: nuovaConferma.volontarioNome,
        sezione: sezioneVolontarioNome,
        dataOra: nuovaConferma.dataOra,
        verifyingPinHashes: volontarioPinHash ? [volontarioPinHash] : undefined,
      };
      realtime
        .submitBachecaPresaVisione(ackPayload)
        .then((res) => {
          if (!res?.ok) {
            window.setTimeout(() => {
              realtime.submitBachecaPresaVisione(ackPayload).catch(() => {});
            }, 1500);
          }
        })
        .catch(() => {});
    }
    setAvvisoBacheca(`✓ Presa visione registrata per "${com.titolo}".`);
    setTimeout(() => setAvvisoBacheca(null), 3500);
  };

  // Aggiornamento singolo post (likes, commenti, risposte) con invio garantito anche da smartphone senza Google Auth
  const handleAggiornaSingoloPost = (
    postAggiornato: ComunicazioneBacheca,
    notificaCommento?: {
      destinatariNomi: string[];
      destinatariIds: string[];
      testoCommento: string;
      autoreCommentoId?: string;
    },
    interactionMeta?: BachecaInteractionMeta
  ) => {
    const aggiornate = comunicazioni.map((c) =>
      c.id === postAggiornato.id ? { ...postAggiornato, updatedAt: Date.now() } : c
    );
    if (notificaCommento) {
      const notifPayload = {
        tipo: 'nuovo_commento' as const,
        postId: postAggiornato.id,
        postTitolo: postAggiornato.titolo,
        autoreCommento: interactionMeta?.autoreNome || volontarioNome,
        autoreCommentoId: notificaCommento.autoreCommentoId || volontarioId,
        testoCommento: notificaCommento.testoCommento,
        destinatariVolontariNomi: notificaCommento.destinatariNomi,
        destinatariVolontariIds: notificaCommento.destinatariIds,
        messaggio: `Nuovo commento di ${interactionMeta?.autoreNome || volontarioNome} su "${postAggiornato.titolo}": "${notificaCommento.testoCommento.substring(0, 80)}"`
      };
      onAggiornaComunicazioni?.(aggiornate, { notifica: notifPayload });
    } else {
      onAggiornaComunicazioni?.(aggiornate);
    }

    // Canale write-only Firestore verificato tramite pinHash: consente a tutti gli smartphone
    // di inviare commenti, risposte e Mi Piace alla Centrale con notifica Push immediata all'autore
    if (interactionMeta && volontarioId) {
      const intPayload = {
        actionType: interactionMeta.actionType,
        postId: postAggiornato.id,
        commentId: interactionMeta.commentId,
        parentCommentId: interactionMeta.parentCommentId,
        parentAutoreNome: interactionMeta.parentAutoreNome,
        volontarioId,
        volontarioNome: interactionMeta.autoreNome || volontarioNome || 'Volontario',
        volontarioRuolo:
          interactionMeta.autoreRuolo ||
          (isAdmin ? 'Amministratore' : isPresidente ? 'Presidente' : 'Volontario'),
        testo: interactionMeta.testo,
        dataOra: interactionMeta.dataOra || formatDateTimeItaly(undefined, false),
        verifyingPinHashes: volontarioPinHash ? [volontarioPinHash] : undefined,
      };
      realtime
        .submitBachecaInteraction(intPayload)
        .then((res) => {
          if (!res?.ok) {
            window.setTimeout(() => {
              realtime.submitBachecaInteraction(intPayload).catch(() => {});
            }, 1500);
          }
        })
        .catch(() => {});
    }
  };

  const handleEliminaPost = (postId: string) => {
    const postDaEliminare = comunicazioni.find((c) => c.id === postId);
    const puoEliminare =
      isAdmin ||
      (postDaEliminare?.autoreId && postDaEliminare.autoreId === volontarioId) ||
      (postDaEliminare?.autore && postDaEliminare.autore.trim().toLowerCase() === volontarioNome.trim().toLowerCase());

    if (!puoEliminare) {
      setAvvisoBacheca("⛔ Operazione non autorizzata: i post in bacheca possono essere cancellati solo da chi li ha creati o dall'Amministratore.");
      setTimeout(() => setAvvisoBacheca(null), 4000);
      return;
    }

    if (confermaEliminaPostId !== postId) {
      setConfermaEliminaPostId(postId);
      return;
    }

    const aggiornate = comunicazioni.filter((c) => c.id !== postId);
    setConfermaEliminaPostId(null);
    if (focusedPostId === postId) {
      setFocusedPostId(null);
      onClearHighlight?.();
    }
    onAggiornaComunicazioni?.(aggiornate, { deletedId: postId });
  };

  const tornaAllaLista = () => {
    setFocusedPostId(null);
    onClearHighlight?.();
  };

  if (!aperta) return null;

  const renderPostCard = (com: ComunicazioneBacheca, inSingleView: boolean) => {
    const isUrgente = com.priorita === 'Urgente';
    const isImportante = com.priorita === 'Importante';
    const isHighlighted = Boolean(highlightPostId && com.id === highlightPostId);
    const isAuthorOrStaff =
      isAdmin ||
      isPresidente ||
      (com.autoreId && com.autoreId === volontarioId) ||
      (com.autore && com.autore.trim().toLowerCase() === volontarioNome.trim().toLowerCase());
    const preseVisioneList = Array.isArray(com.preseVisione) ? com.preseVisione : [];

    return (
      <div
        key={com.id}
        data-bacheca-post-id={com.id}
        className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all relative ${
          inSingleView || isHighlighted
            ? 'bg-gradient-to-r from-violet-900/50 via-slate-950 to-slate-950 border-violet-400 ring-1 ring-violet-400/50 shadow-xl shadow-violet-900/40'
            : com.evidenziata
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
            {isHighlighted && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9.5px] font-black uppercase">
                Da notifica
              </span>
            )}
            {com.evidenziata && (
              <span className="px-2 py-0.5 rounded-full bg-violet-500 text-slate-950 text-[9.5px] font-black uppercase flex items-center gap-1">
                <Pin className="w-3 h-3 fill-slate-950" />
                <span>Fissato</span>
              </span>
            )}

            <span
              className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase border ${
                isUrgente
                  ? 'bg-red-950 text-red-300 border-red-700/60'
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

        {/* Titolo, Testo, Immagine Protetta e Allegato Protetto */}
        <div className="py-2.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <h4
              onClick={() => {
                if (!inSingleView) setFocusedPostId(com.id);
              }}
              className={`text-sm sm:text-base font-black text-white tracking-wide ${
                !inSingleView ? 'cursor-pointer hover:text-violet-300 transition-colors' : ''
              }`}
            >
              {com.titolo}
            </h4>
            {!inSingleView && (
              <button
                type="button"
                onClick={() => setFocusedPostId(com.id)}
                className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-violet-600 text-slate-300 hover:text-white text-[10px] font-bold uppercase inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                title="Apri questo post in vista singola"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Apri</span>
              </button>
            )}
          </div>
          <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed whitespace-pre-line font-normal">
            {com.contenuto}
          </p>

          {com.immaginePostDataUrl && (
            <ImmaginePostProtetta
              dataUrl={com.immaginePostDataUrl}
              nome={com.immaginePostNome}
              titoloPost={com.titolo}
              utenteWatermark={volontarioNome || 'Volontario Croce Oro'}
              onApriProtetto={() =>
                setContenutoProtettoAperto({
                  titolo: com.titolo,
                  nomeFile: com.immaginePostNome || `${com.titolo}.jpg`,
                  dataUrl: com.immaginePostDataUrl!,
                  tipo: 'image',
                })
              }
            />
          )}

          {com.allegatoDataUrl && com.allegatoNome && (
            <div className="p-2.5 rounded-xl bg-slate-900 border border-violet-500/40 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-violet-950 border border-violet-500/40 flex items-center justify-center shrink-0">
                  {com.allegatoTipo === 'excel' ? (
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  ) : com.allegatoTipo === 'image' ? (
                    <ImageIcon className="w-4 h-4 text-sky-400" />
                  ) : (
                    <FileText className="w-4 h-4 text-violet-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{com.allegatoNome}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                    <Lock className="w-2.5 h-2.5 text-rose-400" />
                    <span>Solo visualizzazione protetta</span>
                    {com.allegatoDimensione ? <span>• {formatDimensioneFile(com.allegatoDimensione)}</span> : null}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setContenutoProtettoAperto({
                    titolo: com.titolo,
                    nomeFile: com.allegatoNome!,
                    dataUrl: com.allegatoDataUrl!,
                    tipo: com.allegatoTipo || 'pdf',
                    dimensione: com.allegatoDimensione,
                  })
                }
                className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-black text-[10.5px] uppercase inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Visualizza</span>
              </button>
            </div>
          )}
        </div>

        {/* Box Presa Visione Obbligatoria */}
        {com.richiedePresaVisione && (() => {
          const miaConferma = haConfermatoPresaVisione(com);
          const mostraLettori = dettaglioLettoriPostId === com.id;
          return (
            <div
              className={`mb-2.5 p-3 rounded-xl border space-y-2 ${
                miaConferma
                  ? 'bg-emerald-950/35 border-emerald-500/50'
                  : 'bg-amber-950/40 border-amber-500/70'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start gap-2 text-xs">
                  {miaConferma ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    {miaConferma ? (
                      <>
                        <div className="font-black text-emerald-300 uppercase text-[11px]">
                          Presa Visione Confermata
                        </div>
                        <div className="text-[11px] text-emerald-200/80">
                          Registrata il {miaConferma.dataOra}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-black text-amber-300 uppercase text-[11px]">
                          Richiesta Conferma di Lettura (Presa Visione)
                        </div>
                        <div className="text-[11px] text-slate-300">
                          Conferma di aver letto e compreso questa comunicazione importante.
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  {isAuthorOrStaff && (
                    <button
                      type="button"
                      onClick={() => setDettaglioLettoriPostId(mostraLettori ? null : com.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-[10.5px] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Users className="w-3 h-3" />
                      <span>Letto da {preseVisioneList.length}</span>
                    </button>
                  )}
                  {!miaConferma && (
                    <button
                      type="button"
                      onClick={() => handleConfermaPresaVisione(com)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[11px] uppercase inline-flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Conferma Presa Visione</span>
                    </button>
                  )}
                </div>
              </div>

              {isAuthorOrStaff && mostraLettori && (
                <div className="pt-2 border-t border-slate-800/80 text-[11px] space-y-1">
                  <div className="font-black uppercase text-[10px] text-emerald-300">
                    Volontari che hanno confermato ({preseVisioneList.length})
                  </div>
                  {preseVisioneList.length === 0 ? (
                    <div className="text-slate-400">Nessuna conferma ancora ricevuta.</div>
                  ) : (
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {preseVisioneList.map((p, idx) => (
                        <div key={`${p.volontarioId || p.volontarioNome}-${idx}`} className="flex items-center justify-between gap-2 text-slate-200">
                          <span className="truncate font-semibold">{p.volontarioNome}</span>
                          <span className="text-[10px] font-mono text-emerald-400 shrink-0">{p.dataOra}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Firma Autore & Azioni Post Autore/Admin */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 gap-2 flex-wrap">
          <div>
            Firma: <strong className="text-slate-200">{com.autore}</strong>
          </div>
          <div className="flex items-center gap-2">
            {(isAdmin || (com.autoreId && com.autoreId === volontarioId) || (com.autore && com.autore.trim().toLowerCase() === volontarioNome.trim().toLowerCase())) && (
              confermaEliminaPostId === com.id ? (
                <span className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEliminaPost(com.id)}
                    className="px-2 py-0.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-black text-[10px] cursor-pointer"
                  >
                    Conferma Elimina
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfermaEliminaPostId(null)}
                    className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold cursor-pointer"
                  >
                    Annulla
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleEliminaPost(com.id)}
                  className="px-2 py-0.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 border border-slate-800 transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                  title="Elimina post (consentito all'autore o all'Amministratore)"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                  <span>Elimina Post</span>
                </button>
              )
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
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden animate-in fade-in">
      <div className="bg-slate-900 sm:border-2 border-violet-500/80 rounded-none sm:rounded-3xl max-w-4xl w-full h-[100dvh] sm:h-auto sm:max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden">

        {/* ------------------------------------------------------------- */}
        {/* HEADER COMPATTO (SEMPRE LEGGERO SU MOBILE PER MAX SCROLL)     */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-gradient-to-r from-slate-950 via-[#1d1a60] to-slate-950 border-b border-violet-500/40 px-3.5 py-3 sm:px-5 sm:py-4 flex items-center justify-between gap-2.5 shrink-0">
          {focusedPostId ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={tornaAllaLista}
                className="px-2.5 py-1.5 rounded-xl bg-violet-600/30 hover:bg-violet-600/50 border border-violet-400/50 text-violet-100 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Tutti gli avvisi</span>
              </button>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase text-violet-300 tracking-wider">
                  Avviso Bacheca
                </div>
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  {postFocalizzato?.titolo || 'Apertura avviso...'}
                </h3>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-violet-500/20 border border-violet-400/50 text-violet-300 flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5 sm:w-6 sm:h-6 text-violet-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-700/60">
                    Bacheca
                  </span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>{comunicazioniAttive.length} Avvisi</span>
                  </span>
                  {comunicazioniDaConfermare.length > 0 && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-950 text-rose-200 border border-rose-500/70 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                      <span>{comunicazioniDaConfermare.length} Da Confermare</span>
                    </span>
                  )}
                </div>
                <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide mt-0.5 truncate">
                  Comunicazioni & Circolari
                </h3>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onChiudi}
            className="p-2 rounded-xl bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
            title="Chiudi bacheca"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* CORPO UNICO SCROLLABILE (ZERO SCROLL TRAP SU MOBILE)          */}
        {/* ------------------------------------------------------------- */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-3 sm:px-5 py-3 sm:py-4 space-y-3.5"
        >
          {aggiornamentoLive && (
            <div className="px-3 py-1.5 rounded-xl bg-violet-950/60 border border-violet-500/40 text-violet-200 text-[11px] font-bold flex items-center justify-between">
              <span>Aggiornamento comunicazioni in corso...</span>
            </div>
          )}

          {focusedPostId ? (
            postFocalizzato ? (
              renderPostCard(postFocalizzato, true)
            ) : (
              <div className="p-6 sm:p-8 rounded-2xl bg-slate-950/80 border border-slate-800 text-center space-y-3">
                <Megaphone className="w-10 h-10 mx-auto text-violet-400/70" />
                <p className="text-sm font-bold text-white">
                  {aggiornamentoLive
                    ? 'Caricamento dell’avviso dalla Bacheca...'
                    : 'Questo avviso non è più disponibile o è stato archiviato.'}
                </p>
                <button
                  type="button"
                  onClick={tornaAllaLista}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs uppercase cursor-pointer"
                >
                  Mostra Tutti gli Avvisi
                </button>
              </div>
            )
          ) : (
            <>
              {/* Barra Ricerca & Filtri DENTRO lo scroll per lasciare spazio libero su smartphone */}
              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={ricerca}
                      onChange={(e) => setRicerca(e.target.value)}
                      placeholder="Cerca negli avvisi..."
                      className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:ring-1 focus:ring-violet-500 focus:outline-none"
                    />
                    {ricerca && (
                      <button
                        type="button"
                        onClick={() => setRicerca('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {sezioneVolontarioId && sezioneVolontarioNome && (
                    <button
                      type="button"
                      onClick={() => setSoloMiaSezione(!soloMiaSezione)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                        soloMiaSezione
                          ? 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-900/30'
                          : 'bg-slate-900 text-slate-300 hover:text-white border-slate-800'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5 text-violet-300" />
                      <span>Solo Mia Sezione ({sezioneVolontarioNome.split(' ')[0]})</span>
                    </button>
                  )}
                </div>

                {/* Chips Categorie */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
                  {['tutte', 'Comunicazione Generale', 'Disposizioni Operative', 'Turni & Reperibilità', 'Mezzi & Dotazioni', 'Formazione & Eventi'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoriaSelezionata(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer border ${
                        categoriaSelezionata === cat
                          ? 'bg-violet-900/80 text-violet-200 border-violet-500'
                          : 'bg-slate-900/70 text-slate-400 hover:text-slate-200 border-slate-800/80'
                      }`}
                    >
                      {cat === 'tutte' ? 'Tutte le Categorie' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Elenco Comunicazioni (Fissati in alto, poi cronologico dal più recente) */}
              {comunicazioniAttive.length === 0 && corsiInBacheca.length === 0 ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <Megaphone className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-sm font-bold text-slate-400">Nessuna comunicazione corrispondente trovata</p>
                  <p className="text-xs text-slate-500">Prova a modificare i filtri o la ricerca</p>
                </div>
              ) : (
                <>
                  {comunicazioniAttive.map((com) => renderPostCard(com, false))}

                  {/* Blocco Prossimi Corsi & Formazione in Programma */}
                  {corsiInBacheca.length > 0 && (
                    <div className="space-y-2.5 pt-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-black uppercase tracking-wide text-amber-300">
                            Prossimi Corsi & Formazione ({corsiInBacheca.length})
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
                            className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all relative ${
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
                                      ? 'bg-red-950 text-red-300 border-red-600/70'
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
                </>
              )}
            </>
          )}
        </div>

        {/* Avviso errore/conferma inline */}
        {avvisoBacheca && (
          <div className="mx-3 sm:mx-4 mb-2 p-2.5 rounded-xl bg-emerald-950/85 border border-emerald-500/60 text-emerald-200 text-xs font-bold shrink-0">
            {avvisoBacheca}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* FOOTER COMPATTO                                               */}
        {/* ------------------------------------------------------------- */}
        <div className="bg-slate-950 px-3.5 py-2.5 sm:px-4 sm:py-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] border-t border-slate-800 flex items-center justify-between gap-3 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-400 text-[11px] min-w-0">
            <CroceOroLogo size="sm" className="w-5 h-5 shrink-0" />
            <span className="truncate">
              {focusedPostId ? 'Vista diretta avviso' : `Gentile ${volontarioNome}`}
            </span>
          </div>

          <button
            type="button"
            onClick={onChiudi}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs uppercase shadow-md active:scale-95 transition-all cursor-pointer shrink-0"
          >
            Chiudi
          </button>
        </div>

      </div>

      {/* Visualizzatore Protetto Volontario (NO download, Anti-Screenshot) */}
      <ModalVisualizzatoreProtetto
        contenuto={contenutoProtettoAperto}
        onChiudi={() => setContenutoProtettoAperto(null)}
        utenteLabel={volontarioNome || 'Volontario Croce Oro'}
      />
    </div>
  );
};
