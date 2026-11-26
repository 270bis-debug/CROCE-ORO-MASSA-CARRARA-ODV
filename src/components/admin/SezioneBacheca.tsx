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
  Share2,
  GraduationCap,
  MapPin,
  Image as ImageIcon,
  Paperclip,
  FileText,
  FileSpreadsheet,
  Lock,
  Upload
} from 'lucide-react';
import { ComunicazioneBacheca, CorsoFormazione, SedeAssociativaCompleta } from '../../types/adminTypes';
import { Volontario } from '../DatabaseVolontariModal';
import { CroceOroLogo } from '../CroceOroLogo';
import { inviaNotificaModificaAdmin } from '../../utils/notificaModificaAdmin';
import { CommentiBachecaPost } from '../bacheca/CommentiBachecaPost';
import {
  ImmaginePostProtetta,
  ModalVisualizzatoreProtetto,
  ContenutoProtettoBacheca
} from '../bacheca/VisualizzatoreProtettoBacheca';
import {
  ACCEPT_ALLEGATI_BACHECA,
  ACCEPT_IMMAGINE_POST_BACHECA,
  TipoAllegatoBacheca,
  elaboraImmaginePostBacheca,
  elaboraAllegatoBacheca,
  formatDimensioneFile
} from '../../utils/bachecaMedia';
import { realtime } from '../../services/realtime';
import { formatDateTimeItaly, formatISODateItaly, formatTimeItaly } from '../../utils/italianTime';
import { useTitoloDatabase, useNomiSottosezioniCustom } from '../../hooks/useNomiDatabase';
import { getTitoloSottosezione } from '../../constants/macroCategorie';
import {
  getCorsiVisibiliInBacheca,
  getDataInizioEffettivaCorso,
  formatDataItalianaCorso,
  calcolaGiorniAlCorso
} from '../../utils/bachecaCorsi';

interface SezioneBachecaProps {
  comunicazioni: ComunicazioneBacheca[];
  onAggiornaComunicazioni: (nuove: ComunicazioneBacheca[], opts?: { notifica?: any; deletedId?: string }) => void;
  corsiFormazione?: CorsoFormazione[];
  sedi: SedeAssociativaCompleta[];
  volontari?: Volontario[];
  operatoreCorrente: string;
  operatoreId?: string;
  isAdmin?: boolean;
  isPresidente?: boolean;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  allowedSubtabs?: string[] | null;
}

export const SezioneBacheca: React.FC<SezioneBachecaProps> = ({
  comunicazioni,
  onAggiornaComunicazioni,
  corsiFormazione = [],
  sedi,
  volontari = [],
  operatoreCorrente,
  operatoreId,
  isAdmin = true,
  isPresidente = false,
  onNotificaRadio,
  allowedSubtabs = null
}) => {
  const nomiSubCustom = useNomiSottosezioniCustom();
  const canShowSubtab = (id: string) => !allowedSubtabs || allowedSubtabs.includes(id);
  const canPubblicaBacheca = canShowSubtab('pubblica');
  const canVediElencoBacheca = canShowSubtab('elenco');
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
  const [formRichiedePresaVisione, setFormRichiedePresaVisione] = useState(false);
  const [formAutore, setFormAutore] = useState(operatoreCorrente || 'Direzione Operativa');
  const [dettaglioPresaVisionePostId, setDettaglioPresaVisionePostId] = useState<string | null>(null);
  const [invioPromemoriaPostId, setInvioPromemoriaPostId] = useState<string | null>(null);
  const [formImmaginePostDataUrl, setFormImmaginePostDataUrl] = useState<string | undefined>(undefined);
  const [formImmaginePostNome, setFormImmaginePostNome] = useState<string | undefined>(undefined);
  const [formAllegatoDataUrl, setFormAllegatoDataUrl] = useState<string | undefined>(undefined);
  const [formAllegatoNome, setFormAllegatoNome] = useState<string | undefined>(undefined);
  const [formAllegatoTipo, setFormAllegatoTipo] = useState<TipoAllegatoBacheca | undefined>(undefined);
  const [formAllegatoMime, setFormAllegatoMime] = useState<string | undefined>(undefined);
  const [formAllegatoDimensione, setFormAllegatoDimensione] = useState<number | undefined>(undefined);
  const [erroreMediaForm, setErroreMediaForm] = useState<string | null>(null);
  const [caricamentoMedia, setCaricamentoMedia] = useState(false);

  // Visualizzatore protetto (no download / anti-screenshot)
  const [contenutoProtettoAperto, setContenutoProtettoAperto] = useState<ContenutoProtettoBacheca | null>(null);

  // Modale conferma eliminazione
  const [idDaEliminare, setIdDaEliminare] = useState<string | null>(null);

  // Notifica temporanea
  const [avviso, setAvviso] = useState<string | null>(null);
  const mostraAvviso = (msg: string) => {
    setAvviso(msg);
    setTimeout(() => setAvviso(null), 4000);
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
    setFormRichiedePresaVisione(false);
    setFormAutore(operatoreCorrente || 'Direzione Operativa');
    setFormImmaginePostDataUrl(undefined);
    setFormImmaginePostNome(undefined);
    setFormAllegatoDataUrl(undefined);
    setFormAllegatoNome(undefined);
    setFormAllegatoTipo(undefined);
    setFormAllegatoMime(undefined);
    setFormAllegatoDimensione(undefined);
    setErroreMediaForm(null);
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
    setFormRichiedePresaVisione(Boolean(com.richiedePresaVisione));
    setFormAutore(com.autore);
    setFormImmaginePostDataUrl(com.immaginePostDataUrl);
    setFormImmaginePostNome(com.immaginePostNome);
    setFormAllegatoDataUrl(com.allegatoDataUrl);
    setFormAllegatoNome(com.allegatoNome);
    setFormAllegatoTipo(com.allegatoTipo);
    setFormAllegatoMime(com.allegatoMime);
    setFormAllegatoDimensione(com.allegatoDimensione);
    setErroreMediaForm(null);
    setModaleAperta(true);
  };

  const calcolaStatoPresaVisione = (com: ComunicazioneBacheca) => {
    const attivi = (volontari || []).filter((v) => {
      if (!v || v.approvato === false || v.bloccatoPerTentativi) return false;
      if (com.sezioneTargetId && com.sezioneTargetId !== 'tutte') {
        return v.sezioneAppartenenzaId === com.sezioneTargetId;
      }
      return true;
    });
    const conferme = com.preseVisione || [];
    const confermatiIds = new Set(conferme.map((p) => p.volontarioId).filter(Boolean));
    const confermatiNomi = new Set(conferme.map((p) => (p.volontarioNome || '').trim().toLowerCase()).filter(Boolean));

    const mancanti = attivi.filter((v) => {
      const full1 = `${v.cognome || ''} ${v.nome || ''}`.trim().toLowerCase();
      const full2 = `${v.nome || ''} ${v.cognome || ''}`.trim().toLowerCase();
      return !confermatiIds.has(v.id) && !confermatiNomi.has(full1) && !confermatiNomi.has(full2);
    });

    const totaleTarget = Math.max(attivi.length, conferme.length);
    const percentuale = totaleTarget > 0 ? Math.min(100, Math.round((conferme.length / totaleTarget) * 100)) : 0;
    return { totaleTarget, conferme, mancanti, percentuale };
  };

  const handleInviaPromemoriaMancanti = async (com: ComunicazioneBacheca) => {
    const { mancanti } = calcolaStatoPresaVisione(com);
    if (mancanti.length === 0) {
      mostraAvviso('✓ Tutti i volontari destinatari hanno già confermato la presa visione!');
      return;
    }
    setInvioPromemoriaPostId(com.id);
    try {
      const resp = await fetch('/api/notifica-presa-visione', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: com.id,
          titolo: com.titolo,
          sezioneTargetNome: com.sezioneTargetNome,
          operatore: operatoreCorrente,
          mancanti: mancanti.map((v) => ({
            id: v.id,
            nome: `${v.nome || ''} ${v.cognome || ''}`.trim(),
            email: v.emailNotifiche || v.email || undefined,
          })),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      const oraStr = formatDateTimeItaly();
      const aggiornate = comunicazioni.map((c) =>
        c.id === com.id ? { ...c, ultimoPromemoriaPresaVisione: oraStr, updatedAt: Date.now() } : c
      );
      onAggiornaComunicazioni(aggiornate);
      mostraAvviso(
        resp.ok
          ? `✓ Promemoria inviato a ${mancanti.length} volontari mancanti (${data.emailInviate || 0} email + notifica in-app).`
          : `⚠️ Promemoria in-app inviato, verifica configurazione email.`
      );
    } catch {
      mostraAvviso('⚠️ Errore di connessione durante l’invio del promemoria ai mancanti.');
    } finally {
      setInvioPromemoriaPostId(null);
    }
  };

  const handleCaricaImmaginePost = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErroreMediaForm(null);
    setCaricamentoMedia(true);
    try {
      const res = await elaboraImmaginePostBacheca(file);
      setFormImmaginePostDataUrl(res.dataUrl);
      setFormImmaginePostNome(res.nome);
    } catch (err: any) {
      setErroreMediaForm(err?.message || 'Errore nel caricamento dell\'immagine del post.');
    } finally {
      setCaricamentoMedia(false);
    }
  };

  const handleCaricaAllegato = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErroreMediaForm(null);
    setCaricamentoMedia(true);
    try {
      const res = await elaboraAllegatoBacheca(file);
      setFormAllegatoDataUrl(res.dataUrl);
      setFormAllegatoNome(res.nome);
      setFormAllegatoTipo(res.tipo);
      setFormAllegatoMime(res.mime);
      setFormAllegatoDimensione(res.dimensione);
    } catch (err: any) {
      setErroreMediaForm(err?.message || 'Errore nel caricamento dell\'allegato.');
    } finally {
      setCaricamentoMedia(false);
    }
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
    const nowTs = Date.now();

    if (comunicazioneInModifica) {
      // Modifica esistente: consentita solo all'autore o all'Amministratore
      const puoModificare =
        isAdmin ||
        (comunicazioneInModifica.autoreId && comunicazioneInModifica.autoreId === operatoreId) ||
        (comunicazioneInModifica.autore && comunicazioneInModifica.autore.trim().toLowerCase() === operatoreCorrente.trim().toLowerCase());

      if (!puoModificare) {
        mostraAvviso("⛔ Operazione non autorizzata: i post in bacheca possono essere modificati o cancellati solo da chi li ha creati (l'Amministratore può modificare o cancellare qualsiasi post).");
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
            richiedePresaVisione: formRichiedePresaVisione,
            autore: formAutore.trim() || operatoreCorrente,
            updatedAt: nowTs,
            immaginePostDataUrl: formImmaginePostDataUrl,
            immaginePostNome: formImmaginePostNome,
            allegatoDataUrl: formAllegatoDataUrl,
            allegatoNome: formAllegatoNome,
            allegatoTipo: formAllegatoTipo,
            allegatoMime: formAllegatoMime,
            allegatoDimensione: formAllegatoDimensione
          };
        }
        return c;
      });
      onAggiornaComunicazioni(aggiornate);
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
        id: `com-${nowTs}-${Math.floor(Math.random() * 1000)}`,
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
        richiedePresaVisione: formRichiedePresaVisione,
        preseVisione: [],
        updatedAt: nowTs,
        immaginePostDataUrl: formImmaginePostDataUrl,
        immaginePostNome: formImmaginePostNome,
        allegatoDataUrl: formAllegatoDataUrl,
        allegatoNome: formAllegatoNome,
        allegatoTipo: formAllegatoTipo,
        allegatoMime: formAllegatoMime,
        allegatoDimensione: formAllegatoDimensione,
        likes: [],
        commenti: []
      };

      const aggiornate = [nuova, ...comunicazioni];

      // Notifica SOLO in-app a tutti gli account con il titolo del post (sincronizzata in un'unica operazione atomica)
      const notifPayload = {
        id: `bacheca-post-${nuova.id}-${nowTs}`,
        tipo: 'nuovo_post' as const,
        postId: nuova.id,
        postTitolo: nuova.titolo,
        autoreCommento: nuova.autore,
        sezioneTargetId: nuova.sezioneTargetId,
        sezioneTargetNome: targetNome,
        priorita: nuova.priorita,
        soloInApp: true,
        createdAt: nowTs,
        messaggio: `Nuovo post in bacheca: "${nuova.titolo}" [${nuova.priorita}] — ${targetNome}`
      };
      onAggiornaComunicazioni(aggiornate, { notifica: notifPayload });

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
    const aggiornate = comunicazioni.map((c) =>
      c.id === postAggiornato.id ? { ...postAggiornato, updatedAt: Date.now() } : c
    );
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
      onAggiornaComunicazioni(aggiornate, { notifica: notifPayload });
    } else {
      onAggiornaComunicazioni(aggiornate);
    }
  };

  // Toggle evidenziata (Pin)
  const toggleEvidenziata = (id: string) => {
    const nowTs = Date.now();
    const aggiornate = comunicazioni.map((c) => {
      if (c.id === id) {
        const statoNuovo = !c.evidenziata;
        mostraAvviso(statoNuovo ? '📌 Comunicazione fissata in evidenza in cima alla bacheca.' : 'Comunicazione sfissata.');
        return { ...c, evidenziata: statoNuovo, updatedAt: nowTs };
      }
      return c;
    });
    onAggiornaComunicazioni(aggiornate);
  };

  // Toggle attiva / archiviata
  const toggleAttiva = (id: string) => {
    const nowTs = Date.now();
    let postRiattivato: ComunicazioneBacheca | null = null;
    const aggiornate = comunicazioni.map((c) => {
      if (c.id === id) {
        const stato = !c.attiva;
        if (stato) postRiattivato = { ...c, attiva: true, updatedAt: nowTs };
        mostraAvviso(stato ? '✓ Comunicazione riattivata e visibile ai volontari.' : '✓ Comunicazione archiviata.');
        return { ...c, attiva: stato, updatedAt: nowTs };
      }
      return c;
    });
    if (postRiattivato) {
      const p: ComunicazioneBacheca = postRiattivato;
      onAggiornaComunicazioni(aggiornate, {
        notifica: {
          id: `bacheca-post-${p.id}-${nowTs}`,
          tipo: 'nuovo_post' as const,
          postId: p.id,
          postTitolo: p.titolo,
          autoreCommento: p.autore,
          sezioneTargetId: p.sezioneTargetId,
          sezioneTargetNome: p.sezioneTargetNome,
          priorita: p.priorita,
          soloInApp: true,
          createdAt: nowTs,
          messaggio: `Post pubblicato in bacheca: "${p.titolo}" [${p.priorita}] — ${p.sezioneTargetNome}`
        }
      });
    } else {
      onAggiornaComunicazioni(aggiornate);
    }
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
      mostraAvviso("⛔ Operazione non autorizzata: i post in bacheca possono essere eliminati solo da chi li ha creati (l'Amministratore può eliminare qualsiasi post).");
      setIdDaEliminare(null);
      return;
    }
    const deletedId = idDaEliminare;
    const aggiornate = comunicazioni.filter((c) => c.id !== deletedId);
    onAggiornaComunicazioni(aggiornate, { deletedId });
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

  // Corsi e formazione in programma visibili in bacheca (fino al giorno stesso in cui iniziano)
  const corsiInBacheca = useMemo(() => {
    return getCorsiVisibiliInBacheca(corsiFormazione);
  }, [corsiFormazione]);

  const corsiInBachecaFiltrati = useMemo(() => {
    if (filtroCategoria !== 'tutte' && filtroCategoria !== 'Formazione & Eventi') return [];
    if (filtroPriorita !== 'tutte' && filtroPriorita !== 'Importante') return [];
    return corsiInBacheca.filter((c) => {
      if (filtroSede !== 'tutte') {
        const destIds = c.sezioniDestinatarieIds || [];
        const tutte = destIds.length === 0 || destIds.includes('TUTTE') || destIds.includes('tutte');
        if (!tutte && !destIds.includes(filtroSede) && c.sedeSvolgimentoSedeId !== filtroSede) {
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
  }, [corsiInBacheca, filtroCategoria, filtroPriorita, filtroSede, ricerca]);

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
          {canPubblicaBacheca && (
          <button
            type="button"
            onClick={() => apriNuova()}
            className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black text-xs uppercase flex items-center gap-2 shadow-lg shadow-violet-600/30 active:scale-95 transition-all cursor-pointer border border-violet-400/40"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nuova Comunicazione</span>
          </button>
          )}
        </div>
      </div>

      {/* Sottosezioni Bacheca Autorizzate */}
      <div className="flex items-center gap-2 flex-wrap">
        {canVediElencoBacheca && (
          <span className="px-3 py-1 rounded-xl bg-violet-950/70 border border-violet-500/40 text-violet-200 text-xs font-black uppercase">
            1. {getTitoloSottosezione('bacheca', 'elenco', 'Consultazione Bacheca & Avvisi', nomiSubCustom)}
          </span>
        )}
        {canPubblicaBacheca && (
          <span className="px-3 py-1 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs font-black uppercase">
            2. {getTitoloSottosezione('bacheca', 'pubblica', 'Pubblica & Modifica Comunicazioni', nomiSubCustom)}
          </span>
        )}
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
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Corsi in Bacheca</span>
            <span className="text-lg font-black text-amber-300 font-mono">{corsiInBacheca.length}</span>
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
      {/* PROSSIMI CORSI & FORMAZIONE IN PROGRAMMA (AUTO IN BACHECA)    */}
      {/* ------------------------------------------------------------- */}
      {corsiInBachecaFiltrati.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wide text-amber-300">
                Prossimi Corsi & Formazione in Programma ({corsiInBachecaFiltrati.length})
              </h3>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">
              Visibili fino al giorno di inizio, poi rimossi automaticamente
            </span>
          </div>

          <div className="space-y-3">
            {corsiInBachecaFiltrati.map((corso) => {
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
                  key={`bacheca-corso-${corso.id}`}
                  className={`p-4 sm:p-5 rounded-2xl border-2 transition-all relative overflow-hidden ${
                    iniziaOggi
                      ? 'bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-900 border-amber-400/90 shadow-lg shadow-amber-950/40'
                      : 'bg-gradient-to-r from-amber-950/25 via-slate-900 to-slate-900 border-amber-500/50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase flex items-center gap-1">
                        <GraduationCap className="w-3 h-3" />
                        <span>Corso / Formazione</span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
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
                      <span className="px-2 py-0.5 rounded-full bg-slate-950 text-amber-200 border border-amber-700/50 text-[10px] font-bold">
                        {corso.tipologia}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800/50 text-[10px] font-bold flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-blue-400" />
                        <span>{sezioniLabel}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-amber-200 font-mono font-bold">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-amber-400" />
                        <span>Inizio: {formatDataItalianaCorso(dataInizioIso)}</span>
                      </span>
                      {corso.orarioInizioLezione && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>
                              {corso.orarioInizioLezione}
                              {corso.orarioFineLezione ? ` - ${corso.orarioFineLezione}` : ''}
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="py-3 space-y-1.5">
                    <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                      {corso.titolo}
                    </h3>
                    {corso.sottotitolo && (
                      <p className="text-xs font-semibold text-amber-200/90 italic">{corso.sottotitolo}</p>
                    )}
                    {corso.descrizione && (
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                        {corso.descrizione}
                      </p>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      {corso.sedeCorso && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-amber-400" />
                          <strong>{corso.sedeCorso}</strong>
                        </span>
                      )}
                      {corso.docenteFormatore && (
                        <span>
                          Docente: <strong className="text-white">{corso.docenteFormatore}</strong>
                        </span>
                      )}
                      {corso.oreTotali > 0 && (
                        <span>
                          Durata: <strong className="text-amber-300">{corso.oreTotali}h</strong>
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      Codice: <strong className="text-amber-300 font-mono">{corso.codiceCorso}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* ELENCO COMUNICAZIONI                                           */}
      {/* ------------------------------------------------------------- */}
      {comunicazioniFiltrate.length === 0 && corsiInBachecaFiltrati.length === 0 ? (
        <div className="bg-slate-900/40 p-12 rounded-3xl border border-dashed border-slate-800 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 text-slate-500 mx-auto flex items-center justify-center">
            <Megaphone className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-300">Nessuna comunicazione trovata</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Non ci sono comunicazioni o corsi in programma che corrispondono ai filtri selezionati. Fai clic su "Nuova Comunicazione" per crearne una.
          </p>
          {canPubblicaBacheca && (
          <button
            type="button"
            onClick={() => apriNuova()}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs uppercase cursor-pointer"
          >
            + Nuova Comunicazione
          </button>
          )}
        </div>
      ) : comunicazioniFiltrate.length > 0 ? (
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
                <div className="py-3 space-y-3">
                  <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                    {com.titolo}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line font-normal">
                    {com.contenuto}
                  </p>

                  {/* Immagine del post (adattata allo schermo di PC / Tablet / Smartphone) */}
                  {com.immaginePostDataUrl && (
                    <ImmaginePostProtetta
                      dataUrl={com.immaginePostDataUrl}
                      nome={com.immaginePostNome}
                      titoloPost={com.titolo}
                      utenteWatermark={operatoreCorrente || 'Croce Oro'}
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

                  {/* Allegato protetto (solo visualizzazione, nessun download) */}
                  {com.allegatoDataUrl && com.allegatoNome && (
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-violet-500/40 flex flex-wrap items-center justify-between gap-2">
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
                            <span>Allegato protetto (solo visione, download bloccato)</span>
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
                        className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-black text-[11px] uppercase inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Visualizza Protetto</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Tracking Presa Visione Obbligatoria */}
                {com.richiedePresaVisione && (() => {
                  const pv = calcolaStatoPresaVisione(com);
                  const isAperto = dettaglioPresaVisionePostId === com.id;
                  return (
                    <div className="mb-3 p-3 rounded-xl bg-slate-950/90 border border-emerald-500/40 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/50 text-[10px] font-black uppercase inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Presa Visione: {pv.conferme.length} / {pv.totaleTarget} ({pv.percentuale}%)</span>
                          </span>
                          {pv.mancanti.length > 0 && (
                            <span className="text-[11px] font-bold text-amber-300">
                              Mancano {pv.mancanti.length} volontari
                            </span>
                          )}
                          {com.ultimoPromemoriaPresaVisione && (
                            <span className="text-[10px] text-slate-400">
                              Ultimo sollecito: {com.ultimoPromemoriaPresaVisione}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setDettaglioPresaVisionePostId(isAperto ? null : com.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10.5px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Users className="w-3 h-3 text-emerald-400" />
                            <span>{isAperto ? 'Nascondi Elenco' : 'Vedi Chi Ha Letto'}</span>
                          </button>
                          {pv.mancanti.length > 0 && (
                            <button
                              type="button"
                              disabled={invioPromemoriaPostId === com.id}
                              onClick={() => handleInviaPromemoriaMancanti(com)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-[10.5px] font-black uppercase inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Send className="w-3 h-3" />
                              <span>
                                {invioPromemoriaPostId === com.id
                                  ? 'Invio...'
                                  : `Sollecita Mancanti (${pv.mancanti.length})`}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pv.percentuale >= 85 ? 'bg-emerald-500' : pv.percentuale >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${pv.percentuale}%` }}
                        />
                      </div>

                      {isAperto && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1 text-[11px]">
                          <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                            <div className="font-black text-emerald-300 uppercase text-[10px] mb-1.5">
                              ✓ Confermati ({pv.conferme.length})
                            </div>
                            {pv.conferme.length === 0 ? (
                              <div className="text-slate-500">Nessuna conferma ancora ricevuta.</div>
                            ) : (
                              <div className="max-h-36 overflow-y-auto space-y-1">
                                {pv.conferme.map((p, idx) => (
                                  <div key={`${p.volontarioId}-${idx}`} className="flex items-center justify-between gap-2 text-slate-200">
                                    <span className="truncate font-semibold">{p.volontarioNome}</span>
                                    <span className="text-[10px] font-mono text-emerald-400 shrink-0">{p.dataOra}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/30">
                            <div className="font-black text-amber-300 uppercase text-[10px] mb-1.5">
                              ⏳ In Attesa di Conferma ({pv.mancanti.length})
                            </div>
                            {pv.mancanti.length === 0 ? (
                              <div className="text-emerald-300 font-bold">Tutti i volontari hanno confermato!</div>
                            ) : (
                              <div className="max-h-36 overflow-y-auto space-y-1">
                                {pv.mancanti.map((v) => (
                                  <div key={v.id} className="flex items-center justify-between gap-2 text-slate-300">
                                    <span className="truncate">{v.cognome} {v.nome}</span>
                                    <span className="text-[10px] text-slate-500 shrink-0">{v.sezioneAppartenenzaNome || 'Sede'}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Footer Scheda: Autore e Azioni Amministratore */}
                <div className="pt-2.5 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <span className="font-semibold">Pubblicato da:</span>
                    <strong className="text-slate-200">{com.autore}</strong>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-auto">
                    {/* Toggle Evidenziata (Pin) */}
                    {canPubblicaBacheca && (
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
                    )}

                    {/* Toggle Attiva / Archivia */}
                    {canPubblicaBacheca && (
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
                    )}

                    {/* Modifica: consentita all'autore del post o all'Amministratore */}
                    {canPubblicaBacheca && puoModificarePost && (
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
                    {canPubblicaBacheca && puoEliminarePost && (
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
      ) : null}

      {/* ------------------------------------------------------------- */}
      {/* MODALE CREAZIONE / MODIFICA COMUNICAZIONE                     */}
      {/* ------------------------------------------------------------- */}
      {modaleAperta && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-slate-900 border-2 border-violet-500 rounded-3xl max-w-2xl w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl my-auto">
            {/* Header Fisso */}
            <div className="p-4 sm:p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide truncate">
                    {comunicazioneInModifica ? 'Modifica Comunicazione di Sezione' : 'Nuova Comunicazione in Bacheca'}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    Puoi allegare un&apos;immagine del post e un allegato protetto (solo visione, senza download)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModaleAperta(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer shrink-0"
                title="Chiudi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvaComunicazione} className="flex flex-col flex-1 min-h-0 text-xs">
              {/* Corpo Scrollabile */}
              <div className="p-4 sm:p-5 space-y-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
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

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Livello Priorità</label>
                    <select
                      value={formPriorita}
                      onChange={(e) => {
                        const val = e.target.value as ComunicazioneBacheca['priorita'];
                        setFormPriorita(val);
                        if (!comunicazioneInModifica && (val === 'Importante' || val === 'Urgente')) {
                          setFormRichiedePresaVisione(true);
                        }
                      }}
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
                    rows={4}
                    value={formContenuto}
                    onChange={(e) => setFormContenuto(e.target.value)}
                    placeholder="Scrivi qui il testo completo della circolare o avviso operativo per i volontari..."
                    className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none leading-relaxed"
                  />
                </div>

                {/* MEDIA & ALLEGATO PROTETTO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950 border border-violet-500/35">
                  {/* 1. Immagine del Post */}
                  <div className="space-y-2">
                    <label className="block text-slate-200 font-bold flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                      <span>Immagine del Post (Adattiva)</span>
                    </label>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      Si adatta automaticamente a PC, tablet e smartphone senza ingombrare tutto lo schermo. Visione protetta senza download.
                    </p>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/50 text-sky-200 font-bold text-[11px] cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{formImmaginePostDataUrl ? 'Sostituisci Immagine' : 'Carica Immagine'}</span>
                      <input
                        type="file"
                        accept={ACCEPT_IMMAGINE_POST_BACHECA}
                        onChange={handleCaricaImmaginePost}
                        className="hidden"
                      />
                    </label>
                    {formImmaginePostDataUrl && (
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                        <img
                          src={formImmaginePostDataUrl}
                          alt="Anteprima post"
                          className="max-h-28 w-auto mx-auto rounded-lg object-contain"
                        />
                        <div className="flex items-center justify-between gap-2 text-[10px] text-slate-300">
                          <span className="truncate">{formImmaginePostNome || 'Immagine allegata'}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setFormImmaginePostDataUrl(undefined);
                              setFormImmaginePostNome(undefined);
                            }}
                            className="text-rose-400 hover:text-rose-300 font-bold shrink-0 cursor-pointer"
                          >
                            Rimuovi
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Allegato Protetto (solo pdf, jpeg, png, doc, docx, bmp, xls, xlsx) */}
                  <div className="space-y-2">
                    <label className="block text-slate-200 font-bold flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-violet-400" />
                      <span>Allegato Protetto</span>
                    </label>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      Formati ammessi: <strong>PDF, JPEG, PNG, DOC, DOCX, BMP, XLS, XLSX</strong>. I volontari potranno solo visualizzarlo in ambiente protetto (download e screenshot bloccati).
                    </p>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/50 text-violet-200 font-bold text-[11px] cursor-pointer">
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{formAllegatoDataUrl ? 'Sostituisci Allegato' : 'Allega Documento/File'}</span>
                      <input
                        type="file"
                        accept={ACCEPT_ALLEGATI_BACHECA}
                        onChange={handleCaricaAllegato}
                        className="hidden"
                      />
                    </label>
                    {formAllegatoDataUrl && formAllegatoNome && (
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-violet-500/40 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-white truncate">{formAllegatoNome}</div>
                          <div className="text-[10px] text-slate-400">
                            {formatDimensioneFile(formAllegatoDimensione)} • Solo visione protetta
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormAllegatoDataUrl(undefined);
                            setFormAllegatoNome(undefined);
                            setFormAllegatoTipo(undefined);
                            setFormAllegatoMime(undefined);
                            setFormAllegatoDimensione(undefined);
                          }}
                          className="text-[10px] text-rose-400 hover:text-rose-300 font-bold shrink-0 cursor-pointer"
                        >
                          Rimuovi
                        </button>
                      </div>
                    )}
                  </div>

                  {erroreMediaForm && (
                    <div className="sm:col-span-2 p-2.5 rounded-xl bg-rose-950/70 border border-rose-500/60 text-[11px] text-rose-200 font-bold">
                      ⚠️ {erroreMediaForm}
                    </div>
                  )}
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

                  <div className="flex flex-col justify-center gap-2 pt-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formEvidenziata}
                        onChange={(e) => setFormEvidenziata(e.target.checked)}
                        className="w-4 h-4 rounded text-violet-600 bg-slate-950 border-slate-700 focus:ring-violet-500"
                      />
                      <span className="text-slate-300 font-bold">Fissa in evidenza in cima alla bacheca</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formRichiedePresaVisione}
                        onChange={(e) => setFormRichiedePresaVisione(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-500 bg-slate-950 border-slate-700 focus:ring-emerald-500"
                      />
                      <span className="text-emerald-300 font-bold">
                        Richiedi &quot;Presa Visione&quot; (traccia letture e sollecita mancanti)
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Pulsanti Footer Fisso Modale */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setModaleAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={caricamentoMedia}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-black uppercase flex items-center gap-2 shadow-lg shadow-violet-600/30 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{caricamentoMedia ? 'Elaborazione...' : comunicazioneInModifica ? 'Salva Modifiche' : 'Pubblica Comunicazione'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visualizzatore Protetto Bacheca */}
      <ModalVisualizzatoreProtetto
        contenuto={contenutoProtettoAperto}
        onChiudi={() => setContenutoProtettoAperto(null)}
        utenteLabel={operatoreCorrente || 'Operatore Croce Oro'}
      />

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
