import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  Search,
  PlusCircle,
  Calendar,
  Clock,
  Award,
  CheckCircle2,
  Users,
  AlertTriangle,
  FileCheck2,
  Edit2,
  Trash2,
  UserPlus,
  BookOpen,
  MapPin,
  Sparkles,
  Save,
  X,
  Check,
  ShieldCheck,
  ShieldAlert,
  Building2,
  CheckSquare,
  Square,
  Navigation,
  Crosshair,
  Sliders,
  Eye,
  AlertCircle,
  Download,
  ListPlus,
  ChevronDown,
  ChevronUp,
  Loader2,
  Share2,
  Mail,
  Send
} from 'lucide-react';
import { useTitoloDatabase } from '../../hooks/useNomiDatabase';
import {
  CorsoFormazione,
  PartecipanteCorso,
  TipologiaCorso,
  LezioneCorso,
  SedeAssociativaCompleta
} from '../../types/adminTypes';
import { Volontario } from '../DatabaseVolontariModal';
import { inviaNotificaModificaAdmin } from '../../utils/notificaModificaAdmin';
import {
  getMansioniCatalogo,
  volontarioHaMansione,
  assegnaMansioneAVolontario,
  getStileMansione
} from '../../utils/mansioniVolontari';
import {
  scaricaAttestatoPDF,
  avviaDownloadAttestatoUniversale,
  condividiAttestatoPDF,
  generaNumeroAttestato,
  determinaCittaPrevalenteCorso,
  formattaIntervalloDateItaliano,
  formattaDataSlash
} from '../../utils/pdfAttestatoCorso';
import { addDaysISODate, formatDateTimeItaly, formatISODateItaly, getCurrentYearItaly } from '../../utils/italianTime';

export const TIPOLOGIE_CORSO_CONSENTITE: TipologiaCorso[] = [
  'Seminario PSV',
  'Formazione PSV',
  'Seminario Autisti',
  'BLSD',
  'Protezione Civile Corso 0',
  'Protezione Civile Corso Base'
];

export const SEDI_TERRITORIALI_GPS = [
  {
    id: 'sede-massa-ronchi',
    codice: 'SEDE-01-RONCHI',
    nome: 'Sede Legale & Direzione Generale Massa (Ronchi)',
    indirizzo: 'Via Como, 12 Località Ronchi, 54100 Marina di Massa (MS)',
    lat: 43.99419,
    lng: 10.12367
  },
  {
    id: 'sede-massa-lejare',
    codice: 'SEDE-02-LEJARE',
    nome: 'Sede Operativa H24 & Autoparco Emergenze Massa (Le Jare)',
    indirizzo: 'Via Delle Jare, 9, 54100 Massa (MS)',
    lat: 44.01700,
    lng: 10.15121
  },
  {
    id: 'sede-carrara-fossone',
    codice: 'SEDE-03-FOSSONE',
    nome: 'Sezione Territoriale Carrara (Fossone / Monteverde)',
    indirizzo: 'Strada Comunale di Monteverde, 49 Località Fossone, 54033 Carrara (MS)',
    lat: 44.066716,
    lng: 10.049207
  },
  {
    id: 'sede-pietrasanta',
    codice: 'SEDE-04-PIETRASANTA',
    nome: 'Presidio Territoriale Versilia (Marina di Pietrasanta)',
    indirizzo: 'Piazza Villeparisis, 14 Località Marina di Pietrasanta, 55045 Pietrasanta (LU)',
    lat: 43.92771,
    lng: 10.20194
  },
  {
    id: 'sede-lunigiana',
    codice: 'SEDE-05-LUNIGIANA',
    nome: 'Sezione Territoriale Lunigiana (Aulla)',
    indirizzo: 'Piazza Cavour / Piazza della Vittoria, 54011 Aulla (MS)',
    lat: 44.21455,
    lng: 9.96779
  }
];

interface SezioneFormazioneProps {
  corsi: CorsoFormazione[];
  onAggiornaCorsi: (corsi: CorsoFormazione[]) => void;
  volontari: Volontario[];
  onAggiornaVolontari?: (volontari: Volontario[]) => void;
  sedi?: SedeAssociativaCompleta[];
  operatoreCorrente?: string;
  isAdmin?: boolean;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
}

export const SezioneFormazione: React.FC<SezioneFormazioneProps> = ({
  corsi,
  onAggiornaCorsi,
  volontari,
  onAggiornaVolontari,
  sedi = [],
  operatoreCorrente = 'Amministratore',
  isAdmin = true,
  onNotificaRadio
}) => {
  const [sottoTab, setSottoTab] = useState<'corsi' | 'iscritti' | 'scadenziario'>('corsi');

  // Ricerca e filtri
  const [ricerca, setRicerca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('tutti');
  const [filtroStato, setFiltroStato] = useState('tutti');

  // Modale Nuovo / Modifica Corso
  const [modaleCorsoAperta, setModaleCorsoAperta] = useState(false);
  const [corsoInModifica, setCorsoInModifica] = useState<CorsoFormazione | null>(null);
  const [formCodice, setFormCodice] = useState(`CORSO-${getCurrentYearItaly()}-${String(corsi.length + 1).padStart(2, '0')}`);
  const [formTitolo, setFormTitolo] = useState('');
  const [formSottotitolo, setFormSottotitolo] = useState('');
  const [formTipologia, setFormTipologia] = useState<TipologiaCorso>('Seminario PSV');
  const [formDescrizione, setFormDescrizione] = useState('');
  const [formDocente, setFormDocente] = useState('');
  const [formEnte, setFormEnte] = useState('Regione Toscana — Formazione Continua');
  const [formSede, setFormSede] = useState('Sede Legale & Direzione Generale Massa (Ronchi) — Aula Magna');
  const [formDataInizio, setFormDataInizio] = useState(() => formatISODateItaly());
  const [formDataFine, setFormDataFine] = useState(() => addDaysISODate(formatISODateItaly(), 7));
  const [formOreTotali, setFormOreTotali] = useState(12);
  const [formOreMinime, setFormOreMinime] = useState(10);
  const [formMaxPartecipanti, setFormMaxPartecipanti] = useState(25);
  const [formStato, setFormStato] = useState<CorsoFormazione['stato']>('Programmato');

  // Mansioni collegate al percorso formativo
  const [formMansioneRilasciata, setFormMansioneRilasciata] = useState<string>('');
  const [formPrevedeEsame, setFormPrevedeEsame] = useState<boolean>(false);
  const [formMansionePrerequisito, setFormMansionePrerequisito] = useState<string>('');

  // Programma lezioni (fino a 20)
  const [formLezioni, setFormLezioni] = useState<LezioneCorso[]>([]);
  const [mostraDettaglioLezioniCorsoId, setMostraDettaglioLezioniCorsoId] = useState<string | null>(null);

  // Destinatari per Sezione Territoriale Operativa (NO singoli volontari)
  const [formSezioniDestinatarieIds, setFormSezioniDestinatarieIds] = useState<string[]>(['TUTTE']);

  // Sede di svolgimento & GPS (Sezione salvata o ALTRO con pin regolabile)
  const [formSedeTipo, setFormSedeTipo] = useState<string>('sede-massa-ronchi');
  const [formNomePosizioneAltro, setFormNomePosizioneAltro] = useState('');
  const [formIndirizzoAltro, setFormIndirizzoAltro] = useState('');
  const [formCoordinate, setFormCoordinate] = useState<{ lat: number; lng: number }>({ lat: 43.99419, lng: 10.12367 });

  // Percentuale Minima Presenza e Orari
  const [formPercentualeMinima, setFormPercentualeMinima] = useState<number>(80);
  const [formOrarioInizioLezione, setFormOrarioInizioLezione] = useState('09:00');
  const [formOrarioFineLezione, setFormOrarioFineLezione] = useState('13:00');

  // Modale Iscrizione Volontari a un Corso
  const [corsoPerIscrizioni, setCorsoPerIscrizioni] = useState<CorsoFormazione | null>(null);
  const [volontarioDaIscrivereId, setVolontarioDaIscrivereId] = useState('');

  // Modale Rilascio Attestato / Stampa
  const [attestatoPerStampa, setAttestatoPerStampa] = useState<{
    corso: CorsoFormazione;
    partecipante: PartecipanteCorso;
  } | null>(null);

  // Notifica
  const [avviso, setAvviso] = useState<string | null>(null);
  const mostraAvviso = (msg: string) => {
    setAvviso(msg);
    setTimeout(() => setAvviso(null), 4000);
  };

  // Stato operazione attestato per prevenire click ripetuti
  const [operazioneAttestatoInCorso, setOperazioneAttestatoInCorso] = useState(false);

  const handleScaricaAttestato = async (corso: CorsoFormazione, partecipante: PartecipanteCorso) => {
    if (operazioneAttestatoInCorso) return;
    setOperazioneAttestatoInCorso(true);
    try {
      await avviaDownloadAttestatoUniversale(corso, partecipante);
      mostraAvviso(`Download avviato per ${partecipante.volontarioNome || 'partecipante'}.`);
    } catch (err: any) {
      console.error('Errore download attestato:', err);
      mostraAvviso(`Errore durante il download: ${err?.message || 'verifica il browser'}`);
    } finally {
      setTimeout(() => {
        setOperazioneAttestatoInCorso(false);
      }, 600);
    }
  };

  const handleCondividiAttestato = async (corso: CorsoFormazione, partecipante: PartecipanteCorso) => {
    if (operazioneAttestatoInCorso) return;
    setOperazioneAttestatoInCorso(true);
    try {
      const ok = await condividiAttestatoPDF(corso, partecipante);
      if (ok) {
        mostraAvviso('Apertura menu di condivisione e salvataggio...');
      } else {
        await avviaDownloadAttestatoUniversale(corso, partecipante);
        mostraAvviso('Attestato inviato al download del dispositivo.');
      }
    } catch (err: any) {
      console.error('Errore condivisione attestato:', err);
      mostraAvviso(`Errore: ${err?.message || 'non supportato'}`);
    } finally {
      setTimeout(() => {
        setOperazioneAttestatoInCorso(false);
      }, 600);
    }
  };

  // Apertura modale nuovo corso con valori iniziali geolocalizzati
  const apriNuovoCorso = () => {
    setCorsoInModifica(null);
    setFormCodice(`CORSO-${getCurrentYearItaly()}-${String(corsi.length + 1).padStart(2, '0')}`);
    setFormTitolo('TUTELA, SOCCORSO E BENESSERE ANIMALE');
    setFormSottotitolo('“Dal Soccorso alla tutela degli animali”');
    setFormTipologia('Seminario PSV');
    setFormDescrizione('Seminario formativo teorico-pratico sulle procedure di primo intervento, messa in sicurezza, etologia e soccorso degli animali d\'affezione e fauna selvatica.');
    setFormDocente('Dott.ssa Valentina Moriconi (Formatore IRC / Veterinario)');
    setFormEnte('Regione Toscana — Centrale 118 Alta Toscana');
    setFormSedeTipo('sede-massa-ronchi');
    const primaSede = SEDI_TERRITORIALI_GPS[0];
    setFormSede(primaSede.nome);
    setFormCoordinate({ lat: primaSede.lat, lng: primaSede.lng });
    setFormNomePosizioneAltro('');
    setFormIndirizzoAltro('');
    setFormSezioniDestinatarieIds(['TUTTE']);
    setFormPercentualeMinima(80);
    setFormMansioneRilasciata('');
    setFormPrevedeEsame(false);
    setFormMansionePrerequisito('');
    const dataOggi = formatISODateItaly();
    setFormDataInizio(dataOggi);
    setFormDataFine(addDaysISODate(dataOggi, 14));
    setFormOreTotali(12);
    setFormOreMinime(10);
    setFormOrarioInizioLezione('09:00');
    setFormOrarioFineLezione('13:00');
    setFormMaxPartecipanti(25);
    setFormStato('Programmato');
    // Pre-imposta 3 lezioni in sedi diverse per Seminario PSV
    setFormLezioni([
      {
        id: `lez-${Date.now()}-1`,
        numero: 1,
        titolo: 'Modulo 1: Quadro Normativo, Benessere Animale e Approccio in Sicurezza',
        data: dataOggi,
        orarioInizio: '09:00',
        orarioFine: '13:00',
        ore: 4,
        sedeNome: SEDI_TERRITORIALI_GPS[0].nome,
        indirizzoCompleto: SEDI_TERRITORIALI_GPS[0].indirizzo,
        coordinate: { lat: SEDI_TERRITORIALI_GPS[0].lat, lng: SEDI_TERRITORIALI_GPS[0].lng },
        docente: 'Dott.ssa Valentina Moriconi'
      },
      {
        id: `lez-${Date.now()}-2`,
        numero: 2,
        titolo: 'Modulo 2: Primo Soccorso Veterinario e Gestione Urgenze Traumatiche',
        data: addDaysISODate(dataOggi, 7),
        orarioInizio: '09:00',
        orarioFine: '13:00',
        ore: 4,
        sedeNome: SEDI_TERRITORIALI_GPS[2].nome, // Carrara Fossone
        indirizzoCompleto: SEDI_TERRITORIALI_GPS[2].indirizzo,
        coordinate: { lat: SEDI_TERRITORIALI_GPS[2].lat, lng: SEDI_TERRITORIALI_GPS[2].lng },
        docente: 'Dott.ssa Valentina Moriconi'
      },
      {
        id: `lez-${Date.now()}-3`,
        numero: 3,
        titolo: 'Modulo 3: Allestimento Ambulanze Veterinarie ed Esercitazione Pratica',
        data: addDaysISODate(dataOggi, 14),
        orarioInizio: '09:00',
        orarioFine: '13:00',
        ore: 4,
        sedeNome: SEDI_TERRITORIALI_GPS[1].nome, // Massa Le Jare
        indirizzoCompleto: SEDI_TERRITORIALI_GPS[1].indirizzo,
        coordinate: { lat: SEDI_TERRITORIALI_GPS[1].lat, lng: SEDI_TERRITORIALI_GPS[1].lng },
        docente: 'Istruttori Soccorso Croce Oro'
      }
    ]);
    setModaleCorsoAperta(true);
  };

  // Apertura modale modifica corso
  const apriModificaCorso = (c: CorsoFormazione) => {
    setCorsoInModifica(c);
    setFormCodice(c.codiceCorso);
    setFormTitolo(c.titolo);
    setFormSottotitolo(c.sottotitolo || '');
    setFormTipologia(c.tipologia);
    setFormDescrizione(c.descrizione);
    setFormDocente(c.docenteFormatore);
    setFormEnte(c.enteAccreditato);
    setFormSede(c.sedeCorso);
    setFormDataInizio(c.dataInizio);
    setFormDataFine(c.dataFine);
    setFormOreTotali(c.oreTotali);
    setFormOreMinime(c.oreMinimeFrequenza);
    setFormPercentualeMinima(c.percentualeMinimaPresenza || Math.round((c.oreMinimeFrequenza / c.oreTotali) * 100) || 75);
    setFormMaxPartecipanti(c.massimoPartecipanti);
    setFormStato(c.stato);
    setFormMansioneRilasciata(c.mansioneRilasciata || '');
    setFormPrevedeEsame(Boolean(c.prevedeEsame));
    setFormMansionePrerequisito(c.mansionePrerequisito || '');
    setFormLezioni(c.lezioni && c.lezioni.length > 0 ? [...c.lezioni] : []);
    setFormSezioniDestinatarieIds(c.sezioniDestinatarieIds && c.sezioniDestinatarieIds.length > 0 ? c.sezioniDestinatarieIds : ['TUTTE']);
    if (c.sedeSvolgimentoTipo === 'altro') {
      setFormSedeTipo('ALTRO');
      setFormNomePosizioneAltro(c.sedeCorso || '');
      setFormIndirizzoAltro(c.indirizzoCompleto || '');
    } else if (c.sedeSvolgimentoSedeId) {
      setFormSedeTipo(c.sedeSvolgimentoSedeId);
    } else {
      setFormSedeTipo('sede-massa-ronchi');
    }
    if (c.coordinate) {
      setFormCoordinate(c.coordinate);
    }
    setFormOrarioInizioLezione(c.orarioInizioLezione || '09:00');
    setFormOrarioFineLezione(c.orarioFineLezione || '13:00');
    setModaleCorsoAperta(true);
  };

  // Salva Corso con destinatari a sezioni, fino a 20 lezioni geolocalizzate
  const handleSalvaCorso = (e: React.FormEvent) => {
    e.preventDefault();

    let sedeNome = formSede;
    let indirizzo = '';
    let coordinate = formCoordinate;

    if (formSedeTipo === 'ALTRO') {
      sedeNome = formNomePosizioneAltro.trim() || 'Sede Esterna Formativa';
      indirizzo = formIndirizzoAltro.trim();
    } else {
      const sedeSelezionata = SEDI_TERRITORIALI_GPS.find((s) => s.id === formSedeTipo);
      if (sedeSelezionata) {
        sedeNome = sedeSelezionata.nome;
        indirizzo = sedeSelezionata.indirizzo;
        coordinate = { lat: sedeSelezionata.lat, lng: sedeSelezionata.lng };
      }
    }

    // Sezioni Destinatarie Nomi (NO singoli volontari)
    let sezioniNomi: string[] = [];
    if (formSezioniDestinatarieIds.includes('TUTTE')) {
      sezioniNomi = ['Tutte le Sezioni dell\'Associazione'];
    } else {
      sezioniNomi = formSezioniDestinatarieIds
        .map((id) => SEDI_TERRITORIALI_GPS.find((s) => s.id === id)?.nome)
        .filter(Boolean) as string[];
    }

    // Se ci sono lezioni, ricalcola ore totali e date
    let oreTot = Number(formOreTotali);
    if (formLezioni.length > 0) {
      const sommaOreLezioni = formLezioni.reduce((sum, l) => sum + (Number(l.ore) || 0), 0);
      if (sommaOreLezioni > 0) oreTot = sommaOreLezioni;
    }
    const percMin = Number(formPercentualeMinima);
    const oreMin = Math.round((oreTot * percMin) / 100);

    const lezioniOrdinate = [...formLezioni].map((lez, idx) => ({
      ...lez,
      numero: idx + 1
    }));

    const datiCorsoAggiornato: Partial<CorsoFormazione> = {
      codiceCorso: formCodice.trim().toUpperCase(),
      titolo: formTitolo.trim(),
      sottotitolo: formSottotitolo.trim() || undefined,
      tipologia: formTipologia,
      descrizione: formDescrizione.trim(),
      docenteFormatore: formDocente.trim(),
      enteAccreditato: formEnte.trim(),
      sedeCorso: sedeNome,
      sedeSvolgimentoTipo: formSedeTipo === 'ALTRO' ? 'altro' : 'sezione_salvata',
      sedeSvolgimentoSedeId: formSedeTipo === 'ALTRO' ? undefined : formSedeTipo,
      indirizzoCompleto: indirizzo,
      coordinate: coordinate,
      orarioInizioLezione: formOrarioInizioLezione,
      orarioFineLezione: formOrarioFineLezione,
      sezioniDestinatarieIds: formSezioniDestinatarieIds,
      sezioniDestinatarieNomi: sezioniNomi,
      percentualeMinimaPresenza: percMin,
      dataInizio: formDataInizio,
      dataFine: formDataFine,
      oreTotali: oreTot,
      oreMinimeFrequenza: oreMin,
      massimoPartecipanti: Number(formMaxPartecipanti),
      stato: formStato,
      mansioneRilasciata: formMansioneRilasciata.trim() || undefined,
      prevedeEsame: formPrevedeEsame,
      mansionePrerequisito: formMansionePrerequisito.trim() || undefined,
      lezioni: lezioniOrdinate
    };

    if (corsoInModifica) {
      const aggiornati = corsi.map((c) =>
        c.id === corsoInModifica.id ? ({ ...c, ...datiCorsoAggiornato } as CorsoFormazione) : c
      );
      onAggiornaCorsi(aggiornati);
      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'formazione',
          'Modifica corso formazione',
          `Modificato corso "${formTitolo}" (${formCodice}, docente: ${formDocente}, sede: ${sedeNome}, ${lezioniOrdinate.length} lezioni)`,
          operatoreCorrente
        );
      }
      mostraAvviso(`Corso "${formTitolo}" aggiornato con successo (${lezioniOrdinate.length} incontri programmati).`);
    } else {
      const nuovo: CorsoFormazione = {
        ...(datiCorsoAggiornato as CorsoFormazione),
        id: `corso-${Date.now()}`,
        iscritti: []
      };
      onAggiornaCorsi([...corsi, nuovo]);
      onNotificaRadio?.(`🎓 FORMAZIONE: Programmato nuovo corso "${nuovo.titolo}" per ${sezioniNomi.join(', ')} (${lezioniOrdinate.length} lezioni)`, 'sistema');
      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'formazione',
          'Nuovo corso formazione programmato',
          `Programmato corso "${nuovo.titolo}" (${nuovo.codiceCorso}, tipologia: ${nuovo.tipologia}, ${lezioniOrdinate.length} lezioni in sedi diverse)`,
          operatoreCorrente
        );
      }
      mostraAvviso(`Nuovo corso "${nuovo.titolo}" programmato (${lezioniOrdinate.length} incontri).`);
    }
    setModaleCorsoAperta(false);
    setCorsoInModifica(null);
  };

  // Iscrivi volontario al corso
  const handleIscriviVolontario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!corsoPerIscrizioni || !volontarioDaIscrivereId) return;

    const vol = volontari.find((v) => v.id === volontarioDaIscrivereId);
    if (!vol) return;

    // Controllo prerequisito mansione (diretta o ereditata gerarchicamente)
    if (corsoPerIscrizioni.mansionePrerequisito && corsoPerIscrizioni.mansionePrerequisito.trim()) {
      const haPrerequisito = volontarioHaMansione(vol, corsoPerIscrizioni.mansionePrerequisito);
      if (!haPrerequisito) {
        mostraAvviso(
          `Accesso negato: per "${corsoPerIscrizioni.titolo}" è richiesta la mansione "${corsoPerIscrizioni.mansionePrerequisito}". ${vol.nome} ${vol.cognome} non la possiede.`
        );
        return;
      }
    }

    // Verifica se già iscritto
    if (corsoPerIscrizioni.iscritti.some((i) => i.volontarioId === vol.id)) {
      mostraAvviso('Il volontario risulta già iscritto a questo corso.');
      return;
    }

    const nuovoIscritto: PartecipanteCorso = {
      volontarioId: vol.id,
      volontarioNome: `${vol.nome} ${vol.cognome}`,
      qualifica: vol.qualifica || 'Volontario',
      oreFrequentate: 0,
      esito: 'Iscritto',
      esitoEsame: corsoPerIscrizioni.prevedeEsame ? 'In Attesa Esame' : 'Non Previsto',
      tipoAttestato: (corsoPerIscrizioni.tipologia === 'Seminario PSV' || corsoPerIscrizioni.tipologia === 'Seminario Autisti')
        ? 'partecipazione'
        : 'idoneita'
    };

    const aggiornati = corsi.map((c) => {
      if (c.id === corsoPerIscrizioni.id) {
        return {
          ...c,
          iscritti: [...c.iscritti, nuovoIscritto]
        };
      }
      return c;
    });

    onAggiornaCorsi(aggiornati);
    setCorsoPerIscrizioni(aggiornati.find((c) => c.id === corsoPerIscrizioni.id) || null);
    setVolontarioDaIscrivereId('');
    if (!isAdmin) {
      inviaNotificaModificaAdmin(
        'formazione',
        'Iscrizione volontario a corso',
        `Iscritto ${vol.nome} ${vol.cognome} al corso "${corsoPerIscrizioni.titolo}" (${corsoPerIscrizioni.codiceCorso})`,
        operatoreCorrente
      );
    }
    mostraAvviso(`${vol.nome} ${vol.cognome} iscritto al corso con successo.`);
  };

  // Aggiorna esito partecipante (Idoneo, superato, rilascio attestato e assegnazione automatica mansione)
  const handleAggiornaEsito = (
    corsoId: string,
    volontarioId: string,
    nuovoEsito: PartecipanteCorso['esito'],
    ore: number
  ) => {
    const dataOggi = formatISODateItaly();
    const scadenza = addDaysISODate(dataOggi, 2 * 365); // +2 anni per BLSD

    let mansioneDaAssegnare: string | undefined = undefined;

    const aggiornati = corsi.map((c) => {
      if (c.id === corsoId) {
        return {
          ...c,
          iscritti: c.iscritti.map((p) => {
            if (p.volontarioId === volontarioId) {
              const idoneo = nuovoEsito === 'Idoneo / Superato';
              const isSeminarioPSV = c.tipologia === 'Seminario PSV';
              const isSeminarioAutisti = c.tipologia === 'Seminario Autisti';
              const isPartecipazione = isSeminarioPSV || isSeminarioAutisti;

              let numAtt = p.numeroAttestato;
              if (idoneo && !numAtt) {
                numAtt = generaNumeroAttestato(c.tipologia, corsi);
              }

              // Se il corso riconosce una mansione al superamento (o esame previsto superato)
              let mansioneAssegnata = p.mansioneAssegnataAutomatica;
              if (idoneo && c.mansioneRilasciata) {
                mansioneAssegnata = true;
                mansioneDaAssegnare = c.mansioneRilasciata;
              }

              return {
                ...p,
                esito: nuovoEsito,
                esitoEsame: (c.prevedeEsame ? (idoneo ? 'Superato' : 'Non Superato') : 'Non Previsto') as PartecipanteCorso['esitoEsame'],
                mansioneAssegnataAutomatica: mansioneAssegnata,
                oreFrequentate: ore,
                tipoAttestato: (isPartecipazione ? 'partecipazione' : 'idoneita') as 'partecipazione' | 'idoneita',
                numeroAttestato: idoneo ? numAtt : undefined,
                dataRilascioAttestato: idoneo ? (p.dataRilascioAttestato || dataOggi) : undefined,
                scadenzaBrevetto: idoneo ? (isPartecipazione ? undefined : scadenza) : undefined
              };
            }
            return p;
          })
        };
      }
      return c;
    });

    onAggiornaCorsi(aggiornati);
    if (corsoPerIscrizioni) {
      setCorsoPerIscrizioni(aggiornati.find((c) => c.id === corsoPerIscrizioni.id) || null);
    }

    // Se è stata conseguita una nuova mansione, aggiorna automaticamente l'anagrafica del volontario
    if (mansioneDaAssegnare) {
      const volTarget = volontari.find((v) => v.id === volontarioId);
      if (volTarget) {
        const volontariAggiornati = volontari.map((v) =>
          v.id === volontarioId ? assegnaMansioneAVolontario(v, mansioneDaAssegnare!) : v
        );
        onAggiornaVolontari?.(volontariAggiornati);
        onNotificaRadio?.(
          `🎖️ MANSIONE ACQUISITA: ${volTarget.nome} ${volTarget.cognome} ha superato il corso/esame ed ha acquisito automaticamente la mansione "${mansioneDaAssegnare}"!`,
          'sistema'
        );
      }
    }

    mostraAvviso(`Esito formativo e attestato aggiornati.${mansioneDaAssegnare ? ` Mansione "${mansioneDaAssegnare}" assegnata in automatico!` : ''}`);
  };

  // Corsi filtrati
  const corsiFiltrati = corsi.filter((c) => {
    const matchTesto =
      !ricerca.trim() ||
      c.titolo.toLowerCase().includes(ricerca.toLowerCase()) ||
      c.codiceCorso.toLowerCase().includes(ricerca.toLowerCase()) ||
      c.docenteFormatore.toLowerCase().includes(ricerca.toLowerCase()) ||
      c.sedeCorso.toLowerCase().includes(ricerca.toLowerCase());

    const matchTipo = filtroTipo === 'tutti' || c.tipologia === filtroTipo;
    const matchStato = filtroStato === 'tutti' || c.stato === filtroStato;

    return matchTesto && matchTipo && matchStato;
  });

  // Elenco complessivo di tutti gli attestati e brevetti emessi
  const tuttiGliAttestati = corsi.flatMap((c) =>
    c.iscritti
      .filter((i) => i.numeroAttestato && i.esito === 'Idoneo / Superato')
      .map((i) => ({ corso: c, partecipante: i }))
  );

  // Calcolo scadenze brevetti & attestati (preavviso 30 giorni e 15 giorni prima della data limite)
  const attestatiConScadenza = React.useMemo(() => {
    const oggiMs = Date.now();
    const msGiorno = 1000 * 60 * 60 * 24;
    return tuttiGliAttestati
      .filter(({ partecipante }) => Boolean(partecipante.scadenzaBrevetto))
      .map(({ corso, partecipante }) => {
        const scadMs = new Date(partecipante.scadenzaBrevetto!).getTime();
        const diffGg = Math.ceil((scadMs - oggiMs) / msGiorno);
        let scaglione: '30_giorni' | '15_giorni' | 'scaduto' | 'regolare' = 'regolare';
        if (diffGg <= 0) scaglione = 'scaduto';
        else if (diffGg <= 15) scaglione = '15_giorni';
        else if (diffGg <= 30) scaglione = '30_giorni';

        return {
          corso,
          partecipante,
          scadenzaBrevetto: partecipante.scadenzaBrevetto!,
          giorniRimanenti: diffGg,
          scaglione
        };
      })
      .sort((a, b) => a.giorniRimanenti - b.giorniRimanenti);
  }, [tuttiGliAttestati]);

  // Attestati in scadenza entro 30 giorni (inclusi quelli a 15 giorni e scaduti)
  const attestatiInScadenza30Gg = React.useMemo(() => {
    return attestatiConScadenza.filter((a) => a.scaglione !== 'regolare');
  }, [attestatiConScadenza]);

  // Attestati urgenti (entro 15 giorni o scaduti)
  const attestatiUrgenti15Gg = React.useMemo(() => {
    return attestatiConScadenza.filter((a) => a.scaglione === '15_giorni' || a.scaglione === 'scaduto');
  }, [attestatiConScadenza]);

  // Registro in memoria delle scadenze attestati/brevetti già notificate per scaglione
  const ultimoStatoNotificaAttestatiRef = useRef<Record<string, string>>({});
  const [invioEmailAttestatiInCorso, setInvioEmailAttestatiInCorso] = useState(false);

  // Invia notifica email automatica a formazione@croceoro.oeg (e formazione@croceoro.org) e presidenza@croceoro.org
  const inviaEmailScadenzeAttestatiAutomatico = async (
    items: Array<{ corso: CorsoFormazione; partecipante: PartecipanteCorso; scadenzaBrevetto: string; giorniRimanenti: number; scaglione: string }>,
    causale: string = 'Preavviso scadenza attestati/brevetti formativi (30 gg e 15 gg)',
    force: boolean = false
  ) => {
    if (!items || items.length === 0) return;

    const payload = items.map((i) => ({
      volontarioId: i.partecipante.volontarioId,
      volontarioNome: i.partecipante.volontarioNome,
      qualifica: i.partecipante.qualifica,
      corsoTitolo: i.corso.titolo,
      tipologia: i.corso.tipologia,
      codiceCorso: i.corso.codiceCorso,
      numeroAttestato: i.partecipante.numeroAttestato,
      dataRilascioAttestato: i.partecipante.dataRilascioAttestato,
      scadenzaBrevetto: i.scadenzaBrevetto,
      giorniRimanenti: i.giorniRimanenti,
      scaglione: i.scaglione
    }));

    const daInviare = force
      ? payload
      : payload.filter((p) => {
          const key = `${p.volontarioId}_${p.numeroAttestato || p.codiceCorso}_${p.scadenzaBrevetto}_${p.scaglione}`;
          return !ultimoStatoNotificaAttestatiRef.current[key];
        });

    if (daInviare.length === 0) return;

    daInviare.forEach((p) => {
      const key = `${p.volontarioId}_${p.numeroAttestato || p.codiceCorso}_${p.scadenzaBrevetto}_${p.scaglione}`;
      ultimoStatoNotificaAttestatiRef.current[key] = new Date().toISOString();
    });

    try {
      setInvioEmailAttestatiInCorso(true);
      const res = await fetch('/api/notifica-scadenza-attestati', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attestati: daInviare,
          causale,
          operatore: operatoreCorrente || 'Ufficio Formazione & Didattica',
          dataOra: formatDateTimeItaly(),
          force
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.success && data?.count > 0) {
          const elenco = daInviare.map((a) => `${a.volontarioNome} (${a.tipologia || 'Brevetto'}: ${a.scadenzaBrevetto})`).join(', ');
          onNotificaRadio?.(
            `📧 NOTIFICA SCADENZA BREVETTI INVIATA: Email trasmessa a formazione@croceoro.oeg e presidenza@croceoro.org per: ${elenco}.`,
            'allarme'
          );
        }
      }
    } catch (err) {
      console.warn('[SezioneFormazione] Errore invio email scadenze attestati:', err);
    } finally {
      setInvioEmailAttestatiInCorso(false);
    }
  };

  // Controllo automatico delle scadenze brevetti (30 giorni e 15 giorni prima) all'avvio
  useEffect(() => {
    if (attestatiInScadenza30Gg.length > 0) {
      inviaEmailScadenzeAttestatiAutomatico(
        attestatiInScadenza30Gg,
        'Verifica automatica programmata scadenze attestati/brevetti (preavviso 30 gg e 15 gg)'
      );
    }
  }, [attestatiInScadenza30Gg]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 animate-in fade-in duration-200">
      
      {/* Header Sezione 5 */}
      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/10">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                Macro Categoria 5
              </span>
              <h2 className="text-xl font-black text-white uppercase tracking-wide">
                {useTitoloDatabase('formazione', 'Database Formazione, Corsi & Brevetti')}
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Pianificazione percorsi formativi (BLSD, Soccorso Avanzato, Guida Sicura, Protezione Civile, Soccorso Veterinario), registri presenze e scadenziario abilitazioni.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={apriNuovoCorso}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nuovo Corso Formativo</span>
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

      {/* Barra Navigazione Sotto-Categorie */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800">
        <button
          type="button"
          onClick={() => setSottoTab('corsi')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'corsi'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>1. Catalogo Corsi & Piano Formativo ({corsi.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSottoTab('iscritti')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'iscritti'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>2. Iscrizioni & Registro Presenze</span>
        </button>

        <button
          type="button"
          onClick={() => setSottoTab('scadenziario')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'scadenziario'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>3. Scadenziario Brevetti & Attestati ({tuttiGliAttestati.length})</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* 1. SOTTO-TAB: CATALOGO CORSI                                          */}
      {/* ===================================================================== */}
      {sottoTab === 'corsi' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca titolo corso, codice, docente..."
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="tutti">Tutte le Tipologie</option>
                {TIPOLOGIE_CORSO_CONSENTITE.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                value={filtroStato}
                onChange={(e) => setFiltroStato(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="tutti">Tutti gli Stati</option>
                <option value="Programmato">Programmati</option>
                <option value="In Corso">In Corso</option>
                <option value="Concluso">Conclusi</option>
              </select>
            </div>
          </div>

          {/* Grid Corsi */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {corsiFiltrati.map((c) => {
              const isProgrammato = c.stato === 'Programmato';
              const isInCorso = c.stato === 'In Corso';
              const numLezioni = c.lezioni?.length || 0;
              const isMostraDettagli = mostraDettaglioLezioniCorsoId === c.id;

              return (
                <div
                  key={c.id}
                  className="bg-slate-950 rounded-2xl border border-slate-800 hover:border-indigo-500/50 p-4 shadow-xl flex flex-col justify-between gap-3 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-black text-xs text-indigo-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                        {c.codiceCorso}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        isInCorso
                          ? 'bg-amber-950 text-amber-300 border-amber-700/50 animate-pulse'
                          : isProgrammato
                          ? 'bg-blue-950 text-blue-300 border-blue-700/50'
                          : 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                      }`}>
                        {c.stato}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-black text-white text-sm leading-snug">{c.titolo}</h4>
                      {c.sottotitolo && (
                        <p className="text-[11px] font-semibold text-amber-300 italic">{c.sottotitolo}</p>
                      )}
                      <span className="text-[10px] font-bold text-indigo-300 uppercase block mt-0.5">{c.tipologia}</span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2">{c.descrizione}</p>

                    <div className="space-y-1 pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{c.oreTotali} Ore Totali • Minimo {c.oreMinimeFrequenza}h</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{c.dataInizio} ➔ {c.dataFine}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span className="truncate">{c.sedeCorso}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span><strong>{c.iscritti.length}</strong> / {c.massimoPartecipanti} Iscritti</span>
                      </div>
                    </div>

                    {/* Programma Lezioni (fino a 20 incontri) */}
                    {numLezioni > 0 && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => setMostraDettaglioLezioniCorsoId(isMostraDettagli ? null : c.id)}
                          className="w-full p-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700 text-left text-xs flex items-center justify-between text-indigo-300 cursor-pointer"
                        >
                          <span className="font-bold flex items-center gap-1.5">
                            <span>📅 {numLezioni} Incontri in Sedi Diverse</span>
                          </span>
                          {isMostraDettagli ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isMostraDettagli && (
                          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1 animate-in fade-in">
                            {c.lezioni?.map((lez) => (
                              <div key={lez.id} className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-[10px] space-y-0.5">
                                <div className="flex items-center justify-between font-bold text-slate-200">
                                  <span>#{lez.numero} {lez.titolo || 'Lezione'}</span>
                                  <span className="text-amber-400 font-mono">{lez.ore}h</span>
                                </div>
                                <div className="text-slate-400 flex items-center justify-between text-[9.5px]">
                                  <span>📆 {lez.data} ({lez.orarioInizio}-{lez.orarioFine})</span>
                                </div>
                                <div className="text-emerald-300 text-[9.5px] truncate flex items-center gap-1">
                                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{lez.sedeNome}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setCorsoPerIscrizioni(c);
                        setSottoTab('iscritti');
                      }}
                      className="flex-1 py-1.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-md transition-colors cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Gestisci Iscritti ({c.iscritti.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => apriModificaCorso(c)}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                      title="Modifica Corso"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. SOTTO-TAB: ISCRITTI & REGISTRO PRESENZE                            */}
      {/* ===================================================================== */}
      {sottoTab === 'iscritti' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Gestione Iscrizioni & Registro Presenze Corso</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Seleziona un corso per visualizzare i partecipanti, registrare le ore frequentate ed emettere il brevetto di idoneità.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-bold">Corso:</label>
              <select
                value={corsoPerIscrizioni?.id || ''}
                onChange={(e) => {
                  const sel = corsi.find((c) => c.id === e.target.value) || null;
                  setCorsoPerIscrizioni(sel);
                }}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-indigo-300 font-bold focus:outline-none"
              >
                <option value="">-- Seleziona un Corso --</option>
                {corsi.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codiceCorso} — {c.titolo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {corsoPerIscrizioni ? (
            <div className="space-y-4">
              {/* Box Info Corso & Form Aggiungi Iscritto */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-indigo-400 font-bold">{corsoPerIscrizioni.codiceCorso}</span>
                    {corsoPerIscrizioni.mansioneRilasciata && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-500/50 text-[10px] font-bold">
                        🎖️ Rilascia: {corsoPerIscrizioni.mansioneRilasciata}
                        {corsoPerIscrizioni.prevedeEsame && (
                          <span className="bg-amber-800/60 text-white px-1 py-0.2 rounded text-[9px] ml-1">Con Esame</span>
                        )}
                      </span>
                    )}
                    {corsoPerIscrizioni.mansionePrerequisito && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-950/70 text-rose-300 border border-rose-500/50 text-[10px] font-bold">
                        🔒 Prerequisito: {corsoPerIscrizioni.mansionePrerequisito}
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-black text-white mt-1">{corsoPerIscrizioni.titolo}</h4>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Docente: <strong className="text-slate-200">{corsoPerIscrizioni.docenteFormatore}</strong> • {corsoPerIscrizioni.oreTotali}h totali
                  </div>
                </div>

                <form onSubmit={handleIscriviVolontario} className="flex items-center gap-2 w-full lg:w-auto">
                  <select
                    required
                    value={volontarioDaIscrivereId}
                    onChange={(e) => setVolontarioDaIscrivereId(e.target.value)}
                    className="flex-1 lg:w-64 p-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    <option value="">-- Seleziona Volontario --</option>
                    {volontari
                      .filter((v) => !corsoPerIscrizioni.iscritti.some((i) => i.volontarioId === v.id))
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nome} {v.cognome} ({v.qualifica || 'Volontario'})
                        </option>
                      ))}
                  </select>
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase flex items-center gap-1.5 shrink-0 shadow-md active:scale-95 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Iscrivi al Corso</span>
                  </button>
                </form>
              </div>

              {/* Tabella Iscritti al Corso */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                        <th className="py-3 px-4">Volontario</th>
                        <th className="py-3 px-4">Qualifica</th>
                        <th className="py-3 px-4">Timbratura GPS (Entrata / Uscita)</th>
                        <th className="py-3 px-4">Ore Frequentate</th>
                        <th className="py-3 px-4">Esito Finale</th>
                        <th className="py-3 px-4">Attestato / Brevetto</th>
                        <th className="py-3 px-4 text-right">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {corsoPerIscrizioni.iscritti.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            Nessun volontario ancora iscritto a questo corso. Utilizza il selettore sopra per aggiungere iscritti.
                          </td>
                        </tr>
                      ) : (
                        corsoPerIscrizioni.iscritti.map((p) => {
                          const isIdoneo = p.esito === 'Idoneo / Superato';
                          const oreMinime = corsoPerIscrizioni.oreMinimeFrequenza || Math.round((corsoPerIscrizioni.oreTotali * (corsoPerIscrizioni.percentualeMinimaPresenza || 75)) / 100);
                          const raggiuntoMinimo = p.oreFrequentate >= oreMinime;
                          const percentualeEffettiva = Math.round((p.oreFrequentate / corsoPerIscrizioni.oreTotali) * 100);

                          return (
                            <tr key={p.volontarioId} className="hover:bg-slate-900/50 transition-colors">
                              <td className="py-3 px-4 font-bold text-white text-sm">
                                {p.volontarioNome}
                              </td>
                              <td className="py-3 px-4 text-slate-300">
                                {p.qualifica}
                              </td>

                              {/* Timbratura GPS Entrata / Uscita */}
                              <td className="py-3 px-4 text-[11px] font-mono">
                                {p.timbraturaEntrata || p.timbraturaUscita || (p.timbratureLezioni && p.timbratureLezioni.length > 0) ? (
                                  <div className="space-y-1">
                                    {p.timbraturaEntrata && (
                                      <div className="text-emerald-400 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                        <span>
                                          Entr: {typeof p.timbraturaEntrata === 'object'
                                            ? `${p.timbraturaEntrata.orario} (${p.timbraturaEntrata.distanzaMetri !== undefined ? `±${p.timbraturaEntrata.distanzaMetri}m` : 'GPS'})`
                                            : p.timbraturaEntrata}
                                        </span>
                                      </div>
                                    )}
                                    {p.timbraturaUscita ? (
                                      <div className="text-sky-400 flex items-center gap-1">
                                        <span>
                                          🏁 Usc: {typeof p.timbraturaUscita === 'object'
                                            ? `${p.timbraturaUscita.orario} (${p.timbraturaUscita.distanzaMetri !== undefined ? `±${p.timbraturaUscita.distanzaMetri}m` : 'GPS'})`
                                            : p.timbraturaUscita}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="text-amber-400 text-[10px] italic">
                                        In attesa timbratura uscita GPS
                                      </div>
                                    )}

                                    {p.oreEMinutiTesto && (
                                      <div className="text-amber-300 font-bold text-[10px] flex items-center gap-1 pt-0.5">
                                        ⏱️ Presenza calcolata: {p.oreEMinutiTesto}
                                      </div>
                                    )}

                                    {p.timbratureLezioni && p.timbratureLezioni.length > 0 && (
                                      <div className="pt-1 mt-1 border-t border-slate-800 text-[9.5px] space-y-0.5">
                                        <div className="text-slate-400 font-semibold">
                                          Incontri svolti ({p.timbratureLezioni.length}):
                                        </div>
                                        {p.timbratureLezioni.map((tl, i) => (
                                          <div key={i} className="flex items-center justify-between text-slate-400 font-mono gap-1">
                                            <span className="truncate">Lez #{tl.lezioneNumero}: {typeof tl.timbraturaEntrata === 'object' ? tl.timbraturaEntrata.orario : '✓'}➔{typeof tl.timbraturaUscita === 'object' ? tl.timbraturaUscita.orario : '...'}</span>
                                            <span className="text-emerald-400 font-bold shrink-0">{tl.oreEMinutiTesto || `${tl.oreFrequentate}h`}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-500 italic">Nessuna timbratura GPS</span>
                                )}
                              </td>

                              {/* Ore Frequentate (aggiornate via GPS o modificabili manualmente dall'operatore autorizzato) */}
                              <td className="py-3 px-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      max={corsoPerIscrizioni.oreTotali}
                                      value={p.oreFrequentate}
                                      onChange={(e) =>
                                        handleAggiornaEsito(
                                          corsoPerIscrizioni.id,
                                          p.volontarioId,
                                          p.esito,
                                          Number(e.target.value)
                                        )
                                      }
                                      className="w-16 p-1 rounded bg-slate-900 border border-slate-700 text-white font-mono text-center font-bold"
                                      title="Ore frequentate: aggiornate da timbratura GPS o inseribili manualmente"
                                    />
                                    <span className="text-slate-400 text-xs font-mono">/ {corsoPerIscrizioni.oreTotali}h</span>
                                    {p.oreEMinutiTesto && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono text-[9.5px] font-bold">
                                        {p.oreEMinutiTesto}
                                      </span>
                                    )}
                                  </div>

                                  <div>
                                    {raggiuntoMinimo ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9.5px] font-bold">
                                        ✓ Minimo {corsoPerIscrizioni.percentualeMinimaPresenza || 75}% ({percentualeEffettiva}%)
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9.5px] font-bold">
                                        Mancano {Math.max(0, oreMinime - p.oreFrequentate)}h ({percentualeEffettiva}%)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <select
                                  value={p.esito}
                                  onChange={(e) =>
                                    handleAggiornaEsito(
                                      corsoPerIscrizioni.id,
                                      p.volontarioId,
                                      e.target.value as any,
                                      p.oreFrequentate
                                    )
                                  }
                                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                    isIdoneo
                                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                                      : p.esito === 'Non Idoneo'
                                      ? 'bg-red-950 text-red-300 border-red-800'
                                      : 'bg-slate-900 text-slate-300 border-slate-700'
                                  }`}
                                >
                                  <option value="Iscritto">Iscritto</option>
                                  <option value="In Frequenza">In Frequenza</option>
                                  <option value="Idoneo / Superato">Idoneo / Superato</option>
                                  <option value="Non Idoneo">Non Idoneo</option>
                                  <option value="Ritirato">Ritirato</option>
                                </select>
                                {corsoPerIscrizioni.mansioneRilasciata && (
                                  <div className="mt-1">
                                    {isIdoneo ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-bold">
                                        🎖️ {corsoPerIscrizioni.mansioneRilasciata} (Acquisita)
                                      </span>
                                    ) : (
                                      <span className="text-[9.5px] text-amber-300/80 block">
                                        Riconosce: {corsoPerIscrizioni.mansioneRilasciata} {corsoPerIscrizioni.prevedeEsame ? '(esame)' : ''}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 font-mono">
                                {p.numeroAttestato ? (
                                  <div>
                                    <span className={`font-bold inline-block ${
                                      p.numeroAttestato.startsWith('GEV-')
                                        ? 'text-emerald-400 bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-600/50'
                                        : 'text-amber-400'
                                    }`}>
                                      {p.numeroAttestato}
                                    </span>
                                    {p.scadenzaBrevetto && (
                                      <div className="text-[10px] text-slate-400">Scad: {p.scadenzaBrevetto}</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isIdoneo ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={operazioneAttestatoInCorso}
                                        onClick={() => handleScaricaAttestato(corsoPerIscrizioni, p)}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 disabled:opacity-50 text-emerald-300 border border-emerald-600/50 font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                                        title={corsoPerIscrizioni.tipologia === 'Seminario PSV' ? 'Scarica Attestato Ufficiale GEV (PDF)' : 'Scarica Attestato Ufficiale PDF'}
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>Scarica PDF</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setAttestatoPerStampa({ corso: corsoPerIscrizioni, partecipante: p })}
                                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                                        title="Anteprima Scheda Attestato"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Anteprima</span>
                                      </button>
                                    </>
                                  ) : (
                                    (corsoPerIscrizioni.tipologia === 'Seminario PSV' || corsoPerIscrizioni.tipologia === 'Seminario Autisti') && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleAggiornaEsito(
                                            corsoPerIscrizioni.id,
                                            p.volontarioId,
                                            'Idoneo / Superato',
                                            p.oreFrequentate || corsoPerIscrizioni.oreTotali
                                          )
                                        }
                                        className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm cursor-pointer"
                                        title="Rilascia Attestato di Partecipazione Ufficiale"
                                      >
                                        <Award className="w-3.5 h-3.5" />
                                        <span>Rilascia Attestato</span>
                                      </button>
                                    )
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-950 p-8 rounded-2xl border border-slate-800 text-center text-slate-400">
              Seleziona un corso dal menu a tendina sopra per visualizzare o inserire gli iscritti.
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. SOTTO-TAB: SCADENZIARIO BREVETTI & ABILITAZIONI                    */}
      {/* ===================================================================== */}
      {sottoTab === 'scadenziario' && (
        <div className="space-y-4">
          {/* Header e Banner Avviso Automatico Scadenze Attestati & Brevetti (30gg e 15gg) */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Scadenziario Brevetti & Retraining Obbligatorio</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitora la validità dei brevetti formativi (BLSD biennale, Guida Sicura, Protezione Civile, Soccorso Veterinario). Notifiche automatiche a <strong>30 giorni</strong> e <strong>15 giorni</strong> prima della data limite.
              </p>
            </div>

            <button
              type="button"
              disabled={invioEmailAttestatiInCorso || attestatiInScadenza30Gg.length === 0}
              onClick={async () => {
                await inviaEmailScadenzeAttestatiAutomatico(
                  attestatiInScadenza30Gg,
                  `Invio manuale riepilogo scadenziario attestati e brevetti (${attestatiInScadenza30Gg.length} nominativi)`,
                  true
                );
                mostraAvviso(`✓ Notifica scadenze inviata con successo a formazione@croceoro.oeg e presidenza@croceoro.org (${attestatiInScadenza30Gg.length} brevetti).`);
              }}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-black text-xs uppercase flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{invioEmailAttestatiInCorso ? 'Invio in corso...' : 'Invia Email Scadenziario (formazione@ & presidenza@)'}</span>
            </button>
          </div>

          {/* Banner Stato Notifiche Email */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 text-slate-200 font-bold">
              <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Destinatari Notifiche Scadenza (Preavviso 30gg e 15gg prima):</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 border border-indigo-700/60 text-indigo-300 font-mono text-[11px] font-bold">
                Ufficio Formazione: formazione@croceoro.oeg
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-950 border border-purple-700/60 text-purple-300 font-mono text-[11px] font-bold">
                Presidenza: presidenza@croceoro.org
              </span>
              {attestatiUrgenti15Gg.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[10px] font-bold animate-pulse">
                  {attestatiUrgenti15Gg.length} urgenti (≤ 15 gg o scaduti)
                </span>
              )}
            </div>
          </div>

          {/* Tabella Elenco Brevetti e Stato Preavviso */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                    <th className="py-3 px-4">Volontario</th>
                    <th className="py-3 px-4">Brevetto / Abilitazione</th>
                    <th className="py-3 px-4">Numero Attestato</th>
                    <th className="py-3 px-4 font-mono">Data Conseguimento</th>
                    <th className="py-3 px-4 font-mono">Data Scadenza</th>
                    <th className="py-3 px-4">Stato Preavviso / Validità</th>
                    <th className="py-3 px-4 text-right">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tuttiGliAttestati.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        Nessun attestato ancora rilasciato nel registro corsi.
                      </td>
                    </tr>
                  ) : (
                    tuttiGliAttestati.map(({ corso, partecipante }) => {
                      const oggiMs = Date.now();
                      const msGiorno = 1000 * 60 * 60 * 24;
                      const hasScadenza = Boolean(partecipante.scadenzaBrevetto);
                      const scadMs = hasScadenza ? new Date(partecipante.scadenzaBrevetto!).getTime() : null;
                      const diffGg = scadMs ? Math.ceil((scadMs - oggiMs) / msGiorno) : null;

                      let scaglione: '30_giorni' | '15_giorni' | 'scaduto' | 'regolare' = 'regolare';
                      if (diffGg !== null) {
                        if (diffGg <= 0) scaglione = 'scaduto';
                        else if (diffGg <= 15) scaglione = '15_giorni';
                        else if (diffGg <= 30) scaglione = '30_giorni';
                      }

                      return (
                        <tr key={`${corso.id}-${partecipante.volontarioId}`} className="hover:bg-slate-900/50 transition-colors">
                          <td className="py-3 px-4 font-bold text-white text-sm">
                            {partecipante.volontarioNome}
                            {partecipante.qualifica && (
                              <div className="text-[10px] text-slate-400 font-normal">{partecipante.qualifica}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            <div className="font-bold">{corso.titolo}</div>
                            <div className="text-[10px] text-indigo-400 font-mono">{corso.tipologia}</div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-amber-400">
                            {partecipante.numeroAttestato || '-'}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {partecipante.dataRilascioAttestato || '-'}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-white">
                            {partecipante.scadenzaBrevetto || 'Permanente'}
                          </td>
                          <td className="py-3 px-4">
                            {scaglione === 'scaduto' ? (
                              <span className="px-2.5 py-1 rounded-full bg-red-950 text-red-300 border border-red-700 text-[10px] font-black flex items-center gap-1 w-fit">
                                <AlertTriangle className="w-3 h-3 text-red-400" />
                                Scaduto ({Math.abs(diffGg!)} gg fa)
                              </span>
                            ) : scaglione === '15_giorni' ? (
                              <span className="px-2.5 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-600 text-[10px] font-black flex items-center gap-1 w-fit animate-pulse">
                                <Clock className="w-3 h-3 text-amber-400" />
                                Preavviso 15 gg ({diffGg} gg rimasti)
                              </span>
                            ) : scaglione === '30_giorni' ? (
                              <span className="px-2.5 py-1 rounded-full bg-blue-950 text-blue-300 border border-blue-600 text-[10px] font-black flex items-center gap-1 w-fit">
                                <Clock className="w-3 h-3 text-blue-400" />
                                Preavviso 30 gg ({diffGg} gg rimasti)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-[10px] font-bold flex items-center gap-1 w-fit">
                                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                                In Corso di Validità
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {hasScadenza && (
                                <button
                                  type="button"
                                  disabled={invioEmailAttestatiInCorso}
                                  onClick={async () => {
                                    await inviaEmailScadenzeAttestatiAutomatico(
                                      [{
                                        corso,
                                        partecipante,
                                        scadenzaBrevetto: partecipante.scadenzaBrevetto!,
                                        giorniRimanenti: diffGg || 0,
                                        scaglione: scaglione === 'regolare' ? '30_giorni' : scaglione
                                      }],
                                      `Avviso scadenza attestato per ${partecipante.volontarioNome}`,
                                      true
                                    );
                                    mostraAvviso(`✓ Notifica inviata a formazione@croceoro.oeg e presidenza@croceoro.org per ${partecipante.volontarioNome}.`);
                                  }}
                                  className="px-2 py-1 rounded-lg bg-indigo-950 hover:bg-indigo-900 disabled:opacity-50 text-indigo-300 border border-indigo-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  title="Invia email di avviso scadenza a formazione@croceoro.oeg e presidenza@croceoro.org"
                                >
                                  <Mail className="w-3 h-3 text-indigo-400" />
                                  <span>Invia Email</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setAttestatoPerStampa({ corso, partecipante })}
                                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
                                title="Visualizza Scheda / Scarica PDF"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODALE NUOVO / MODIFICA CORSO */}
      {modaleCorsoAperta && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-indigo-500/50 rounded-3xl max-w-2xl w-full p-5 shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-black text-white uppercase">
                  {corsoInModifica ? `Modifica Corso: ${corsoInModifica.codiceCorso}` : 'Programma Nuovo Corso Formativo'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleCorsoAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvaCorso} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Codice Corso</label>
                  <input
                    type="text"
                    required
                    value={formCodice}
                    onChange={(e) => setFormCodice(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-indigo-400 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tipologia Corso *</label>
                  <select
                    value={formTipologia}
                    onChange={(e) => {
                      const val = e.target.value as TipologiaCorso;
                      setFormTipologia(val);
                      if (val === 'Seminario PSV') {
                        setFormTitolo('TUTELA, SOCCORSO E BENESSERE ANIMALE');
                        setFormSottotitolo('“Dal Soccorso alla tutela degli animali”');
                      }
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  >
                    {TIPOLOGIE_CORSO_CONSENTITE.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Titolo del Percorso Formativo *</label>
                  <input
                    type="text"
                    required
                    value={formTitolo}
                    onChange={(e) => setFormTitolo(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                    placeholder="es. TUTELA, SOCCORSO E BENESSERE ANIMALE"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Sottotitolo Ufficiale</label>
                  <input
                    type="text"
                    value={formSottotitolo}
                    onChange={(e) => setFormSottotitolo(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-semibold"
                    placeholder="es. “Dal Soccorso alla tutela degli animali”"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Descrizione & Programma Formativo</label>
                <textarea
                  rows={2}
                  required
                  value={formDescrizione}
                  onChange={(e) => setFormDescrizione(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  placeholder="Dettagli didattici e argomenti trattati..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Docente / Formatore Accreditato</label>
                  <input
                    type="text"
                    required
                    value={formDocente}
                    onChange={(e) => setFormDocente(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                    placeholder="es. Dott.ssa Valentina Moriconi (Formatore IRC)"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Ente Accreditato / Riconoscimento</label>
                  <input
                    type="text"
                    required
                    value={formEnte}
                    onChange={(e) => setFormEnte(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>

              {/* MANSIONI OPERATIVE & ESAMI FINALI COLLEGATI AL CORSO */}
              <div className="p-3.5 rounded-2xl bg-amber-950/30 border-2 border-amber-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    <span className="font-black text-xs uppercase text-amber-200">
                      Riconoscimento Mansioni & Esame Finale (Database Mansioni)
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-300 font-semibold bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    Assegnazione Automatica
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Mansione Rilasciata al Superamento */}
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      🎖️ Mansione Acquisita al Superamento del Corso
                    </label>
                    <select
                      value={formMansioneRilasciata}
                      onChange={(e) => setFormMansioneRilasciata(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-300 font-bold"
                    >
                      <option value="">-- Nessuna mansione rilasciata in automatico --</option>
                      {getMansioniCatalogo().map((m) => (
                        <option key={m.id} value={m.nome}>
                          {m.badgeEmoji || '🎖️'} {m.nome} ({m.categoria})
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Viene assegnata in automatico all'anagrafica del volontario quando il corso/esame risulta superato.
                    </span>
                  </div>

                  {/* Mansione Prerequisito Obbligatoria per Iscrizione */}
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      🔒 Mansione Prerequisito Obbligatoria per Accedere
                    </label>
                    <select
                      value={formMansionePrerequisito}
                      onChange={(e) => setFormMansionePrerequisito(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-rose-300 font-bold"
                    >
                      <option value="">-- Nessun prerequisito (Aperto a tutti i volontari) --</option>
                      {getMansioniCatalogo().map((m) => (
                        <option key={m.id} value={m.nome}>
                          {m.badgeEmoji || '🔒'} {m.nome}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Il volontario deve possedere questa mansione (o una superiore che la include) per potersi iscrivere.
                    </span>
                  </div>
                </div>

                {/* Checkbox Prevede Esame Finale */}
                <div className="pt-1 border-t border-amber-900/40">
                  <label className="flex items-center gap-2.5 cursor-pointer text-slate-200">
                    <input
                      type="checkbox"
                      checked={formPrevedeEsame}
                      onChange={(e) => setFormPrevedeEsame(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 bg-slate-900 border-slate-700"
                    />
                    <span className="text-xs font-bold text-white">
                      Questo corso prevede un <u>esame finale di valutazione</u> obbligatorio per conseguire la mansione
                    </span>
                  </label>
                  <span className="text-[10.5px] text-slate-400 block ml-6">
                    Se selezionato, la mansione viene rilasciata solo previo superamento dell'esame abilitante.
                  </span>
                </div>
              </div>

              {/* SELEZIONE DESTINATARI DEL CORSO PER SEZIONI OPERATIVE (NO SINGOLI NOMI) */}
              <div className="p-3.5 rounded-2xl bg-indigo-950/40 border-2 border-indigo-500/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-400" />
                    <span className="font-black text-xs uppercase text-indigo-200">
                      Destinatari del Corso per Sezione Territoriale *
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full">
                    Visibili solo le sezioni, non i singoli nomi
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Seleziona le sezioni operative destinatarie: tutti i volontari assegnati alle sezioni scelte visualizzeranno la comunicazione al login e potranno iscriversi.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {/* Opzione TUTTE LE SEZIONI */}
                  <div
                    onClick={() => {
                      if (formSezioniDestinatarieIds.includes('TUTTE')) {
                        setFormSezioniDestinatarieIds([]);
                      } else {
                        setFormSezioniDestinatarieIds(['TUTTE', ...SEDI_TERRITORIALI_GPS.map(s => s.id)]);
                      }
                    }}
                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                      formSezioniDestinatarieIds.includes('TUTTE')
                        ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-sm font-bold'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🏢</span>
                      <span className="text-xs">TUTTE le Sezioni dell'Associazione</span>
                    </div>
                    {formSezioniDestinatarieIds.includes('TUTTE') ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600 shrink-0" />
                    )}
                  </div>

                  {/* Singole Sezioni */}
                  {SEDI_TERRITORIALI_GPS.map((s) => {
                    const isSelezionata = formSezioniDestinatarieIds.includes(s.id) || formSezioniDestinatarieIds.includes('TUTTE');
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          let nuove: string[];
                          if (formSezioniDestinatarieIds.includes('TUTTE')) {
                            // Se era selezionato TUTTE, rimuoviamo TUTTE e lasciamo le altre tranne questa
                            nuove = SEDI_TERRITORIALI_GPS.map(item => item.id).filter(id => id !== s.id);
                          } else if (formSezioniDestinatarieIds.includes(s.id)) {
                            nuove = formSezioniDestinatarieIds.filter(id => id !== s.id);
                          } else {
                            nuove = [...formSezioniDestinatarieIds, s.id];
                            if (nuove.length === SEDI_TERRITORIALI_GPS.length) {
                              nuove = ['TUTTE', ...nuove];
                            }
                          }
                          setFormSezioniDestinatarieIds(nuove);
                        }}
                        className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isSelezionata
                            ? 'bg-indigo-950/60 border-indigo-400 text-white font-bold'
                            : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="text-xs truncate">{s.nome}</span>
                        </div>
                        {isSelezionata ? (
                          <CheckSquare className="w-4 h-4 text-indigo-400 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SEDE DI SVOLGIMENTO & GEOLOCALIZZAZIONE GPS PER TIMBRATURA */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-rose-400" />
                    <span className="font-bold text-xs uppercase text-white">
                      Sede di Svolgimento & Coordinate GPS per Timbratura *
                    </span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">
                    GPS: {formCoordinate.lat.toFixed(4)}, {formCoordinate.lng.toFixed(4)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Seleziona Sede / Sezione</label>
                    <select
                      value={formSedeTipo}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormSedeTipo(val);
                        if (val !== 'ALTRO') {
                          const s = SEDI_TERRITORIALI_GPS.find(item => item.id === val);
                          if (s) {
                            setFormSede(s.nome);
                            setFormCoordinate({ lat: s.lat, lng: s.lng });
                          }
                        }
                      }}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-bold text-xs focus:ring-1 focus:ring-indigo-500"
                    >
                      {SEDI_TERRITORIALI_GPS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome} ({s.indirizzo})
                        </option>
                      ))}
                      <option value="ALTRO">📍 ALTRO (Sede esterna con indirizzo manuale e mappa)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Stato Corso</label>
                    <select
                      value={formStato}
                      onChange={(e) => setFormStato(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs"
                    >
                      <option value="Programmato">Programmato</option>
                      <option value="In Corso">In Corso</option>
                      <option value="Concluso">Concluso</option>
                      <option value="Annullato">Annullato</option>
                    </select>
                  </div>
                </div>

                {/* Se ALTRO: Inserimento manuale di nome, indirizzo completo e cartina interattiva per regolazione pin */}
                {formSedeTipo === 'ALTRO' && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/40 space-y-3 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Nome Posizione / Struttura Esterna *</label>
                        <input
                          type="text"
                          required
                          value={formNomePosizioneAltro}
                          onChange={(e) => setFormNomePosizioneAltro(e.target.value)}
                          placeholder="es. Ospedale delle Apuane (NOA) — Polo Didattico"
                          className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Indirizzo Completo *</label>
                        <input
                          type="text"
                          required
                          value={formIndirizzoAltro}
                          onChange={(e) => setFormIndirizzoAltro(e.target.value)}
                          placeholder="es. Via Enrico Mattei 1, 54100 Massa (MS)"
                          className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs"
                        />
                      </div>
                    </div>

                    {/* Cartina Interattiva con Pin Regolabile Senza Modificare l'Indirizzo */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                          <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                          <span>Cartina Regolazione Pin GPS (Non modifica l'indirizzo scritto)</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Clicca sulla mappa o usa i tasti micro-regolazione
                        </span>
                      </div>

                      {/* Canvas Mappa Interattiva */}
                      <div
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = (e.clientX - rect.left) / rect.width;
                          const y = (e.clientY - rect.top) / rect.height;
                          // Regola leggermente latitudine e longitudine
                          const newLat = 44.000 + (1 - y) * 0.100;
                          const newLng = 10.050 + x * 0.150;
                          setFormCoordinate({ lat: Number(newLat.toFixed(5)), lng: Number(newLng.toFixed(5)) });
                        }}
                        className="relative w-full h-36 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden cursor-crosshair select-none shadow-inner"
                        style={{
                          backgroundImage: `radial-gradient(circle at center, #1e293b 1px, transparent 1px), linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)`,
                          backgroundSize: '20px 20px'
                        }}
                      >
                        {/* Strade e griglia schematica */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                          <div className="w-full h-1 bg-amber-500/40 rotate-12 absolute" />
                          <div className="h-full w-1 bg-sky-500/40 -rotate-12 absolute" />
                          <div className="w-3/4 h-3/4 rounded-full border border-dashed border-slate-600 absolute" />
                        </div>

                        {/* Pin Mappa Posizionato */}
                        <div
                          className="absolute transform -translate-x-1/2 -translate-y-full transition-all pointer-events-none"
                          style={{
                            left: `${Math.max(10, Math.min(90, ((formCoordinate.lng - 10.050) / 0.150) * 100))}%`,
                            top: `${Math.max(15, Math.min(85, (1 - ((formCoordinate.lat - 44.000) / 0.100)) * 100))}%`
                          }}
                        >
                          <div className="flex flex-col items-center">
                            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[9px] shadow whitespace-nowrap mb-0.5">
                              {formNomePosizioneAltro || 'Sede Corso'}
                            </span>
                            <MapPin className="w-7 h-7 text-red-500 fill-red-500 filter drop-shadow-md animate-bounce" />
                          </div>
                        </div>

                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-slate-950/80 rounded border border-slate-800 text-[10px] text-slate-300 font-mono">
                          Lat: {formCoordinate.lat.toFixed(5)} • Lng: {formCoordinate.lng.toFixed(5)}
                        </div>
                      </div>

                      {/* Tasti Micro-Regolazione Fine del Pin */}
                      <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Micro-Spostamento Pin:</span>
                        <div className="flex items-center gap-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setFormCoordinate(prev => ({ ...prev, lat: Number((prev.lat + 0.001).toFixed(5)) }))}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                            title="Sposta Pin verso Nord"
                          >
                            Nord ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormCoordinate(prev => ({ ...prev, lat: Number((prev.lat - 0.001).toFixed(5)) }))}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                            title="Sposta Pin verso Sud"
                          >
                            Sud ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormCoordinate(prev => ({ ...prev, lng: Number((prev.lng - 0.001).toFixed(5)) }))}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                            title="Sposta Pin verso Ovest"
                          >
                            Ovest ←
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormCoordinate(prev => ({ ...prev, lng: Number((prev.lng + 0.001).toFixed(5)) }))}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                            title="Sposta Pin verso Est"
                          >
                            Est →
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* DATE, ORARI LEZIONE E PERCENTUALE MINIMA DI FREQUENZA */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Data Inizio *</label>
                    <input
                      type="date"
                      required
                      value={formDataInizio}
                      onChange={(e) => setFormDataInizio(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Data Fine *</label>
                    <input
                      type="date"
                      required
                      value={formDataFine}
                      onChange={(e) => setFormDataFine(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Orario Inizio *</label>
                    <input
                      type="time"
                      required
                      value={formOrarioInizioLezione}
                      onChange={(e) => setFormOrarioInizioLezione(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Orario Fine *</label>
                    <input
                      type="time"
                      required
                      value={formOrarioFineLezione}
                      onChange={(e) => setFormOrarioFineLezione(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Ore Totali del Corso *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formOreTotali}
                      onChange={(e) => setFormOreTotali(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">
                      Minimo Presenza Obbligatoria (%) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        required
                        value={formPercentualeMinima}
                        onChange={(e) => setFormPercentualeMinima(Number(e.target.value))}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-amber-500/50 text-amber-300 font-mono font-bold"
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">%</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-medium block mt-1">
                      Equivalente a: <strong>{Math.round((Number(formOreTotali) * Number(formPercentualeMinima)) / 100)} ore minime</strong>
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Max Partecipanti *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formMaxPartecipanti}
                      onChange={(e) => setFormMaxPartecipanti(Number(e.target.value))}
                      className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* PROGRAMMA LEZIONI / INCONTRI (FINO A 20 INCONTRI IN SEDI E ORARI DIVERSI) */}
              <div className="p-4 rounded-2xl bg-indigo-950/30 border-2 border-indigo-500/40 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      <span className="font-black text-xs uppercase text-white">
                        Programma Incontri & Lezioni Formative ({formLezioni.length} / 20)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Il corso può prevedere fino a 20 lezioni in giorni, orari e sedi diverse. La presenza dei volontari verrà timbrata via GPS nella sede specifica di ciascuna lezione.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={formLezioni.length >= 20}
                    onClick={() => {
                      if (formLezioni.length >= 20) return;
                      const num = formLezioni.length + 1;
                      const primaSede = SEDI_TERRITORIALI_GPS[(num - 1) % SEDI_TERRITORIALI_GPS.length];
                      const nuovaLezione: LezioneCorso = {
                        id: `lez-${Date.now()}-${num}`,
                        numero: num,
                        titolo: `Incontro ${num}`,
                        data: formDataInizio,
                        orarioInizio: formOrarioInizioLezione || '09:00',
                        orarioFine: formOrarioFineLezione || '13:00',
                        ore: 4,
                        sedeNome: primaSede.nome,
                        indirizzoCompleto: primaSede.indirizzo,
                        coordinate: { lat: primaSede.lat, lng: primaSede.lng },
                        docente: formDocente || 'Docente Formatore'
                      };
                      const agg = [...formLezioni, nuovaLezione];
                      setFormLezioni(agg);
                      const somma = agg.reduce((s, l) => s + (Number(l.ore) || 0), 0);
                      if (somma > 0) setFormOreTotali(somma);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs uppercase flex items-center gap-1.5 transition-all ${
                      formLezioni.length >= 20
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md cursor-pointer active:scale-95'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Aggiungi Incontro / Lezione (Max 20)</span>
                  </button>
                </div>

                {/* Lista Lezioni */}
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {formLezioni.length === 0 ? (
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
                      Nessun singolo incontro impostato. Clicca sul pulsante sopra per aggiungere fino a 20 lezioni in sedi e orari diversi.
                    </div>
                  ) : (
                    formLezioni.map((lez, idx) => (
                      <div key={lez.id || idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                          <span className="font-black text-amber-400">
                            Lezione #{idx + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-emerald-400 font-mono">
                              GPS: {lez.coordinate?.lat?.toFixed(4)}, {lez.coordinate?.lng?.toFixed(4)}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const agg = formLezioni.filter((_, i) => i !== idx).map((item, i) => ({ ...item, numero: i + 1 }));
                                setFormLezioni(agg);
                                const somma = agg.reduce((s, l) => s + (Number(l.ore) || 0), 0);
                                if (somma > 0) setFormOreTotali(somma);
                              }}
                              className="p-1 rounded bg-slate-800 hover:bg-red-900 text-slate-400 hover:text-white"
                              title="Rimuovi lezione"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Argomento / Titolo Lezione</label>
                            <input
                              type="text"
                              value={lez.titolo || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormLezioni(prev => prev.map((item, i) => i === idx ? { ...item, titolo: val } : item));
                              }}
                              className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                              placeholder={`Argomento lezione ${idx + 1}`}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Docente</label>
                            <input
                              type="text"
                              value={lez.docente || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormLezioni(prev => prev.map((item, i) => i === idx ? { ...item, docente: val } : item));
                              }}
                              className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                              placeholder="Docente"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Data Lezione</label>
                            <input
                              type="date"
                              value={lez.data}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormLezioni(prev => prev.map((item, i) => i === idx ? { ...item, data: val } : item));
                              }}
                              className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Orario Inizio</label>
                            <input
                              type="time"
                              value={lez.orarioInizio}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormLezioni(prev => prev.map((item, i) => i === idx ? { ...item, orarioInizio: val } : item));
                              }}
                              className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-300 font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Orario Fine</label>
                            <input
                              type="time"
                              value={lez.orarioFine}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormLezioni(prev => prev.map((item, i) => i === idx ? { ...item, orarioFine: val } : item));
                              }}
                              className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-300 font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-400 font-bold mb-0.5">Ore Durata</label>
                            <input
                              type="number"
                              min="0.5"
                              step="0.5"
                              value={lez.ore}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                setFormLezioni(prev => {
                                  const agg = prev.map((item, i) => i === idx ? { ...item, ore: val } : item);
                                  const somma = agg.reduce((s, l) => s + (Number(l.ore) || 0), 0);
                                  if (somma > 0) setFormOreTotali(somma);
                                  return agg;
                                });
                              }}
                              className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-emerald-400 font-mono text-xs font-bold"
                            />
                          </div>
                        </div>

                        {/* Sede specifica per questa lezione con coordinate GPS per timbratura */}
                        <div>
                          <label className="block text-[10px] text-slate-400 font-bold mb-0.5">
                            📍 Sede di Svolgimento di QUESTA Lezione (Punto GPS per Timbratura Volontari)
                          </label>
                          <select
                            value={lez.sedeNome}
                            onChange={(e) => {
                              const sel = SEDI_TERRITORIALI_GPS.find(s => s.nome === e.target.value);
                              if (sel) {
                                setFormLezioni(prev => prev.map((item, i) => i === idx ? {
                                  ...item,
                                  sedeNome: sel.nome,
                                  indirizzoCompleto: sel.indirizzo,
                                  coordinate: { lat: sel.lat, lng: sel.lng }
                                } : item));
                              }
                            }}
                            className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-amber-200 text-xs font-bold"
                          >
                            {SEDI_TERRITORIALI_GPS.map((s) => (
                              <option key={s.id} value={s.nome}>
                                {s.nome} ({s.indirizzo})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleCorsoAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Salva Corso Formativo</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE ANTEPRIMA & STAMPA ATTESTATO UFFICIALE */}
      {attestatoPerStampa && (() => {
        const isPSV = attestatoPerStampa.corso.tipologia === 'Seminario PSV';
        const isSeminario = attestatoPerStampa.corso.tipologia.toLowerCase().includes('seminario');
        const cittaPrevalente = determinaCittaPrevalenteCorso(attestatoPerStampa.corso);
        const intervalloDate = formattaIntervalloDateItaliano(attestatoPerStampa.corso.dataInizio, attestatoPerStampa.corso.dataFine);
        const dataStampa = formattaDataSlash(attestatoPerStampa.partecipante.dataRilascioAttestato || formatISODateItaly());

        let numAttestato = (attestatoPerStampa.partecipante.numeroAttestato || '').trim();
        if (isPSV) {
          if (!numAttestato) numAttestato = 'GEV 099';
          if (!numAttestato.toUpperCase().startsWith('GEV')) {
            numAttestato = `GEV ${numAttestato}`;
          }
          numAttestato = numAttestato.replace(/GEV[-_ ]+/i, 'GEV ');
        } else if (!numAttestato) {
          numAttestato = generaNumeroAttestato(attestatoPerStampa.corso.tipologia);
        }

        const titoloMostrato = isPSV
          ? 'TUTELA, SOCCORSO E BENESSERE ANIMALE'
          : (attestatoPerStampa.corso.titolo || attestatoPerStampa.corso.tipologia || 'CORSO DI FORMAZIONE').toUpperCase();

        const sottotitoloMostrato = isPSV
          ? '“Dal Soccorso alla tutela degli animali”'
          : (attestatoPerStampa.corso.sottotitolo || '');

        return (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
            <div className="bg-white text-slate-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 border-4 border-[#bfa353] max-h-[92vh] overflow-y-auto">
              <div className="text-center space-y-1">
                <div className="text-xs font-black uppercase text-slate-500 tracking-wider">
                  Croce Oro Massa Carrara OdV • Layout Regionale A4 Ufficiale
                </div>
                <h2 className="text-xl font-black text-[#1d1a60] uppercase">
                  Attestato di Partecipazione
                </h2>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-300">
                    {isPSV ? 'Matricola Ufficiale GEV:' : 'Matricola / Protocollo:'} <strong>{numAttestato}</strong>
                  </span>
                </div>
              </div>

              {/* ANTEPRIMA FEDELE AL MODELLO UFFICIALE REGIONALE (TUTTI I CORSI) */}
              <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-200 text-center space-y-3.5">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  {isSeminario ? 'Seminario Formativo Regionale:' : 'Corso Formativo Regionale:'}
                </div>
                <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 space-y-0.5">
                  <div className="text-lg font-black text-[#1d1a60] uppercase tracking-wide">
                    {titoloMostrato}
                  </div>
                  {sottotitoloMostrato && (
                    <div className="text-xs font-semibold text-amber-800 italic">
                      {sottotitoloMostrato}
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-600 pt-1">
                  {isSeminario ? 'Ha frequentato con assiduità il Seminario:' : 'Ha frequentato con assiduità il Corso Formativo:'}
                </div>
                <div className="text-2xl font-black text-[#1d1a60] tracking-wide pb-1 border-b-2 border-slate-900 mx-6">
                  {(attestatoPerStampa.partecipante.volontarioNome || 'PARTECIPANTE').toUpperCase()}
                </div>

                <div className="text-xs text-slate-700 leading-relaxed font-semibold pt-1">
                  Organizzato da <strong>Croce Oro Massa Carrara OdV</strong> presso la sede operativa di{' '}
                  <strong className="text-indigo-900 underline">{cittaPrevalente}</strong> {intervalloDate}.
                </div>

                <div className="flex items-center justify-between text-xs pt-3 px-2 border-t border-slate-200 text-slate-600">
                  <div className="text-left font-mono">
                    <div>
                      <span>Matricola: </span>
                      <strong className="text-indigo-950 font-bold">{numAttestato}</strong>
                    </div>
                    <div>
                      <span>Rilascio: </span>
                      <strong className="text-slate-800">{cittaPrevalente}, lì {dataStampa}</strong>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Il Presidente Croce Oro Massa Carrara</div>
                    <div className="font-bold text-slate-900">Claudio Simonini</div>
                    <span className="text-[10px] text-emerald-600 font-mono">✓ Firma Digitale Autografa Apposta</span>
                  </div>
                </div>
              </div>

              {/* AZIONI DI STAMPA E DOWNLOAD */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAttestatoPerStampa(null)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                >
                  Chiudi Scheda
                </button>

                <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                  {typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function' && (
                    <button
                      type="button"
                      disabled={operazioneAttestatoInCorso}
                      onClick={() => handleCondividiAttestato(attestatoPerStampa.corso, attestatoPerStampa.partecipante)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer transition-all"
                      title="Salva in File / Invia su WhatsApp o Drive"
                    >
                      <Share2 className="w-4 h-4 text-emerald-200" />
                      <span>Condividi / Salva App</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={operazioneAttestatoInCorso}
                    onClick={() => handleScaricaAttestato(attestatoPerStampa.corso, attestatoPerStampa.partecipante)}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#1d1a60] hover:bg-[#2b2787] disabled:opacity-50 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer transition-all"
                  >
                    {operazioneAttestatoInCorso ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                    ) : (
                      <Download className="w-4 h-4 text-amber-300" />
                    )}
                    <span>Scarica PDF</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
