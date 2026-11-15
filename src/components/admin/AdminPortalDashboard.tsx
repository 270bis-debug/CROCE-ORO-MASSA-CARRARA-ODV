import React, { useState } from 'react';
import {
  Headphones,
  Users,
  Ambulance,
  Receipt,
  GraduationCap,
  Package,
  Building2,
  Calendar,
  ArrowRight,
  Shield,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Car,
  Clock,
  Sparkles,
  Search,
  Radio,
  Megaphone,
  BookUser,
  Wrench,
  BarChart3,
  Server
} from 'lucide-react';
import { CroceOroLogo } from '../CroceOroLogo';
import { MezzoFlotta, InterventoManutenzione } from '../../types/adminTypes';
import { calcolaManutenzioniInScadenza } from '../../utils/avvisiManutenzioneMezzi';
import { MonitoraggioFlotta } from './MonitoraggioFlotta';
import { LISTA_MACRO_CATEGORIE } from '../../constants/macroCategorie';

export type AdminSectionId =
  | 'dashboard'
  | 'centrale'
  | 'volontari'
  | 'mezzi'
  | 'contabilita'
  | 'formazione'
  | 'magazzino'
  | 'sedi'
  | 'turni'
  | 'bacheca'
  | 'contatti';

interface AdminPortalDashboardProps {
  onSelectSection: (section: AdminSectionId) => void;
  operatoreNome: string;
  isPresidente?: boolean;
  isAdmin?: boolean;
  allowedSections?: AdminSectionId[];
  onApriSyncServer?: () => void;
  conteggioServiziArchivio: number;
  conteggioVolontari: number;
  conteggioMezzi: number;
  conteggioMezziFuoriServizio: number;
  conteggioDonazioni: number;
  conteggioCorsi: number;
  conteggioSedi: number;
  conteggioTurniOggi: number;
  conteggioComunicazioni?: number;
  conteggioContatti?: number;
  mezziFlotta?: MezzoFlotta[];
  manutenzioni?: InterventoManutenzione[];
  serviziArchivio?: any[];
}

export const AdminPortalDashboard: React.FC<AdminPortalDashboardProps> = ({
  onSelectSection,
  operatoreNome,
  isPresidente,
  isAdmin = true,
  allowedSections,
  onApriSyncServer,
  conteggioServiziArchivio,
  conteggioVolontari,
  conteggioMezzi,
  conteggioMezziFuoriServizio,
  conteggioDonazioni,
  conteggioCorsi,
  conteggioSedi,
  conteggioTurniOggi,
  conteggioComunicazioni = 3,
  conteggioContatti = 11,
  mezziFlotta = [],
  manutenzioni = [],
  serviziArchivio = []
}) => {
  const [vistaAttiva, setVistaAttiva] = useState<'macro' | 'monitoraggio_flotta'>('macro');

  // Calcolo automatico avvisi manutenzione programmata e scadenze flotta entro 30 giorni
  const avvisiManutenzione = React.useMemo(() => {
    return calcolaManutenzioniInScadenza(mezziFlotta, manutenzioni, 30);
  }, [mezziFlotta, manutenzioni]);

  const sezioni = [
    {
      id: 'centrale' as AdminSectionId,
      numero: '1',
      titolo: 'Operatore Centrale',
      sottotitolo: 'Gestione Operativa Missioni & Mezzi in Tempo Reale',
      icona: Headphones,
      coloreBg: 'bg-emerald-500/15',
      coloreBordo: 'border-emerald-500/40 hover:border-emerald-400',
      coloreTesto: 'text-emerald-400',
      coloreBadge: 'bg-emerald-950 text-emerald-300 border-emerald-700/50',
      coloreGradiente: 'from-emerald-600/20 via-slate-900 to-slate-950',
      descrizione: 'Crea e invia nuove schede di servizio al telefono di bordo rimanendo in contatto radio e telefonico continuo. Visualizza la posizione GPS live dei mezzi sulla mappa operativa e consulta il database storico di tutti i servizi archiviati con filtri di ricerca avanzati.',
      funzionalita: [
        'Nuova scheda missione e dispatch immediato a bordo mezzo',
        'Mappa GPS live con tracciamento in tempo reale della flotta',
        'Database servizi archiviati con filtri di ricerca (codice, data, mezzo, urgenza)',
        'Comunicazioni radio bidirezionali e allarmi suoneria'
      ],
      statistiche: `${conteggioServiziArchivio} Servizi Archiviati`
    },
    {
      id: 'volontari' as AdminSectionId,
      numero: '2',
      titolo: 'Database Volontari',
      sottotitolo: 'Anagrafiche, Vestiario, PIN & Registro Timbrature',
      icona: Users,
      coloreBg: 'bg-blue-500/15',
      coloreBordo: 'border-blue-500/40 hover:border-blue-400',
      coloreTesto: 'text-blue-400',
      coloreBadge: 'bg-blue-950 text-blue-300 border-blue-700/50',
      coloreGradiente: 'from-blue-600/20 via-slate-900 to-slate-950',
      descrizione: 'Gestione completa del personale volontario: inserimento e modifica anagrafiche, gestione del vestiario personale assegnato, visualizzazione e sblocco PIN di sicurezza, domande di ammissione e modifica del registro timbrature di tutti gli account.',
      funzionalita: [
        'Anagrafiche volontari con filtri (ruolo, qualifica, stato)',
        'Gestione vestiario personale e storico consegne',
        'Visualizzazione, sblocco e reimpostazione PIN operativi',
        'Domande di ammissione nuovi volontari e fascicolo socio',
        'Consultazione e modifica registro timbrature presenze'
      ],
      statistiche: `${conteggioVolontari} Volontari Registrati`
    },
    {
      id: 'mezzi' as AdminSectionId,
      numero: '3',
      titolo: 'Database Mezzi & Flotta',
      sottotitolo: 'Gestione Mezzi, Manutenzione & Magazzino di Bordo',
      icona: Ambulance,
      coloreBg: 'bg-amber-500/15',
      coloreBordo: 'border-amber-500/40 hover:border-amber-400',
      coloreTesto: 'text-amber-400',
      coloreBadge: 'bg-amber-950 text-amber-300 border-amber-700/50',
      coloreGradiente: 'from-amber-600/20 via-slate-900 to-slate-950',
      descrizione: 'Gestione e monitoraggio dell\'intero autoparco associativo. Inserimento e modifica mezzi, messa fuori servizio con causale (guasto, incidente, riparazione, sanificazione), storico manutenzioni (tagliandi, revisioni, assicurazioni) e magazzino dotazioni di bordo.',
      funzionalita: [
        'Database flotta con filtri (sigla, targa, allestimento, stato)',
        'Messa fuori servizio e reintegro con storico motivi',
        'Gestione manutenzione (tagliandi, revisioni, scadenze, costi)',
        'Magazzino dedicato ai mezzi (dotazioni e ricambi di bordo)'
      ],
      statistiche: `${conteggioMezzi} Mezzi (${conteggioMezziFuoriServizio > 0 ? `${conteggioMezziFuoriServizio} Fuori Servizio` : 'Tutti Operativi'})`
    },
    {
      id: 'contabilita' as AdminSectionId,
      numero: '4',
      titolo: 'Database Contabilità',
      sottotitolo: 'Donazioni, Quote Sociali, Tesseramento & Note di Debito',
      icona: Receipt,
      coloreBg: 'bg-purple-500/15',
      coloreBordo: 'border-purple-500/40 hover:border-purple-400',
      coloreTesto: 'text-purple-400',
      coloreBadge: 'bg-purple-950 text-purple-300 border-purple-700/50',
      coloreGradiente: 'from-purple-600/20 via-slate-900 to-slate-950',
      descrizione: 'Area amministrativa e contabile: visualizzazione esclusiva dei servizi con donazioni economiche registrate, gestione rinnovi, annullamenti ed emissione delle tessere associative con ricevute fiscali, ed emissione e gestione delle note di debito.',
      funzionalita: [
        'Visualizzazione solo servizi con donazioni e totali incassati',
        'Gestione tesseramento annuale soci (volontari e operatori)',
        'Emissione ricevute fiscali esenti bollo (art. 82 D.Lgs. 117/2017)',
        'Gestione ed emissione Note di Debito con numerazione e stati'
      ],
      statistiche: `${conteggioDonazioni} Servizi con Donazione`
    },
    {
      id: 'formazione' as AdminSectionId,
      numero: '5',
      titolo: 'Database Formazione / Corsi',
      sottotitolo: 'Piano Formativo, Registro Presenze & Scadenziario Brevetti',
      icona: GraduationCap,
      coloreBg: 'bg-indigo-500/15',
      coloreBordo: 'border-indigo-500/40 hover:border-indigo-400',
      coloreTesto: 'text-indigo-400',
      coloreBadge: 'bg-indigo-950 text-indigo-300 border-indigo-700/50',
      coloreGradiente: 'from-indigo-600/20 via-slate-900 to-slate-950',
      descrizione: 'Pianificazione dei percorsi formativi per i volontari (BLSD, Soccorso Veterinario, Guida Sicura, Protezione Civile, Antincendio). Gestione iscrizioni, registri presenze, esiti esami, scadenziario brevetti e rilascio attestati di frequenza.',
      funzionalita: [
        'Catalogo corsi formativi con docenti, sedi e date',
        'Iscrizione volontari e verifica requisiti di accesso',
        'Registro presenze, ore formative ed esito idoneità',
        'Scadenziario attestati e brevetti con promemoria rinnovi',
        'Emissione e stampa attestati ufficiali di partecipazione'
      ],
      statistiche: `${conteggioCorsi} Corsi Attivi / Programmati`
    },
    {
      id: 'magazzino' as AdminSectionId,
      numero: '6',
      titolo: 'Magazzino Vestiario & Attrezzature',
      sottotitolo: 'Giacenze Divise, DPI, Radio & Presidi Operativi',
      icona: Package,
      coloreBg: 'bg-cyan-500/15',
      coloreBordo: 'border-cyan-500/40 hover:border-cyan-400',
      coloreTesto: 'text-cyan-400',
      coloreBadge: 'bg-cyan-950 text-cyan-300 border-cyan-700/50',
      coloreGradiente: 'from-cyan-600/20 via-slate-900 to-slate-950',
      descrizione: 'Gestione centralizzata del magazzino associativo: scorte di vestiario e divise operative (taglie, carichi da fornitori, scarichi a volontari) e censimento attrezzature operative (radio portatili, lettori microchip, zaini sanitari, barelle, collari, scadenze revisione).',
      funzionalita: [
        'Giacenze divise per taglia (XS-XXXL) e scorta minima',
        'Registro carichi fornitori e scarichi assegnazione vestiario',
        'Censimento attrezzature operative con matricola e ubicazione',
        'Tracciamento radio portatili, lettori microchip e presidi sanitari',
        'Scadenziario revisione periodica e collaudo dispositivi'
      ],
      statistiche: 'Giacenze & Attrezzature H24'
    },
    {
      id: 'sedi' as AdminSectionId,
      numero: '7',
      titolo: 'Anagrafiche Sedi Associative',
      sottotitolo: 'Sede Legale, Operativa, Autoparco & Sezioni Territoriali',
      icona: Building2,
      coloreBg: 'bg-rose-500/15',
      coloreBordo: 'border-rose-500/40 hover:border-rose-400',
      coloreTesto: 'text-rose-400',
      coloreBadge: 'bg-rose-950 text-rose-300 border-rose-700/50',
      coloreGradiente: 'from-rose-600/20 via-slate-900 to-slate-950',
      descrizione: 'Registro completo e anagrafica di tutte le sedi associative e territoriali (Sede Legale Massa Ronchi, Sede Operativa Le Jare, Sezione Territoriale Carrara Fossone, presidi). Recapiti, responsabili di sede, autoparco assegnato, dotazioni locali e mappa interattiva.',
      funzionalita: [
        'Anagrafica sedi con tipologia, indirizzo e recapiti H24',
        'Responsabile/coordinatore di sede e contatti di presidio',
        'Associazione mezzi della flotta stazionati per sede',
        'Mappa interattiva con coordinate GPS e navigazione',
        'Inserimento, modifica e gestione inventario di sede'
      ],
      statistiche: `${conteggioSedi} Sedi Operative Ufficiali`
    },
    {
      id: 'turni' as AdminSectionId,
      numero: '8',
      titolo: 'Calendario Turni Sedi Operative',
      sottotitolo: 'Pianificazione Turni, Copertura Operativa & Reperibilità',
      icona: Calendar,
      coloreBg: 'bg-teal-500/15',
      coloreBordo: 'border-teal-500/40 hover:border-teal-400',
      coloreTesto: 'text-teal-400',
      coloreBadge: 'bg-teal-950 text-teal-300 border-teal-700/50',
      coloreGradiente: 'from-teal-600/20 via-slate-900 to-slate-950',
      descrizione: 'Gestione del calendario turni per tutte le sedi operative della Croce Oro. Pianificazione fasce orarie (Mattina, Pomeriggio, Notte, Reperibilità H24), assegnazione volontari per ruolo operativo (Autista, Capo Turno, Soccorritore, Centrale), monitoraggio coperture e sostituzioni.',
      funzionalita: [
        'Pianificazione turni suddivisa per sede operativa',
        'Fasce orarie operative (Mattina, Pomeriggio, Notte, Reperibilità)',
        'Assegnazione volontari per qualifica e ruolo a bordo',
        'Monitoraggio visivo coperture (Coperto, Parziale, Scoperto)',
        'Vista calendario mensile/settimanale e lista esportabile'
      ],
      statistiche: `${conteggioTurniOggi} Turni Programmata Sede`
    },
    {
      id: 'bacheca' as AdminSectionId,
      numero: '9',
      titolo: 'Bacheca di Sezione',
      sottotitolo: 'Comunicazioni, Circolari & Avvisi Ufficiali ai Volontari',
      icona: Megaphone,
      coloreBg: 'bg-violet-500/15',
      coloreBordo: 'border-violet-500/40 hover:border-violet-400',
      coloreTesto: 'text-violet-400',
      coloreBadge: 'bg-violet-950 text-violet-300 border-violet-700/50',
      coloreGradiente: 'from-violet-600/20 via-slate-900 to-slate-950',
      descrizione: 'Pubblicazione e gestione delle comunicazioni di servizio, circolari e disposizioni per tutti i volontari o per singola sezione territoriale. Notifiche prioritarie, avvisi urgenti in evidenza e consultazione da parte di tutto il personale operativo con un clic.',
      funzionalita: [
        'Nuova comunicazione con priorità (Ordinaria, Importante, Urgente)',
        'Destinatari mirati: Tutte le Sezioni o specifica Sezione Territoriale',
        'Bacheca avvisi con fissaggio in alto (pin evidenziato)',
        'Pulsante dedicato per tutti i volontari nella prima schermata dopo il login'
      ],
      statistiche: `${conteggioComunicazioni} Comunicazioni Attive`
    },
    {
      id: 'contatti' as AdminSectionId,
      numero: '10',
      titolo: 'Contatti Fornitori / Clienti / Ecc.',
      sottotitolo: 'Anagrafiche Esterne, Officine, Enti Debitori & Donatori',
      icona: BookUser,
      coloreBg: 'bg-amber-500/15',
      coloreBordo: 'border-amber-500/40 hover:border-amber-400',
      coloreTesto: 'text-amber-400',
      coloreBadge: 'bg-amber-950 text-amber-300 border-amber-700/50',
      coloreGradiente: 'from-amber-600/20 via-slate-900 to-slate-950',
      descrizione: 'Archivio centralizzato anagrafiche esterne: officine per manutenzione automezzi flotta, fornitori abbigliamento e ricambi, enti debitori per note di debito con autocompilazione P.IVA/CF e indirizzo, e registro donatori da interventi.',
      funzionalita: [
        'Anagrafiche complete con P.IVA/CF, SDI, PEC, indirizzo e referenti',
        'Collegamento con Manutenzione Mezzi (Officine ed Esecutori)',
        'Autocompilazione Note di Debito in Contabilità (Enti Debitori)',
        'Salvataggio donazioni post-intervento con ricevute e causali',
        'Accesso protetto e autorizzabile esclusivamente dall’Amministratore'
      ],
      statistiche: `${conteggioContatti} Anagrafiche Registrate`
    }
  ];

  // Allinea e numera automaticamente le macro categorie in base a LISTA_MACRO_CATEGORIE
  const sezioniAttive = React.useMemo(() => {
    const byId = new Map(sezioni.map(s => [s.id, s]));
    return LISTA_MACRO_CATEGORIE.map((cat, idx) => {
      const card = byId.get(cat.id as AdminSectionId);
      if (card) {
        return { ...card, numero: String(idx + 1) };
      }
      return {
        id: cat.id as AdminSectionId,
        numero: String(idx + 1),
        titolo: cat.titolo,
        sottotitolo: cat.sottotitolo,
        icona: Shield,
        coloreBg: 'bg-slate-500/15',
        coloreBordo: 'border-slate-500/40 hover:border-slate-400',
        coloreTesto: 'text-slate-300',
        coloreBadge: 'bg-slate-950 text-slate-300 border-slate-700/50',
        coloreGradiente: 'from-slate-600/20 via-slate-900 to-slate-950',
        descrizione: cat.descrizione,
        funzionalita: [] as string[],
        statistiche: 'Attiva'
      };
    });
  }, [sezioni]);

  // Filtra le sezioni disponibili in base ai permessi delegati
  const sezioniVisibili = React.useMemo(() => {
    if (isAdmin || !allowedSections || allowedSections.length === 0) {
      return sezioniAttive;
    }
    return sezioniAttive.filter(s => allowedSections.includes(s.id));
  }, [sezioniAttive, isAdmin, allowedSections]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Banner di Benvenuto Amministratore / Delegato */}
      <div className="bg-gradient-to-r from-slate-950 via-[#1d1a60] to-slate-950 border-2 border-[#bfa353]/50 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="relative">
              <CroceOroLogo size="md" className="shrink-0 shadow-xl shadow-amber-500/20" />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 tracking-wider">
                  {isPresidente ? 'Presidente / Legale Rappresentante' : (!isAdmin ? 'Volontario / Operatore Delegato' : 'Centrale & Amministrazione')}
                </span>
                <span className="text-[10px] text-slate-300 flex items-center gap-1 font-mono">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  Sistema Operativo H24
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase mt-1">
                {!isAdmin ? 'Portale Operativo Delegato' : 'Portale Gestionale Amministratore'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Benvenuto, <strong className="text-amber-400">{operatoreNome}</strong>. {!isAdmin ? `Hai accesso a ${sezioniVisibili.length} macro categorie abilitate per nuovi inserimenti e modifiche.` : 'Seleziona una delle macro categorie operative sottostanti per gestire le attività della Croce Oro Massa Carrara ODV.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2.5 shrink-0">
            {/* Switch Viste: Macro Categorie vs Monitoraggio Flotta */}
            <div className="flex items-center p-1 rounded-2xl bg-slate-950/90 border border-slate-800 shrink-0 shadow-lg">
              <button
                type="button"
                onClick={() => setVistaAttiva('macro')}
                className={`px-3 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                  vistaAttiva === 'macro'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Macro Categorie ({sezioniVisibili.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setVistaAttiva('monitoraggio_flotta')}
                className={`px-3 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                  vistaAttiva === 'monitoraggio_flotta'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-current" />
                <span>Monitoraggio Flotta (KM)</span>
              </button>
            </div>

            {onApriSyncServer && (
              <button
                type="button"
                onClick={onApriSyncServer}
                className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-600/20 hover:from-amber-500 hover:to-amber-400 border border-amber-500/50 text-amber-300 hover:text-slate-950 text-xs font-black uppercase flex items-center gap-2 shadow-lg transition-all active:scale-95 cursor-pointer shrink-0 group"
                title="Salva e sincronizza i dati sui 10 GB di spazio del dominio www.croceoro.org"
              >
                <Server className="w-4 h-4 text-amber-400 group-hover:text-slate-950 group-hover:scale-110 transition-transform" />
                <span>Backup www.croceoro.org (10 GB)</span>
              </button>
            )}

            <div className="flex items-center gap-2 bg-slate-950/80 px-3.5 py-2.5 rounded-2xl border border-slate-800 shrink-0">
              <Shield className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-right">
                <div className="text-[9px] uppercase font-bold text-slate-400">Privilegi Accesso</div>
                <div className="text-xs font-black text-white">
                  {!isAdmin ? `${sezioniVisibili.length} Categorie Abilitate` : 'Accesso Completo'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barra Statistiche Rapide */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2.5 text-center">
          <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Servizi</div>
            <div className="text-sm font-black text-emerald-400 font-mono">{conteggioServiziArchivio}</div>
          </div>
          <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Volontari</div>
            <div className="text-sm font-black text-blue-400 font-mono">{conteggioVolontari}</div>
          </div>
          <div
            onClick={() => setVistaAttiva('monitoraggio_flotta')}
            className="bg-slate-900/60 hover:bg-slate-900 p-2 rounded-xl border border-slate-800 hover:border-amber-500/60 transition-all cursor-pointer group"
            title="Clicca per aprire la vista Monitoraggio Flotta con grafici KM"
          >
            <div className="text-[10px] text-slate-400 uppercase font-bold group-hover:text-amber-300 flex items-center justify-center gap-1">
              <span>Mezzi</span>
              <BarChart3 className="w-2.5 h-2.5 text-amber-400" />
            </div>
            <div className="text-sm font-black text-amber-400 font-mono">{conteggioMezzi}</div>
          </div>
          <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Donazioni</div>
            <div className="text-sm font-black text-purple-400 font-mono">{conteggioDonazioni}</div>
          </div>
          <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Corsi</div>
            <div className="text-sm font-black text-indigo-400 font-mono">{conteggioCorsi}</div>
          </div>
          <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Magazzino</div>
            <div className="text-sm font-black text-cyan-400 font-mono">Attivo</div>
          </div>
          <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Sedi</div>
            <div className="text-sm font-black text-rose-400 font-mono">{conteggioSedi}</div>
          </div>
          <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Turni</div>
            <div className="text-sm font-black text-teal-400 font-mono">{conteggioTurniOggi}</div>
          </div>
          <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-bold">Bacheca</div>
            <div className="text-sm font-black text-violet-400 font-mono">{conteggioComunicazioni}</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. ALLERTA AUTOMATICA: MANUTENZIONI E SCADENZE FLOTTA IN SCADENZA (30 GG)  */}
      {/* ========================================================================= */}
      {avvisiManutenzione.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/90 via-slate-900 to-amber-950/90 border-2 border-amber-500 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden animate-in fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-amber-500/30">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                <Wrench className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                    Avviso Automatico Dashboard
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-300">
                    {avvisiManutenzione.length} {avvisiManutenzione.length === 1 ? 'veicolo con intervento' : 'veicoli con interventi'} in scadenza
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide mt-0.5">
                  Interventi di Manutenzione Programmata & Revisioni in Scadenza (Entro 30 Giorni)
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectSection('mezzi')}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5 shadow transition-all cursor-pointer shrink-0"
            >
              <span>Gestisci in Sezione Mezzi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-3">
            {avvisiManutenzione.map((alert) => (
              <div
                key={alert.id}
                onClick={() => onSelectSection('mezzi')}
                className="bg-slate-950/90 p-3 rounded-2xl border border-amber-500/40 hover:border-amber-400 transition-all cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-sm text-amber-400 group-hover:text-amber-300">
                      🚑 {alert.mezzoSigla}
                    </span>
                    {alert.targa && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                        {alert.targa}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-white truncate max-w-[200px]">
                    {alert.tipo}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Scadenza: <strong className="text-slate-200">{alert.dataScadenza}</strong>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`px-2 py-1 rounded-xl text-[10px] font-black uppercase font-mono block ${
                    alert.scaduta
                      ? 'bg-rose-950 text-rose-300 border border-rose-800 animate-pulse'
                      : alert.giorniRimanenti <= 7
                        ? 'bg-amber-500 text-slate-950 font-black animate-pulse'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}>
                    {alert.scaduta ? 'SCADUTA' : `${alert.giorniRimanenti} gg rimasti`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CONTENUTO PRINCIPALE: VISTA MONITORAGGIO FLOTTA OPPURE MACRO CATEGORIE */}
      {/* ========================================================================= */}
      {vistaAttiva === 'monitoraggio_flotta' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setVistaAttiva('macro')}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              <span>Torna alle {sezioniVisibili.length} Macro Categorie Operative</span>
            </button>
          </div>

          <MonitoraggioFlotta
            mezzi={mezziFlotta}
            serviziArchivio={serviziArchivio}
            manutenzioni={manutenzioni}
            onSelezionaMezzo={() => onSelectSection('mezzi')}
          />
        </div>
      ) : (
        <>
          {/* Avviso Regole Accesso Delegato (Eliminazione non consentita & Notifiche automatiche attive) */}
          {!isAdmin && (
        <div className="p-4 rounded-3xl bg-amber-500/15 border-2 border-amber-500/60 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-amber-300 font-black text-sm uppercase tracking-wide">
                🔒 Accesso Delegato: Inserimenti & Modifiche Abilitati (Eliminazione Non Consentita)
              </strong>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                Come volontario/operatore autorizzato dall'Amministrazione puoi consultare i dati, effettuare nuovi inserimenti e apportare modifiche alle macro categorie a te assegnate. 
                <span className="text-amber-300 font-bold"> Non hai i permessi per cancellare o rimuovere alcun record.</span>
              </p>
              <p className="text-[11px] text-amber-300/90 mt-1 font-mono">
                📧 Notifica automatica attiva: ogni inserimento o modifica effettuata invierà una mail istantanea all'Amministratore (Sistemi Automatizzati).
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-[11px] uppercase shrink-0 shadow">
            {sezioniVisibili.length} Categorie Attive
          </span>
        </div>
      )}

      {/* Intestazione Griglia Scelte */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-black text-white tracking-wide uppercase flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>{!isAdmin ? `Le tue ${sezioniVisibili.length} Macro Categorie Abilitate` : `Le ${sezioniAttive.length} Macro Categorie Operative del Portale`}</span>
          </h2>
          <p className="text-xs text-slate-400">
            Fai clic su una scheda per accedere all'ambiente di lavoro dedicato e alle relative funzionalità
          </p>
        </div>
      </div>

      {/* GRIGLIA DELLE SCELTE */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sezioniVisibili.map((sez) => {
          const Icona = sez.icona;
          return (
            <div
              key={sez.id}
              onClick={() => onSelectSection(sez.id)}
              className={`group bg-gradient-to-b ${sez.coloreGradiente} border-2 ${sez.coloreBordo} rounded-3xl p-5 shadow-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl cursor-pointer flex flex-col justify-between relative overflow-hidden`}
            >
              <div className="space-y-3">
                {/* Header Scheda con Numero e Icona */}
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border ${sez.coloreBadge}`}>
                    Scelta {sez.numero}
                  </span>
                  <div className={`w-12 h-12 rounded-2xl ${sez.coloreBg} border ${sez.coloreBordo} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <Icona className={`w-6 h-6 ${sez.coloreTesto}`} />
                  </div>
                </div>

                {/* Titoli */}
                <div>
                  <h3 className="text-base font-black text-white group-hover:text-amber-400 transition-colors uppercase tracking-wide leading-tight">
                    {sez.numero}. {sez.titolo}
                  </h3>
                  <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
                    {sez.sottotitolo}
                  </div>
                </div>

                {/* Descrizione Principale */}
                <p className="text-xs text-slate-300 leading-relaxed">
                  {sez.descrizione}
                </p>

                {/* Lista Funzionalità Chiave */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Funzionalità incluse:
                  </span>
                  <ul className="space-y-1 text-[11px] text-slate-300">
                    {sez.funzionalita.map((fn, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 leading-snug">
                        <CheckCircle2 className={`w-3.5 h-3.5 ${sez.coloreTesto} shrink-0 mt-0.5`} />
                        <span>{fn}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Footer Scheda con Badge Statistiche e Pulsante */}
              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <span className="text-[10.5px] font-mono font-bold text-slate-400 truncate">
                  {sez.statistiche}
                </span>
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-xl ${sez.coloreBg} hover:bg-white hover:text-slate-950 ${sez.coloreTesto} font-black text-xs uppercase flex items-center gap-1.5 transition-all shadow-sm shrink-0`}
                >
                  <span>Accedi</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
        </>
      )}

    </div>
  );
};
