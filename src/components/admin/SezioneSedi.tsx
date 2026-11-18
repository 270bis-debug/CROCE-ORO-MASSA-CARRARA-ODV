import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  Search,
  PlusCircle,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  Car,
  ShieldCheck,
  Edit2,
  Trash2,
  Save,
  X,
  Check,
  ExternalLink,
  Navigation,
  Sparkles,
  Layers,
  CheckCircle2,
  FileText,
  Globe,
  Building,
  RotateCcw,
  Printer,
  Info,
  Shield,
  CreditCard,
  Copy,
  Landmark,
  CheckCheck,
  Share2
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { SedeAssociativaCompleta, MezzoFlotta, ContoCorrenteSede } from '../../types/adminTypes';
import { CONTI_CORRENTI_CROCE_ORO_DEFAULT } from '../../data/adminMockData';
import { GeolocalizzazioneMappaSede } from './GeolocalizzazioneMappaSede';
import { inviaNotificaModificaAdmin } from '../../utils/notificaModificaAdmin';
import { realtime } from '../../services/realtime';
import { useTitoloDatabase } from '../../hooks/useNomiDatabase';
import {
  DatiCartaIntestata,
  getDatiCartaIntestata,
  aggiornaCacheLocaleCartaIntestata,
  formattaSocialCartaIntestata,
  salvaDatiCartaIntestata,
  ripristinaDatiCartaIntestataDefault,
  sincronizzaDatiCartaIntestataDaServer,
  ascoltaModificheCartaIntestata
} from '../../utils/cartaIntestataStore';
import {
  disegnaHeaderIstituzionale,
  disegnaFooterIstituzionale
} from '../../utils/pdfInstitutionalLayout';

interface SezioneSediProps {
  sedi: SedeAssociativaCompleta[];
  onAggiornaSedi: (sedi: SedeAssociativaCompleta[]) => void;
  mezzi?: MezzoFlotta[];
  onAggiornaMezzi?: (mezzi: MezzoFlotta[]) => void;
  operatoreCorrente?: string;
  isAdmin?: boolean;
  onNotificaRadio?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
}

export const SezioneSedi: React.FC<SezioneSediProps> = ({
  sedi,
  onAggiornaSedi,
  mezzi = [],
  onAggiornaMezzi,
  operatoreCorrente = 'Amministratore',
  isAdmin = true,
  onNotificaRadio
}) => {
  const [sottoTab, setSottoTab] = useState<'elenco' | 'mappa' | 'autoparco' | 'cartaIntestata' | 'contiCorrenti'>('elenco');

  // Dati Carta Intestata (Macro Categoria Sedi Associative - Sezione 4)
  const [datiCarta, setDatiCarta] = useState<DatiCartaIntestata>(() => getDatiCartaIntestata());
  const [salvataggioCartaInCorso, setSalvataggioCartaInCorso] = useState(false);
  const [anteprimaPDFInCorso, setAnteprimaPDFInCorso] = useState(false);
  const syncCartaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    sincronizzaDatiCartaIntestataDaServer().then((d) => setDatiCarta(d));
    const unsubscribe = ascoltaModificheCartaIntestata((aggiornati) => {
      setDatiCarta(aggiornati);
    });
    return () => {
      unsubscribe();
      if (syncCartaTimerRef.current) clearTimeout(syncCartaTimerRef.current);
    };
  }, []);

  const aggiornaCampoCarta = (patch: Partial<DatiCartaIntestata>, salvaSubito = false) => {
    const aggiornati = aggiornaCacheLocaleCartaIntestata({ ...datiCarta, ...patch });
    setDatiCarta(aggiornati);
    if (syncCartaTimerRef.current) clearTimeout(syncCartaTimerRef.current);
    if (salvaSubito) {
      const salvati = salvaDatiCartaIntestata(aggiornati);
      realtime.syncCartaIntestata(salvati);
    } else {
      syncCartaTimerRef.current = setTimeout(() => {
        const salvati = salvaDatiCartaIntestata(aggiornati);
        realtime.syncCartaIntestata(salvati);
      }, 450);
    }
  };

  // Copia negli appunti con feedback visivo
  const [copiatoKey, setCopiatoKey] = useState<string | null>(null);
  const copiaTesto = (testo: string, key: string) => {
    try {
      navigator.clipboard.writeText(testo);
      setCopiatoKey(key);
      mostraAvviso(`✓ Copiato negli appunti: ${testo}`);
      setTimeout(() => setCopiatoKey(null), 2500);
    } catch {
      mostraAvviso(`Seleziona e copia: ${testo}`);
    }
  };

  // Ricerca e filtri
  const [ricerca, setRicerca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('tutti');
  const [filtroComune, setFiltroComune] = useState('tutti');

  // Modale Nuova / Modifica Sede
  const [modaleSedeAperta, setModaleSedeAperta] = useState(false);
  const [sedeInModifica, setSedeInModifica] = useState<SedeAssociativaCompleta | null>(null);
  const [formCodice, setFormCodice] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formTipo, setFormTipo] = useState<SedeAssociativaCompleta['tipologia']>('Sezione Territoriale');
  const [formIndirizzo, setFormIndirizzo] = useState('');
  const [formComune, setFormComune] = useState('Massa');
  const [formCap, setFormCap] = useState('54100');
  const [formProvincia, setFormProvincia] = useState('MS');
  const [formTel, setFormTel] = useState('0585 625410');
  const [formCell, setFormCell] = useState('333 4455667');
  const [formEmail, setFormEmail] = useState('');
  const [formPec, setFormPec] = useState('');
  const [formResponsabile, setFormResponsabile] = useState('');
  const [formTelResp, setFormTelResp] = useState('');
  const [formMezzi, setFormMezzi] = useState('T4606, T4609');
  const [formMezziList, setFormMezziList] = useState<string[]>(['T4606', 'T4609']);
  const [formDotazioni, setFormDotazioni] = useState('Centrale Radio, DAE, Locale Riposo Equipaggi');
  const [formOrari, setFormOrari] = useState('Operativo H24 365 Giorni all\'Anno');
  const [formLat, setFormLat] = useState(44.01700);
  const [formLng, setFormLng] = useState(10.15121);
  const [formNote, setFormNote] = useState('');

  // Coordinate Bancarie e Postali per il form della Sede
  const [formIntestatarioConti, setFormIntestatarioConti] = useState('CROCE ORO MASSA CARRARA ODV');
  const [formBancaPoste, setFormBancaPoste] = useState('POSTE ITALIANE');
  const [formIbanPoste, setFormIbanPoste] = useState('IT40P0760113600001007035676');
  const [formCcPostale, setFormCcPostale] = useState('00001007035676');
  const [formBancaAppoggio, setFormBancaAppoggio] = useState('Credit Agricole');
  const [formIbanBanca, setFormIbanBanca] = useState('IT79M0623024500000046980317');

  // Notifiche
  const [avviso, setAvviso] = useState<string | null>(null);
  const mostraAvviso = (msg: string) => {
    setAvviso(msg);
    setTimeout(() => setAvviso(null), 4000);
  };

  // Modale Gestione Assegnazione Mezzi di Sede
  const [modaleGestioneMezziSedeAperta, setModaleGestioneMezziSedeAperta] = useState(false);
  const [sedePerGestioneMezzi, setSedePerGestioneMezzi] = useState<SedeAssociativaCompleta | null>(null);
  const [mezziSelezionatiSede, setMezziSelezionatiSede] = useState<string[]>([]);

  const handleConfermaGestioneMezziSede = () => {
    if (!sedePerGestioneMezzi) return;
    const nomeSede = sedePerGestioneMezzi.nome;
    const nuoveSigle = mezziSelezionatiSede;

    // 1. Aggiorna sedi
    const nuoveSedi = sedi.map((s) => {
      if (s.id === sedePerGestioneMezzi.id) {
        return { ...s, mezziAssegnati: nuoveSigle };
      }
      return s;
    });
    onAggiornaSedi(nuoveSedi);

    // 2. Aggiorna flotta mezzi
    if (mezzi.length > 0 && onAggiornaMezzi) {
      const nuoviMezzi = mezzi.map((m) => {
        if (nuoveSigle.includes(m.sigla)) {
          return { ...m, sedeStazionamento: nomeSede };
        } else if (m.sedeStazionamento === nomeSede) {
          return { ...m, sedeStazionamento: 'Non Assegnata' };
        }
        return m;
      });
      onAggiornaMezzi(nuoviMezzi);
    }

    onNotificaRadio?.(
      `🏢 ASSEGNAZIONE MEZZI: Aggiornato autoparco assegnato alla sede "${nomeSede}" (${nuoveSigle.join(', ') || 'Nessun mezzo'})`,
      'sistema'
    );
    mostraAvviso(`✓ Mezzi assegnati alla sede "${nomeSede}" aggiornati con successo.`);
    setModaleGestioneMezziSedeAperta(false);
    setSedePerGestioneMezzi(null);
  };

  // Salva Sede
  const handleSalvaSede = (e: React.FormEvent) => {
    e.preventDefault();
    const mezziArray = formMezziList;
    const dotazioniArray = formDotazioni.split(',').map((s) => s.trim()).filter(Boolean);

    const contiAssociativi: ContoCorrenteSede[] = [
      {
        id: 'cc-poste',
        banca: formBancaPoste.trim() || 'POSTE ITALIANE',
        iban: formIbanPoste.trim().toUpperCase() || 'IT40P0760113600001007035676',
        intestatario: formIntestatarioConti.trim() || 'CROCE ORO MASSA CARRARA ODV',
        numeroConto: formCcPostale.trim() || '00001007035676',
        tipo: 'postale',
        note: `Conto Corrente Postale OdV (C/C n. ${formCcPostale.trim() || '00001007035676'})`
      },
      {
        id: 'cc-credit-agricole',
        banca: formBancaAppoggio.trim() || 'Credit Agricole',
        iban: formIbanBanca.trim().toUpperCase() || 'IT79M0623024500000046980317',
        intestatario: formIntestatarioConti.trim() || 'CROCE ORO MASSA CARRARA ODV',
        tipo: 'bancario',
        note: 'Conto Corrente Bancario Istituzionale OdV'
      }
    ];

    if (sedeInModifica) {
      const aggiornate = sedi.map((s) => {
        if (s.id === sedeInModifica.id) {
          return {
            ...s,
            codice: formCodice.trim().toUpperCase(),
            nome: formNome.trim(),
            tipologia: formTipo,
            indirizzoCompleto: formIndirizzo.trim(),
            comune: formComune.trim(),
            cap: formCap.trim(),
            provincia: formProvincia.trim(),
            telefonoFisso: formTel.trim(),
            cellulareEmergenza: formCell.trim(),
            email: formEmail.trim(),
            pec: formPec.trim() || undefined,
            responsabileSede: formResponsabile.trim(),
            telefonoResponsabile: formTelResp.trim(),
            mezziAssegnati: mezziArray,
            dotazioniLocali: dotazioniArray,
            orariOperativita: formOrari.trim(),
            coordinate: { lat: Number(formLat), lng: Number(formLng) },
            note: formNote.trim(),
            intestatarioConti: formIntestatarioConti.trim() || 'CROCE ORO MASSA CARRARA ODV',
            bancaPoste: formBancaPoste.trim() || 'POSTE ITALIANE',
            ibanPoste: formIbanPoste.trim().toUpperCase() || 'IT40P0760113600001007035676',
            ccPostale: formCcPostale.trim() || '00001007035676',
            bancaAppoggio: formBancaAppoggio.trim() || 'Credit Agricole',
            ibanBanca: formIbanBanca.trim().toUpperCase() || 'IT79M0623024500000046980317',
            contiCorrenti: contiAssociativi
          };
        }
        return s;
      });
      onAggiornaSedi(aggiornate);
      mostraAvviso(`Dati della sede "${formNome}" aggiornati.`);
    } else {
      const nuova: SedeAssociativaCompleta = {
        id: `sede-${Date.now()}`,
        codice: formCodice.trim().toUpperCase() || `SEDE-${Date.now().toString().slice(-4)}`,
        nome: formNome.trim(),
        tipologia: formTipo,
        indirizzoCompleto: formIndirizzo.trim(),
        comune: formComune.trim(),
        cap: formCap.trim(),
        provincia: formProvincia.trim(),
        telefonoFisso: formTel.trim(),
        cellulareEmergenza: formCell.trim(),
        email: formEmail.trim(),
        pec: formPec.trim() || undefined,
        responsabileSede: formResponsabile.trim(),
        telefonoResponsabile: formTelResp.trim(),
        mezziAssegnati: mezziArray,
        dotazioniLocali: dotazioniArray,
        orariOperativita: formOrari.trim(),
        coordinate: { lat: Number(formLat), lng: Number(formLng) },
        note: formNote.trim(),
        intestatarioConti: formIntestatarioConti.trim() || 'CROCE ORO MASSA CARRARA ODV',
        bancaPoste: formBancaPoste.trim() || 'POSTE ITALIANE',
        ibanPoste: formIbanPoste.trim().toUpperCase() || 'IT40P0760113600001007035676',
        ccPostale: formCcPostale.trim() || '00001007035676',
        bancaAppoggio: formBancaAppoggio.trim() || 'Credit Agricole',
        ibanBanca: formIbanBanca.trim().toUpperCase() || 'IT79M0623024500000046980317',
        contiCorrenti: contiAssociativi
      };
      onAggiornaSedi([...sedi, nuova]);
      onNotificaRadio?.(`🏢 NUOVA SEDE: Inserita nel database la sede "${nuova.nome}" (${nuova.comune})`, 'sistema');
      if (!isAdmin) {
        inviaNotificaModificaAdmin(
          'sedi',
          'Nuova sede territoriale inserita',
          `Creata sede "${nuova.nome}" (${nuova.comune}, resp: ${nuova.responsabileSede}, mezzi assegnati: ${nuova.mezziAssegnati.join(', ') || 'Nessuno'})`,
          operatoreCorrente
        );
      }
      mostraAvviso(`Nuova sede "${nuova.nome}" inserita con successo.`);
    }

    if (sedeInModifica && !isAdmin) {
      inviaNotificaModificaAdmin(
        'sedi',
        'Modifica dati sede territoriale',
        `Modificati dati sede "${formNome}" (${formComune}, resp: ${formResponsabile})`,
        operatoreCorrente
      );
    }

    // Sincronizzazione automatica con i Mezzi della Flotta
    if (mezzi.length > 0 && onAggiornaMezzi) {
      const nomeSede = formNome.trim();
      const nuoviMezzi = mezzi.map((m) => {
        if (mezziArray.includes(m.sigla)) {
          return { ...m, sedeStazionamento: nomeSede };
        } else if (m.sedeStazionamento === nomeSede) {
          return { ...m, sedeStazionamento: 'Non Assegnata' };
        }
        return m;
      });
      onAggiornaMezzi(nuoviMezzi);
    }
    setModaleSedeAperta(false);
    setSedeInModifica(null);
  };

  // Elimina Sede
  const handleEliminaSede = (id: string, nome: string) => {
    if (!isAdmin) {
      alert("⛔ Operazione non autorizzata: solo l'Amministratore può eliminare sedi dal database.");
      return;
    }
    if (!confirm(`Sei sicuro di voler eliminare dal database la sede "${nome}"?`)) return;
    const filtrate = sedi.filter((s) => s.id !== id);
    onAggiornaSedi(filtrate);
    onNotificaRadio?.(`🏢 SEDI: Rimossa la sede "${nome}"`, 'sistema');
    mostraAvviso(`Sede rimossa dal database.`);
  };

  // Sedi filtrate
  const sediFiltrate = sedi.filter((s) => {
    const matchTesto =
      !ricerca.trim() ||
      s.nome.toLowerCase().includes(ricerca.toLowerCase()) ||
      s.indirizzoCompleto.toLowerCase().includes(ricerca.toLowerCase()) ||
      s.comune.toLowerCase().includes(ricerca.toLowerCase()) ||
      s.responsabileSede.toLowerCase().includes(ricerca.toLowerCase());

    const matchTipo = filtroTipo === 'tutti' || s.tipologia === filtroTipo;
    const matchComune = filtroComune === 'tutti' || s.comune === filtroComune;

    return matchTesto && matchTipo && matchComune;
  });

  // Handlers Sezione 4: Dati per Carta Intestata
  const handleSalvaDatiCarta = (e: React.FormEvent) => {
    e.preventDefault();
    setSalvataggioCartaInCorso(true);
    try {
      if (syncCartaTimerRef.current) clearTimeout(syncCartaTimerRef.current);
      const salvati = salvaDatiCartaIntestata(datiCarta);
      realtime.syncCartaIntestata(salvati);
      setDatiCarta(salvati);
      mostraAvviso('Dati carta intestata salvati con successo! Tutti i documenti PDF generati da questo momento utilizzeranno questi riferimenti.');
      onNotificaRadio?.(`🏢 CARTA INTESTATA: Dati ufficiali aggiornati nel database da ${operatoreCorrente}`, 'sistema');
    } catch (err) {
      console.error(err);
      mostraAvviso('Errore durante il salvataggio dei dati');
    } finally {
      setSalvataggioCartaInCorso(false);
    }
  };

  const handleRipristinaDefaultCarta = () => {
    if (confirm('Ripristinare i dati ufficiali predefiniti della carta intestata (verranno svuotati eventuali riferimenti social personalizzati)?')) {
      if (syncCartaTimerRef.current) clearTimeout(syncCartaTimerRef.current);
      const rip = ripristinaDatiCartaIntestataDefault();
      realtime.syncCartaIntestata(rip);
      setDatiCarta(rip);
      mostraAvviso('Dati ufficiali predefiniti ripristinati con successo!');
      onNotificaRadio?.(`🏢 CARTA INTESTATA: Ripristinati i dati ufficiali di default da ${operatoreCorrente}`, 'sistema');
    }
  };

  const handleScaricaPDFProvaCarta = () => {
    setAnteprimaPDFInCorso(true);
    try {
      if (syncCartaTimerRef.current) clearTimeout(syncCartaTimerRef.current);
      const salvati = salvaDatiCartaIntestata(datiCarta);
      realtime.syncCartaIntestata(salvati);
      const socialAttivi = formattaSocialCartaIntestata(salvati);
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      disegnaHeaderIstituzionale(doc, {
        titoloDocumento: 'VERIFICA CONFORMITÀ CARTA INTESTATA UFFICIALE',
        badge: {
          riga1Tag: 'CARTA INTESTATA',
          riga2Valore: 'MODELLO A4 ETS',
          riga3Sotto: 'RUNTS • 1 Pagina'
        },
        pageWidth: 210,
        margin: 12
      });

      let y = 44;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(12, y, 186, 24, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(29, 26, 96);
      doc.text('ATTESTAZIONE DI CONFORMITÀ DELLA CARTA INTESTATA ISTITUZIONALE', 16, y + 8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Tutti i documenti PDF generati nell\'applicazione attingono in tempo reale ai parametri impostati nella Sezione 4.', 16, y + 16);

      y += 32;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(191, 163, 83);
      doc.setLineWidth(0.6);
      doc.roundedRect(12, y, 186, socialAttivi ? 102 : 92, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(191, 163, 83);
      doc.text('RIEPILOGO PARAMETRI ISTITUZIONALI ATTUALMENTE ATTIVI:', 16, y + 8);

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Ente: ${salvati.denominazione}`, 16, y + 17);

      doc.setFont('helvetica', 'normal');
      doc.text(`• Sede Legale: ${salvati.sedeLegale}`, 16, y + 24);
      doc.text(`• Sede Operativa Massa: ${salvati.sedeMassa}`, 16, y + 31);
      doc.text(`• Sede Operativa Carrara: ${salvati.sedeCarrara}`, 16, y + 38);
      doc.text(`• Sede Operativa Pietrasanta: ${salvati.sedePietrasanta}`, 16, y + 45);
      doc.text(`• Centrale Tel: ${salvati.centraleTel}`, 16, y + 52);
      doc.text(`• Codice Fiscale: ${salvati.codiceFiscale} • Portale Web: ${salvati.sitoWeb}`, 16, y + 59);
      doc.text(`• Canali Ufficiali: Email: ${salvati.email} • Pec: ${salvati.pec}`, 16, y + 66);

      let yBank = y + 74;
      if (socialAttivi) {
        doc.setTextColor(30, 64, 175);
        doc.text(`• Social Ufficiali: ${socialAttivi}`, 16, y + 73, { maxWidth: 178 });
        yBank = y + 81;
      }

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(21, 128, 61);
      doc.text(`• Conto Bancario: ${salvati.bancaAppoggio || 'Credit Agricole'} - IBAN: ${salvati.ibanBanca || 'IT79M0623024500000046980317'}`, 16, yBank);
      doc.setTextColor(180, 83, 9);
      doc.text(`• Conto Postale: ${salvati.bancaPoste || 'POSTE ITALIANE'} - IBAN: ${salvati.ibanPoste || 'IT40P0760113600001007035676'} (C/c: ${salvati.ccPostale || '00001007035676'})`, 16, yBank + 7);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.text(`• Intestatario Ufficiale: ${(salvati.intestatarioConti || salvati.denominazione || 'CROCE ORO MASSA CARRARA ODV').toUpperCase()}`, 16, yBank + 14);

      disegnaFooterIstituzionale(doc, {
        dicituraArchiviazione: `Documento di Prova Carta Intestata • Generato il ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })} • ${salvati.denominazione}`,
        pageWidth: 210,
        pageHeight: 297,
        margin: 12
      });

      doc.save('Anteprima_Carta_Intestata_Croce_Oro.pdf');
      mostraAvviso('PDF di prova generato e scaricato con successo!');
    } catch (err) {
      console.error(err);
      mostraAvviso('Errore generazione PDF di prova');
    } finally {
      setAnteprimaPDFInCorso(false);
    }
  };

  const handleScaricaSchedaBancariaPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      disegnaHeaderIstituzionale(doc, {
        titoloDocumento: 'COORDINATE BANCARIE E POSTALI UFFICIALI',
        badge: {
          riga1Tag: 'TESORERIA ODV',
          riga2Valore: '2 CONTI ATTIVI',
          riga3Sotto: 'POSTE & CRÉDIT AGRICOLE'
        },
        pageWidth: 210,
        margin: 12
      });

      let y = 46;

      // Titolo e presentazione
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(12, y, 186, 20, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(29, 26, 96);
      doc.text('SCHEDA UFFICIALE DEI CONTI CORRENTI E COORDINATE IBAN', 16, y + 7.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Documento istituzionale per donazioni, contributi pubblici, pagamenti fornitori, rimborsi e convenzioni ASL/118.', 16, y + 14.5);

      y += 26;

      // BOX 1: POSTE ITALIANE
      doc.setFillColor(254, 252, 232); // yellow-50
      doc.setDrawColor(234, 179, 8); // yellow-500
      doc.setLineWidth(0.6);
      doc.roundedRect(12, y, 186, 46, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(161, 98, 7); // amber-700
      doc.text('1. CONTO CORRENTE POSTALE • POSTE ITALIANE', 16, y + 8);

      const infoBancaria = getDatiCartaIntestata();
      const intestatarioUff = (infoBancaria.intestatarioConti || infoBancaria.denominazione || 'CROCE ORO MASSA CARRARA ODV').toUpperCase();

      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text('Intestatario:', 16, y + 16);
      doc.setFont('helvetica', 'normal');
      doc.text(intestatarioUff, 52, y + 16);

      doc.setFont('helvetica', 'bold');
      doc.text('Banca d\'Appoggio:', 16, y + 23);
      doc.setFont('helvetica', 'normal');
      doc.text(infoBancaria.bancaPoste || 'POSTE ITALIANE S.p.A. - BancoPosta', 52, y + 23);

      doc.setFont('helvetica', 'bold');
      doc.text('Numero C/C Postale:', 16, y + 30);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text(infoBancaria.ccPostale || '00001007035676', 52, y + 30);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Codice IBAN Ufficiale:', 16, y + 38);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(29, 26, 96);
      doc.text(infoBancaria.ibanPoste || 'IT40P0760113600001007035676', 52, y + 38);

      y += 52;

      // BOX 2: CREDIT AGRICOLE
      doc.setFillColor(240, 253, 244); // green-50
      doc.setDrawColor(34, 197, 94); // emerald-500
      doc.setLineWidth(0.6);
      doc.roundedRect(12, y, 186, 42, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(21, 128, 61); // emerald-700
      doc.text(`2. CONTO CORRENTE BANCARIO • ${(infoBancaria.bancaAppoggio || 'CRÉDIT AGRICOLE').toUpperCase()}`, 16, y + 8);

      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text('Intestatario:', 16, y + 16);
      doc.setFont('helvetica', 'normal');
      doc.text(intestatarioUff, 52, y + 16);

      doc.setFont('helvetica', 'bold');
      doc.text('Banca d\'Appoggio:', 16, y + 23);
      doc.setFont('helvetica', 'normal');
      doc.text(infoBancaria.bancaAppoggio || 'Credit Agricole Italia', 52, y + 23);

      doc.setFont('helvetica', 'bold');
      doc.text('Codice IBAN Ufficiale:', 16, y + 32);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(29, 26, 96);
      doc.text(infoBancaria.ibanBanca || 'IT79M0623024500000046980317', 52, y + 32);

      y += 48;

      // Box note fiscali e donazioni
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.4);
      doc.roundedRect(12, y, 186, 32, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(29, 26, 96);
      doc.text('INFORMAZIONI FISCALI E BENEFICI PER EROGAZIONI LIBERALI (DONAZIONI):', 16, y + 7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`• Codice Fiscale dell'Associazione: ${infoBancaria.codiceFiscale || '92035360459'} (RUNTS Repertorio OdV)`, 16, y + 14);
      doc.text('• Le donazioni a mezzo bonifico bancario o bollettino postale sono detraibili/deducibili ai sensi dell\'art. 83 D.Lgs. 117/2017.', 16, y + 20);
      doc.text('• Specificare sempre nella causale il motivo del versamento (es. "Erogazione liberale", "Contributo associativo", "Saldo fattura").', 16, y + 26);

      disegnaFooterIstituzionale(doc, {
        dicituraArchiviazione: `Scheda Ufficiale Coordinate Bancarie • Generata il ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })} • ${infoBancaria.denominazione}`,
        pageWidth: 210,
        pageHeight: 297,
        margin: 12
      });

      doc.save('Coordinate_Bancarie_Croce_Oro_Massa_Carrara.pdf');
      mostraAvviso('Scheda Coordinate Bancarie generata e scaricata in formato PDF A4!');
    } catch (e) {
      console.error(e);
      mostraAvviso('Errore generazione PDF Coordinate Bancarie');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 animate-in fade-in duration-200">
      
      {/* Header Sezione 7 */}
      <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/10">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700/50">
                Macro Categoria 7
              </span>
              <h2 className="text-xl font-black text-white uppercase tracking-wide">
                {useTitoloDatabase('sedi', 'Database Anagrafiche Sedi Associative')}
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Registro sedi legali e operative, distaccamenti territoriali, recapiti H24, coordinatori, flotta stazionata e coordinate GPS.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSottoTab('contiCorrenti')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
              sottoTab === 'contiCorrenti'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/30'
                : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/60'
            }`}
          >
            <Landmark className="w-4 h-4 text-emerald-400" />
            <span>Coordinate Bancarie OdV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSedeInModifica(null);
              setFormCodice(`SEDE-${Date.now().toString().slice(-4)}`);
              setFormNome('');
              setFormTipo('Sezione Territoriale');
              setFormIndirizzo('');
              setFormComune('Massa');
              setFormCap('54100');
              setFormProvincia('MS');
              setFormTel('0585 625410');
              setFormCell('333 4455667');
              setFormEmail('info@croceoromassacarrara.it');
              setFormPec('');
              setFormResponsabile('');
              setFormTelResp('');
              setFormMezzi('');
              setFormMezziList([]);
              setFormDotazioni('Postazione Radio VHF, DAE');
              setFormOrari('Presidio Operativo H24');
              setFormLat(44.01700);
              setFormLng(10.15121);
              setFormNote('');
              setFormIntestatarioConti('CROCE ORO MASSA CARRARA ODV');
              setFormBancaPoste('POSTE ITALIANE');
              setFormIbanPoste('IT40P0760113600001007035676');
              setFormCcPostale('00001007035676');
              setFormBancaAppoggio('Credit Agricole');
              setFormIbanBanca('IT79M0623024500000046980317');
              setModaleSedeAperta(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nuova Sede Associativa</span>
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
          onClick={() => setSottoTab('elenco')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'elenco'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 border border-rose-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>1. Elenco Sedi Ufficiali ({sedi.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSottoTab('mappa')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'mappa'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 border border-rose-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>2. Mappa Territoriale Sedi</span>
        </button>

        <button
          type="button"
          onClick={() => setSottoTab('autoparco')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'autoparco'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 border border-rose-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Car className="w-4 h-4" />
          <span>3. Mezzi Assegnati per Sede</span>
        </button>

        <button
          type="button"
          onClick={() => setSottoTab('cartaIntestata')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'cartaIntestata'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 border border-rose-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>4. DATI PER CARTA INTESTATA</span>
        </button>

        <button
          type="button"
          onClick={() => setSottoTab('contiCorrenti')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer ${
            sottoTab === 'contiCorrenti'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 border border-emerald-400'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          <Landmark className="w-4 h-4 text-emerald-400" />
          <span>5. COORDINATE BANCARIE & POSTALI (2 CONTI)</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* 1. SOTTO-TAB: ELENCO SEDI ASSOCIATIVE                                 */}
      {/* ===================================================================== */}
      {sottoTab === 'elenco' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Cerca sede, indirizzo, responsabile..."
                value={ricerca}
                onChange={(e) => setRicerca(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
              <select
                value={filtroComune}
                onChange={(e) => setFiltroComune(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="tutti">Tutti i Comuni</option>
                <option value="Massa">Massa</option>
                <option value="Carrara">Carrara</option>
                <option value="Pietrasanta">Pietrasanta</option>
                <option value="Aulla">Aulla (Lunigiana)</option>
              </select>

              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
              >
                <option value="tutti">Tutte le Tipologie</option>
                <option value="Sede Legale & Territoriale">Sede Legale</option>
                <option value="Sede Operativa H24 & Centrale">Sede Operativa H24</option>
                <option value="Sezione Territoriale">Sezione Territoriale</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sediFiltrate.map((s) => (
              <div
                key={s.id}
                className="bg-slate-950 rounded-2xl border border-slate-800 hover:border-rose-500/50 p-5 shadow-xl flex flex-col justify-between gap-3 transition-all"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-xs text-rose-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                        {s.codice}
                      </span>
                      <h4 className="font-black text-white text-base mt-1">{s.nome}</h4>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">{s.tipologia}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span>{s.indirizzoCompleto}, {s.cap} {s.comune} ({s.provincia})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Tel: <strong className="text-white">{s.telefonoFisso}</strong> • Cell: {s.cellulareEmergenza}</span>
                    </div>
                    {s.email && (
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate">{s.email}</span>
                      </div>
                    )}
                    {s.responsabileSede && (
                      <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                        Responsabile: <strong className="text-white">{s.responsabileSede}</strong>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        Mezzi Assegnati ({s.mezziAssegnati?.length || 0}):
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSedePerGestioneMezzi(s);
                          setMezziSelezionatiSede([...(s.mezziAssegnati || [])]);
                          setModaleGestioneMezziSedeAperta(true);
                        }}
                        className="text-[10.5px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                        title="Modifica l'assegnazione dei mezzi per questa sede"
                      >
                        ⚡ Gestisci Mezzi
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {s.mezziAssegnati && s.mezziAssegnati.length > 0 ? (
                        [...s.mezziAssegnati].sort((a, b) => a.localeCompare(b, 'it', { numeric: true, sensitivity: 'base' })).map((m) => (
                          <span key={m} className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/50 font-mono font-bold text-[11px]">
                            🚑 {m}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">Nessun mezzo assegnato</span>
                      )}
                    </div>
                  </div>

                  {/* BOX COORDINATE BANCARIE & POSTALI UFFICIALI */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-emerald-400 flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5" />
                        <span>Coordinate Bancarie Ufficiali</span>
                      </span>
                      <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60 font-bold">
                        2 Conti OdV
                      </span>
                    </div>

                    {/* Conto 1: Poste Italiane */}
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="font-bold text-yellow-400 flex items-center gap-1">
                          🟡 POSTE ITALIANE <span className="text-[9.5px] text-slate-400 font-mono font-normal">(C/c: {s.ccPostale || '00001007035676'})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => copiaTesto(s.ibanPoste || 'IT40P0760113600001007035676', `poste-${s.id}`)}
                          className="text-[9.5px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          title="Copia codice IBAN Poste Italiane"
                        >
                          {copiatoKey === `poste-${s.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                          <span>{copiatoKey === `poste-${s.id}` ? 'Copiato' : 'Copia IBAN'}</span>
                        </button>
                      </div>
                      <div className="font-mono text-[10px] text-slate-200 font-bold select-all tracking-tight break-all">
                        {s.ibanPoste || 'IT40P0760113600001007035676'}
                      </div>
                    </div>

                    {/* Conto 2: Credit Agricole */}
                    <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="font-bold text-emerald-400 flex items-center gap-1">
                          🟢 Credit Agricole <span className="text-[9.5px] text-slate-400 font-normal">(Conto Bancario)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => copiaTesto(s.ibanBanca || 'IT79M0623024500000046980317', `ca-${s.id}`)}
                          className="text-[9.5px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                          title="Copia codice IBAN Credit Agricole"
                        >
                          {copiatoKey === `ca-${s.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                          <span>{copiatoKey === `ca-${s.id}` ? 'Copiato' : 'Copia IBAN'}</span>
                        </button>
                      </div>
                      <div className="font-mono text-[10px] text-slate-200 font-bold select-all tracking-tight break-all">
                        {s.ibanBanca || 'IT79M0623024500000046980317'}
                      </div>
                    </div>

                    <div className="text-[9.5px] text-slate-400 pt-0.5 border-t border-slate-800/80 flex items-center justify-between">
                      <span>Intestato a: <strong className="text-white">{s.intestatarioConti || 'CROCE ORO MASSA CARRARA ODV'}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800 text-xs">
                  <a
                    href={`https://www.google.com/maps?q=${s.coordinate.lat},${s.coordinate.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Apri Navigatore</span>
                  </a>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSedeInModifica(s);
                        setFormCodice(s.codice);
                        setFormNome(s.nome);
                        setFormTipo(s.tipologia);
                        setFormIndirizzo(s.indirizzoCompleto);
                        setFormComune(s.comune);
                        setFormCap(s.cap);
                        setFormProvincia(s.provincia);
                        setFormTel(s.telefonoFisso);
                        setFormCell(s.cellulareEmergenza);
                        setFormEmail(s.email);
                        setFormPec(s.pec || '');
                        setFormResponsabile(s.responsabileSede);
                        setFormTelResp(s.telefonoResponsabile);
                        setFormMezzi(s.mezziAssegnati.join(', '));
                        setFormMezziList(s.mezziAssegnati || []);
                        setFormDotazioni(s.dotazioniLocali.join(', '));
                        setFormOrari(s.orariOperativita);
                        setFormLat(s.coordinate.lat);
                        setFormLng(s.coordinate.lng);
                        setFormNote(s.note || '');
                        setFormIntestatarioConti(s.intestatarioConti || 'CROCE ORO MASSA CARRARA ODV');
                        setFormBancaPoste(s.bancaPoste || 'POSTE ITALIANE');
                        setFormIbanPoste(s.ibanPoste || 'IT40P0760113600001007035676');
                        setFormCcPostale(s.ccPostale || '00001007035676');
                        setFormBancaAppoggio(s.bancaAppoggio || 'Credit Agricole');
                        setFormIbanBanca(s.ibanBanca || 'IT79M0623024500000046980317');
                        setModaleSedeAperta(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      title="Modifica Dati Sede"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleEliminaSede(s.id, s.nome)}
                        className="p-1.5 rounded-lg bg-red-950 hover:bg-red-900 text-red-300 border border-red-800 cursor-pointer"
                        title="Elimina Sede"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. SOTTO-TAB: MAPPA TERRITORIALE                                      */}
      {/* ===================================================================== */}
      {sottoTab === 'mappa' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <Navigation className="w-4 h-4 text-rose-400" />
                <span>Mappa Geografica delle Sedi & Presidi Territoriali</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Visualizza le coordinate GPS esatte e le indicazioni stradali per raggiungere i presidi della Croce Oro.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sedi.map((s) => (
              <div
                key={s.id}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="font-bold text-white text-sm">{s.nome}</div>
                  <span className="font-mono text-xs text-rose-400">{s.comune}</span>
                </div>
                <div className="text-xs text-slate-300">{s.indirizzoCompleto}</div>
                <div className="font-mono text-[11px] text-slate-400 bg-slate-900 p-2 rounded-xl border border-slate-800 flex justify-between">
                  <span>Lat: {s.coordinate.lat.toFixed(5)}</span>
                  <span>Lng: {s.coordinate.lng.toFixed(5)}</span>
                </div>
                <a
                  href={`https://www.google.com/maps?q=${s.coordinate.lat},${s.coordinate.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
                >
                  <Navigation className="w-4 h-4" />
                  <span>Avvia Navigazione GPS</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. SOTTO-TAB: MEZZI ASSEGNATI PER SEDE                                */}
      {/* ===================================================================== */}
      {sottoTab === 'autoparco' && (
        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
                <Car className="w-4 h-4 text-rose-400" />
                <span>Riepilogo Autoparco & Dotazioni Fisse per Sede</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Monitoraggio della dislocazione territoriale dei mezzi della flotta nelle singole basi operative.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {sedi.map((s) => (
              <div
                key={s.id}
                className="bg-slate-950 p-4 rounded-2xl border border-slate-800 shadow-xl space-y-3"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div>
                    <h4 className="font-black text-white text-sm">{s.nome}</h4>
                    <span className="text-[11px] text-slate-400">{s.indirizzoCompleto}</span>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-rose-300 border border-slate-700 font-bold text-xs">
                    {s.mezziAssegnati.length} Mezzi Stazionati
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Mezzi della Flotta:</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {s.mezziAssegnati.length > 0 ? (
                        [...s.mezziAssegnati].sort((a, b) => a.localeCompare(b, 'it', { numeric: true, sensitivity: 'base' })).map((m) => (
                          <span key={m} className="px-3 py-1.5 rounded-xl bg-amber-950 text-amber-300 border border-amber-700/50 font-mono font-black text-xs">
                            🚑 {m}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 text-xs italic">Nessun mezzo assegnato a questa sede</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Dotazioni di Sede:</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {s.dotazioniLocali.map((d) => (
                        <span key={d} className="px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 text-[11px]">
                          ✓ {d}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. SOTTO-TAB: DATI PER CARTA INTESTATA                                */}
      {/* ===================================================================== */}
      {sottoTab === 'cartaIntestata' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Header Barra Sotto-Sezione */}
          <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-700/50">
                  Macro Categoria 7 • Sezione 4
                </span>
                <h3 className="text-base font-black text-white uppercase flex items-center gap-2">
                  <FileText className="w-5 h-5 text-rose-400" />
                  <span>Dati per Carta Intestata dell'Associazione</span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Configurazione anagrafica centrale, sedi territoriali e recapiti ufficiali. 
                <strong> Tutti i documenti PDF generati nel gestionale</strong> (Fogli di Viaggio, Domande di Iscrizione, Ricevute Tesseramento, Schede Vestiario, Note di Debito, ecc.) ripescano automaticamente e in tempo reale questi dati.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap">
              <button
                type="button"
                onClick={handleRipristinaDefaultCarta}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer active:scale-95 transition-all"
                title="Ripristina i dati ufficiali predefiniti"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Ripristina Default</span>
              </button>

              <button
                type="button"
                disabled={anteprimaPDFInCorso}
                onClick={handleScaricaPDFProvaCarta}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>{anteprimaPDFInCorso ? 'Generazione PDF...' : 'Scarica PDF di Prova A4'}</span>
              </button>
            </div>
          </div>

          {/* ANTEPRIMA GRAFICA LIVE DELLA CARTA INTESTATA */}
          <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs uppercase font-black text-white tracking-wide">
                  Anteprima Istituzionale Carta Intestata (Header PDF)
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-800">
                Rendering Automatico in Tempo Reale
              </span>
            </div>

            {/* Foglio Simulato Intestazione */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700/60 text-slate-900">
              {/* Barra Blu Navy con Filetto Oro */}
              <div className="bg-[#1d1a60] text-white p-4 relative border-b-[3px] border-[#bfa353]">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black text-sm shrink-0 shadow-lg border border-white/20">
                      🚑 CO
                    </div>
                    <div>
                      <h4 className="font-black text-base md:text-lg text-white uppercase tracking-wide leading-tight">
                        {datiCarta.denominazione || 'CROCE ORO MASSA CARRARA OdV'}
                      </h4>
                      <p className="text-[11px] font-bold text-amber-300">
                        Organizzazione di Volontariato • Ente del Terzo Settore • RUNTS
                      </p>
                    </div>
                  </div>

                  {/* Badge Destro Modello */}
                  <div className="bg-slate-900/90 border border-amber-500/80 rounded-xl px-3 py-1.5 text-right shrink-0">
                    <span className="block text-[9px] font-black uppercase text-amber-400">Carta Intestata Ufficiale</span>
                    <span className="block text-xs font-mono font-black text-white">Modello A4 • RUNTS</span>
                    <span className="block text-[8px] text-slate-300">Approvato Direttivo</span>
                  </div>
                </div>

                {/* Righe Informative di Sede e Contatti */}
                <div className="mt-3 pt-2.5 border-t border-white/15 space-y-1 text-[11px] text-slate-200">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      <strong>Sede Legale:</strong> {datiCarta.sedeLegale} • <strong>Sede Massa:</strong> {datiCarta.sedeMassa} • <strong>Sede Carrara:</strong> {datiCarta.sedeCarrara} • <strong>Sede Pietrasanta:</strong> {datiCarta.sedePietrasanta}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap text-slate-300 text-[10.5px]">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-amber-400 shrink-0" />
                      <strong>Centrale Tel:</strong> <span className="font-mono text-white">{datiCarta.centraleTel}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-amber-400 shrink-0" />
                      <strong>Codice Fiscale:</strong> <span className="font-mono text-amber-300">{datiCarta.codiceFiscale}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3 text-amber-400 shrink-0" />
                      <strong>Sito Web:</strong> <span className="text-white underline">{datiCarta.sitoWeb}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3 text-amber-400 shrink-0" />
                      <strong>Email:</strong> {datiCarta.email} • <strong>Pec:</strong> {datiCarta.pec}
                    </span>
                  </div>

                  {formattaSocialCartaIntestata(datiCarta) && (
                    <div className="flex items-center gap-1.5 flex-wrap text-amber-300 text-[10.5px] font-semibold">
                      <Share2 className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>{formattaSocialCartaIntestata(datiCarta)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Corpo del Foglio Dimostrativo */}
              <div className="p-4 bg-slate-50 text-xs text-slate-600 space-y-1.5 border-b border-slate-200">
                <div className="font-mono text-[10px] text-slate-400">
                  [Area di testo riservata ai contenuti specifici del documento: Ricevuta, Foglio di Viaggio, Domanda di Iscrizione, Scheda Vestiario...]
                </div>
              </div>

              {/* Anteprima Footer */}
              <div className="bg-slate-100 p-2.5 text-center text-[10px] text-slate-500 border-t border-[#bfa353]/50 space-y-0.5">
                <div className="font-bold text-slate-700">
                  {datiCarta.denominazione} • Sede Legale: {datiCarta.sedeLegale} • Sede Massa: {datiCarta.sedeMassa} • Sede Carrara: {datiCarta.sedeCarrara} • Sede Pietrasanta: {datiCarta.sedePietrasanta}
                </div>
                <div>
                  Centrale Tel: {datiCarta.centraleTel} • Codice Fiscale: {datiCarta.codiceFiscale} • {datiCarta.sitoWeb} • Email: {datiCarta.email} • Pec: {datiCarta.pec}
                  {formattaSocialCartaIntestata(datiCarta) ? ` • ${formattaSocialCartaIntestata(datiCarta)}` : ''}
                </div>
                <div className="text-[9px] text-emerald-700 font-mono font-bold pt-0.5">
                  Conto Bancario: {datiCarta.bancaAppoggio || 'Credit Agricole'} IBAN {datiCarta.ibanBanca || 'IT79M0623024500000046980317'} • Conto Postale: {datiCarta.bancaPoste || 'POSTE ITALIANE'} IBAN {datiCarta.ibanPoste || 'IT40P0760113600001007035676'} (C/c: {datiCarta.ccPostale || '00001007035676'})
                </div>
              </div>
            </div>
          </div>

          {/* FORM DI CONFIGURAZIONE DEI DATI */}
          <form onSubmit={handleSalvaDatiCarta} className="space-y-4">
            <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Building className="w-4 h-4 text-rose-400" />
                <h4 className="text-sm font-black text-white uppercase">
                  1. Denominazione Istituzionale & Codice Fiscale
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Denominazione Ufficiale dell'Associazione (Intestazione Principale)
                  </label>
                  <input
                    type="text"
                    required
                    value={datiCarta.denominazione}
                    onChange={(e) => aggiornaCampoCarta({ denominazione: e.target.value })}
                    placeholder="CROCE ORO MASSA CARRARA OdV"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs focus:ring-2 focus:ring-rose-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Viene visualizzata in grassetto maiuscolo in cima a tutti i documenti ufficiali.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Codice Fiscale Ufficiale dell'Ente (CF)
                  </label>
                  <input
                    type="text"
                    required
                    value={datiCarta.codiceFiscale}
                    onChange={(e) => aggiornaCampoCarta({ codiceFiscale: e.target.value })}
                    placeholder="92035360459"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold text-xs focus:ring-2 focus:ring-rose-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Codice fiscale fiscale registrato all'Agenzia delle Entrate e RUNTS.
                  </span>
                </div>
              </div>
            </div>

            {/* Box Sedi Ufficiali */}
            <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <MapPin className="w-4 h-4 text-rose-400" />
                <h4 className="text-sm font-black text-white uppercase">
                  2. Sedi Associative Ufficiali (Legale & Operative)
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Sede Legale
                  </label>
                  <input
                    type="text"
                    required
                    value={datiCarta.sedeLegale}
                    onChange={(e) => aggiornaCampoCarta({ sedeLegale: e.target.value })}
                    placeholder="Via Como, 12 Massa (MS)"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Sede Operativa Massa
                  </label>
                  <input
                    type="text"
                    required
                    value={datiCarta.sedeMassa}
                    onChange={(e) => aggiornaCampoCarta({ sedeMassa: e.target.value })}
                    placeholder="Via Delle Jare 9"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Sede Operativa Carrara
                  </label>
                  <input
                    type="text"
                    required
                    value={datiCarta.sedeCarrara}
                    onChange={(e) => aggiornaCampoCarta({ sedeCarrara: e.target.value })}
                    placeholder="Strada Comunale Monteverde 49"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Sede Operativa Pietrasanta
                  </label>
                  <input
                    type="text"
                    required
                    value={datiCarta.sedePietrasanta}
                    onChange={(e) => aggiornaCampoCarta({ sedePietrasanta: e.target.value })}
                    placeholder="Piazza Villeparisis, 14"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
            </div>

            {/* Box Contatti & Canali */}
            <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Phone className="w-4 h-4 text-rose-400" />
                <h4 className="text-sm font-black text-white uppercase">
                  3. Centrale Operativa & Canali di Comunicazione
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Centrale Telefonica H24
                  </label>
                  <input
                    type="text"
                    required
                    value={datiCarta.centraleTel}
                    onChange={(e) => aggiornaCampoCarta({ centraleTel: e.target.value })}
                    placeholder="0585 625410"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-xs focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Sito Web Istituzionale
                  </label>
                  <input
                    type="text"
                    required
                    value={datiCarta.sitoWeb}
                    onChange={(e) => aggiornaCampoCarta({ sitoWeb: e.target.value })}
                    placeholder="www.croceoro.org"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Email Ufficiale
                  </label>
                  <input
                    type="email"
                    required
                    value={datiCarta.email}
                    onChange={(e) => aggiornaCampoCarta({ email: e.target.value })}
                    placeholder="volontari@croceoro.org"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Posta Certificata (PEC)
                  </label>
                  <input
                    type="email"
                    required
                    value={datiCarta.pec}
                    onChange={(e) => aggiornaCampoCarta({ pec: e.target.value })}
                    placeholder="croceoromassacarrara@pec.it"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
            </div>

            {/* Box 4: Riferimenti Social Ufficiali dell'Associazione */}
            <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-sky-400" />
                  <h4 className="text-sm font-black text-white uppercase">
                    4. Riferimenti Social Ufficiali dell'Associazione
                  </h4>
                </div>
                <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                  {formattaSocialCartaIntestata(datiCarta)
                    ? '✓ Canali compilati visibili nei PDF'
                    : 'Nessun social compilato (non mostrati sui PDF)'}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Inserisci, modifica o cancella i riferimenti social ufficiali. <strong>Se un campo viene lasciato vuoto, non verrà mostrato sulla carta intestata né sui PDF generati.</strong> Ogni modifica ha effetto immediato su tutti i nuovi PDF.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {(
                  [
                    { key: 'socialFacebook', label: 'Facebook (Pagina / Handle)', placeholder: 'es. @CroceOroMassaCarrara' },
                    { key: 'socialInstagram', label: 'Instagram (Profilo)', placeholder: 'es. @croceoromassacarrara' },
                    { key: 'socialYouTube', label: 'YouTube (Canale)', placeholder: 'es. @CroceOroMassaCarrara' },
                    { key: 'socialTikTok', label: 'TikTok (Profilo)', placeholder: 'es. @croceoromassacarrara' },
                    { key: 'socialLinkedIn', label: 'LinkedIn (Pagina Ente)', placeholder: 'es. Croce Oro Massa Carrara OdV' },
                    { key: 'socialAltro', label: 'Altro Social / Canale', placeholder: 'es. Telegram: @CroceOroMC' }
                  ] as const
                ).map(({ key, label, placeholder }) => {
                  const val = String((datiCarta as any)[key] || '');
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-slate-300">{label}</label>
                        {val.trim().length > 0 && (
                          <button
                            type="button"
                            onClick={() => aggiornaCampoCarta({ [key]: '' }, true)}
                            className="text-[10px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/60 border border-red-800/50 cursor-pointer"
                            title={`Cancella ${label}`}
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Cancella</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => aggiornaCampoCarta({ [key]: e.target.value })}
                        placeholder={placeholder}
                        className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-sky-500 placeholder-slate-600"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Box 5: Coordinate Bancarie e Postali per Carta Intestata e Note di Debito */}
            <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <Landmark className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-black text-white uppercase">
                  5. Coordinate Bancarie & Postali Ufficiali (Tesoreria & Donazioni)
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Intestatario Ufficiale dei Conti Correnti
                  </label>
                  <input
                    type="text"
                    required
                    value={datiCarta.intestatarioConti || 'CROCE ORO MASSA CARRARA ODV'}
                    onChange={(e) => aggiornaCampoCarta({ intestatarioConti: e.target.value.toUpperCase() })}
                    placeholder="CROCE ORO MASSA CARRARA ODV"
                    className="w-full p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs focus:ring-2 focus:ring-emerald-500 uppercase"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Inserito in automatico su note di debito, ricevute fiscali e mandati di pagamento.
                  </span>
                </div>

                {/* Conto Postale: Poste Italiane */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-yellow-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-yellow-400 uppercase flex items-center gap-1.5">
                      🟡 Conto Corrente Postale
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">BancoPosta</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Banca d'Appoggio / Istituto
                    </label>
                    <input
                      type="text"
                      required
                      value={datiCarta.bancaPoste || 'POSTE ITALIANE'}
                      onChange={(e) => aggiornaCampoCarta({ bancaPoste: e.target.value })}
                      placeholder="POSTE ITALIANE"
                      className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Codice IBAN Postale
                    </label>
                    <input
                      type="text"
                      required
                      value={datiCarta.ibanPoste || 'IT40P0760113600001007035676'}
                      onChange={(e) => aggiornaCampoCarta({ ibanPoste: e.target.value.toUpperCase().replace(/\s/g, '') })}
                      placeholder="IT40P0760113600001007035676"
                      className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-yellow-300 font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Numero C/C Postale
                    </label>
                    <input
                      type="text"
                      required
                      value={datiCarta.ccPostale || '00001007035676'}
                      onChange={(e) => aggiornaCampoCarta({ ccPostale: e.target.value.replace(/\s/g, '') })}
                      placeholder="00001007035676"
                      className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-yellow-300 font-mono text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Conto Bancario: Credit Agricole */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-400 uppercase flex items-center gap-1.5">
                      🟢 Conto Corrente Bancario
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Istituto Bancario</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Banca d'Appoggio / Istituto
                    </label>
                    <input
                      type="text"
                      required
                      value={datiCarta.bancaAppoggio || 'Credit Agricole'}
                      onChange={(e) => aggiornaCampoCarta({ bancaAppoggio: e.target.value })}
                      placeholder="Credit Agricole"
                      className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Codice IBAN Bancario
                    </label>
                    <input
                      type="text"
                      required
                      value={datiCarta.ibanBanca || 'IT79M0623024500000046980317'}
                      onChange={(e) => aggiornaCampoCarta({ ibanBanca: e.target.value.toUpperCase().replace(/\s/g, '') })}
                      placeholder="IT79M0623024500000046980317"
                      className="w-full p-2 rounded-xl bg-slate-950 border border-slate-700 text-emerald-300 font-mono text-xs font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Barra Azione Finale */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-900 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Ogni modifica viene applicata immediatamente a tutti i nuovi PDF e sincronizzata nel database centrale.</span>
              </div>

              <button
                type="submit"
                disabled={salvataggioCartaInCorso}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer active:scale-95 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{salvataggioCartaInCorso ? 'Salvataggio in corso...' : 'Salva Dati Carta Intestata'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. SOTTO-TAB: COORDINATE BANCARIE & POSTALI (2 CONTI CORRENTI)         */}
      {/* ===================================================================== */}
      {sottoTab === 'contiCorrenti' && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Header Barra Sotto-Sezione */}
          <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                  Macro Categoria 7 • Sezione 5
                </span>
                <h3 className="text-base font-black text-white uppercase flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-emerald-400" />
                  <span>Coordinate Bancarie & Postali Ufficiali dell'Associazione</span>
                </h3>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Riferimenti contabili ufficiali per bonifici, donazioni 5x1000, rimborsi, contributi pubblici e pagamenti fornitori.
                Intestati tassativamente a <strong>CROCE ORO MASSA CARRARA ODV</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const testoCompleto = `CROCE ORO MASSA CARRARA ODV - COORDINATE BANCARIE E POSTALI UFFICIALI\n` +
                    `Codice Fiscale: 92035360459 (RUNTS OdV)\n\n` +
                    `1) CONTO CORRENTE POSTALE (BancoPosta):\n` +
                    `• Banca: POSTE ITALIANE\n` +
                    `• C/C Postale: 00001007035676\n` +
                    `• IBAN: IT40P0760113600001007035676\n` +
                    `• Intestatario: CROCE ORO MASSA CARRARA ODV\n\n` +
                    `2) CONTO CORRENTE BANCARIO:\n` +
                    `• Banca d'appoggio: Credit Agricole\n` +
                    `• IBAN: IT79M0623024500000046980317\n` +
                    `• Intestatario: CROCE ORO MASSA CARRARA ODV\n\n` +
                    `Sede Legale: Via Como, 12 Marina di Massa (MS) • Tel: 0585 625410 • Email: volontari@croceoro.org`;
                  copiaTesto(testoCompleto, 'blocco-completo');
                }}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer active:scale-95 transition-all"
                title="Copia tutte le coordinate formattate per WhatsApp o Email"
              >
                {copiatoKey === 'blocco-completo' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
                <span>{copiatoKey === 'blocco-completo' ? 'Copiato!' : 'Copia Testo per WhatsApp / Email'}</span>
              </button>

              <button
                type="button"
                onClick={handleScaricaSchedaBancariaPDF}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs uppercase flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer active:scale-95 transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>Scarica Scheda Bancaria PDF A4</span>
              </button>
            </div>
          </div>

          {/* GRIGLIA 2 GRANDI SCHEDE CONTI */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* SCHEDA 1: POSTE ITALIANE */}
            <div className="bg-slate-950 rounded-3xl border-2 border-yellow-500/50 p-6 shadow-2xl space-y-5 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-lg">
                      📮
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-yellow-400 tracking-wider">
                        Conto Corrente Postale Ufficiale
                      </span>
                      <h4 className="text-xl font-black text-white">POSTE ITALIANE</h4>
                      <span className="text-xs text-slate-400">BancoPosta • Circuito Nazionale Postale</span>
                    </div>
                  </div>

                  <span className="text-[10px] uppercase font-bold text-yellow-300 bg-yellow-950/80 px-2.5 py-1 rounded-xl border border-yellow-700/50 font-mono shrink-0">
                    Attivo & Certificato
                  </span>
                </div>

                {/* Dettagli Conto Poste */}
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold">Intestatario Ufficiale:</span>
                      <button
                        type="button"
                        onClick={() => copiaTesto('CROCE ORO MASSA CARRARA ODV', 'intestatario-poste')}
                        className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiatoKey === 'intestatario-poste' ? 'Copiato' : 'Copia'}</span>
                      </button>
                    </div>
                    <div className="text-sm font-black text-white tracking-wide">
                      CROCE ORO MASSA CARRARA ODV
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold">Banca d'Appoggio:</span>
                    </div>
                    <div className="text-sm font-black text-white">
                      POSTE ITALIANE
                    </div>
                  </div>

                  {/* Numero C/C Postale */}
                  <div className="p-3.5 rounded-2xl bg-yellow-950/40 border border-yellow-500/40 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-yellow-300 font-bold uppercase tracking-wider flex items-center gap-1">
                        Numero C/C Postale:
                      </span>
                      <button
                        type="button"
                        onClick={() => copiaTesto('00001007035676', 'cc-num')}
                        className="text-[10.5px] px-2.5 py-1 rounded-lg bg-yellow-500 text-slate-950 font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow"
                      >
                        {copiatoKey === 'cc-num' ? <Check className="w-3 h-3 text-slate-950" /> : <Copy className="w-3 h-3 text-slate-950" />}
                        <span>{copiatoKey === 'cc-num' ? 'Copiato!' : 'Copia C/C'}</span>
                      </button>
                    </div>
                    <div className="font-mono text-xl font-black text-yellow-400 tracking-wider">
                      00001007035676
                    </div>
                    <p className="text-[10px] text-yellow-200/80">
                      Utilizzabile direttamente per versamenti su bollettino di conto corrente postale o bonifici da BancoPosta.
                    </p>
                  </div>

                  {/* Codice IBAN Poste */}
                  <div className="p-4 rounded-2xl bg-slate-900 border-2 border-yellow-500/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-yellow-400" />
                        <span>Codice IBAN Ufficiale:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => copiaTesto('IT40P0760113600001007035676', 'iban-poste-main')}
                        className="text-xs px-3 py-1 rounded-lg bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 font-black flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-md"
                      >
                        {copiatoKey === 'iban-poste-main' ? <Check className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5 text-slate-950" />}
                        <span>{copiatoKey === 'iban-poste-main' ? 'Copiato!' : 'Copia IBAN'}</span>
                      </button>
                    </div>
                    <div className="font-mono text-sm sm:text-base font-black text-white bg-slate-950 p-3 rounded-xl border border-slate-800 tracking-widest break-all select-all text-center">
                      IT40 P076 0113 6000 0100 7035 676
                    </div>
                    <div className="text-[10px] text-slate-400 text-center font-mono">
                      Formato compatto: <strong className="text-yellow-300 select-all">IT40P0760113600001007035676</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Codice Fiscale Ente: <strong className="text-white font-mono">92035360459</strong></span>
                <span className="text-yellow-400 font-bold">BancoPosta Impresa</span>
              </div>
            </div>

            {/* SCHEDA 2: CREDIT AGRICOLE */}
            <div className="bg-slate-950 rounded-3xl border-2 border-emerald-500/50 p-6 shadow-2xl space-y-5 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 flex items-center justify-center font-black text-lg shadow-lg">
                      🏛️
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                        Conto Corrente Bancario Istituzionale
                      </span>
                      <h4 className="text-xl font-black text-white">Credit Agricole</h4>
                      <span className="text-xs text-slate-400">Crédit Agricole Italia S.p.A. • Circuito Bancario SEPA</span>
                    </div>
                  </div>

                  <span className="text-[10px] uppercase font-bold text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded-xl border border-emerald-700/50 font-mono shrink-0">
                    Attivo & Certificato
                  </span>
                </div>

                {/* Dettagli Conto Credit Agricole */}
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold">Intestatario Ufficiale:</span>
                      <button
                        type="button"
                        onClick={() => copiaTesto('CROCE ORO MASSA CARRARA ODV', 'intestatario-ca')}
                        className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiatoKey === 'intestatario-ca' ? 'Copiato' : 'Copia'}</span>
                      </button>
                    </div>
                    <div className="text-sm font-black text-white tracking-wide">
                      CROCE ORO MASSA CARRARA ODV
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-bold">Banca d'Appoggio:</span>
                    </div>
                    <div className="text-sm font-black text-white">
                      Credit Agricole
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-300 font-bold uppercase tracking-wider">
                        Destinazione Operativa:
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Tesoreria Centrale OdV</span>
                    </div>
                    <div className="text-xs text-slate-300 leading-relaxed">
                      Conto principale per bonifici SEPA, stipendi/rimborsi, incasso convenzioni ASL e contributi enti locali e privati.
                    </div>
                  </div>

                  {/* Codice IBAN Credit Agricole */}
                  <div className="p-4 rounded-2xl bg-slate-900 border-2 border-emerald-500/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Codice IBAN Ufficiale:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => copiaTesto('IT79M0623024500000046980317', 'iban-ca-main')}
                        className="text-xs px-3 py-1 rounded-lg bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-md"
                      >
                        {copiatoKey === 'iban-ca-main' ? <Check className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5 text-slate-950" />}
                        <span>{copiatoKey === 'iban-ca-main' ? 'Copiato!' : 'Copia IBAN'}</span>
                      </button>
                    </div>
                    <div className="font-mono text-sm sm:text-base font-black text-white bg-slate-950 p-3 rounded-xl border border-slate-800 tracking-widest break-all select-all text-center">
                      IT79 M062 3024 5000 0004 6980 317
                    </div>
                    <div className="text-[10px] text-slate-400 text-center font-mono">
                      Formato compatto: <strong className="text-emerald-300 select-all">IT79M0623024500000046980317</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Codice Fiscale Ente: <strong className="text-white font-mono">92035360459</strong></span>
                <span className="text-emerald-400 font-bold">Conto Corrente Enti Terzo Settore</span>
              </div>
            </div>
          </div>

          {/* BOX CONDIVISIONE RAPIDA CONTI PER OPERATORI */}
          <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CheckCheck className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm font-black text-white uppercase">
                  Modello Pronto per Invio Rapido a Cittadini, Donatori e Fornitori
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  const msg = `Coordinate Bancarie CROCE ORO MASSA CARRARA ODV (CF: 92035360459)\n` +
                    `• POSTE ITALIANE: IBAN IT40P0760113600001007035676 (C/C n. 00001007035676)\n` +
                    `• CREDIT AGRICOLE: IBAN IT79M0623024500000046980317\n` +
                    `Intestatario: CROCE ORO MASSA CARRARA ODV\n` +
                    `Causale da indicare: Erogazione liberale / Quota associativa / Saldo servizio`;
                  copiaTesto(msg, 'msg-rapido');
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow"
              >
                {copiatoKey === 'msg-rapido' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiatoKey === 'msg-rapido' ? 'Copiato!' : 'Copia Messaggio Rapido'}</span>
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 font-mono text-xs text-slate-300 space-y-1.5 select-all leading-relaxed">
              <div className="text-amber-400 font-bold">🏢 CROCE ORO MASSA CARRARA ODV — Coordinate Bancarie e Postali</div>
              <div><strong>Codice Fiscale:</strong> 92035360459 (RUNTS)</div>
              <div className="pt-1 text-slate-200"><strong>1) Conto BancoPosta:</strong> Banca POSTE ITALIANE • C/C 00001007035676 • IBAN: <span className="text-yellow-400 font-bold">IT40P0760113600001007035676</span></div>
              <div className="text-slate-200"><strong>2) Conto Bancario:</strong> Credit Agricole • IBAN: <span className="text-emerald-400 font-bold">IT79M0623024500000046980317</span></div>
              <div className="text-slate-400 pt-1 text-[11px]">Intestatario di entrambi i conti: CROCE ORO MASSA CARRARA ODV</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs text-slate-400">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Donazioni deducibili e detraibili (Art. 83 Codice Terzo Settore).</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Stampate in automatico sulle Note di Debito e Ricevute Ufficiali.</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <Building2 className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Condivise con tutte le 5 sezioni territoriali della Croce Oro.</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {modaleSedeAperta && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-rose-500/50 rounded-3xl max-w-3xl w-full p-5 shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-rose-400" />
                <h3 className="text-base font-black text-white uppercase">
                  {sedeInModifica ? `Modifica Scheda Sede: ${sedeInModifica.nome}` : 'Nuova Sede Associativa'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleSedeAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalvaSede} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Codice Identificativo Sede</label>
                  <input
                    type="text"
                    required
                    value={formCodice}
                    onChange={(e) => setFormCodice(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-rose-400 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Tipologia Sede</label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  >
                    <option value="Sede Legale & Territoriale">Sede Legale & Territoriale</option>
                    <option value="Sede Operativa H24 & Centrale">Sede Operativa H24 & Centrale</option>
                    <option value="Sezione Territoriale">Sezione Territoriale</option>
                    <option value="Polo Logistico & Magazzino">Polo Logistico & Magazzino</option>
                    <option value="Postazione Convenzionata 118">Postazione Convenzionata 118</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Denominazione Ufficiale</label>
                <input
                  type="text"
                  required
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                  placeholder="es. Sede Operativa Massa (Le Jare)"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 font-bold mb-1">Indirizzo Completo</label>
                  <input
                    type="text"
                    required
                    value={formIndirizzo}
                    onChange={(e) => setFormIndirizzo(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Comune</label>
                  <input
                    type="text"
                    required
                    value={formComune}
                    onChange={(e) => setFormComune(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Telefono Fisso</label>
                  <input
                    type="text"
                    required
                    value={formTel}
                    onChange={(e) => setFormTel(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Cellulare Emergenze H24</label>
                  <input
                    type="text"
                    required
                    value={formCell}
                    onChange={(e) => setFormCell(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Responsabile di Sede</label>
                  <input
                    type="text"
                    required
                    value={formResponsabile}
                    onChange={(e) => setFormResponsabile(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1 flex items-center justify-between">
                    <span>Assegna Mezzi alla Sede (Menù a Tendina)</span>
                    <span className="text-[10px] text-teal-400 font-mono">
                      {formMezziList.length} {formMezziList.length === 1 ? 'mezzo assegnato' : 'mezzi assegnati'}
                    </span>
                  </label>

                  {/* Menù a tendina: solo mezzi caricati in MEZZI non assegnati ad altre sezioni */}
                  {(() => {
                    const mezziDisponibili = mezzi.filter((m) => {
                      if (formMezziList.includes(m.sigla)) return false;
                      const sedeTargetNome = formNome.trim();
                      const sedeAttualeDelMezzo = (m.sedeStazionamento || '').trim();
                      const nonAssegnato = !sedeAttualeDelMezzo || sedeAttualeDelMezzo === 'Non Assegnata';
                      const appartieneGiaAQuestaSede = (sedeInModifica && sedeAttualeDelMezzo.toLowerCase() === sedeInModifica.nome.toLowerCase()) ||
                        (sedeTargetNome && sedeAttualeDelMezzo.toLowerCase() === sedeTargetNome.toLowerCase());
                      return nonAssegnato || appartieneGiaAQuestaSede;
                    });

                    return (
                      <div className="space-y-2">
                        <select
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val && !formMezziList.includes(val)) {
                              setFormMezziList([...formMezziList, val]);
                            }
                          }}
                          className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-rose-300 font-bold text-xs focus:border-rose-500 focus:outline-none cursor-pointer"
                        >
                          <option value="">
                            {mezziDisponibili.length > 0
                              ? `➕ Seleziona un mezzo non assegnato (${mezziDisponibili.length} disponibili)...`
                              : '⚠️ Nessun altro mezzo disponibile (tutti assegnati ad altre sezioni)'}
                          </option>
                          {mezziDisponibili.map((m) => (
                            <option key={m.id} value={m.sigla}>
                              🚑 {m.sigla} — {m.modello} ({m.tipo} • {m.flotta === 'vet' ? 'Emergenza/Vet' : 'Prot. Civile'})
                            </option>
                          ))}
                        </select>

                        {/* Elenco Mezzi Assegnati alla Sezione */}
                        {formMezziList.length === 0 ? (
                          <div className="text-[11px] text-slate-500 italic p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                            Nessun mezzo associativo assegnato a questa sezione territoriale. Scegline uno dal menù a tendina.
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {formMezziList.map((sigla) => {
                              const mezzoDati = mezzi.find((m) => m.sigla === sigla);
                              return (
                                <span
                                  key={sigla}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs font-mono font-bold shadow-sm"
                                >
                                  <span>{sigla}</span>
                                  {mezzoDati && (
                                    <span className="text-[10px] text-rose-300/80 font-sans font-normal truncate max-w-[130px]">
                                      {mezzoDati.modello}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setFormMezziList(formMezziList.filter((s) => s !== sigla))}
                                    className="w-4 h-4 rounded-full bg-rose-900/80 hover:bg-red-600 text-white flex items-center justify-center text-[10px] cursor-pointer ml-0.5"
                                    title="Rimuovi questo mezzo da questa sezione"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Dotazioni Locali (separate da virgola)</label>
                  <input
                    type="text"
                    value={formDotazioni}
                    onChange={(e) => setFormDotazioni(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200"
                    placeholder="Centrale Radio, DAE, Locale Riposo Equipaggi"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Orari di Operatività</label>
                  <input
                    type="text"
                    value={formOrari}
                    onChange={(e) => setFormOrari(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200"
                    placeholder="Operativo H24 365 Giorni all'Anno"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Note Aggiuntive / Presidio</label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-300"
                  placeholder="Eventuali note logistiche o istruzioni operative"
                />
              </div>

              {/* COORDINATE BANCARIE E POSTALI DELLA SEDE / ASSOCIAZIONE */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-xs text-emerald-400 uppercase flex items-center gap-1.5">
                    <Landmark className="w-4 h-4" />
                    <span>Coordinate Bancarie & Postali dell'Associazione (2 Conti)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Tesoreria Ufficiale</span>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1 text-[11px]">Intestatario Ufficiale Conti Correnti</label>
                  <input
                    type="text"
                    required
                    value={formIntestatarioConti}
                    onChange={(e) => setFormIntestatarioConti(e.target.value.toUpperCase())}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-xs uppercase"
                    placeholder="CROCE ORO MASSA CARRARA ODV"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Poste Italiane */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-yellow-500/30 space-y-2">
                    <span className="block font-bold text-[11px] text-yellow-400">🟡 Conto Postale (Poste Italiane)</span>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Banca d'Appoggio</label>
                      <input
                        type="text"
                        value={formBancaPoste}
                        onChange={(e) => setFormBancaPoste(e.target.value)}
                        className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-[11px] font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Codice IBAN Postale</label>
                      <input
                        type="text"
                        value={formIbanPoste}
                        onChange={(e) => setFormIbanPoste(e.target.value.toUpperCase().replace(/\s/g, ''))}
                        className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-yellow-300 font-mono text-[11px] font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Numero C/C Postale</label>
                      <input
                        type="text"
                        value={formCcPostale}
                        onChange={(e) => setFormCcPostale(e.target.value.replace(/\s/g, ''))}
                        className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-yellow-300 font-mono text-[11px] font-bold"
                      />
                    </div>
                  </div>

                  {/* Credit Agricole */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-emerald-500/30 space-y-2">
                    <span className="block font-bold text-[11px] text-emerald-400">🟢 Conto Bancario (Credit Agricole)</span>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Banca d'Appoggio</label>
                      <input
                        type="text"
                        value={formBancaAppoggio}
                        onChange={(e) => setFormBancaAppoggio(e.target.value)}
                        className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-[11px] font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Codice IBAN Bancario</label>
                      <input
                        type="text"
                        value={formIbanBanca}
                        onChange={(e) => setFormIbanBanca(e.target.value.toUpperCase().replace(/\s/g, ''))}
                        className="w-full p-1.5 rounded-lg bg-slate-950 border border-slate-700 text-emerald-300 font-mono text-[11px] font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* GEOLOCALIZZAZIONE SU MAPPA INTERATTIVA O COORDINATE MANUALI */}
              <GeolocalizzazioneMappaSede
                lat={formLat}
                lng={formLng}
                indirizzo={formIndirizzo}
                comune={formComune}
                cap={formCap}
                nomeSede={formNome}
                onChange={({ lat, lng }) => {
                  setFormLat(lat);
                  setFormLng(lng);
                }}
              />

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleSedeAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>Salva Sede Associativa</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE GESTIONE MEZZI ASSEGNATI ALLA SEDE */}
      {modaleGestioneMezziSedeAperta && sedePerGestioneMezzi && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl max-w-xl w-full p-5 shadow-2xl text-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black text-white uppercase">
                  Gestione Mezzi: {sedePerGestioneMezzi.nome}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModaleGestioneMezziSedeAperta(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block mb-1 font-bold">Sezione Territoriale Selezionata:</span>
                <div className="text-sm font-black text-white">🏢 {sedePerGestioneMezzi.nome}</div>
                <div className="text-xs text-slate-400">{sedePerGestioneMezzi.indirizzoCompleto}, {sedePerGestioneMezzi.comune}</div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-slate-300 font-bold uppercase tracking-wide">
                    Seleziona i Mezzi da Assegnare a questa Sede:
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMezziSelezionatiSede(mezzi.map((m) => m.sigla))}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                    >
                      Seleziona Tutti
                    </button>
                    <span className="text-slate-600">•</span>
                    <button
                      type="button"
                      onClick={() => setMezziSelezionatiSede([])}
                      className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Deseleziona Tutti
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1 bg-slate-950 rounded-2xl border border-slate-800">
                  {mezzi.map((m) => {
                    const isSelezionato = mezziSelezionatiSede.includes(m.sigla);
                    const isGiaInQuestaSede = m.sedeStazionamento === sedePerGestioneMezzi.nome;

                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          if (isSelezionato) {
                            setMezziSelezionatiSede(mezziSelezionatiSede.filter((s) => s !== m.sigla));
                          } else {
                            setMezziSelezionatiSede([...mezziSelezionatiSede, m.sigla]);
                          }
                        }}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                          isSelezionato
                            ? 'bg-amber-950/50 border-amber-500 text-white shadow-md'
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <input
                            type="checkbox"
                            checked={isSelezionato}
                            onChange={() => {}}
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer pointer-events-none"
                          />
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-amber-400 text-xs">{m.sigla}</span>
                              <span className="text-[10px] text-slate-400 truncate">{m.modello}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate">
                              Attuale: <strong className={isGiaInQuestaSede ? 'text-emerald-400' : 'text-slate-300'}>{m.sedeStazionamento}</strong>
                            </span>
                          </div>
                        </div>

                        {isGiaInQuestaSede && (
                          <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[9px] font-bold uppercase shrink-0">
                            Attuale
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  Mezzi assegnati alla sede:
                </span>
                <span className="font-mono font-black text-amber-400 text-sm">
                  {mezziSelezionatiSede.length} Mezzi
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModaleGestioneMezziSedeAperta(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleConfermaGestioneMezziSede}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Salva Assegnazione ({mezziSelezionatiSede.length} Mezzi)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
