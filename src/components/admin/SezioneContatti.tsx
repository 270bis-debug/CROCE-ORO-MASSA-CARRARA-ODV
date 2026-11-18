import React, { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  PlusCircle,
  Wrench,
  Truck,
  Heart,
  Landmark,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  FileText,
  Edit2,
  Trash2,
  Save,
  X,
  Check,
  CheckCircle2,
  AlertTriangle,
  Download,
  ShieldAlert,
  Sparkles,
  Tag,
  Calendar,
  FileCheck2,
  RefreshCw,
  Navigation,
  Map as MapIcon
} from 'lucide-react';
import { ContattoEsterno, TipoContattoEsterno, IndirizzoCollezionato } from '../../types/adminTypes';
import { inviaNotificaModificaAdmin } from '../../utils/notificaModificaAdmin';
import { MappaIndirizzoCollezionato } from './MappaIndirizzoCollezionato';
import { formatISODateItaly } from '../../utils/italianTime';
import { useTitoloDatabase } from '../../hooks/useNomiDatabase';

interface SezioneContattiProps {
  contatti: ContattoEsterno[];
  onAggiornaContatti: (contatti: ContattoEsterno[]) => void;
  indirizziCollezionati?: IndirizzoCollezionato[];
  onAggiornaIndirizziCollezionati?: (indirizzi: IndirizzoCollezionato[]) => void;
  googleMapsApiKey?: string;
  mapsQuotaExceeded?: boolean;
  serviziArchivio?: any[];
  operatoreCorrente?: string;
  isAdmin?: boolean;
  hasAccess?: boolean; // Accesso autorizzato dall'amministratore
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
}

export const SezioneContatti: React.FC<SezioneContattiProps> = ({
  contatti,
  onAggiornaContatti,
  indirizziCollezionati = [],
  onAggiornaIndirizziCollezionati,
  googleMapsApiKey = '',
  mapsQuotaExceeded = false,
  serviziArchivio = [],
  operatoreCorrente = 'Amministratore',
  isAdmin = true,
  hasAccess = true,
  onNotificaRadio
}) => {
  // Filtro tipologia (include sottosezione Indirizzi Collezionati)
  const titoloDbContatti = useTitoloDatabase('contatti', 'Contatti Fornitori / Clienti / Ecc.');
  const [filtroTipo, setFiltroTipo] = useState<'tutti' | TipoContattoEsterno | 'indirizzi_collezionati'>('tutti');
  const [ricerca, setRicerca] = useState('');

  // Modale Indirizzo Collezionato & Mappa Pin
  const [modaleIndirizzoAperta, setModaleIndirizzoAperta] = useState(false);
  const [indirizzoInModifica, setIndirizzoInModifica] = useState<IndirizzoCollezionato | null>(null);

  // Modale Nuovo / Modifica Contatto
  const [modaleAperta, setModaleAperta] = useState(false);
  const [contattoInModifica, setContattoInModifica] = useState<ContattoEsterno | null>(null);

  // Campi Form Anagrafica
  const [formTipo, setFormTipo] = useState<TipoContattoEsterno>('fornitore');
  const [formRagioneSociale, setFormRagioneSociale] = useState('');
  const [formReferente, setFormReferente] = useState('');
  const [formPivaCf, setFormPivaCf] = useState('');
  const [formIndirizzo, setFormIndirizzo] = useState('');
  const [formCitta, setFormCitta] = useState('Massa');
  const [formCap, setFormCap] = useState('54100');
  const [formProvincia, setFormProvincia] = useState('MS');
  const [formTelefono, setFormTelefono] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPec, setFormPec] = useState('');
  const [formIban, setFormIban] = useState('');
  const [formNote, setFormNote] = useState('');

  // Dati Donazione Intervento
  const [formHaDonazione, setFormHaDonazione] = useState(false);
  const [formDonazCodiceServizio, setFormDonazCodiceServizio] = useState('');
  const [formDonazData, setFormDonazData] = useState(formatISODateItaly());
  const [formDonazImporto, setFormDonazImporto] = useState<number>(50);
  const [formDonazMetodo, setFormDonazMetodo] = useState<'Contanti' | 'POS' | 'Bonifico'>('Contanti');
  const [formDonazMezzo, setFormDonazMezzo] = useState('T4606');
  const [formDonazNote, setFormDonazNote] = useState('');

  // Notifiche locali
  const [avviso, setAvviso] = useState<string | null>(null);
  const mostraAvviso = (msg: string) => {
    setAvviso(msg);
    setTimeout(() => setAvviso(null), 4000);
  };

  // Se l'utente non ha le autorizzazioni concesse dall'amministratore
  if (!isAdmin && !hasAccess) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 space-y-4">
        <div className="bg-red-950/80 border-2 border-red-500 rounded-3xl p-6 text-center space-y-3 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/40">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-wider">
            Accesso Riservato • {titoloDbContatti}
          </h2>
          <p className="text-sm text-red-200 max-w-lg mx-auto leading-relaxed">
            A questa macrocategoria possono accedere <strong>solo ed esclusivamente gli utenti con autorizzazione concessa dall'Amministratore</strong> dell'associazione.
          </p>
          <div className="pt-2 text-xs text-slate-400">
            Contatta l'amministratore o la presidenza per richiedere l'abilitazione della macrocategoria sul tuo profilo personale.
          </div>
        </div>
      </div>
    );
  }

  // Filtraggio contatti
  const contattiFiltrati = useMemo(() => {
    return contatti.filter((c) => {
      const matchTipo = filtroTipo === 'tutti' || c.tipo === filtroTipo;
      const query = ricerca.toLowerCase().trim();
      const matchQuery =
        !query ||
        c.ragioneSociale.toLowerCase().includes(query) ||
        (c.referente && c.referente.toLowerCase().includes(query)) ||
        c.partitaIvaCodiceFiscale.toLowerCase().includes(query) ||
        c.indirizzo.toLowerCase().includes(query) ||
        c.citta.toLowerCase().includes(query) ||
        c.telefono.includes(query) ||
        c.email.toLowerCase().includes(query) ||
        (c.donazioneOrigineIntervento?.codiceServizio &&
          c.donazioneOrigineIntervento.codiceServizio.toLowerCase().includes(query));

      return matchTipo && matchQuery;
    });
  }, [contatti, filtroTipo, ricerca]);

  // Filtraggio Indirizzi Collezionati
  const indirizziFiltrati = useMemo(() => {
    const q = ricerca.toLowerCase().trim();
    return (indirizziCollezionati || []).filter((ind) => {
      if (!q) return true;
      return (
        (ind.nome && ind.nome.toLowerCase().includes(q)) ||
        ind.indirizzo.toLowerCase().includes(q) ||
        (ind.note && ind.note.toLowerCase().includes(q))
      );
    });
  }, [indirizziCollezionati, ricerca]);

  // Salvataggio / Modifica / Eliminazione Indirizzo Collezionato (consentito a chiunque abbia accesso al database)
  const handleSalvaIndirizzoCollezionato = (saved: IndirizzoCollezionato) => {
    if (!onAggiornaIndirizziCollezionati) return;
    const exists = indirizziCollezionati.some((i) => i.id === saved.id);
    const updated = exists
      ? indirizziCollezionati.map((i) => (i.id === saved.id ? saved : i))
      : [saved, ...indirizziCollezionati];
    onAggiornaIndirizziCollezionati(updated);
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'contatti',
        exists ? 'Modifica Indirizzo Collezionato' : 'Nuovo Indirizzo Collezionato',
        `${exists ? 'Aggiornato' : 'Inserito'} indirizzo "${saved.nome || saved.indirizzo}"`,
        operatoreCorrente
      );
    }
    mostraAvviso(
      exists
        ? `Indirizzo "${saved.nome || saved.indirizzo}" aggiornato con pin sulla mappa.`
        : `Nuovo indirizzo "${saved.nome || saved.indirizzo}" salvato in Indirizzi Collezionati.`
    );
    setModaleIndirizzoAperta(false);
    setIndirizzoInModifica(null);
  };

  const handleEliminaIndirizzoCollezionato = (item: IndirizzoCollezionato) => {
    if (!onAggiornaIndirizziCollezionati) return;
    if (!confirm(`Eliminare l'indirizzo collezionato "${item.nome ? `${item.nome} — ` : ''}${item.indirizzo}"?`)) {
      return;
    }
    const rimasti = indirizziCollezionati.filter((i) => i.id !== item.id);
    onAggiornaIndirizziCollezionati(rimasti);
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'contatti',
        'Eliminazione Indirizzo Collezionato',
        `Eliminato indirizzo "${item.nome || item.indirizzo}"`,
        operatoreCorrente
      );
    }
    mostraAvviso(`Indirizzo "${item.nome || item.indirizzo}" eliminato.`);
  };

  const importaIndirizziDaServizi = () => {
    if (!onAggiornaIndirizziCollezionati) return;
    const seen = new Set(indirizziCollezionati.map((i) => i.indirizzo.trim().toLowerCase()));
    const nuovi: IndirizzoCollezionato[] = [];
    const nowIso = new Date().toISOString();
    const isValido = (v?: string) => {
      const t = (v || '').trim();
      return t.length >= 4 && t.toLowerCase() !== 'massa carrara' && t !== '-';
    };

    for (const s of serviziArchivio || []) {
      const indPartenza = (s.indirizzoIntervento || s.indirizzo || '').trim();
      if (isValido(indPartenza) && !seen.has(indPartenza.toLowerCase())) {
        seen.add(indPartenza.toLowerCase());
        nuovi.push({
          id: `ind-srv-p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          nome: '',
          indirizzo: indPartenza,
          lat: s.tempi?.coordinateSulPosto?.lat,
          lng: s.tempi?.coordinateSulPosto?.lng,
          origine: 'partenza',
          dataCreazione: formatISODateItaly(),
          ultimoUtilizzo: nowIso,
          utilizzi: 1
        });
      }
      const indDest = (s.destinazione || '').trim();
      if (isValido(indDest) && !seen.has(indDest.toLowerCase())) {
        seen.add(indDest.toLowerCase());
        nuovi.push({
          id: `ind-srv-d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          nome: '',
          indirizzo: indDest,
          lat: s.tempi?.coordinateDestinazione?.lat,
          lng: s.tempi?.coordinateDestinazione?.lng,
          origine: 'destinazione',
          dataCreazione: formatISODateItaly(),
          ultimoUtilizzo: nowIso,
          utilizzi: 1
        });
      }
    }

    if (nuovi.length > 0) {
      onAggiornaIndirizziCollezionati([...nuovi, ...indirizziCollezionati]);
      mostraAvviso(`Importati ${nuovi.length} indirizzi dallo storico dei servizi!`);
    } else {
      mostraAvviso('Tutti gli indirizzi validi dello storico servizi sono già collezionati.');
    }
  };

  // Conteggi per categoria
  const conteggi = {
    tutti: contatti.length,
    fornitore: contatti.filter((c) => c.tipo === 'fornitore').length,
    officina: contatti.filter((c) => c.tipo === 'officina').length,
    cliente_ente: contatti.filter((c) => c.tipo === 'cliente_ente').length,
    donatore: contatti.filter((c) => c.tipo === 'donatore').length,
    indirizzi_collezionati: indirizziCollezionati.length
  };

  // Apertura modale nuovo contatto
  const apriNuovoContatto = (prefillTipo?: TipoContattoEsterno) => {
    setContattoInModifica(null);
    setFormTipo(prefillTipo || 'fornitore');
    setFormRagioneSociale('');
    setFormReferente('');
    setFormPivaCf('');
    setFormIndirizzo('');
    setFormCitta('Massa');
    setFormCap('54100');
    setFormProvincia('MS');
    setFormTelefono('');
    setFormEmail('');
    setFormPec('');
    setFormIban('');
    setFormNote('');
    setFormHaDonazione(prefillTipo === 'donatore');
    setFormDonazCodiceServizio('');
    setFormDonazData(formatISODateItaly());
    setFormDonazImporto(50);
    setFormDonazMetodo('Contanti');
    setFormDonazMezzo('T4606');
    setFormDonazNote('');
    setModaleAperta(true);
  };

  // Apertura modale modifica
  const apriModificaContatto = (c: ContattoEsterno) => {
    setContattoInModifica(c);
    setFormTipo(c.tipo);
    setFormRagioneSociale(c.ragioneSociale);
    setFormReferente(c.referente || '');
    setFormPivaCf(c.partitaIvaCodiceFiscale || '');
    setFormIndirizzo(c.indirizzo);
    setFormCitta(c.citta);
    setFormCap(c.cap);
    setFormProvincia(c.provincia);
    setFormTelefono(c.telefono);
    setFormEmail(c.email);
    setFormPec(c.pec || '');
    setFormIban(c.iban || '');
    setFormNote(c.note || '');

    if (c.donazioneOrigineIntervento || c.tipo === 'donatore') {
      setFormHaDonazione(true);
      setFormDonazCodiceServizio(c.donazioneOrigineIntervento?.codiceServizio || '');
      setFormDonazData(c.donazioneOrigineIntervento?.dataIntervento || formatISODateItaly());
      setFormDonazImporto(c.donazioneOrigineIntervento?.importo || 50);
      setFormDonazMetodo((c.donazioneOrigineIntervento?.metodoPagamento as any) || 'Contanti');
      setFormDonazMezzo(c.donazioneOrigineIntervento?.mezzo || 'T4606');
      setFormDonazNote(c.donazioneOrigineIntervento?.note || '');
    } else {
      setFormHaDonazione(false);
      setFormDonazCodiceServizio('');
      setFormDonazData(formatISODateItaly());
      setFormDonazImporto(50);
      setFormDonazMetodo('Contanti');
      setFormDonazMezzo('T4606');
      setFormDonazNote('');
    }

    setModaleAperta(true);
  };

  // Salvataggio contatto
  const handleSalvaContatto = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formRagioneSociale.trim()) {
      mostraAvviso('La Ragione Sociale o Nome Intestatario è obbligatoria!');
      return;
    }

    const donazioneData = (formHaDonazione || formTipo === 'donatore') ? {
      codiceServizio: formDonazCodiceServizio.trim() || undefined,
      dataIntervento: formDonazData,
      importo: Number(formDonazImporto) || 0,
      metodoPagamento: formDonazMetodo,
      mezzo: formDonazMezzo.trim() || undefined,
      note: formDonazNote.trim() || undefined
    } : undefined;

    if (contattoInModifica) {
      const aggiornati = contatti.map((c) => {
        if (c.id === contattoInModifica.id) {
          return {
            ...c,
            tipo: formTipo,
            ragioneSociale: formRagioneSociale.trim(),
            referente: formReferente.trim() || undefined,
            partitaIvaCodiceFiscale: formPivaCf.trim().toUpperCase(),
            indirizzo: formIndirizzo.trim(),
            citta: formCitta.trim(),
            cap: formCap.trim(),
            provincia: formProvincia.trim().toUpperCase(),
            telefono: formTelefono.trim(),
            email: formEmail.trim(),
            pec: formPec.trim() || undefined,
            iban: formIban.trim().toUpperCase() || undefined,
            note: formNote.trim() || undefined,
            donazioneOrigineIntervento: donazioneData
          };
        }
        return c;
      });

      onAggiornaContatti(aggiornati);
      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'contatti',
          'Modifica anagrafica contatto',
          `Modificata anagrafica "${formRagioneSociale}" (${formTipo})`,
          operatoreCorrente
        );
      }
      onNotificaRadio?.(
        `📇 ANAGRAFICA CONTATTI: Aggiornato contatto "${formRagioneSociale}" (${formTipo.toUpperCase()}) da ${operatoreCorrente}`,
        'sistema'
      );
      mostraAvviso(`Contatto "${formRagioneSociale}" aggiornato con successo.`);
    } else {
      const nuovo: ContattoEsterno = {
        id: `cont-${Date.now()}`,
        tipo: formTipo,
        ragioneSociale: formRagioneSociale.trim(),
        referente: formReferente.trim() || undefined,
        partitaIvaCodiceFiscale: formPivaCf.trim().toUpperCase(),
        indirizzo: formIndirizzo.trim(),
        citta: formCitta.trim(),
        cap: formCap.trim(),
        provincia: formProvincia.trim().toUpperCase(),
        telefono: formTelefono.trim(),
        email: formEmail.trim(),
        pec: formPec.trim() || undefined,
        iban: formIban.trim().toUpperCase() || undefined,
        note: formNote.trim() || undefined,
        donazioneOrigineIntervento: donazioneData,
        dataCreazione: formatISODateItaly()
      };

      onAggiornaContatti([nuovo, ...contatti]);
      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'contatti',
          'Nuovo contatto inserito',
          `Inserito nuovo contatto "${nuovo.ragioneSociale}" (${nuovo.tipo})`,
          operatoreCorrente
        );
      }
      onNotificaRadio?.(
        `📇 NUOVO CONTATTO: Registrata nuova anagrafica "${nuovo.ragioneSociale}" (${nuovo.tipo.toUpperCase()})`,
        'sistema'
      );
      mostraAvviso(`Nuovo contatto "${nuovo.ragioneSociale}" salvato in archivio.`);
    }

    setModaleAperta(false);
  };

  // Eliminazione contatto (riservata admin)
  const handleEliminaContatto = (c: ContattoEsterno) => {
    if (!isAdmin) {
      mostraAvviso('Solo l\'Amministratore può eliminare anagrafiche dai contatti.');
      return;
    }
    if (!confirm(`Sei sicuro di voler eliminare definitivamente l'anagrafica "${c.ragioneSociale}"?`)) {
      return;
    }

    const rimasti = contatti.filter((item) => item.id !== c.id);
    onAggiornaContatti(rimasti);
    onNotificaRadio?.(
      `🗑️ CONTATTI: Rimossa anagrafica "${c.ragioneSociale}" dall'archivio contatti da parte di ${operatoreCorrente}`,
      'sistema'
    );
    mostraAvviso(`Anagrafica "${c.ragioneSociale}" rimossa.`);
  };

  // Sincronizzazione automatica donatori dall'archivio servizi
  const sincronizzaDonatoriDaServizi = () => {
    let aggiunti = 0;
    const nuovi: ContattoEsterno[] = [];

    (serviziArchivio || []).forEach((s) => {
      const don = s.donazione || s.datiDestinazione?.donazione;
      const somma = don?.importo || don?.somma;
      if (somma && somma > 0) {
        const nominativo = s.chiamante || s.segnalante || s.donatoreNome || 'Donatore da Intervento';
        const giaPresente = contatti.some(
          (c) =>
            (c.donazioneOrigineIntervento?.codiceServizio && c.donazioneOrigineIntervento.codiceServizio === s.codice) ||
            c.ragioneSociale.toLowerCase() === nominativo.toLowerCase()
        );

        if (!giaPresente) {
          nuovi.push({
            id: `cont-don-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tipo: 'donatore',
            ragioneSociale: nominativo,
            referente: s.telefono ? `Tel: ${s.telefono}` : undefined,
            partitaIvaCodiceFiscale: s.codiceFiscale || 'N/D',
            indirizzo: s.indirizzo || 'Massa Carrara',
            citta: 'Massa',
            cap: '54100',
            provincia: 'MS',
            telefono: s.telefono || '',
            email: s.email || '',
            note: `Donazione registrata a conclusione del servizio ${s.codice} (${s.mezzo || 'Mezzo Emergenza'}).`,
            donazioneOrigineIntervento: {
              codiceServizio: s.codice,
              dataIntervento: s.data || formatISODateItaly(),
              importo: Number(somma),
              metodoPagamento: don.metodo === 'pos' ? 'POS' : 'Contanti',
              mezzo: s.mezzo,
              note: `Ricevuta n. ${don.ricevutaNumero || 'Liberale'}`
            },
            dataCreazione: formatISODateItaly()
          });
          aggiunti++;
        }
      }
    });

    if (aggiunti > 0) {
      onAggiornaContatti([...nuovi, ...contatti]);
      mostraAvviso(`Sincronizzati ${aggiunti} donatori dagli interventi archiviati!`);
      onNotificaRadio?.(
        `📇 CONTATTI DONATORI: Sincronizzati ${aggiunti} nuovi nominativi di donatori a seguito di intervento`,
        'sistema'
      );
    } else {
      mostraAvviso('Tutti i donatori degli interventi risultano già censiti nei contatti.');
    }
  };

  // Esportazione CSV
  const esportaCSV = () => {
    const headers = [
      'ID',
      'Tipo',
      'Ragione Sociale / Nominativo',
      'Referente',
      'P.IVA / CF',
      'Indirizzo',
      'Citta',
      'CAP',
      'Provincia',
      'Telefono',
      'Email',
      'PEC',
      'IBAN',
      'Importo Donazione',
      'Codice Missione Donazione',
      'Note'
    ];

    const rows = contattiFiltrati.map((c) => [
      c.id,
      c.tipo,
      `"${c.ragioneSociale.replace(/"/g, '""')}"`,
      `"${(c.referente || '').replace(/"/g, '""')}"`,
      `"${c.partitaIvaCodiceFiscale}"`,
      `"${c.indirizzo.replace(/"/g, '""')}"`,
      `"${c.citta}"`,
      `"${c.cap}"`,
      `"${c.provincia}"`,
      `"${c.telefono}"`,
      `"${c.email}"`,
      `"${c.pec || ''}"`,
      `"${c.iban || ''}"`,
      c.donazioneOrigineIntervento?.importo ? `"${c.donazioneOrigineIntervento.importo.toFixed(2)}"` : '""',
      c.donazioneOrigineIntervento?.codiceServizio ? `"${c.donazioneOrigineIntervento.codiceServizio}"` : '""',
      `"${(c.note || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Contatti_Croce_Oro_${formatISODateItaly()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    mostraAvviso('Elenco contatti esportato in CSV con successo!');
  };

  const getBadgeTipo = (tipo: TipoContattoEsterno) => {
    switch (tipo) {
      case 'fornitore':
        return (
          <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/40 font-mono text-[10px] font-black uppercase flex items-center gap-1">
            <Truck className="w-3 h-3" /> Fornitore DPI/Ricambi
          </span>
        );
      case 'officina':
        return (
          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-black uppercase flex items-center gap-1">
            <Wrench className="w-3 h-3" /> Officina Meccanica
          </span>
        );
      case 'cliente_ente':
        return (
          <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono text-[10px] font-black uppercase flex items-center gap-1">
            <Landmark className="w-3 h-3" /> Cliente / Ente Debitore
          </span>
        );
      case 'donatore':
        return (
          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-[10px] font-black uppercase flex items-center gap-1">
            <Heart className="w-3 h-3 text-red-400 fill-red-400" /> Donatore da Intervento
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md bg-slate-700 text-slate-300 text-[10px] font-mono font-bold">
            Altro
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 animate-in fade-in pb-12">
      {/* Intestazione Ufficiale Macrocategoria 10 */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-2 border-indigo-500/50 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-black text-2xl sm:text-3xl border border-indigo-500/40 shadow-inner shrink-0">
            📇
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                Macrocategoria 10 • Riservata Amministratore
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Totale: {contatti.length} anagrafiche
              </span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-white uppercase tracking-wider mt-0.5">
              {titoloDbContatti}
            </h2>
            <p className="text-xs text-slate-300 leading-snug">
              Anagrafiche complete fornitori DPI e ricambi, officine manutenzioni, debitori note di debito, donatori da interventi e indirizzi collezionati con mappa GPS.
            </p>
          </div>
        </div>

        {/* Pulsanti Azioni Rapide */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={() => setFiltroTipo('indirizzi_collezionati')}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border ${
              filtroTipo === 'indirizzi_collezionati'
                ? 'bg-cyan-600 text-white border-cyan-400 shadow-lg'
                : 'bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-200 border-cyan-500/50'
            }`}
            title="Apri la sottosezione Indirizzi Collezionati con mappa interattiva"
          >
            <MapPin className="w-3.5 h-3.5 text-cyan-300" />
            <span>Indirizzi Collezionati ({conteggi.indirizzi_collezionati})</span>
          </button>

          <button
            type="button"
            onClick={sincronizzaDonatoriDaServizi}
            className="px-3 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-500/50 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Importa automaticamente nei contatti le persone che hanno effettuato donazioni a seguito di intervento"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sync Donatori</span>
          </button>

          <button
            type="button"
            onClick={esportaCSV}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Esporta elenco contatti in formato CSV"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>Esporta CSV</span>
          </button>

          <button
            type="button"
            onClick={() => apriNuovoContatto()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs uppercase flex items-center gap-2 shadow-lg shadow-indigo-950/50 active:scale-95 transition-all cursor-pointer border border-indigo-400/40"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nuova Anagrafica</span>
          </button>
        </div>
      </div>

      {/* Alert Notifica */}
      {avviso && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{avviso}</span>
        </div>
      )}

      {/* Barra Filtri Tipologia e Ricerca */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-3">
        <div className="flex flex-col gap-3">
          {/* Tabs Filtro Tipologia (a capo automatico per mostrare sempre tutte le sottosezioni) */}
          <div className="flex flex-wrap items-center gap-2 w-full">
            <button
              type="button"
              onClick={() => setFiltroTipo('tutti')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                filtroTipo === 'tutti'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>Tutti i Contatti</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono">{conteggi.tutti}</span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroTipo('fornitore')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                filtroTipo === 'fornitore'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Fornitori DPI & Ricambi</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono">{conteggi.fornitore}</span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroTipo('officina')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                filtroTipo === 'officina'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Officine & Manutentori</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono">{conteggi.officina}</span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroTipo('cliente_ente')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                filtroTipo === 'cliente_ente'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Landmark className="w-3.5 h-3.5" />
              <span>Clienti & Enti Debitori</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono">{conteggi.cliente_ente}</span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroTipo('donatore')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                filtroTipo === 'donatore'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Heart className="w-3.5 h-3.5 text-red-400" />
              <span>Donatori Interventi</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono">{conteggi.donatore}</span>
            </button>

            <button
              type="button"
              onClick={() => setFiltroTipo('indirizzi_collezionati')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                filtroTipo === 'indirizzi_collezionati'
                  ? 'bg-cyan-600 text-white shadow-md ring-1 ring-cyan-300/60'
                  : 'bg-cyan-950/60 text-cyan-200 hover:bg-cyan-900/70 hover:text-white border border-cyan-500/50'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Indirizzi Collezionati</span>
              <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-[10px] font-mono">{conteggi.indirizzi_collezionati}</span>
            </button>
          </div>

          {/* Campo di Ricerca */}
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              placeholder={
                filtroTipo === 'indirizzi_collezionati'
                  ? 'Cerca nome assegnato, indirizzo o note...'
                  : 'Cerca nome, P.IVA, CF, comune...'
              }
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
        </div>
      </div>

      {/* SOTTOSEZIONE: INDIRIZZI COLLEZIONATI */}
      {filtroTipo === 'indirizzi_collezionati' ? (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-cyan-400" />
                <span>Indirizzi Collezionati (Partenza &amp; Destinazione)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tutti gli indirizzi inseriti in partenza e destinazione vengono raccolti qui. Puoi assegnare un nome distinto, correggere l'indirizzo, spostare il pin sulla mappa o eliminarli.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {serviziArchivio && serviziArchivio.length > 0 && (
                <button
                  type="button"
                  onClick={importaIndirizziDaServizi}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Importa da Storico</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIndirizzoInModifica(null);
                  setModaleIndirizzoAperta(true);
                }}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nuovo Indirizzo</span>
              </button>
            </div>
          </div>

          {indirizziFiltrati.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/60 rounded-3xl border border-slate-800 text-slate-400 space-y-3">
              <MapPin className="w-10 h-10 mx-auto text-slate-600" />
              <div className="font-bold text-sm text-slate-300">Nessun indirizzo collezionato</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Gli indirizzi inseriti nei campi Indirizzo Intervento / Obiettivo di Partenza e Destinazione Mezzo verranno salvati automaticamente qui. Puoi anche aggiungerne uno manualmente o importarli dallo storico.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIndirizzoInModifica(null);
                  setModaleIndirizzoAperta(true);
                }}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Aggiungi Indirizzo su Mappa</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {indirizziFiltrati.map((item) => {
                const origineLabel =
                  item.origine === 'partenza'
                    ? 'Obiettivo di Partenza'
                    : item.origine === 'destinazione'
                    ? 'Destinazione Mezzo'
                    : item.origine === 'entrambi'
                    ? 'Partenza & Destinazione'
                    : 'Inserimento Manuale';
                return (
                  <div
                    key={item.id}
                    className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-colors"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[11px] text-slate-400">
                            Nome Assegnato
                          </div>
                          <h4 className={`font-bold text-sm leading-snug ${item.nome ? 'text-white' : 'text-slate-400 italic'}`}>
                            {item.nome || 'Senza nome assegnato'}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setIndirizzoInModifica(item);
                              setModaleIndirizzoAperta(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white transition-colors cursor-pointer"
                            title="Modifica nome, testo indirizzo o pin sulla mappa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminaIndirizzoCollezionato(item)}
                            className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900 text-red-400 hover:text-white transition-colors cursor-pointer border border-red-500/30"
                            title="Elimina indirizzo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-200 flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span className="leading-snug break-words">{item.indirizzo}</span>
                      </div>

                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-400">
                        {typeof item.lat === 'number' && typeof item.lng === 'number' ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <Navigation className="w-3 h-3" />
                            <span>
                              {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-amber-300 font-sans">Pin mappa non ancora impostato</span>
                        )}
                      </div>

                      {item.note && (
                        <div className="text-[11px] text-slate-400 italic line-clamp-2">
                          {item.note}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400 truncate tabular-nums">
                        {origineLabel}
                        {item.utilizzi && item.utilizzi > 1 ? ` · ${item.utilizzi} utilizzi` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIndirizzoInModifica(item);
                          setModaleIndirizzoAperta(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-cyan-600/25 hover:bg-cyan-600/45 text-cyan-200 border border-cyan-500/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Mappa &amp; Pin</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
      /* Griglia Schede Contatti */
      contattiFiltrati.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/60 rounded-3xl border border-slate-800 text-slate-400 space-y-3">
          <Building2 className="w-12 h-12 mx-auto text-slate-600" />
          <div className="font-bold text-sm text-slate-300">Nessuna anagrafica trovata</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Nessun contatto corrisponde ai criteri di ricerca impostati. Clicca su "Nuova Anagrafica" per aggiungere il primo contatto.
          </p>
          <button
            type="button"
            onClick={() => apriNuovoContatto()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Aggiungi Anagrafica</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contattiFiltrati.map((c) => {
            return (
              <div
                key={c.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-lg transition-all"
              >
                <div className="space-y-2.5">
                  {/* Riga Tipologia & Azioni */}
                  <div className="flex items-center justify-between gap-2">
                    {getBadgeTipo(c.tipo)}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => apriModificaContatto(c)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Modifica Anagrafica"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleEliminaContatto(c)}
                          className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900 text-red-400 hover:text-white transition-colors cursor-pointer border border-red-500/30"
                          title="Elimina Anagrafica (Amministratore)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nome e Referente */}
                  <div>
                    <h3 className="font-bold text-sm text-white leading-tight">
                      {c.ragioneSociale}
                    </h3>
                    {c.referente && (
                      <div className="text-[11px] text-amber-300 font-medium mt-0.5">
                        Ref: {c.referente}
                      </div>
                    )}
                  </div>

                  {/* Dati Fiscali */}
                  <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] font-mono text-slate-300 flex items-center justify-between">
                    <span className="text-slate-500">P.IVA / CF:</span>
                    <strong className="text-indigo-300">{c.partitaIvaCodiceFiscale || 'Non specificato'}</strong>
                  </div>

                  {/* Indirizzo e Sede */}
                  <div className="text-xs text-slate-300 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                    <span className="leading-tight">
                      {c.indirizzo}, {c.cap} {c.citta} ({c.provincia})
                    </span>
                  </div>

                  {/* Recapiti Telefono ed Email */}
                  <div className="space-y-1 text-xs text-slate-300 pt-1 border-t border-slate-800/60">
                    {c.telefono && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                        <a href={`tel:${c.telefono}`} className="hover:underline font-mono text-emerald-300">
                          {c.telefono}
                        </a>
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-cyan-400 shrink-0" />
                        <a href={`mailto:${c.email}`} className="hover:underline text-cyan-300 truncate">
                          {c.email}
                        </a>
                      </div>
                    )}
                    {c.pec && (
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        PEC: {c.pec}
                      </div>
                    )}
                  </div>

                  {/* IBAN se presente */}
                  {c.iban && (
                    <div className="p-1.5 rounded-lg bg-slate-950/50 border border-slate-800 text-[10px] font-mono text-slate-400">
                      <span className="text-slate-500 block">IBAN:</span>
                      <span className="text-slate-300 font-bold select-all">{c.iban}</span>
                    </div>
                  )}

                  {/* BOX SPECIALE: DONAZIONE DA INTERVENTO */}
                  {c.donazioneOrigineIntervento && (
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-200 space-y-1">
                      <div className="flex items-center justify-between font-bold text-[11px]">
                        <span className="flex items-center gap-1 text-emerald-300">
                          <Heart className="w-3 h-3 text-red-400 fill-red-400" /> Donazione Ricevuta
                        </span>
                        <span className="font-mono text-white text-sm font-black bg-emerald-900/60 px-1.5 py-0.2 rounded">
                          € {c.donazioneOrigineIntervento.importo.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 font-mono flex items-center justify-between">
                        <span>Data: {c.donazioneOrigineIntervento.dataIntervento}</span>
                        <span>Metodo: {c.donazioneOrigineIntervento.metodoPagamento || 'Contanti'}</span>
                      </div>
                      {c.donazioneOrigineIntervento.codiceServizio && (
                        <div className="text-[10px] text-amber-300 font-mono">
                          Servizio Rif.: <strong>{c.donazioneOrigineIntervento.codiceServizio}</strong>
                          {c.donazioneOrigineIntervento.mezzo && ` (${c.donazioneOrigineIntervento.mezzo})`}
                        </div>
                      )}
                      {c.donazioneOrigineIntervento.note && (
                        <div className="text-[10px] text-slate-400 italic">
                          "{c.donazioneOrigineIntervento.note}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* Note generali se presenti */}
                  {c.note && !c.donazioneOrigineIntervento && (
                    <div className="text-[11px] text-slate-400 italic line-clamp-2">
                      "{c.note}"
                    </div>
                  )}
                </div>

                <div className="text-[9px] text-slate-500 font-mono pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span>Registrato il {c.dataCreazione}</span>
                  <span className="uppercase text-indigo-400">Croce Oro</span>
                </div>
              </div>
            );
          })}
        </div>
      )
      )}

      {/* MODALE MAPPA & MODIFICA INDIRIZZO COLLEZIONATO */}
      {modaleIndirizzoAperta && (
        <MappaIndirizzoCollezionato
          indirizzoIniziale={indirizzoInModifica}
          googleMapsApiKey={googleMapsApiKey}
          mapsQuotaExceeded={mapsQuotaExceeded}
          onSave={handleSalvaIndirizzoCollezionato}
          onClose={() => {
            setModaleIndirizzoAperta(false);
            setIndirizzoInModifica(null);
          }}
        />
      )}

      {/* MODALE INSERIMENTO / MODIFICA ANAGRAFICA COMPLETA */}
      {modaleAperta && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border-2 border-indigo-500/60 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl text-slate-200 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase">
                    {contattoInModifica ? `Modifica Anagrafica: ${contattoInModifica.ragioneSociale}` : 'Nuova Anagrafica Contatto'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Fornitori, Officine manutenzione, Enti debitori e Donatori da intervento
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModaleAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvaContatto} className="overflow-y-auto space-y-4 py-3 flex-1 text-xs">
              {/* Tipologia Contatto */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="block text-[11px] font-bold text-indigo-300 uppercase">
                  Tipologia di Anagrafica *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormTipo('fornitore');
                      setFormHaDonazione(false);
                    }}
                    className={`p-2 rounded-xl text-center font-bold text-xs flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                      formTipo === 'fornitore'
                        ? 'bg-blue-600 text-white border-blue-400 shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
                    }`}
                  >
                    <Truck className="w-4 h-4" />
                    <span>Fornitore</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormTipo('officina');
                      setFormHaDonazione(false);
                    }}
                    className={`p-2 rounded-xl text-center font-bold text-xs flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                      formTipo === 'officina'
                        ? 'bg-amber-600 text-white border-amber-400 shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
                    }`}
                  >
                    <Wrench className="w-4 h-4" />
                    <span>Officina</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormTipo('cliente_ente');
                      setFormHaDonazione(false);
                    }}
                    className={`p-2 rounded-xl text-center font-bold text-xs flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                      formTipo === 'cliente_ente'
                        ? 'bg-purple-600 text-white border-purple-400 shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
                    }`}
                  >
                    <Landmark className="w-4 h-4" />
                    <span>Cliente / Ente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormTipo('donatore');
                      setFormHaDonazione(true);
                    }}
                    className={`p-2 rounded-xl text-center font-bold text-xs flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                      formTipo === 'donatore'
                        ? 'bg-emerald-600 text-white border-emerald-400 shadow'
                        : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
                    }`}
                  >
                    <Heart className="w-4 h-4 text-red-400" />
                    <span>Donatore</span>
                  </button>
                </div>
              </div>

              {/* Dati Generali */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-bold mb-1">
                    {formTipo === 'donatore' ? 'Nome & Cognome Donatore *' : 'Ragione Sociale / Denominazione *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={formRagioneSociale}
                    onChange={(e) => setFormRagioneSociale(e.target.value)}
                    placeholder={formTipo === 'donatore' ? 'Es. Mario Rossi' : 'Es. Officina Meccanica Autorizzata Srl'}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Persona Referente / Contatto</label>
                  <input
                    type="text"
                    value={formReferente}
                    onChange={(e) => setFormReferente(e.target.value)}
                    placeholder="Es. Ing. Marco Bini"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">Partita IVA / Codice Fiscale *</label>
                  <input
                    type="text"
                    required
                    value={formPivaCf}
                    onChange={(e) => setFormPivaCf(e.target.value.toUpperCase())}
                    placeholder="11 cifre P.IVA o 16 caratteri CF"
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-indigo-300 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Indirizzo e Recapiti */}
              <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase block">
                  Indirizzo Sede & Recapiti
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-0.5 text-[11px]">Via / Piazza e Civico *</label>
                    <input
                      type="text"
                      required
                      value={formIndirizzo}
                      onChange={(e) => setFormIndirizzo(e.target.value)}
                      placeholder="Es. Via Dorsale 42"
                      className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-0.5 text-[11px]">Comune *</label>
                    <input
                      type="text"
                      required
                      value={formCitta}
                      onChange={(e) => setFormCitta(e.target.value)}
                      className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="block text-slate-400 mb-0.5 text-[11px]">CAP *</label>
                    <input
                      type="text"
                      required
                      maxLength={5}
                      value={formCap}
                      onChange={(e) => setFormCap(e.target.value)}
                      className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-0.5 text-[11px]">Provincia *</label>
                    <input
                      type="text"
                      required
                      maxLength={2}
                      value={formProvincia}
                      onChange={(e) => setFormProvincia(e.target.value.toUpperCase())}
                      className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-0.5 text-[11px]">Telefono *</label>
                    <input
                      type="tel"
                      required
                      value={formTelefono}
                      onChange={(e) => setFormTelefono(e.target.value)}
                      placeholder="0585..."
                      className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-0.5 text-[11px]">Email</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="info@..."
                      className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-400 mb-0.5 text-[11px]">Indirizzo PEC (Posta Elettronica Certificata)</label>
                    <input
                      type="email"
                      value={formPec}
                      onChange={(e) => setFormPec(e.target.value)}
                      placeholder="ragionesociale@pec.it"
                      className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-0.5 text-[11px]">Codice IBAN per Bonifici</label>
                    <input
                      type="text"
                      maxLength={34}
                      value={formIban}
                      onChange={(e) => setFormIban(e.target.value.toUpperCase())}
                      placeholder="IT..."
                      className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* SEZIONE SPECIALE DONATORE A SEGUITO DI INTERVENTO */}
              {(formTipo === 'donatore' || formHaDonazione) && (
                <div className="p-3.5 rounded-2xl bg-emerald-950/40 border-2 border-emerald-500/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-emerald-300 uppercase flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-red-400 fill-red-400" />
                      Dati Donazione a Seguito di Intervento
                    </span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-900/60 px-2 py-0.5 rounded font-mono font-bold">
                      Archivio Donazioni OdV
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-slate-400 mb-0.5 text-[11px]">Codice Servizio / Missione</label>
                      <input
                        type="text"
                        value={formDonazCodiceServizio}
                        onChange={(e) => setFormDonazCodiceServizio(e.target.value)}
                        placeholder="Es. CO-VET-VERDE-2026-001"
                        className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-0.5 text-[11px]">Data Intervento *</label>
                      <input
                        type="date"
                        required={formTipo === 'donatore'}
                        value={formDonazData}
                        onChange={(e) => setFormDonazData(e.target.value)}
                        className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-0.5 text-[11px]">Importo Donato (€) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required={formTipo === 'donatore'}
                        value={formDonazImporto}
                        onChange={(e) => setFormDonazImporto(Number(e.target.value))}
                        className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-400 mb-0.5 text-[11px]">Metodo di Pagamento Donazione</label>
                      <select
                        value={formDonazMetodo}
                        onChange={(e) => setFormDonazMetodo(e.target.value as any)}
                        className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                      >
                        <option value="Contanti">Contanti (Con Ricevuta a Bordo)</option>
                        <option value="POS">Terminale POS di Bordo Mezzo</option>
                        <option value="Bonifico">Bonifico Bancario su C/C Associazione</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-0.5 text-[11px]">Mezzo / Sede Intervenuta</label>
                      <input
                        type="text"
                        value={formDonazMezzo}
                        onChange={(e) => setFormDonazMezzo(e.target.value)}
                        placeholder="Es. T4606 (Massa Le Jare)"
                        className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-0.5 text-[11px]">Note / Ringraziamenti Donazione</label>
                    <input
                      type="text"
                      value={formDonazNote}
                      onChange={(e) => setFormDonazNote(e.target.value)}
                      placeholder="Note sull'intervento o motivazione della donazione liberale..."
                      className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>
                </div>
              )}

              {/* Note Generali */}
              <div>
                <label className="block text-slate-400 font-bold mb-1">Note & Condizioni Specifiche</label>
                <textarea
                  rows={2}
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Note operative, recapiti alternativi, sconti convenzionati o referenze..."
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              {/* Footer Pulsanti Modale */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setModaleAperta(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs uppercase flex items-center gap-2 shadow-lg active:scale-95 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{contattoInModifica ? 'Salva Modifiche' : 'Registra Anagrafica'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
