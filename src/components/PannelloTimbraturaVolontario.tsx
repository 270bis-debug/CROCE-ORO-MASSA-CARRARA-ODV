import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  History,
  ShieldCheck,
  RefreshCw,
  Award,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Building2,
  GraduationCap,
  Briefcase,
  Edit3
} from 'lucide-react';
import { TimbraturaVolontario, SedeAssociativaCompleta, LuogoTimbratura, CorsoFormazione, TurnoSedeOperativa } from '../types/adminTypes';
import { LUOGHI_TIMBRATURA_DEFAULT } from '../data/adminMockData';
import { PosizioneGPS } from './MappaOperativa';
import {
  formatOrarioConSecondi,
  calcolaDurataTimbratura,
  formatDurataTimbratura,
  formatLocalISODate
} from '../utils/exportTimbrature';
import { addDaysISODate, formatTimeItaly, getCurrentYearItaly } from '../utils/italianTime';
import { rilevaAttivitaProgrammataPerTimbratura } from '../utils/turnoVerifica';

// Formula geodesica di Haversine per calcolare la distanza in metri tra due coordinate GPS
export function calcolaDistanzaMetri(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // raggio terrestre in metri
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Limite predefinito di tolleranza di base se non specificato dall'operatore
export const RAGGIO_MAX_TIMBRATURA_METRI = 20;

export function getLuoghiTimbraturaServizioAttivi(
  luoghiTimbratura: LuogoTimbratura[] | undefined,
  sedi: SedeAssociativaCompleta[]
): LuogoTimbratura[] {
  const baseLuoghi =
    luoghiTimbratura !== undefined
      ? luoghiTimbratura
      : LUOGHI_TIMBRATURA_DEFAULT;

  const attivi = baseLuoghi.filter(l => l.attivo !== false);

  // Integrazione sedi associative solo se non già configurate in luoghiTimbratura (rispetta eventuali disattivazioni Admin)
  if (sedi && sedi.length > 0) {
    sedi.forEach(sede => {
      const giaConfigurata = baseLuoghi.some(p =>
        p.nome.toLowerCase() === sede.nome.toLowerCase() ||
        (p.codice && p.codice.toLowerCase() === sede.id.toLowerCase())
      );
      if (!giaConfigurata && sede.coordinate && typeof sede.coordinate.lat === 'number' && typeof sede.coordinate.lng === 'number') {
        attivi.push({
          id: `sede-${sede.id}`,
          nome: sede.nome,
          codice: sede.id,
          indirizzo: sede.indirizzoCompleto || 'Massa Carrara',
          coordinate: sede.coordinate,
          raggioMetri: RAGGIO_MAX_TIMBRATURA_METRI,
          tipo: 'sede',
          attivo: true,
          descrizione: 'Sede Associativa Ufficiale Croce Oro'
        });
      }
    });
  }

  return attivi;
}

export function trovaLuogoAutorizzatoPerPosizione(
  posizione: { lat: number; lng: number } | null | undefined,
  luoghi: LuogoTimbratura[]
): {
  luogoValido: (LuogoTimbratura & { distanza: number }) | null;
  luogoPiuVicino: (LuogoTimbratura & { distanza: number }) | null;
} {
  if (!posizione || typeof posizione.lat !== 'number' || typeof posizione.lng !== 'number' || !luoghi || luoghi.length === 0) {
    return { luogoValido: null, luogoPiuVicino: null };
  }
  const conDistanze = luoghi
    .map(p => ({
      ...p,
      distanza: calcolaDistanzaMetri(posizione.lat, posizione.lng, p.coordinate.lat, p.coordinate.lng)
    }))
    .sort((a, b) => a.distanza - b.distanza);

  const luogoPiuVicino = conDistanze[0] || null;
  const luogoValido = conDistanze.find(p => p.distanza <= (p.raggioMetri || RAGGIO_MAX_TIMBRATURA_METRI)) || null;
  return { luogoValido, luogoPiuVicino };
}

interface PannelloTimbraturaVolontarioProps {
  volontarioId: string;
  volontarioNome: string;
  qualifica?: string;
  posizioneGps: PosizioneGPS;
  onAggiornaPosizioneGps: (nuovaPos: PosizioneGPS) => void;
  sedi: SedeAssociativaCompleta[];
  timbrature: TimbraturaVolontario[];
  onSalvaTimbrature: (nuove: TimbraturaVolontario[]) => void;
  onNotifica?: (testo: string, tipo?: 'centrale' | 'mezzo' | 'sistema' | 'allarme') => void;
  luoghiTimbratura?: LuogoTimbratura[];
  corsiFormazione?: CorsoFormazione[];
  turni?: TurnoSedeOperativa[];
  onTimbraPresenzaGPSCorso?: (
    corsoId: string,
    volontario: any,
    tipo: 'entrata' | 'uscita',
    coords: { lat: number; lng: number },
    distanzaMetri: number,
    lezioneId?: string
  ) => void;
  onTimbraturaServizioRegistrata?: (tipo: 'entrata' | 'uscita', timbratura: TimbraturaVolontario) => void;
}

export const PannelloTimbraturaVolontario: React.FC<PannelloTimbraturaVolontarioProps> = ({
  volontarioId,
  volontarioNome,
  qualifica = 'Volontario Soccorritore',
  posizioneGps,
  onAggiornaPosizioneGps,
  sedi,
  timbrature,
  onSalvaTimbrature,
  onNotifica,
  luoghiTimbratura,
  corsiFormazione,
  turni,
  onTimbraPresenzaGPSCorso,
  onTimbraturaServizioRegistrata
}) => {
  // Stato espansione storico timbrature
  const [mostraStorico, setMostraStorico] = useState(false);
  const [erroreGps, setErroreGps] = useState<string | null>(null);
  const [avvisoSuccesso, setAvvisoSuccesso] = useState<string | null>(null);
  const [inRilevamentoGps, setInRilevamentoGps] = useState(false);
  const [attivitaManuale, setAttivitaManuale] = useState('');
  const [oraLiveConSecondi, setOraLiveConSecondi] = useState(() => formatOrarioConSecondi());

  useEffect(() => {
    const timer = setInterval(() => {
      setOraLiveConSecondi(formatOrarioConSecondi());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filtri temporali per lo storico: Data Inizio e Data Fine
  const oggiStr = formatLocalISODate();
  const primoDelMeseStr = oggiStr.slice(0, 8) + '01';
  const [dataInizioFiltro, setDataInizioFiltro] = useState(primoDelMeseStr);
  const [dataFineFiltro, setDataFineFiltro] = useState(oggiStr);

  // Elenco unificato dei luoghi autorizzati per la timbratura GPS con effetto immediato
  const elencoPuntiValidi = useMemo<LuogoTimbratura[]>(() => {
    const attivi = getLuoghiTimbraturaServizioAttivi(luoghiTimbratura, sedi);

    // Integrazione sedi e lezioni dei Corsi di Formazione a cui l'account volontario è iscritto
    if (corsiFormazione && corsiFormazione.length > 0) {
      const vNomeNorm = (volontarioNome || '').trim().toLowerCase();
      const corsiIscritto = corsiFormazione.filter(c =>
        c.iscritti && c.iscritti.some(p =>
          (volontarioId && p.volontarioId === volontarioId) ||
          (p.volontarioNome && p.volontarioNome.trim().toLowerCase() === vNomeNorm)
        )
      );

      corsiIscritto.forEach(c => {
        if (c.lezioni && c.lezioni.length > 0) {
          c.lezioni.forEach(lez => {
            if (lez.coordinate && typeof lez.coordinate.lat === 'number' && typeof lez.coordinate.lng === 'number') {
              const puntoId = `corso-${c.id}-lez-${lez.id}`;
              const giaPresente = attivi.some(p => p.id === puntoId);
              if (!giaPresente) {
                attivi.push({
                  id: puntoId,
                  nome: `🎓 ${c.titolo} - Lez. #${lez.numero} (${lez.sedeNome})`,
                  codice: c.codiceCorso,
                  indirizzo: lez.indirizzoCompleto || c.indirizzoCompleto || 'Sede didattica',
                  coordinate: lez.coordinate,
                  raggioMetri: 500, // tolleranza autorizzata per sede didattica corso
                  tipo: 'corso_formazione',
                  attivo: true,
                  descrizione: `Corso Formazione "${c.titolo}" • Lezione #${lez.numero} (${lez.data || ''} ${lez.orarioInizio || ''}-${lez.orarioFine || ''})`
                });
              }
            }
          });
        } else if (c.coordinate && typeof c.coordinate.lat === 'number' && typeof c.coordinate.lng === 'number') {
          const puntoId = `corso-${c.id}`;
          const giaPresente = attivi.some(p => p.id === puntoId);
          if (!giaPresente) {
            attivi.push({
              id: puntoId,
              nome: `🎓 ${c.titolo} (${c.sedeCorso})`,
              codice: c.codiceCorso,
              indirizzo: c.indirizzoCompleto || 'Sede didattica',
              coordinate: c.coordinate,
              raggioMetri: 500,
              tipo: 'corso_formazione',
              attivo: true,
              descrizione: `Corso Formazione "${c.titolo}"`
            });
          }
        }
      });
    }

    return attivi;
  }, [luoghiTimbratura, sedi, corsiFormazione, volontarioId, volontarioNome]);

  const [mostraElencoLuoghi, setMostraElencoLuoghi] = useState(false);

  // Calcolo verifica raggio di validità a discrezione dell'operatore (Effetto Immediato)
  const analisiDistanza = useMemo(() => {
    if (!elencoPuntiValidi || elencoPuntiValidi.length === 0) {
      return {
        luogoValido: null,
        luogoPiuVicino: null,
        distanzaMetri: 9999,
        raggioConsentitoMetri: 20,
        nelRaggioConsentito: false,
        elencoConDistanze: []
      };
    }

    let minDistanza = Infinity;
    let puntoPiuVicino: LuogoTimbratura | null = null;
    let puntoValidoTrovato: LuogoTimbratura | null = null;

    const conDistanze = elencoPuntiValidi.map(punto => {
      const d = calcolaDistanzaMetri(
        posizioneGps.lat,
        posizioneGps.lng,
        punto.coordinate.lat,
        punto.coordinate.lng
      );
      const raggio = punto.raggioMetri || 20;
      const isInRange = d <= raggio;

      if (d < minDistanza) {
        minDistanza = d;
        puntoPiuVicino = punto;
      }
      if (isInRange && !puntoValidoTrovato) {
        puntoValidoTrovato = punto;
      }

      return {
        ...punto,
        distanza: d,
        isInRange
      };
    }).sort((a, b) => a.distanza - b.distanza);

    // Se uno o più luoghi sono nel raggio consentito, seleziona il più vicino tra quelli validati
    const puntoInRaggio = conDistanze.find(p => p.isInRange) || null;
    const luogoTarget = puntoInRaggio || puntoPiuVicino || elencoPuntiValidi[0];
    const distTarget = puntoInRaggio ? puntoInRaggio.distanza : (minDistanza === Infinity ? 9999 : minDistanza);
    const raggioTarget = luogoTarget?.raggioMetri || 20;

    return {
      luogoValido: puntoInRaggio,
      luogoPiuVicino: luogoTarget,
      distanzaMetri: distTarget,
      raggioConsentitoMetri: raggioTarget,
      nelRaggioConsentito: !!puntoInRaggio,
      elencoConDistanze: conDistanze
    };
  }, [elencoPuntiValidi, posizioneGps.lat, posizioneGps.lng]);

  // Helper per verificare se un record di timbratura appartiene al volontario corrente
  const isMioRecord = (t: TimbraturaVolontario) => {
    if (volontarioId && t.volontarioId === volontarioId) return true;
    if (volontarioNome && t.volontarioNome && t.volontarioNome.trim().toLowerCase() === volontarioNome.trim().toLowerCase()) return true;
    return false;
  };

  // Verifica se il volontario ha una timbratura attiva aperta (senza orario di uscita)
  const timbraturaAttiva = useMemo(() => {
    return timbrature.find(
      (t) => isMioRecord(t) && !t.orarioUscita
    );
  }, [timbrature, volontarioId, volontarioNome]);

  // Rilevamento automatico attività "Cosa stai facendo?" da Turni (qualsiasi tabellone) o Corsi/Formazione
  const attivitaRilevata = useMemo(() => {
    const validId = analisiDistanza.luogoValido?.id;
    let targetCorsoId: string | undefined;
    let targetLezioneId: string | undefined;
    if (validId && validId.startsWith('corso-')) {
      const clean = validId.replace('corso-', '');
      const parts = clean.split('-lez-');
      targetCorsoId = parts[0];
      targetLezioneId = parts[1] || undefined;
    }
    return rilevaAttivitaProgrammataPerTimbratura({
      volontarioId,
      volontarioNome,
      turni,
      corsiFormazione,
      targetCorsoId,
      targetLezioneId
    });
  }, [analisiDistanza.luogoValido, volontarioId, volontarioNome, turni, corsiFormazione]);

  // Calcolo ore di volontariato regolarmente timbrate nel mese in corso
  const oreMeseCorrente = useMemo(() => {
    const prefissoMese = oggiStr.slice(0, 7); // es. "2026-10"
    const mieDelMese = timbrature.filter(
      (t) => isMioRecord(t) && t.data.startsWith(prefissoMese) && typeof t.oreTotali === 'number'
    );
    const sommaOre = mieDelMese.reduce((acc, curr) => acc + (curr.oreTotali || 0), 0);
    return Math.round(sommaOre * 10) / 10;
  }, [timbrature, volontarioId, volontarioNome, oggiStr]);

  const conteggioTurniMese = useMemo(() => {
    const prefissoMese = oggiStr.slice(0, 7);
    return timbrature.filter(
      (t) => isMioRecord(t) && t.data.startsWith(prefissoMese)
    ).length;
  }, [timbrature, volontarioId, volontarioNome, oggiStr]);

  // Calcolo ore di servizio timbrate nell'anno in corso (2026) esclusivamente per il volontario corrente
  const annoCorrenteStr = oggiStr.slice(0, 4); // "2026"
  const oreAnnoCorrente = useMemo(() => {
    const mieDellAnno = timbrature.filter(
      (t) => isMioRecord(t) && t.data && t.data.startsWith(annoCorrenteStr) && typeof t.oreTotali === 'number'
    );
    const sommaOre = mieDellAnno.reduce((acc, curr) => acc + (curr.oreTotali || 0), 0);
    return Math.round(sommaOre * 10) / 10;
  }, [timbrature, volontarioId, volontarioNome, annoCorrenteStr]);

  const conteggioTurniAnno = useMemo(() => {
    return timbrature.filter(
      (t) => isMioRecord(t) && t.data && t.data.startsWith(annoCorrenteStr)
    ).length;
  }, [timbrature, volontarioId, volontarioNome, annoCorrenteStr]);

  // Storico timbrature filtrate per Data Inizio e Data Fine
  const timbratureFiltrate = useMemo(() => {
    return timbrature
      .filter((t) => {
        if (!isMioRecord(t)) return false;
        if (dataInizioFiltro && t.data < dataInizioFiltro) return false;
        if (dataFineFiltro && t.data > dataFineFiltro) return false;
        return true;
      })
      .sort((a, b) => {
        const dateComp = b.data.localeCompare(a.data);
        if (dateComp !== 0) return dateComp;
        return (b.orarioIngresso || '').localeCompare(a.orarioIngresso || '');
      });
  }, [timbrature, volontarioId, dataInizioFiltro, dataFineFiltro]);

  const oreTotaliPeriodoFiltrato = useMemo(() => {
    const sum = timbratureFiltrate.reduce((acc, curr) => acc + (curr.oreTotali || 0), 0);
    return Math.round(sum * 10) / 10;
  }, [timbratureFiltrate]);

  // Funzione per forzare la lettura GPS reale dal dispositivo
  const rilevaGpsDispositivo = () => {
    setInRilevamentoGps(true);
    setErroreGps(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const nuova: PosizioneGPS = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuratezza: Math.round(pos.coords.accuracy),
            velocita: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : null,
            orario: formatTimeItaly(undefined, true)
          };
          onAggiornaPosizioneGps(nuova);
          setInRilevamentoGps(false);
          setAvvisoSuccesso(`GPS aggiornato: coordinate [${nuova.lat.toFixed(5)}, ${nuova.lng.toFixed(5)}] rilevate con accuratezza ±${nuova.accuratezza}m`);
          setTimeout(() => setAvvisoSuccesso(null), 5000);
        },
        (err) => {
          setInRilevamentoGps(false);
          setErroreGps(`Impossibile acquisire GPS: ${err.message}. Verifica le autorizzazioni di geolocalizzazione sul dispositivo.`);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    } else {
      setInRilevamentoGps(false);
      setErroreGps('Geolocalizzazione non supportata su questo browser.');
    }
  };

  // Azione Timbratura Ingresso / Uscita (Singolo pulsante unificato con orario HH:MM:SS e controllo stretto sulle posizioni autorizzate)
  const handleEseguiTimbratura = () => {
    setErroreGps(null);
    const now = new Date();
    const orarioCorrente = formatOrarioConSecondi(now);
    const dataCorrente = formatLocalISODate(now);

    if (!elencoPuntiValidi || elencoPuntiValidi.length === 0) {
      setErroreGps('⛔ Nessuna posizione autorizzata attiva per la timbratura. Contatta la Centrale Operativa.');
      return;
    }

    // Controllo rigoroso del perimetro autorizzato sia in ENTRATA che in USCITA
    if (!analisiDistanza.nelRaggioConsentito || !analisiDistanza.luogoValido) {
      const nomeTarget = analisiDistanza.luogoPiuVicino?.nome || 'Luogo autorizzato';
      const raggioTarget = analisiDistanza.raggioConsentitoMetri;
      const tipoAzione = timbraturaAttiva ? 'USCITA' : 'INGRESSO';
      setErroreGps(
        `⛔ Timbratura di ${tipoAzione} non consentita: ti trovi a ${analisiDistanza.distanzaMetri} metri da "${nomeTarget}". Sia l'entrata che l'uscita possono essere effettuate esclusivamente all'interno di una posizione autorizzata (raggio ${raggioTarget} metri), anche in una sede diversa rispetto all'entrata.`
      );
      if (onNotifica) {
        onNotifica(
          `⚠️ Tentativo di timbratura ${tipoAzione} respinto per ${volontarioNome}: distanza ${analisiDistanza.distanzaMetri}m (raggio consentito ${raggioTarget}m) da ${nomeTarget}`,
          'allarme'
        );
      }
      return;
    }

    const targetPunto = analisiDistanza.luogoValido;
    const nomeLuogo = targetPunto.nome || 'Sede Operativa Croce Oro';
    const raggioApplicato = targetPunto.raggioMetri || analisiDistanza.raggioConsentitoMetri;

    // Riconoscimento automatico se il luogo validato corrisponde a una lezione di un corso a cui il volontario è iscritto
    const isPuntoCorso = Boolean(targetPunto.id?.startsWith('corso-'));
    let targetCorsoId: string | undefined;
    let targetLezioneId: string | undefined;
    if (isPuntoCorso && targetPunto.id) {
      const clean = targetPunto.id.replace('corso-', '');
      const parts = clean.split('-lez-');
      targetCorsoId = parts[0];
      targetLezioneId = parts[1] || undefined;
    }

    if (!timbraturaAttiva) {
      // Verifica "Cosa stai facendo?" prima di registrare la timbratura di entrata
      const attivitaEffettiva = (attivitaRilevata.trovata ? attivitaRilevata.titolo : attivitaManuale).trim();
      if (!attivitaRilevata.trovata && !attivitaEffettiva) {
        setErroreGps('✏️ Scrivi prima nella riga "Cosa stai facendo?" l\'attività che stai svolgendo.');
        return;
      }

      // -------------------------------------------------------------
      // 1. TIMBRATURA INGRESSO (con secondi HH:MM:SS)
      // -------------------------------------------------------------
      const nuovaTimb: TimbraturaVolontario = {
        id: `timb-${Date.now()}`,
        volontarioId,
        volontarioNome,
        qualifica,
        data: dataCorrente,
        orarioIngresso: orarioCorrente,
        orarioUscita: undefined,
        oreTotali: undefined,
        mezzoAssegnato: attivitaRilevata.mezzoAssegnato,
        sede: nomeLuogo,
        coordinateIngresso: { lat: posizioneGps.lat, lng: posizioneGps.lng },
        modificataDaAdmin: false,
        corsoId: targetCorsoId,
        lezioneId: targetLezioneId,
        attivitaSvolta: attivitaEffettiva,
        tipoAttivita: attivitaRilevata.trovata ? (attivitaRilevata.tipo || 'turno') : 'manuale',
        note: isPuntoCorso
          ? `Timbratura INGRESSO LEZIONE CORSO FORMATIVO validata via GPS alle ${orarioCorrente} a ${analisiDistanza.distanzaMetri}m da ${nomeLuogo} (Raggio autorizzato: ${raggioApplicato}m - GPS: ${posizioneGps.lat.toFixed(5)}, ${posizioneGps.lng.toFixed(5)})`
          : `Timbratura INGRESSO validata via GPS alle ${orarioCorrente} a ${analisiDistanza.distanzaMetri}m da ${nomeLuogo} (Raggio autorizzato: ${raggioApplicato}m - GPS: ${posizioneGps.lat.toFixed(5)}, ${posizioneGps.lng.toFixed(5)})`
      };

      const aggiornate = [nuovaTimb, ...timbrature];
      onSalvaTimbrature(aggiornate);
      if (!attivitaRilevata.trovata) {
        setAttivitaManuale('');
      }

      // Notifica e aggiornamento registro presenze del corso oppure sincronizza Inizio Turno
      if (isPuntoCorso && targetCorsoId && onTimbraPresenzaGPSCorso) {
        onTimbraPresenzaGPSCorso(
          targetCorsoId,
          { id: volontarioId, nome: volontarioNome, qualifica },
          'entrata',
          posizioneGps,
          analisiDistanza.distanzaMetri,
          targetLezioneId
        );
      } else if (!isPuntoCorso && onTimbraturaServizioRegistrata) {
        onTimbraturaServizioRegistrata('entrata', nuovaTimb);
      }

      const msgConferma = isPuntoCorso
        ? `✅ Timbratura di INGRESSO CORSO registrata alle ore ${orarioCorrente} del ${dataCorrente} presso ${nomeLuogo}! Attività: ${attivitaEffettiva}.`
        : `✅ Timbratura di INGRESSO registrata alle ore ${orarioCorrente} del ${dataCorrente} presso ${nomeLuogo}! Attività: ${attivitaEffettiva}.`;
      setAvvisoSuccesso(msgConferma);

      if (onNotifica) {
        onNotifica(
          isPuntoCorso
            ? `🎓 INIZIO LEZIONE CORSO: ${volontarioNome} ha timbrato l'ingresso alle ${orarioCorrente} presso ${nomeLuogo} (${attivitaEffettiva})`
            : `🕒 TIMBRATURA INGRESSO & INIZIO TURNO: ${volontarioNome} ha timbrato alle ${orarioCorrente} presso ${nomeLuogo} • Attività: ${attivitaEffettiva}`,
          'centrale'
        );
      }
    } else {
      // -------------------------------------------------------------
      // 2. TIMBRATURA USCITA (anche in posizione autorizzata differente dall'ingresso, con calcolo fino ai secondi)
      // -------------------------------------------------------------
      const durata = calcolaDurataTimbratura(timbraturaAttiva.orarioIngresso, orarioCorrente);
      const oreCalc = durata.oreDecimali;
      const durataStr = durata.durataTesto !== '—' ? durata.durataTesto : '0s';
      const sedeEntrata = timbraturaAttiva.sede || nomeLuogo;
      const sedeDifferente = sedeEntrata.trim().toLowerCase() !== nomeLuogo.trim().toLowerCase();

      const timbCorsoId = timbraturaAttiva.corsoId || targetCorsoId;
      const timbLezioneId = timbraturaAttiva.lezioneId || targetLezioneId;
      const isCorsoAttivo = Boolean(timbCorsoId || isPuntoCorso || timbraturaAttiva.sede?.includes('Corso'));

      const timbChiusa: TimbraturaVolontario = {
        ...timbraturaAttiva,
        orarioUscita: orarioCorrente,
        sedeUscita: nomeLuogo,
        coordinateUscita: { lat: posizioneGps.lat, lng: posizioneGps.lng },
        oreTotali: oreCalc,
        oreEMinuti: durataStr,
        note: isCorsoAttivo
          ? `${timbraturaAttiva.note || ''} • USCITA LEZIONE timbrata via GPS alle ${orarioCorrente} a ${analisiDistanza.distanzaMetri}m da ${nomeLuogo} [Presenza convalidata: ${durataStr}]`
          : `${timbraturaAttiva.note || ''} • USCITA timbrata via GPS alle ${orarioCorrente} a ${analisiDistanza.distanzaMetri}m da ${nomeLuogo}${sedeDifferente ? ` (Sede uscita diversa da entrata: ${sedeEntrata})` : ''} (Raggio ammesso: ${raggioApplicato}m) [Durata: ${durataStr}]`
      };

      const aggiornate = timbrature.map((t) => (t.id === timbraturaAttiva.id ? timbChiusa : t));
      onSalvaTimbrature(aggiornate);

      // Notifica e aggiornamento registro presenze corso con ore, minuti e secondi precisi oppure sincronizza Fine Turno
      if (isCorsoAttivo && timbCorsoId && onTimbraPresenzaGPSCorso) {
        onTimbraPresenzaGPSCorso(
          timbCorsoId,
          { id: volontarioId, nome: volontarioNome, qualifica },
          'uscita',
          posizioneGps,
          analisiDistanza.distanzaMetri,
          timbLezioneId
        );
      }

      const infoSedeDiff = sedeDifferente ? ` (Entrata: ${sedeEntrata} ➔ Uscita: ${nomeLuogo})` : '';
      const msgConferma = isCorsoAttivo
        ? `🏁 Timbratura di USCITA CORSO registrata alle ore ${orarioCorrente} presso ${nomeLuogo}! Presenza alla lezione convalidata: ${durataStr} (${oreCalc}h) di frequenza effettiva.`
        : `🏁 Timbratura di USCITA & FINE TURNO registrata alle ore ${orarioCorrente} presso ${nomeLuogo}${infoSedeDiff}! Servizio completato: ${durataStr} (${oreCalc} ore).`;
      setAvvisoSuccesso(msgConferma);

      if (onNotifica) {
        onNotifica(
          isCorsoAttivo
            ? `🎓 FINE LEZIONE CORSO: ${volontarioNome} ha concluso la lezione alle ${orarioCorrente} presso ${nomeLuogo} (${durataStr})`
            : `🏁 TIMBRATURA USCITA & FINE TURNO: ${volontarioNome} ha terminato il servizio alle ${orarioCorrente} presso ${nomeLuogo}${infoSedeDiff} (${durataStr})`,
          'centrale'
        );
      }

      if (!isCorsoAttivo && onTimbraturaServizioRegistrata) {
        onTimbraturaServizioRegistrata('uscita', timbChiusa);
      }
    }
  };

  const meseAttualeNome = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date());

  return (
    <div className="w-full bg-slate-900/95 border-2 border-slate-700/80 rounded-2xl shadow-xl overflow-hidden my-0.5 text-slate-100">
      
      {/* Intestazione Sezione Timbratura GPS */}
      <div className="bg-gradient-to-r from-slate-950 via-[#1d1a60] to-slate-950 border-b border-amber-500/30 p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-amber-300 uppercase tracking-wide">
                Timbratura Presenza GPS
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 border border-slate-700 font-mono">
                📍 {elencoPuntiValidi.length} Luoghi Abilitati
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {volontarioNome} • {qualifica}
            </p>
          </div>
        </div>

        {/* Badge Orologio con Secondi & Stato Timbratura Attuale */}
        <div className="shrink-0 text-right flex items-center gap-1.5 flex-wrap justify-end">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-black">
            🕒 {oraLiveConSecondi}
          </span>
          {timbraturaAttiva ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-[10px] font-black uppercase animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              In Servizio (da {timbraturaAttiva.orarioIngresso})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-bold uppercase">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              Non Timbrato
            </span>
          )}
        </div>
      </div>

      <div className="p-2.5 sm:p-4 space-y-3">
        
        {/* KPI BOX: Ore Anno Corrente, Ore Mese Corrente & Turni Svolti (Esclusivo per il volontario) */}
        <div className="space-y-2">
          {/* Card Evidenziata: Totale Ore Timbrate nell'Anno (Solo del volontario) */}
          <div className="bg-gradient-to-r from-emerald-950/80 via-slate-950 to-teal-950/80 border-2 border-emerald-500/50 rounded-2xl p-3 shadow-xl flex items-center justify-between gap-2">
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  Le Tue Ore di Servizio Timbrate • Anno {annoCorrenteStr}
                </span>
                <span className="text-[8.5px] px-1.5 py-0.2 rounded-full bg-slate-900 text-slate-300 border border-slate-700 font-mono">
                  🔒 Personale
                </span>
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
                  {oreAnnoCorrente} <span className="text-sm font-bold text-emerald-200">ore</span>
                </span>
                <span className="text-xs text-slate-300 font-medium font-mono">
                  ({conteggioTurniAnno} turni registrati nel {annoCorrenteStr})
                </span>
              </div>
              <p className="text-[9.5px] text-slate-400">
                Conteggio automatico delle ore regolarmente vidimate con timbratura GPS in sede
              </p>
            </div>
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/10">
              <Award className="w-6 h-6 text-emerald-400" />
            </div>
          </div>

          {/* Dettaglio Mese e Turni */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-1.5 min-w-0">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wide break-words">
                  Ore Mese ({meseAttualeNome})
                </span>
                <span className="text-lg sm:text-xl font-black text-amber-400 font-mono">
                  {oreMeseCorrente} <span className="text-xs font-normal text-slate-400">h</span>
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-1.5 min-w-0">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wide break-words">
                  Turni Conclusi Mese
                </span>
                <span className="text-lg sm:text-xl font-black text-emerald-400 font-mono">
                  {conteggioTurniMese} <span className="text-xs font-normal text-slate-400">turni</span>
                </span>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Box Stato Geolocalizzazione GPS e Raggio di Validità Stabilito dall'Operatore */}
        <div className={`p-2.5 rounded-xl border text-xs transition-all ${
          analisiDistanza.nelRaggioConsentito
            ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
            : 'bg-amber-950/40 border-amber-500/50 text-amber-200'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <MapPin className={`w-4 h-4 shrink-0 mt-0.5 ${analisiDistanza.nelRaggioConsentito ? 'text-emerald-400' : 'text-amber-400 animate-bounce'}`} />
              <div className="min-w-0 flex-1">
                <div className="font-bold flex items-center gap-1.5 flex-wrap">
                  <span>
                    {analisiDistanza.nelRaggioConsentito
                      ? `✅ SEI NEL RAGGIO AUTORIZZATO (≤ ${analisiDistanza.raggioConsentitoMetri}m)`
                      : `⚠️ FUORI DAL RAGGIO AUTORIZZATO (> ${analisiDistanza.raggioConsentitoMetri}m)`}
                  </span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-black ${
                    analisiDistanza.nelRaggioConsentito ? 'bg-emerald-500/30 text-emerald-300' : 'bg-amber-500/30 text-amber-300'
                  }`}>
                    Distanza: {analisiDistanza.distanzaMetri} m (Raggio: {analisiDistanza.raggioConsentitoMetri}m)
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5 break-words">
                  Postazione: <strong className="text-white">{analisiDistanza.luogoPiuVicino?.nome || 'Luogo autorizzato'}</strong>
                  <span className="text-[10px] text-slate-400 ml-1">({analisiDistanza.luogoPiuVicino?.indirizzo || 'Massa Carrara'})</span>
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-slate-400 font-mono">
                  <span>GPS: {posizioneGps.lat.toFixed(5)}, {posizioneGps.lng.toFixed(5)}</span>
                  <span>•</span>
                  <span>Raggio operatore: <strong>{analisiDistanza.raggioConsentitoMetri}m</strong></span>
                  <span>•</span>
                  <span className="text-amber-300 font-bold">Effetto Immediato</span>
                </div>
              </div>
            </div>

            {/* Pulsante Aggiorna GPS Reale */}
            <div className="flex flex-row sm:flex-col flex-wrap gap-1.5 shrink-0">
              <button
                type="button"
                onClick={rilevaGpsDispositivo}
                disabled={inRilevamentoGps}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center gap-1 border border-slate-700 cursor-pointer active:scale-95 disabled:opacity-50"
                title="Rileva posizione GPS reale dal sensore del dispositivo"
              >
                <RefreshCw className={`w-3 h-3 text-amber-400 ${inRilevamentoGps ? 'animate-spin' : ''}`} />
                <span>Rileva GPS</span>
              </button>
            </div>
          </div>

          {/* Toggle cassetto Elenco Luoghi Autorizzati con raggio custom */}
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-1 text-[10.5px]">
            <button
              type="button"
              onClick={() => setMostraElencoLuoghi(!mostraElencoLuoghi)}
              className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer transition-colors text-left"
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                {mostraElencoLuoghi ? 'Nascondi' : 'Mostra'} tutti i Luoghi Autorizzati ({elencoPuntiValidi.length} postazioni attive)
              </span>
              {mostraElencoLuoghi ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
            </button>
            <span className="text-[9.5px] text-slate-400">
              Entrata/Uscita ammesse anche in posizioni autorizzate diverse
            </span>
          </div>

          {mostraElencoLuoghi && (
            <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {analisiDistanza.elencoConDistanze.map(p => (
                <div
                  key={p.id}
                  className={`p-1.5 rounded-lg border flex items-center justify-between gap-2 text-[10px] ${
                    p.isInRange
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white flex items-center gap-1 flex-wrap">
                      <span>{p.nome}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-amber-300 font-mono">
                        Raggio: {p.raggioMetri}m
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-400 truncate">
                      {p.indirizzo} • Distanza: <strong>{p.distanza}m</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {p.isInRange ? (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black text-[9px] uppercase">
                        Nel Raggio
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[9px]">
                        {p.distanza}m
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messaggi di Errore o Avviso */}
        {erroreGps && (
          <div className="p-2.5 bg-red-950/60 border border-red-500/70 rounded-xl text-xs text-red-200 flex items-start gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="leading-snug">{erroreGps}</div>
          </div>
        )}

        {/* MESSAGGIO DI CONFERMA PERMANENTE DELLA TIMBRATURA INGRESSO / USCITA */}
        {avvisoSuccesso && (
          <div className="p-3 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 border-2 border-emerald-400 rounded-xl text-xs text-emerald-100 flex items-start gap-2.5 shadow-lg animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 animate-bounce" />
            <div className="font-medium leading-relaxed">{avvisoSuccesso}</div>
          </div>
        )}

        {/* SE LA TIMBRATURA È GIÀ ATTIVA: MOSTRA IL MESSAGGIO CHE INDICA CHE È STATA REGOLARMENTE REGISTRATA */}
        {timbraturaAttiva && !avvisoSuccesso && (
          <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/50 rounded-xl text-xs text-emerald-200 flex flex-wrap items-center justify-between gap-2 shadow-sm">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0 mt-1" />
              <div className="min-w-0">
                <span className="font-bold text-white flex items-center gap-1.5 flex-wrap">
                  {timbraturaAttiva.corsoId ? <GraduationCap className="w-4 h-4 text-amber-400 shrink-0" /> : null}
                  <span>{timbraturaAttiva.corsoId ? 'Timbratura di INGRESSO CORSO FORMATIVO registrata' : 'Timbratura di INGRESSO regolarmente registrata'}</span>
                </span>
                <span className="text-[11px] text-emerald-300 break-words block">
                  Ingresso ore <strong className="font-mono">{timbraturaAttiva.orarioIngresso}</strong> ({timbraturaAttiva.data}) • Entrata presso <strong>{timbraturaAttiva.sede}</strong>
                </span>
                <span className="text-[10px] text-slate-300 block mt-0.5">
                  Puoi timbrare l'uscita in qualsiasi posizione autorizzata attiva (anche diversa dalla sede di entrata).
                </span>
              </div>
            </div>
            <span className="text-[10px] bg-emerald-900/60 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-700/50 shrink-0">
              {timbraturaAttiva.corsoId ? 'Presenza Corso' : 'Servizio Attivo'}
            </span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* RIGA "COSA STAI FACENDO?" (AUTO DA TURNO/CORSO O EDITABILE)   */}
        {/* ------------------------------------------------------------- */}
        <div className="p-3 rounded-xl bg-slate-950/90 border border-amber-500/40 space-y-2 shadow-inner">
          {/* Riga 1: Domanda chiara + provenienza rilevata */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-amber-300 uppercase tracking-wide">
              <Briefcase className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Cosa stai facendo?</span>
            </div>
            {timbraturaAttiva ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                ✓ Registrato all'entrata
              </span>
            ) : attivitaRilevata.trovata ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                {attivitaRilevata.tipo === 'corso' ? '🎓 Compilato da Corso/Formazione' : '📅 Compilato da Turno in App'}
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
                <Edit3 className="w-2.5 h-2.5" />
                <span>Campo editabile</span>
              </span>
            )}
          </div>

          {/* Riga 2: Valore automatico (se iscritto) oppure campo editabile (se non segnato da nessuna parte) */}
          {timbraturaAttiva ? (
            <div className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-emerald-500/30 text-xs font-bold text-white break-words">
              {timbraturaAttiva.attivitaSvolta || (attivitaRilevata.trovata ? attivitaRilevata.titolo : 'Servizio operativo')}
            </div>
          ) : attivitaRilevata.trovata ? (
            <div className="w-full px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-xs font-bold text-emerald-100 break-words">
              {attivitaRilevata.titolo}
            </div>
          ) : (
            <input
              type="text"
              value={attivitaManuale}
              onChange={(e) => {
                setAttivitaManuale(e.target.value);
                if (erroreGps) setErroreGps(null);
              }}
              placeholder="Scrivi cosa stai facendo (es. Servizio sede, Manutenzione mezzo, Segreteria...)"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-amber-500/50 text-xs font-medium text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* PULSANTE UNIFICATO PER TIMBRATURA INGRESSO ED USCITA CON GPS  */}
        {/* ------------------------------------------------------------- */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleEseguiTimbratura}
            className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm uppercase flex items-center justify-center gap-2.5 shadow-xl transition-all cursor-pointer active:scale-[0.98] border-2 ${
              !analisiDistanza.nelRaggioConsentito
                ? 'bg-slate-800 text-slate-400 border-slate-700 hover:border-amber-500 hover:text-amber-300'
                : timbraturaAttiva
                ? 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white border-rose-400 shadow-rose-950/50'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-300 shadow-emerald-950/50'
            }`}
          >
            <Clock className="w-5 h-5 shrink-0" />
            <div className="text-center leading-tight">
              <div>
                {timbraturaAttiva
                  ? `🏁 TIMBRATURA USCITA (${oraLiveConSecondi})`
                  : `🟢 TIMBRATURA INGRESSO (${oraLiveConSecondi})`}
              </div>
              <div className="text-[10px] font-normal opacity-90 tracking-normal normal-case mt-0.5">
                {analisiDistanza.nelRaggioConsentito
                  ? `Posizione autorizzata (${analisiDistanza.distanzaMetri}m da ${analisiDistanza.luogoValido?.nome || 'postazione'} - Raggio: ${analisiDistanza.raggioConsentitoMetri}m)`
                  : `Richiede posizione autorizzata entro ${analisiDistanza.raggioConsentitoMetri}m da "${analisiDistanza.luogoPiuVicino?.nome || 'postazione'}" (attuale: ${analisiDistanza.distanzaMetri}m)`}
              </div>
            </div>
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* SEZIONE STORICO DELLE TIMBRATURE CON FILTRO DATA INIZIO/FINE  */}
        {/* ------------------------------------------------------------- */}
        <div className="pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setMostraStorico(!mostraStorico)}
            className="w-full py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              <span>Storico Timbrature & Ore Volontariato ({timbratureFiltrate.length})</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-mono">
              <span>{oreTotaliPeriodoFiltrato}h nel periodo</span>
              {mostraStorico ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {mostraStorico && (
            <div className="mt-2.5 p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3 animate-in fade-in">
              
              {/* Filtri Data Inizio e Data Fine come richiesto tassativamente */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <span className="flex items-center gap-1">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                    Seleziona Periodo per Visualizzare lo Storico:
                  </span>
                  <span className="text-[10px] text-amber-300 font-mono">
                    Totale: {oreTotaliPeriodoFiltrato} ore
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                      Data Inizio
                    </label>
                    <input
                      type="date"
                      value={dataInizioFiltro}
                      onChange={(e) => setDataInizioFiltro(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">
                      Data Fine
                    </label>
                    <input
                      type="date"
                      value={dataFineFiltro}
                      onChange={(e) => setDataFineFiltro(e.target.value)}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Preimpostazioni Rapide Periodo */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDataInizioFiltro(primoDelMeseStr);
                      setDataFineFiltro(oggiStr);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-300 hover:text-white whitespace-nowrap cursor-pointer"
                  >
                    Mese Corrente
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDataInizioFiltro(addDaysISODate(oggiStr, -30));
                      setDataFineFiltro(oggiStr);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-300 hover:text-white whitespace-nowrap cursor-pointer"
                  >
                    Ultimi 30 Giorni
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const primoAnno = `${getCurrentYearItaly()}-01-01`;
                      setDataInizioFiltro(primoAnno);
                      setDataFineFiltro(oggiStr);
                    }}
                    className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-slate-300 hover:text-white whitespace-nowrap cursor-pointer"
                  >
                    Anno Intero
                  </button>
                </div>
              </div>

              {/* Elenco Timbrature nel Periodo Selezionato */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {timbratureFiltrate.length === 0 ? (
                  <div className="text-center py-4 text-xs text-slate-500 bg-slate-900/50 rounded-xl border border-dashed border-slate-800">
                    Nessuna timbratura registrata tra il {dataInizioFiltro} e il {dataFineFiltro}.
                  </div>
                ) : (
                  timbratureFiltrate.map((t) => (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-bold text-white font-mono">
                            {t.data}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {t.corsoId && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[9px] font-bold flex items-center gap-1">
                              <GraduationCap className="w-2.5 h-2.5" />
                              <span>Corso</span>
                            </span>
                          )}
                          {t.orarioUscita ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px] border border-emerald-500/40" title={`Durata convalidata: ${formatDurataTimbratura(t)}`}>
                              {formatDurataTimbratura(t)} ({t.oreTotali || 0}h)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold text-[10px] border border-amber-500/40 animate-pulse">
                              In corso
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-300 pt-0.5">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>
                            Ingresso: <strong className="text-white font-mono">{t.orarioIngresso}</strong>
                            {' → '}
                            Uscita: <strong className="text-white font-mono">{t.orarioUscita || '---'}</strong>
                          </span>
                        </div>
                      </div>

                      {t.attivitaSvolta && (
                        <div className="text-[11px] font-semibold text-amber-200 bg-slate-950/70 border border-slate-800 rounded-lg px-2 py-1 break-words">
                          <span className="text-slate-400 font-normal mr-1">Attività:</span>
                          {t.attivitaSvolta}
                        </div>
                      )}

                      <div className="text-[10px] text-slate-400 flex flex-wrap items-center justify-between gap-1 border-t border-slate-800/80 pt-1">
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="flex items-center gap-1 truncate">
                            <Building2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span className="truncate">
                              {t.sedeUscita && t.sedeUscita !== t.sede ? `Entrata: ${t.sede}` : t.sede}
                            </span>
                          </span>
                          {t.sedeUscita && t.sedeUscita !== t.sede && (
                            <span className="flex items-center gap-1 truncate text-amber-300">
                              <Building2 className="w-3 h-3 text-amber-400 shrink-0" />
                              <span className="truncate">Uscita: {t.sedeUscita}</span>
                            </span>
                          )}
                        </div>
                        {t.modificataDaAdmin && (
                          <span className="text-amber-400 font-semibold shrink-0 ml-1">
                            (Modificato da Amministrazione)
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};
