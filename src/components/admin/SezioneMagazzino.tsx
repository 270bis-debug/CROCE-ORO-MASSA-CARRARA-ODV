import React, { useState, useEffect } from 'react';
import {
  Package,
  Search,
  PlusCircle,
  Shirt,
  Radio,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  Edit2,
  Trash2,
  Save,
  X,
  Check,
  Sparkles,
  MapPin,
  Tag,
  Truck
} from 'lucide-react';
import { ArticoloVestiarioMagazzino, AttrezzaturaOperativa, MovimentoMagazzino, ContattoEsterno, ChiaveVestiarioAccount } from '../../types/adminTypes';
import { TAGLIE_DISPONIBILI } from '../../data/vestiarioDocumenti';
import { inviaNotificaModificaAdmin } from '../../utils/notificaModificaAdmin';
import { useTitoloDatabase, useNomiSottosezioniCustom } from '../../hooks/useNomiDatabase';
import { getTitoloSottosezione } from '../../constants/macroCategorie';

interface SezioneMagazzinoProps {
  vestiarioMagazzino: ArticoloVestiarioMagazzino[];
  onAggiornaVestiario: (vestiario: ArticoloVestiarioMagazzino[]) => void;
  attrezzature: AttrezzaturaOperativa[];
  onAggiornaAttrezzature: (attrezzature: AttrezzaturaOperativa[]) => void;
  movimenti: MovimentoMagazzino[];
  onAggiornaMovimenti: (movimenti: MovimentoMagazzino[]) => void;
  operatoreCorrente?: string;
  isAdmin?: boolean;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  contatti?: ContattoEsterno[];
  allowedSubtabs?: string[] | null;
}

export const SezioneMagazzino: React.FC<SezioneMagazzinoProps> = ({
  vestiarioMagazzino,
  onAggiornaVestiario,
  attrezzature,
  onAggiornaAttrezzature,
  movimenti,
  onAggiornaMovimenti,
  operatoreCorrente = 'Amministratore',
  isAdmin = true,
  onNotificaRadio,
  contatti = [],
  allowedSubtabs = null
}) => {
  const nomiSubCustom = useNomiSottosezioniCustom();
  const [sottoTab, setSottoTab] = useState<'vestiario' | 'attrezzature' | 'movimenti'>('vestiario');
  const canShowSubtab = (id: string) => !allowedSubtabs || allowedSubtabs.includes(id);

  useEffect(() => {
    if (!canShowSubtab(sottoTab)) {
      const ordine = ['vestiario', 'attrezzature', 'movimenti'] as const;
      const prima = ordine.find((t) => canShowSubtab(t));
      if (prima) setSottoTab(prima);
    }
  }, [sottoTab, allowedSubtabs]);

  // Filtri e ricerca
  const [ricerca, setRicerca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('tutti');
  const [filtroSottoscorta, setFiltroSottoscorta] = useState(false);

  // Modale Nuovo / Modifica Vestiario
  const [modaleVestAperta, setModaleVestAperta] = useState(false);
  const [vestInModifica, setVestInModifica] = useState<ArticoloVestiarioMagazzino | null>(null);
  const [formVestCodice, setFormVestCodice] = useState('');
  const [formVestNome, setFormVestNome] = useState('');
  const [formVestCategoria, setFormVestCategoria] = useState<ArticoloVestiarioMagazzino['categoria']>('Giacche & Giubbotti');
  const [formVestTaglia, setFormVestTaglia] = useState<string>('L');
  const [formVestGiacenza, setFormVestGiacenza] = useState(10);
  const [formVestMinima, setFormVestMinima] = useState(5);
  const [formVestPrezzo, setFormVestPrezzo] = useState(75);
  const [formVestFornitore, setFormVestFornitore] = useState('Siggi Group SpA');
  const [formVestScaffale, setFormVestScaffale] = useState('Armadio A1');
  const [formVestCauzione, setFormVestCauzione] = useState<number>(0);
  const [formVestChiaveAccount, setFormVestChiaveAccount] = useState<ChiaveVestiarioAccount | ''>('');
  const [articoloDaEliminare, setArticoloDaEliminare] = useState<ArticoloVestiarioMagazzino | null>(null);

  // Modale Nuova / Modifica Attrezzatura
  const [modaleAttrAperta, setModaleAttrAperta] = useState(false);
  const [attrInModifica, setAttrInModifica] = useState<AttrezzaturaOperativa | null>(null);
  const [formAttrCodice, setFormAttrCodice] = useState('');
  const [formAttrNome, setFormAttrNome] = useState('');
  const [formAttrCategoria, setFormAttrCategoria] = useState<AttrezzaturaOperativa['categoria']>('Telecomunicazioni & Radio');
  const [formAttrMatricola, setFormAttrMatricola] = useState('');
  const [formAttrQuantita, setFormAttrQuantita] = useState(1);
  const [formAttrUbicazione, setFormAttrUbicazione] = useState('Magazzino Centrale Massa (Le Jare)');
  const [formAttrStato, setFormAttrStato] = useState<AttrezzaturaOperativa['stato']>('Operativa al 100%');
  const [formAttrRevisione, setFormAttrRevisione] = useState('2027-06-30');
  const [formAttrNote, setFormAttrNote] = useState('');

  // Modale Registrazione Carico / Scarico Rapido
  const [modaleMovimentoAperta, setModaleMovimentoAperta] = useState(false);
  const [formMovTipo, setFormMovTipo] = useState<MovimentoMagazzino['tipo']>('Carico Fornitore');
  const [formMovArticolo, setFormMovArticolo] = useState('');
  const [formMovQuantita, setFormMovQuantita] = useState(1);
  const [formMovDestinatario, setFormMovDestinatario] = useState('');
  const [formMovNote, setFormMovNote] = useState('');

  // Notifiche
  const [avviso, setAvviso] = useState<string | null>(null);
  const mostraAvviso = (msg: string) => {
    setAvviso(msg);
    setTimeout(() => setAvviso(null), 4000);
  };

  // Salva Articolo Vestiario
  const handleSalvaVestiario = (e: React.FormEvent) => {
    e.preventDefault();
    if (vestInModifica) {
      const aggiornati = vestiarioMagazzino.map((v) => {
        if (v.id === vestInModifica.id) {
          return {
            ...v,
            codiceArticolo: formVestCodice.trim().toUpperCase(),
            nome: formVestNome.trim(),
            categoria: formVestCategoria,
            taglia: formVestTaglia,
            giacenzaAttuale: Number(formVestGiacenza),
            scortaMinima: Number(formVestMinima),
            prezzoUnitarioFornitore: Number(formVestPrezzo),
            fornitore: formVestFornitore.trim(),
            ubicazioneScaffale: formVestScaffale.trim(),
            cauzione: Math.max(0, Number(formVestCauzione) || 0),
            chiaveVestiarioAccount: formVestChiaveAccount || undefined
          };
        }
        return v;
      });
      onAggiornaVestiario(aggiornati);
      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'magazzino',
          'Modifica articolo vestiario magazzino',
          `Modificato articolo "${formVestNome}" (giacenza: ${formVestGiacenza}, cauzione: €${Number(formVestCauzione || 0).toFixed(2)}, scaffale: ${formVestScaffale})`,
          operatoreCorrente
        );
      }
      mostraAvviso(`Articolo "${formVestNome}" aggiornato.`);
    } else {
      const nuovo: ArticoloVestiarioMagazzino = {
        id: `vest-${Date.now()}`,
        codiceArticolo: formVestCodice.trim().toUpperCase() || `VEST-${Date.now().toString().slice(-4)}`,
        nome: formVestNome.trim(),
        categoria: formVestCategoria,
        taglia: formVestTaglia,
        giacenzaAttuale: Number(formVestGiacenza),
        scortaMinima: Number(formVestMinima),
        prezzoUnitarioFornitore: Number(formVestPrezzo),
        fornitore: formVestFornitore.trim(),
        ubicazioneScaffale: formVestScaffale.trim(),
        cauzione: Math.max(0, Number(formVestCauzione) || 0),
        chiaveVestiarioAccount: formVestChiaveAccount || undefined
      };
      onAggiornaVestiario([...vestiarioMagazzino, nuovo]);
      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'magazzino',
          'Nuovo articolo vestiario inserito',
          `Inserito articolo "${nuovo.nome}" (taglia: ${nuovo.taglia}, giacenza: ${nuovo.giacenzaAttuale}, cauzione: €${Number(nuovo.cauzione || 0).toFixed(2)}, codice: ${nuovo.codiceArticolo})`,
          operatoreCorrente
        );
      }
      mostraAvviso(`Nuovo articolo inserito in magazzino vestiario.`);
    }
    setModaleVestAperta(false);
    setVestInModifica(null);
  };

  const handleConfermaEliminaVestiario = () => {
    if (!articoloDaEliminare) return;
    const aggiornati = vestiarioMagazzino.filter((item) => item.id !== articoloDaEliminare.id);
    onAggiornaVestiario(aggiornati);
    onNotificaRadio?.(
      `🗑️ MAGAZZINO VESTIARIO: Eliminato articolo "${articoloDaEliminare.nome}" (${articoloDaEliminare.codiceArticolo}) da ${operatoreCorrente}`,
      'sistema'
    );
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'magazzino',
        'Eliminazione articolo vestiario magazzino',
        `Eliminato articolo "${articoloDaEliminare.nome}" (codice: ${articoloDaEliminare.codiceArticolo}, taglia: ${articoloDaEliminare.taglia})`,
        operatoreCorrente
      );
    }
    mostraAvviso(`Articolo "${articoloDaEliminare.nome}" eliminato dal magazzino vestiario.`);
    setArticoloDaEliminare(null);
  };

  // Salva Attrezzatura
  const handleSalvaAttrezzatura = (e: React.FormEvent) => {
    e.preventDefault();
    if (attrInModifica) {
      const aggiornate = attrezzature.map((a) => {
        if (a.id === attrInModifica.id) {
          return {
            ...a,
            codice: formAttrCodice.trim().toUpperCase(),
            nome: formAttrNome.trim(),
            categoria: formAttrCategoria,
            matricola: formAttrMatricola.trim(),
            quantita: Number(formAttrQuantita),
            ubicazione: formAttrUbicazione.trim(),
            stato: formAttrStato,
            dataProssimaScadenzaRevisione: formAttrRevisione,
            note: formAttrNote.trim()
          };
        }
        return a;
      });
      onAggiornaAttrezzature(aggiornate);
      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'magazzino',
          'Modifica attrezzatura magazzino',
          `Modificata attrezzatura "${formAttrNome}" (${formAttrCodice}, ubicazione: ${formAttrUbicazione})`,
          operatoreCorrente
        );
      }
      mostraAvviso(`Attrezzatura "${formAttrNome}" aggiornata.`);
    } else {
      const nuova: AttrezzaturaOperativa = {
        id: `attr-${Date.now()}`,
        codice: formAttrCodice.trim().toUpperCase() || `ATTR-${Date.now().toString().slice(-4)}`,
        nome: formAttrNome.trim(),
        categoria: formAttrCategoria,
        matricola: formAttrMatricola.trim(),
        quantita: Number(formAttrQuantita),
        ubicazione: formAttrUbicazione.trim(),
        stato: formAttrStato,
        dataProssimaScadenzaRevisione: formAttrRevisione,
        note: formAttrNote.trim()
      };
      onAggiornaAttrezzature([...attrezzature, nuova]);
      onNotificaRadio?.(`📦 MAGAZZINO: Registrata nuova attrezzatura "${nuova.nome}" (${nuova.codice})`, 'sistema');
      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'magazzino',
          'Nuova attrezzatura registrata',
          `Registrata attrezzatura "${nuova.nome}" (${nuova.codice}, quantita: ${nuova.quantita})`,
          operatoreCorrente
        );
      }
      mostraAvviso(`Nuova attrezzatura inserita nel database magazzino.`);
    }
    setModaleAttrAperta(false);
    setAttrInModifica(null);
  };

  // Registra Movimento Magazzino
  const handleRegistraMovimento = (e: React.FormEvent) => {
    e.preventDefault();
    const nuovoMov: MovimentoMagazzino = {
      id: `mov-${Date.now()}`,
      data: new Date().toISOString().replace('T', ' ').slice(0, 16),
      tipo: formMovTipo,
      articoloNome: formMovArticolo,
      quantita: Number(formMovQuantita),
      destinatarioOOrigine: formMovDestinatario,
      operatore: operatoreCorrente,
      note: formMovNote
    };

    onAggiornaMovimenti([nuovoMov, ...movimenti]);

    // Se l'articolo corrisponde a uno di vestiario, aggiorna automaticamente la giacenza!
    const artVestiario = vestiarioMagazzino.find((v) => v.nome === formMovArticolo || `${v.nome} (Taglia ${v.taglia})` === formMovArticolo);
    if (artVestiario) {
      const delta = formMovTipo === 'Carico Fornitore' || formMovTipo === 'Reso a Magazzino' ? Number(formMovQuantita) : -Number(formMovQuantita);
      const nuovaGiacenza = Math.max(0, artVestiario.giacenzaAttuale + delta);
      const vestAgg = vestiarioMagazzino.map((v) => v.id === artVestiario.id ? { ...v, giacenzaAttuale: nuovaGiacenza } : v);
      onAggiornaVestiario(vestAgg);
    }

    setModaleMovimentoAperta(false);
    onNotificaRadio?.(`📦 MOVIMENTO MAGAZZINO: Registrato ${nuovoMov.tipo} per ${nuovoMov.articoloNome} (${nuovoMov.quantita} pz)`, 'sistema');
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'magazzino',
        'Movimento carico/scarico magazzino',
        `Registrato movimento "${nuovoMov.tipo}" per ${nuovoMov.articoloNome} (${nuovoMov.quantita} pz - destinatario: ${nuovoMov.destinatarioOOrigine})`,
        operatoreCorrente
      );
    }
    mostraAvviso(`Movimentazione magazzino registrata.`);
  };

  // Vestiario filtrato
  const vestiarioFiltrato = vestiarioMagazzino.filter((v) => {
    const matchTesto =
      !ricerca.trim() ||
      v.nome.toLowerCase().includes(ricerca.toLowerCase()) ||
      v.codiceArticolo.toLowerCase().includes(ricerca.toLowerCase()) ||
      v.taglia.toLowerCase().includes(ricerca.toLowerCase()) ||
      v.ubicazioneScaffale.toLowerCase().includes(ricerca.toLowerCase());

    const matchCat = filtroCategoria === 'tutti' || v.categoria === filtroCategoria;
    const matchSotto = !filtroSottoscorta || v.giacenzaAttuale <= v.scortaMinima;

    return matchTesto && matchCat && matchSotto;
  });

  // Attrezzature filtrate
  const attrezzatureFiltrate = attrezzature.filter((a) => {
    const matchTesto =
      !ricerca.trim() ||
      a.nome.toLowerCase().includes(ricerca.toLowerCase()) ||
      a.codice.toLowerCase().includes(ricerca.toLowerCase()) ||
      a.matricola.toLowerCase().includes(ricerca.toLowerCase()) ||
      a.ubicazione.toLowerCase().includes(ricerca.toLowerCase());

    const matchCat = filtroCategoria === 'tutti' || a.categoria === filtroCategoria;
    return matchTesto && matchCat;
  });

  // Articoli sottoscorta
  const conteggioSottoscorta = vestiarioMagazzino.filter((v) => v.giacenzaAttuale <= v.scortaMinima).length;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 animate-in fade-in duration-200">
      
      {/* Header Sezione 6 */}
      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/10">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                Macro Categoria 6
              </span>
              <h2 className="text-xl font-black text-white uppercase tracking-wide">
                {useTitoloDatabase('magazzino', 'Database Magazzino Vestiario & Attrezzature')}
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Gestione giacenze divise operative e DPI (con alert scorta minima), censimento radio DMR e attrezzature operative, registro carichi e scarichi.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setFormMovArticolo(vestiarioMagazzino[0]?.nome || '');
              setFormMovQuantita(1);
              setFormMovTipo('Carico Fornitore');
              setFormMovDestinatario('');
              setFormMovNote('');
              setModaleMovimentoAperta(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-lg active:scale-95 cursor-pointer"
          >
            <Truck className="w-4 h-4" />
            <span>Registra Carico / Scarico</span>
          </button>
        </div>
      </div>

      {/* Alert Notifica */}
      {avviso && (
        <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{avviso}</span>
        </div>
      )}

      {/* Banner Allerta Sottoscorta */}
      {conteggioSottoscorta > 0 && (
        <div className="bg-amber-950/80 border border-amber-500/50 text-amber-200 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
            <div className="text-xs">
              <strong className="text-white uppercase font-black">Attenzione Sottoscorta Magazzino:</strong> ci sono{' '}
              <strong className="text-amber-300 underline">{conteggioSottoscorta} articoli</strong> al di sotto della soglia minima di sicurezza.
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSottoTab('vestiario');
              setFiltroSottoscorta(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs uppercase shrink-0 hover:bg-amber-400 transition-colors cursor-pointer"
          >
            Filtra Sottoscorta
          </button>
        </div>
      )}

      {/* Barra Navigazione Sotto-Categorie: tutte visibili senza scorrimento orizzontale */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2 pb-2 border-b border-slate-800">
        {canShowSubtab('vestiario') && (
        <button
          type="button"
          onClick={() => {
            setSottoTab('vestiario');
            setFiltroCategoria('tutti');
          }}
          className={`w-full min-w-0 px-2.5 sm:px-3.5 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-left leading-tight transition-all cursor-pointer ${
            sottoTab === 'vestiario'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 border border-cyan-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Shirt className="w-4 h-4 shrink-0" />
          <span className="break-words">1. {getTitoloSottosezione('magazzino', 'vestiario', 'Magazzino Vestiario & DPI', nomiSubCustom)} ({vestiarioMagazzino.length})</span>
        </button>
        )}

        {canShowSubtab('attrezzature') && (
        <button
          type="button"
          onClick={() => {
            setSottoTab('attrezzature');
            setFiltroCategoria('tutti');
          }}
          className={`w-full min-w-0 px-2.5 sm:px-3.5 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-left leading-tight transition-all cursor-pointer ${
            sottoTab === 'attrezzature'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 border border-cyan-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Radio className="w-4 h-4 shrink-0" />
          <span className="break-words">2. {getTitoloSottosezione('magazzino', 'attrezzature', 'Attrezzature & Presidi', nomiSubCustom)} ({attrezzature.length})</span>
        </button>
        )}

        {canShowSubtab('movimenti') && (
        <button
          type="button"
          onClick={() => setSottoTab('movimenti')}
          className={`w-full min-w-0 col-span-2 sm:col-span-1 px-2.5 sm:px-3.5 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-left leading-tight transition-all cursor-pointer ${
            sottoTab === 'movimenti'
              ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 border border-cyan-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          <span className="break-words">3. {getTitoloSottosezione('magazzino', 'movimenti', 'Registro Movimentazioni', nomiSubCustom)} ({movimenti.length})</span>
        </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 1. SOTTO-TAB: MAGAZZINO VESTIARIO & DPI                               */}
      {/* ===================================================================== */}
      {sottoTab === 'vestiario' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca articolo, taglia, scaffale..."
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="tutti">Tutte le Categorie</option>
                <option value="Giacche & Giubbotti">Giacche & Giubbotti</option>
                <option value="Pantaloni Soccorso">Pantaloni Soccorso</option>
                <option value="Polo & T-Shirt">Polo & T-Shirt</option>
                <option value="Felpe & Pile">Felpe & Pile</option>
                <option value="Calzature Antinfortunistiche">Calzature Antinfortunistiche</option>
                <option value="DPI & Caschi">DPI & Caschi</option>
              </select>

              <button
                type="button"
                onClick={() => setFiltroSottoscorta(!filtroSottoscorta)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  filtroSottoscorta
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                    : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                Solo Sottoscorta
              </button>

              <button
                type="button"
                onClick={() => {
                  setVestInModifica(null);
                  setFormVestCodice(`VEST-${Date.now().toString().slice(-4)}`);
                  setFormVestNome('');
                  setFormVestCategoria('Giacche & Giubbotti');
                  setFormVestTaglia('L');
                  setFormVestGiacenza(10);
                  setFormVestMinima(5);
                  setFormVestPrezzo(75);
                  setFormVestFornitore('Siggi Group SpA');
                  setFormVestScaffale('Armadio A1');
                  setFormVestCauzione(0);
                  setFormVestChiaveAccount('');
                  setModaleVestAperta(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nuovo Articolo</span>
              </button>
            </div>
          </div>

          {/* Tabella Vestiario */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                    <th className="py-3 px-4">Codice & Articolo</th>
                    <th className="py-3 px-4">Categoria</th>
                    <th className="py-3 px-4">Taglia</th>
                    <th className="py-3 px-4 font-mono">Giacenza Attuale</th>
                    <th className="py-3 px-4 font-mono">Scorta Minima</th>
                    <th className="py-3 px-4 font-mono">Cauzione</th>
                    <th className="py-3 px-4">Ubicazione Scaffale</th>
                    <th className="py-3 px-4 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {vestiarioFiltrato.map((v) => {
                    const isSottoscorta = v.giacenzaAttuale <= v.scortaMinima;
                    return (
                      <tr key={v.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-cyan-400 text-[11px] block">{v.codiceArticolo}</span>
                          <span className="font-bold text-white text-sm">{v.nome}</span>
                          {v.chiaveVestiarioAccount && (
                            <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[9px] font-bold">
                              🔗 Collegato: {v.chiaveVestiarioAccount}
                            </span>
                          )}
                          {v.fornitore && <div className="text-[10px] text-slate-500">Fornitore: {v.fornitore}</div>}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {v.categoria}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-bold border border-slate-700 font-mono">
                            {v.taglia}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-sm">
                          <span className={isSottoscorta ? 'text-red-400 animate-pulse' : 'text-emerald-400'}>
                            {v.giacenzaAttuale} Pz
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {v.scortaMinima} Pz
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {(v.cauzione ?? 0) > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 font-bold">
                              € {Number(v.cauzione).toFixed(2).replace('.', ',')}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Nessuna</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {v.ubicazioneScaffale}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setVestInModifica(v);
                                setFormVestCodice(v.codiceArticolo);
                                setFormVestNome(v.nome);
                                setFormVestCategoria(v.categoria);
                                setFormVestTaglia(v.taglia);
                                setFormVestGiacenza(v.giacenzaAttuale);
                                setFormVestMinima(v.scortaMinima);
                                setFormVestPrezzo(v.prezzoUnitarioFornitore || 75);
                                setFormVestFornitore(v.fornitore || '');
                                setFormVestScaffale(v.ubicazioneScaffale);
                                setFormVestCauzione(Number(v.cauzione ?? 0));
                                setFormVestChiaveAccount(v.chiaveVestiarioAccount || '');
                                setModaleVestAperta(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                              title="Modifica Articolo"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setArticoloDaEliminare(v)}
                              className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-400 border border-red-500/40 cursor-pointer"
                              title="Elimina Articolo dal Magazzino"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. SOTTO-TAB: ATTREZZATURE & PRESIDI OPERATIVI                         */}
      {/* ===================================================================== */}
      {sottoTab === 'attrezzature' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca matricola, apparato radio, ubicazione..."
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setAttrInModifica(null);
                setFormAttrCodice(`ATTR-${Date.now().toString().slice(-4)}`);
                setFormAttrNome('');
                setFormAttrCategoria('Telecomunicazioni & Radio');
                setFormAttrMatricola('');
                setFormAttrQuantita(1);
                setFormAttrUbicazione('Magazzino Centrale Massa (Le Jare)');
                setFormAttrStato('Operativa al 100%');
                setFormAttrRevisione('2027-06-30');
                setFormAttrNote('');
                setModaleAttrAperta(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nuova Attrezzatura</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attrezzatureFiltrate.map((a) => (
              <div
                key={a.id}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl space-y-3 hover:border-cyan-500/50 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                      {a.codice}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[10px] font-bold">
                      {a.stato}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-black text-white text-sm">{a.nome}</h4>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">{a.categoria}</span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-300 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                    {a.matricola && <div>Matricola: <span className="font-mono text-amber-400 font-bold">{a.matricola}</span></div>}
                    <div className="flex items-center gap-1"><MapPin className="w-3 h-3 text-rose-400" /> Ubicazione: <strong className="text-white">{a.ubicazione}</strong></div>
                    {a.dataProssimaScadenzaRevisione && (
                      <div className="flex items-center gap-1 text-slate-400">
                        <Calendar className="w-3 h-3 text-emerald-400" /> Scadenza: {a.dataProssimaScadenzaRevisione}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setAttrInModifica(a);
                      setFormAttrCodice(a.codice);
                      setFormAttrNome(a.nome);
                      setFormAttrCategoria(a.categoria);
                      setFormAttrMatricola(a.matricola);
                      setFormAttrQuantita(a.quantita);
                      setFormAttrUbicazione(a.ubicazione);
                      setFormAttrStato(a.stato);
                      setFormAttrRevisione(a.dataProssimaScadenzaRevisione || '');
                      setFormAttrNote(a.note || '');
                      setModaleAttrAperta(true);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. SOTTO-TAB: REGISTRO MOVIMENTAZIONI                                 */}
      {/* ===================================================================== */}
      {sottoTab === 'movimenti' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Registro Storico Movimentazioni Carico & Scarico Magazzino</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tracciamento carichi merci da fornitori esterni e scarichi / assegnazioni a volontari o mezzi della flotta.
              </p>
            </div>
          </div>

          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                    <th className="py-3 px-4">Data & Ora</th>
                    <th className="py-3 px-4">Tipologia Movimento</th>
                    <th className="py-3 px-4">Articolo</th>
                    <th className="py-3 px-4 font-mono">Quantità</th>
                    <th className="py-3 px-4">Destinatario / Provenienza</th>
                    <th className="py-3 px-4 text-right">Operatore</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {movimenti.map((m) => {
                    const isCarico = m.tipo === 'Carico Fornitore' || m.tipo === 'Reso a Magazzino';
                    return (
                      <tr key={m.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-400">
                          {m.data}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 w-fit ${
                            isCarico
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                              : 'bg-blue-950 text-blue-300 border-blue-700/50'
                          }`}>
                            {isCarico ? <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" /> : <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />}
                            {m.tipo}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-white">
                          {m.articoloNome}
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-cyan-400 text-sm">
                          {isCarico ? `+${m.quantita}` : `-${m.quantita}`} Pz
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {m.destinatarioOOrigine}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-400">
                          {m.operatore}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODALE NUOVO / MODIFICA VESTIARIO */}
      {modaleVestAperta && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-cyan-500/50 rounded-3xl max-w-lg w-full p-5 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shirt className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-black text-white uppercase">
                  {vestInModifica ? 'Modifica Articolo Vestiario' : 'Nuovo Articolo Vestiario'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleVestAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvaVestiario} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Codice Articolo</label>
                  <input
                    type="text"
                    required
                    value={formVestCodice}
                    onChange={(e) => setFormVestCodice(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-cyan-400 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Categoria</label>
                  <select
                    value={formVestCategoria}
                    onChange={(e) => setFormVestCategoria(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="Giacche & Giubbotti">Giacche & Giubbotti</option>
                    <option value="Pantaloni Soccorso">Pantaloni Soccorso</option>
                    <option value="Polo & T-Shirt">Polo & T-Shirt</option>
                    <option value="Felpe & Pile">Felpe & Pile</option>
                    <option value="Calzature Antinfortunistiche">Calzature Antinfortunistiche</option>
                    <option value="DPI & Caschi">DPI & Caschi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Nome Articolo</label>
                <input
                  type="text"
                  required
                  value={formVestNome}
                  onChange={(e) => setFormVestNome(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="es. Giacca Alta Visibilità 4 Stagioni"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Taglia / Misura</label>
                  <select
                    value={formVestTaglia}
                    onChange={(e) => setFormVestTaglia(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  >
                    {TAGLIE_DISPONIBILI.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="38">38 (Scarpe)</option>
                    <option value="39">39 (Scarpe)</option>
                    <option value="40">40 (Scarpe)</option>
                    <option value="41">41 (Scarpe)</option>
                    <option value="42">42 (Scarpe)</option>
                    <option value="43">43 (Scarpe)</option>
                    <option value="44">44 (Scarpe)</option>
                    <option value="45">45 (Scarpe)</option>
                    <option value="Unica">Taglia Unica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Giacenza (Pz)</label>
                  <input
                    type="number"
                    required
                    value={formVestGiacenza}
                    onChange={(e) => setFormVestGiacenza(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Scorta Minima</label>
                  <input
                    type="number"
                    required
                    value={formVestMinima}
                    onChange={(e) => setFormVestMinima(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Fornitore</label>
                  <input
                    type="text"
                    value={formVestFornitore}
                    onChange={(e) => setFormVestFornitore(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Ubicazione Scaffale</label>
                  <input
                    type="text"
                    value={formVestScaffale}
                    onChange={(e) => setFormVestScaffale(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                    placeholder="es. Armadio A1 - Ripiano 2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                <div>
                  <label className="block text-amber-300 font-bold mb-1">Cauzione Prevista (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formVestCauzione}
                    onChange={(e) => setFormVestCauzione(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-mono font-bold"
                    placeholder="es. 30 oppure 45"
                  />
                </div>
                <div>
                  <label className="block text-indigo-300 font-bold mb-1">Collegamento Capo Account</label>
                  <select
                    value={formVestChiaveAccount}
                    onChange={(e) => setFormVestChiaveAccount((e.target.value || '') as ChiaveVestiarioAccount | '')}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-indigo-500/40 text-indigo-200 font-bold"
                  >
                    <option value="">Nessun collegamento diretto</option>
                    <option value="tshirt">T-Shirt Istituzionale</option>
                    <option value="felpa">Felpa con Zip</option>
                    <option value="pile">Pile Tecnico</option>
                    <option value="pantaloni">Pantaloni Operativi</option>
                    <option value="giubbetto">Giubbetto Mezza Stagione</option>
                    <option value="giubbottoInvernale">Giubbotto Invernale</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleVestAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Salva Articolo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE NUOVA / MODIFICA ATTREZZATURA */}
      {modaleAttrAperta && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-cyan-500/50 rounded-3xl max-w-lg w-full p-5 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-black text-white uppercase">
                  {attrInModifica ? 'Modifica Attrezzatura' : 'Nuova Attrezzatura / Presidio'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleAttrAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvaAttrezzatura} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Codice Attrezzatura</label>
                  <input
                    type="text"
                    required
                    value={formAttrCodice}
                    onChange={(e) => setFormAttrCodice(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-cyan-400 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Categoria</label>
                  <select
                    value={formAttrCategoria}
                    onChange={(e) => setFormAttrCategoria(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="Telecomunicazioni & Radio">Telecomunicazioni & Radio</option>
                    <option value="Presidi Sanitari & Zaini">Presidi Sanitari & Zaini</option>
                    <option value="Immobilizzazione (Spinali/Collari)">Immobilizzazione (Spinali/Collari)</option>
                    <option value="Attrezzature Veterinarie">Attrezzature Veterinarie</option>
                    <option value="Protezione Civile & Idrovore">Protezione Civile & Idrovore</option>
                    <option value="Illuminazione & Gruppi Elettrogeni">Illuminazione & Gruppi Elettrogeni</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Nome Dispositivo</label>
                <input
                  type="text"
                  required
                  value={formAttrNome}
                  onChange={(e) => setFormAttrNome(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="es. Radio Portatile DMR Motorola DP4800e"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Matricola / Seriale</label>
                  <input
                    type="text"
                    value={formAttrMatricola}
                    onChange={(e) => setFormAttrMatricola(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                    placeholder="es. MOT-89102"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Scad. Revisione</label>
                  <input
                    type="date"
                    value={formAttrRevisione}
                    onChange={(e) => setFormAttrRevisione(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Ubicazione</label>
                  <input
                    type="text"
                    required
                    value={formAttrUbicazione}
                    onChange={(e) => setFormAttrUbicazione(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Stato Operativo</label>
                  <select
                    value={formAttrStato}
                    onChange={(e) => setFormAttrStato(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="Operativa al 100%">Operativa al 100%</option>
                    <option value="In Uso">In Uso</option>
                    <option value="In Manutenzione">In Manutenzione</option>
                    <option value="Da Revisionare">Da Revisionare</option>
                    <option value="Dismessa">Dismessa</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleAttrAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Salva Attrezzatura</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE REGISTRA MOVIMENTO CARICO / SCARICO */}
      {modaleMovimentoAperta && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-cyan-500/50 rounded-3xl max-w-lg w-full p-5 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-black text-white uppercase">
                  Registra Carico / Scarico Magazzino
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleMovimentoAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegistraMovimento} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tipo Movimentazione</label>
                  <select
                    value={formMovTipo}
                    onChange={(e) => setFormMovTipo(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  >
                    <option value="Carico Fornitore">📥 Carico Fornitore</option>
                    <option value="Scarico / Assegnazione">📤 Scarico / Assegnazione</option>
                    <option value="Reso a Magazzino">🔄 Reso a Magazzino</option>
                    <option value="Dismissione / Danneggiato">⚠️ Dismissione / Scarto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Quantità (Pz)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formMovQuantita}
                    onChange={(e) => setFormMovQuantita(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-cyan-400 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Articolo</label>
                <input
                  type="text"
                  required
                  value={formMovArticolo}
                  onChange={(e) => setFormMovArticolo(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="Seleziona o digita il nome dell'articolo"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-400 font-bold">Destinatario / Fornitore Origine</label>
                  {contatti.length > 0 && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) setFormMovDestinatario(e.target.value);
                      }}
                      value=""
                      className="text-[10px] bg-slate-900 text-cyan-300 border border-slate-700 rounded px-1.5 py-0.5 cursor-pointer"
                      title="Seleziona un'anagrafica dalla macrocategoria Contatti"
                    >
                      <option value="">Scegli da Contatti...</option>
                      {contatti.map((c) => (
                        <option key={c.id} value={c.ragioneSociale}>
                          {c.ragioneSociale} ({c.tipo})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <input
                  type="text"
                  required
                  value={formMovDestinatario}
                  onChange={(e) => setFormMovDestinatario(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="es. Siggi Group SpA (DDT 102/26) oppure Volontario In Servizio"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Note Movimento</label>
                <textarea
                  rows={2}
                  value={formMovNote}
                  onChange={(e) => setFormMovNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="Note aggiuntive..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleMovimentoAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Registra Movimento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE CONFERMA ELIMINAZIONE ARTICOLO VESTIARIO */}
      {articoloDaEliminare && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-red-500/80 rounded-3xl max-w-sm w-full p-5 shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-11 h-11 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h4 className="font-black text-sm text-white uppercase">Elimina Articolo Magazzino</h4>
                <p className="text-[11px] text-slate-400">Azione irreversibile su tutti i dispositivi</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sei sicuro di voler eliminare definitivamente <strong className="text-white">{articoloDaEliminare.nome}</strong> (Cod. <span className="font-mono text-cyan-300">{articoloDaEliminare.codiceArticolo}</span>, Taglia {articoloDaEliminare.taglia})?
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfermaEliminaVestiario}
                className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase cursor-pointer"
              >
                Elimina Definitivamente
              </button>
              <button
                type="button"
                onClick={() => setArticoloDaEliminare(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
