import React, { useState, useMemo } from 'react';
import {
  Megaphone,
  PlusCircle,
  Search,
  Filter,
  Pin,
  PinOff,
  AlertTriangle,
  Info,
  CheckCircle2,
  Trash2,
  Edit3,
  Calendar,
  Clock,
  Building2,
  Eye,
  EyeOff,
  X,
  Save,
  Users,
  Send,
  Sparkles,
  Share2
} from 'lucide-react';
import { ComunicazioneBacheca, SedeAssociativaCompleta } from '../../types/adminTypes';
import { CroceOroLogo } from '../CroceOroLogo';
import { inviaNotificaModificaAdmin } from '../../utils/notificaModificaAdmin';
import { CommentiBachecaPost } from '../bacheca/CommentiBachecaPost';
import { realtime } from '../../services/realtime';
import { formatISODateItaly, formatTimeItaly } from '../../utils/italianTime';
import { useTitoloDatabase } from '../../hooks/useNomiDatabase';

interface SezioneBachecaProps {
  comunicazioni: ComunicazioneBacheca[];
  onAggiornaComunicazioni: (nuove: ComunicazioneBacheca[]) => void;
  sedi: SedeAssociativaCompleta[];
  operatoreCorrente: string;
  operatoreId?: string;
  isAdmin?: boolean;
  isPresidente?: boolean;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
}

export const SezioneBacheca: React.FC<SezioneBachecaProps> = ({
  comunicazioni,
  onAggiornaComunicazioni,
  sedi,
  operatoreCorrente,
  operatoreId,
  isAdmin = true,
  isPresidente = false,
  onNotificaRadio
}) => {
  // Filtri di ricerca
  const [ricerca, setRicerca] = useState('');
  const [filtroSede, setFiltroSede] = useState('tutte');
  const [filtroCategoria, setFiltroCategoria] = useState('tutte');
  const [filtroPriorita, setFiltroPriorita] = useState('tutte');
  const [mostraSoloAttive, setMostraSoloAttive] = useState(true);

  // Modale creazione / modifica comunicazione
  const [modaleAperta, setModaleAperta] = useState(false);
  const [comunicazioneInModifica, setComunicazioneInModifica] = useState<ComunicazioneBacheca | null>(null);

  // Campi form
  const [formTitolo, setFormTitolo] = useState('');
  const [formContenuto, setFormContenuto] = useState('');
  const [formSezioneTargetId, setFormSezioneTargetId] = useState('tutte');
  const [formPriorita, setFormPriorita] = useState<ComunicazioneBacheca['priorita']>('Ordinaria');
  const [formCategoria, setFormCategoria] = useState<ComunicazioneBacheca['categoria']>('Comunicazione Generale');
  const [formEvidenziata, setFormEvidenziata] = useState(false);
  const [formAutore, setFormAutore] = useState(operatoreCorrente || 'Direzione Operativa');

  // Modale conferma eliminazione
  const [idDaEliminare, setIdDaEliminare] = useState<string | null>(null);

  // Notifica temporanea
  const [avviso, setAvviso] = useState<string | null>(null);
  const mostraAvviso = (msg: string) => {
    setAvviso(msg);
    setTimeout(() => setAvviso(null), 3500);
  };

  // Apertura modale nuova comunicazione
  const apriNuova = (prefillSedeId?: string) => {
    setComunicazioneInModifica(null);
    setFormTitolo('');
    setFormContenuto('');
    setFormSezioneTargetId(prefillSedeId || 'tutte');
    setFormPriorita('Ordinaria');
    setFormCategoria('Comunicazione Generale');
    setFormEvidenziata(false);
    setFormAutore(operatoreCorrente || 'Direzione Operativa');
    setModaleAperta(true);
  };

  // Apertura modale modifica
  const apriModifica = (com: ComunicazioneBacheca) => {
    setComunicazioneInModifica(com);
    setFormTitolo(com.titolo);
    setFormContenuto(com.contenuto);
    setFormSezioneTargetId(com.sezioneTargetId);
    setFormPriorita(com.priorita);
    setFormCategoria(com.categoria);
    setFormEvidenziata(Boolean(com.evidenziata));
    setFormAutore(com.autore);
    setModaleAperta(true);
  };

  // Salvataggio form
  const handleSalvaComunicazione = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitolo.trim() || !formContenuto.trim()) {
      mostraAvviso('⚠️ Compila tutti i campi obbligatori (Titolo e Contenuto).');
      return;
    }

    const sedeObj = sedi.find((s) => s.id === formSezioneTargetId);
    const targetNome = formSezioneTargetId === 'tutte' ? 'Tutte le Sezioni Territoriali' : (sedeObj?.nome || 'Sezione Territoriale');

    const now = new Date();
    const dataOggi = formatISODateItaly(now);
    const oraOggi = formatTimeItaly(now, false);

    if (comunicazioneInModifica) {
      // Modifica esistente: consentita solo all'autore o all'Amministratore
      const puoModificare =
        isAdmin ||
        (comunicazioneInModifica.autoreId && comunicazioneInModifica.autoreId === operatoreId) ||
        (comunicazioneInModifica.autore && comunicazioneInModifica.autore.trim().toLowerCase() === operatoreCorrente.trim().toLowerCase());

      if (!puoModificare) {
        alert("⛔ Operazione non autorizzata: i post in bacheca possono essere modificati o cancellati solo da chi li ha creati (l'Amministratore può modificare o cancellare qualsiasi post).");
        return;
      }

      const aggiornate = comunicazioni.map((c) => {
        if (c.id === comunicazioneInModifica.id) {
          return {
            ...c,
            titolo: formTitolo.trim(),
            contenuto: formContenuto.trim(),
            sezioneTargetId: formSezioneTargetId,
            sezioneTargetNome: targetNome,
            priorita: formPriorita,
            categoria: formCategoria,
            evidenziata: formEvidenziata,
            autore: formAutore.trim() || operatoreCorrente
          };
        }
        return c;
      });
      onAggiornaComunicazioni(aggiornate);
      realtime.syncBacheca(aggiornate);
      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'bacheca',
          'Modifica comunicazione bacheca',
          `Modificata comunicazione bacheca "${formTitolo}" (${formCategoria}, priorità: ${formPriorita})`,
          operatoreCorrente
        );
      }
      mostraAvviso('✓ Comunicazione aggiornata con successo.');
    } else {
      // Creazione nuova comunicazione
      const nuova: ComunicazioneBacheca = {
        id: `com-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        titolo: formTitolo.trim(),
        contenuto: formContenuto.trim(),
        sezioneTargetId: formSezioneTargetId,
        sezioneTargetNome: targetNome,
        priorita: formPriorita,
        categoria: formCategoria,
        dataPubblicazione: dataOggi,
        oraPubblicazione: oraOggi,
        autore: formAutore.trim() || operatoreCorrente,
        autoreId: operatoreId,
        attiva: true,
        evidenziata: formEvidenziata,
        likes: [],
        commenti: []
      };

      const aggiornate = [nuova, ...comunicazioni];
      onAggiornaComunicazioni(aggiornate);

      // Notifica in tempo reale per nuovo post in bacheca (pop-up + standard chime, no sirena)
      const notifPayload = {
        tipo: 'nuovo_post' as const,
        postId: nuova.id,
        postTitolo: nuova.titolo,
        autoreCommento: nuova.autore,
        messaggio: `Nuova comunicazione: "${nuova.titolo}" [${nuova.priorita}] destinata a ${targetNome}`
      };
      realtime.syncBacheca(aggiornate, notifPayload);

      onNotificaRadio?.(
        `📢 NUOVA COMUNICAZIONE BACHECA: "${nuova.titolo}" destinata a ${targetNome} [${nuova.priorita}]`,
        'sistema'
      );
      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'bacheca',
          'Nuova comunicazione bacheca pubblicata',
          `Pubblicata nuova comunicazione "${nuova.titolo}" destinata a ${targetNome} (categoria: ${nuova.categoria}, priorità: ${nuova.priorita})`,
          operatoreCorrente
        );
      }
      mostraAvviso('✓ Nuova comunicazione pubblicata in bacheca.');
    }

    setModaleAperta(false);
  };

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
    onAggiornaComunicazioni(aggiornate);

    if (notificaCommento) {
      const notifPayload = {
        tipo: 'nuovo_commento' as const,
        postId: postAggiornato.id,
        postTitolo: postAggiornato.titolo,
        autoreCommento: operatoreCorrente,
        testoCommento: notificaCommento.testoCommento,
        destinatariVolontariNomi: notificaCommento.destinatariNomi,
        destinatariVolontariIds: notificaCommento.destinatariIds,
        messaggio: `Nuovo commento di ${operatoreCorrente} su "${postAggiornato.titolo}": "${notificaCommento.testoCommento.substring(0, 80)}"`
      };
      realtime.syncBacheca(aggiornate, notifPayload);
    } else {
      realtime.syncBacheca(aggiornate);
    }
  };

  // Toggle evidenziata (Pin)
  const toggleEvidenziata = (id: string) => {
    const aggiornate = comunicazioni.map((c) => {
      if (c.id === id) {
        const statoNuovo = !c.evidenziata;
        mostraAvviso(statoNuovo ? '📌 Comunicazione fissata in evidenza in cima alla bacheca.' : 'Comunicazione sfissata.');
        return { ...c, evidenziata: statoNuovo };
      }
      return c;
    });
    onAggiornaComunicazioni(aggiornate);
  };

  // Toggle attiva / archiviata
  const toggleAttiva = (id: string) => {
    const aggiornate = comunicazioni.map((c) => {
      if (c.id === id) {
        const stato = !c.attiva;
        mostraAvviso(stato ? '✓ Comunicazione riattivata e visibile ai volontari.' : '✓ Comunicazione archiviata.');
        return { ...c, attiva: stato };
      }
      return c;
    });
    onAggiornaComunicazioni(aggiornate);
  };

  // Eliminazione definitiva (consentita solo all'autore del post o all'Amministratore)
  const confermaEliminazione = () => {
    if (!idDaEliminare) return;
    const postDaEliminare = comunicazioni.find((c) => c.id === idDaEliminare);
    const puoEliminare =
      isAdmin ||
      (postDaEliminare?.autoreId && postDaEliminare.autoreId === operatoreId) ||
      (postDaEliminare?.autore && postDaEliminare.autore.trim().toLowerCase() === operatoreCorrente.trim().toLowerCase());

    if (!puoEliminare) {
      alert("⛔ Operazione non autorizzata: i post in bacheca possono essere eliminati solo da chi li ha creati (l'Amministratore può eliminare qualsiasi post).");
      setIdDaEliminare(null);
      return;
    }
    const aggiornate = comunicazioni.filter((c) => c.id !== idDaEliminare);
    onAggiornaComunicazioni(aggiornate);
    realtime.syncBacheca(aggiornate);
    setIdDaEliminare(null);
    mostraAvviso('✓ Comunicazione eliminata definitivamente dalla bacheca.');
  };

  // Filtro e ordinamento comunicazioni (prima le evidenziate, poi le urgenti, poi data decrescente)
  const comunicazioniFiltrate = useMemo(() => {
    return comunicazioni
      .filter((c) => {
        if (mostraSoloAttive && !c.attiva) return false;
        if (filtroSede !== 'tutte' && c.sezioneTargetId !== 'tutte' && c.sezioneTargetId !== filtroSede) return false;
        if (filtroCategoria !== 'tutte' && c.categoria !== filtroCategoria) return false;
        if (filtroPriorita !== 'tutte' && c.priorita !== filtroPriorita) return false;
        if (ricerca.trim()) {
          const q = ricerca.toLowerCase().trim();
          const matchTitolo = c.titolo.toLowerCase().includes(q);
          const matchContenuto = c.contenuto.toLowerCase().includes(q);
          const matchAutore = c.autore.toLowerCase().includes(q);
          const matchSede = c.sezioneTargetNome.toLowerCase().includes(q);
          if (!matchTitolo && !matchContenuto && !matchAutore && !matchSede) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // 1. Evidenziate prima
        if (a.evidenziata && !b.evidenziata) return -1;
        if (!a.evidenziata && b.evidenziata) return 1;

        // 2. Urgenti prima
        if (a.priorita === 'Urgente' && b.priorita !== 'Urgente') return -1;
        if (a.priorita !== 'Urgente' && b.priorita === 'Urgente') return 1;

        // 3. Data e ora decrescente
        const dtA = `${a.dataPubblicazione} ${a.oraPubblicazione}`;
        const dtB = `${b.dataPubblicazione} ${b.oraPubblicazione}`;
        return dtB.localeCompare(dtA);
      });
  }, [comunicazioni, mostraSoloAttive, filtroSede, filtroCategoria, filtroPriorita, ricerca]);

  // Statistiche rapide
  const totaliAttive = comunicazioni.filter((c) => c.attiva).length;
  const totaliUrgenti = comunicazioni.filter((c) => c.attiva && c.priorita === 'Urgente').length;
  const totaliEvidenziate = comunicazioni.filter((c) => c.attiva && c.evidenziata).length;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 animate-in fade-in duration-300">
      
      {/* Toast Notifiche */}
      {avviso && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-slate-900 border-2 border-violet-500 text-white font-bold text-xs shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-3">
          <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
          <span>{avviso}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* HEADER BACHECA DI SEZIONE                                      */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900/90 p-5 rounded-3xl border-2 border-violet-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="w-13 h-13 rounded-2xl bg-violet-500/20 border border-violet-400/40 text-violet-400 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/10">
            <Megaphone className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-violet-950 text-violet-300 border border-violet-700/50">
                Macrocategoria 9 • Portale Gestionale
              </span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Visibile a Tutti i Volontari</span>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wide mt-1">
              {useTitoloDatabase('bacheca', 'Bacheca di Sezione & Comunicazioni Ufficiali')}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
              Pubblica comunicazioni di servizio, disposizioni operative, circolari e avvisi urgenti. I volontari hanno accesso diretto alla bacheca tramite un pulsante dedicato nella prima schermata appena effettuato il login.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-end md:self-auto relative z-10">
          <button
            type="button"
            onClick={() => apriNuova()}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs uppercase flex items-center gap-2 shadow-lg shadow-violet-600/30 active:scale-95 transition-all cursor-pointer border border-violet-400/40"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nuova Comunicazione</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* BARRA STATISTICHE & RIEPILOGO BACHECA                          */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Totale Attive</span>
            <span className="text-lg font-black text-white font-mono">{totaliAttive}</span>
          </div>
        </div>

        <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Avvisi Urgenti</span>
            <span className="text-lg font-black text-red-400 font-mono">{totaliUrgenti}</span>
          </div>
        </div>

        <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Pin className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Fissate in Alto</span>
            <span className="text-lg font-black text-amber-400 font-mono">{totaliEvidenziate}</span>
          </div>
        </div>

        <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Sezioni Coperte</span>
            <span className="text-lg font-black text-blue-400 font-mono">{sedi.length} Sedi</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* BARRA FILTRI & RICERCA                                        */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          
          {/* Ricerca testuale */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              placeholder="Cerca per titolo, testo, autore o sezione..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
            />
            {ricerca && (
              <button
                type="button"
                onClick={() => setRicerca('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filtri a tendina */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Sezione Destinataria */}
            <select
              value={filtroSede}
              onChange={(e) => setFiltroSede(e.target.value)}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold"
            >
              <option value="tutte">Tutte le Sezioni ({comunicazioni.length})</option>
              {sedi.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>

            {/* Categoria */}
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold"
            >
              <option value="tutte">Tutte le Categorie</option>
              <option value="Comunicazione Generale">Comunicazione Generale</option>
              <option value="Disposizioni Operative">Disposizioni Operative</option>
              <option value="Formazione & Eventi">Formazione & Eventi</option>
              <option value="Turni & Reperibilità">Turni & Reperibilità</option>
              <option value="Mezzi & Dotazioni">Mezzi & Dotazioni</option>
            </select>

            {/* Priorità */}
            <select
              value={filtroPriorita}
              onChange={(e) => setFiltroPriorita(e.target.value)}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold"
            >
              <option value="tutte">Tutte le Priorità</option>
              <option value="Urgente">🔴 Solo Urgenti</option>
              <option value="Importante">🟡 Solo Importanti</option>
              <option value="Ordinaria">🟢 Solo Ordinarie</option>
            </select>

            {/* Toggle Solo Attive */}
            <button
              type="button"
              onClick={() => setMostraSoloAttive(!mostraSoloAttive)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                mostraSoloAttive
                  ? 'bg-slate-950 text-slate-300 border-slate-700 hover:text-white'
                  : 'bg-violet-950 text-violet-300 border-violet-700'
              }`}
            >
              {mostraSoloAttive ? 'Nascondi Archiviate' : 'Mostra Anche Archiviate'}
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ELENCO COMUNICAZIONI                                           */}
      {/* ------------------------------------------------------------- */}
      {comunicazioniFiltrate.length === 0 ? (
        <div className="bg-slate-900/40 p-12 rounded-3xl border border-dashed border-slate-800 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 text-slate-500 mx-auto flex items-center justify-center">
            <Megaphone className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-300">Nessuna comunicazione trovata</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Non ci sono comunicazioni che corrispondono ai filtri selezionati. Fai clic su "Nuova Comunicazione" per crearne una.
          </p>
          <button
            type="button"
            onClick={() => apriNuova()}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase cursor-pointer"
          >
            + Nuova Comunicazione
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {comunicazioniFiltrate.map((com) => {
            const isUrgente = com.priorita === 'Urgente';
            const isImportante = com.priorita === 'Importante';
            const puoModificarePost =
              isAdmin ||
              (com.autoreId && com.autoreId === operatoreId) ||
              (com.autore && com.autore.trim().toLowerCase() === operatoreCorrente.trim().toLowerCase());
            const puoEliminarePost =
              isAdmin ||
              (com.autoreId && com.autoreId === operatoreId) ||
              (com.autore && com.autore.trim().toLowerCase() === operatoreCorrente.trim().toLowerCase());

            return (
              <div
                key={com.id}
                className={`p-4 sm:p-5 rounded-2xl border-2 transition-all relative overflow-hidden ${
                  !com.attiva
                    ? 'bg-slate-900/40 border-slate-800/70 opacity-60'
                    : com.evidenziata
                    ? 'bg-gradient-to-r from-violet-950/40 via-slate-900 to-slate-900 border-violet-500/80 shadow-lg shadow-violet-950/40 ring-1 ring-violet-400/50'
                    : isUrgente
                    ? 'bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-900 border-red-500/80 shadow-lg shadow-red-950/40'
                    : isImportante
                    ? 'bg-slate-900/90 border-amber-500/60'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header Scheda: Badge, Titolo, Data */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800/80">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Badge Evidenziata */}
                    {com.evidenziata && (
                      <span className="px-2 py-0.5 rounded-full bg-violet-500 text-slate-950 text-[10px] font-black uppercase flex items-center gap-1 shadow-sm">
                        <Pin className="w-3 h-3 fill-slate-950" />
                        <span>In Evidenza</span>
                      </span>
                    )}

                    {/* Badge Priorità */}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        isUrgente
                          ? 'bg-red-950 text-red-300 border-red-700/60 animate-pulse'
                          : isImportante
                          ? 'bg-amber-950 text-amber-300 border-amber-700/60'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-700/60'
                      }`}
                    >
                      {isUrgente ? '🔴 Urgente' : isImportante ? '🟡 Importante' : '🟢 Ordinaria'}
                    </span>

                    {/* Categoria */}
                    <span className="px-2 py-0.5 rounded-full bg-slate-950 text-slate-300 border border-slate-800 text-[10px] font-bold">
                      {com.categoria}
                    </span>

                    {/* Sezione Target */}
                    <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/50 text-[10px] font-bold flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-blue-400" />
                      <span>{com.sezioneTargetNome}</span>
                    </span>

                    {!com.attiva && (
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[9.5px] font-black uppercase">
                        Archiviata
                      </span>
                    )}
                  </div>

                  {/* Data & Ora Pubblicazione */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-violet-400" />
                      <span>{com.dataPubblicazione}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-violet-400" />
                      <span>{com.oraPubblicazione}</span>
                    </span>
                  </div>
                </div>

                {/* Corpo Comunicazione */}
                <div className="py-3 space-y-2">
                  <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                    {com.titolo}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line font-normal">
                    {com.contenuto}
                  </p>
                </div>

                {/* Footer Scheda: Autore e Azioni Amministratore */}
                <div className="pt-2.5 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <span className="font-semibold">Pubblicato da:</span>
                    <strong className="text-slate-200">{com.autore}</strong>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-auto">
                    {/* Toggle Evidenziata (Pin) */}
                    <button
                      type="button"
                      onClick={() => toggleEvidenziata(com.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                        com.evidenziata
                          ? 'bg-violet-900/60 text-violet-300 border-violet-700/60 hover:bg-violet-800'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                      title={com.evidenziata ? 'Rimuovi evidenza' : 'Fissa in evidenza in cima'}
                    >
                      {com.evidenziata ? <PinOff className="w-3.5 h-3.5 text-violet-300" /> : <Pin className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{com.evidenziata ? 'Sfissa' : 'Evidenzia'}</span>
                    </button>

                    {/* Toggle Attiva / Archivia */}
                    <button
                      type="button"
                      onClick={() => toggleAttiva(com.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                        com.attiva
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                          : 'bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border-emerald-700'
                      }`}
                      title={com.attiva ? 'Archivia (non visibile ai volontari)' : 'Riattiva in bacheca'}
                    >
                      {com.attiva ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-emerald-400" />}
                      <span>{com.attiva ? 'Archivia' : 'Riattiva'}</span>
                    </button>

                    {/* Modifica: consentita all'autore del post o all'Amministratore */}
                    {puoModificarePost && (
                      <button
                        type="button"
                        onClick={() => apriModifica(com)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-white text-xs font-bold flex items-center gap-1 border border-slate-700 transition-all cursor-pointer"
                        title="Modifica comunicazione (Autore o Admin)"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-teal-400" />
                        <span>Modifica</span>
                      </button>
                    )}

                    {/* Elimina: consentita all'autore del post o all'Amministratore */}
                    {puoEliminarePost && (
                      <button
                        type="button"
                        onClick={() => setIdDaEliminare(com.id)}
                        className="px-2.5 py-1 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 hover:text-white text-xs font-bold flex items-center gap-1 border border-red-800/60 transition-all cursor-pointer"
                        title="Elimina comunicazione (Autore o Admin)"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        <span>Elimina</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sezione Commenti, Risposte Annidate e Likes del Post */}
                <CommentiBachecaPost
                  post={com}
                  currentUserId={operatoreId || 'admin'}
                  currentUserName={operatoreCorrente || 'Amministratore'}
                  currentUserRuolo={isAdmin ? 'Amministratore' : isPresidente ? 'Presidente' : 'Operatore'}
                  isAdmin={Boolean(isAdmin)}
                  isPresidente={Boolean(isPresidente)}
                  onAggiornaPost={handleAggiornaSingoloPost}
                  mostraCommentiIniziali={true}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODALE CREAZIONE / MODIFICA COMUNICAZIONE                     */}
      {/* ------------------------------------------------------------- */}
      {modaleAperta && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border-2 border-violet-500 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wide">
                    {comunicazioneInModifica ? 'Modifica Comunicazione di Sezione' : 'Nuova Comunicazione in Bacheca'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    I dettagli inseriti saranno visibili a tutti i volontari della sezione scelta
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModaleAperta(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvaComunicazione} className="space-y-4 text-xs">
              
              {/* Titolo */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Titolo Comunicazione / Circolare <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitolo}
                  onChange={(e) => setFormTitolo(e.target.value)}
                  placeholder="Es. Disposizioni Operative Turni Festivi e Manovre Sanitarie..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold text-sm focus:ring-2 focus:ring-violet-500 focus:outline-none"
                />
              </div>

              {/* RIGA 2: SEZIONE TARGET, CATEGORIA, PRIORITÀ */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Sezione Destinataria */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Sezione Destinataria</label>
                  <select
                    value={formSezioneTargetId}
                    onChange={(e) => setFormSezioneTargetId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold"
                  >
                    <option value="tutte">Tutte le Sezioni Territoriali</option>
                    {sedi.map((s) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </div>

                {/* Categoria */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Categoria</label>
                  <select
                    value={formCategoria}
                    onChange={(e) => setFormCategoria(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold"
                  >
                    <option value="Comunicazione Generale">Comunicazione Generale</option>
                    <option value="Disposizioni Operative">Disposizioni Operative</option>
                    <option value="Formazione & Eventi">Formazione & Eventi</option>
                    <option value="Turni & Reperibilità">Turni & Reperibilità</option>
                    <option value="Mezzi & Dotazioni">Mezzi & Dotazioni</option>
                  </select>
                </div>

                {/* Priorità */}
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Livello Priorità</label>
                  <select
                    value={formPriorita}
                    onChange={(e) => setFormPriorita(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  >
                    <option value="Ordinaria">🟢 Ordinaria</option>
                    <option value="Importante">🟡 Importante</option>
                    <option value="Urgente">🔴 Urgente (Badge in evidenza)</option>
                  </select>
                </div>
              </div>

              {/* Contenuto Testuale */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Testo della Comunicazione <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  value={formContenuto}
                  onChange={(e) => setFormContenuto(e.target.value)}
                  placeholder="Scrivi qui il testo completo della circolare o avviso operativo per i volontari..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none leading-relaxed"
                />
              </div>

              {/* RIGA 3: AUTORE & OPZIONE PIN EVIDENZIATO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Autore / Firma</label>
                  <input
                    type="text"
                    value={formAutore}
                    onChange={(e) => setFormAutore(e.target.value)}
                    placeholder="Es. Direzione Operativa / Coordinatore Sede"
                    className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formEvidenziata}
                      onChange={(e) => setFormEvidenziata(e.target.checked)}
                      className="w-4 h-4 rounded text-violet-600 bg-slate-950 border-slate-700 focus:ring-violet-500"
                    />
                    <span className="text-slate-300 font-bold">Fissa in evidenza in cima alla bacheca</span>
                  </label>
                </div>
              </div>

              {/* Pulsanti Footer Modale */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModaleAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black uppercase flex items-center gap-2 shadow-lg shadow-violet-600/30 active:scale-95 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{comunicazioneInModifica ? 'Salva Modifiche' : 'Pubblica Comunicazione'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODALE CONFERMA ELIMINAZIONE                                  */}
      {/* ------------------------------------------------------------- */}
      {idDaEliminare && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border-2 border-red-500 rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-white uppercase">Elimina Comunicazione</h3>
            <p className="text-xs text-slate-300">
              Sei sicuro di voler rimuovere questa comunicazione dalla bacheca? I volontari non potranno più visualizzarla.
            </p>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIdDaEliminare(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={confermaEliminazione}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase shadow-md shadow-red-600/30"
              >
                Sì, Elimina
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
