import { ChecklistTemplate, ChecklistCompilataTurno } from '../types/checklistTypes';

export const CHECKLIST_TEMPLATES_INIZIALI: ChecklistTemplate[] = [
  {
    id: 'chk-amb-emergenza',
    titolo: 'Checklist Inizio Turno Ambulanza Emergenza & Soccorso Veterinario',
    descrizione: 'Verifica tecnica, sanitaria e operativa obbligatoria prima di dare l\'operatività del mezzo alla Centrale.',
    tipologiaMezzo: 'Ambulanza Emergenza',
    attiva: true,
    dataCreazione: '01/01/2026',
    dataUltimaModifica: '28/10/2026',
    autore: 'Responsabile Parco Mezzi & Centrale',
    voci: [
      // 1. Documenti & Dotazioni
      {
        id: 'v-doc-1',
        categoria: 'Documenti & Dotazioni Bordo',
        titolo: 'Libretto di circolazione, assicurazione e scheda carburante presenti',
        descrizione: 'Controllare nel vano cruscotto il raccoglitore documenti di bordo.',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-doc-2',
        categoria: 'Documenti & Dotazioni Bordo',
        titolo: 'Telepass / Viacard di emergenza e torcia ricaricabile a bordo',
        critica: false,
        obbligatoria: true
      },
      {
        id: 'v-doc-3',
        categoria: 'Documenti & Dotazioni Bordo',
        titolo: 'Giubbotti alta visibilità e triangolo di emergenza omologati',
        critica: true,
        obbligatoria: true
      },
      // 2. Meccanica & Livelli
      {
        id: 'v-mec-1',
        categoria: 'Stato Meccanico & Livelli',
        titolo: 'Livello carburante > 1/2 serbatoio (autonomia per codice rosso)',
        descrizione: 'Se sotto metà serbatoio provvedere al rifornimento prima dell\'inizio turno.',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-mec-2',
        categoria: 'Stato Meccanico & Livelli',
        titolo: 'Livelli olio motore e liquido radiatore nella norma',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-mec-3',
        categoria: 'Stato Meccanico & Livelli',
        titolo: 'Pneumatici e pressione visivamente conformi (nessuna gomma sgonfia)',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-mec-4',
        categoria: 'Stato Meccanico & Livelli',
        titolo: 'Spazzole tergicristallo e liquido lavavetri operativi',
        critica: false,
        obbligatoria: true
      },
      // 3. Dispositivi Emergenza & Luci
      {
        id: 'v-luc-1',
        categoria: 'Dispositivi Emergenza & Luci',
        titolo: 'Lampeggianti blu a tetto e lampeggiatori supplementari griglia operativi',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-luc-2',
        categoria: 'Dispositivi Emergenza & Luci',
        titolo: 'Sirena bitonale / fischio di emergenza funzionante e provato',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-luc-3',
        categoria: 'Dispositivi Emergenza & Luci',
        titolo: 'Fari anteriori, stop, frecce e luce vano sanitario funzionanti',
        critica: true,
        obbligatoria: true
      },
      // 4. Vano Sanitario
      {
        id: 'v-san-1',
        categoria: 'Vano Sanitario & Elettromedicali',
        titolo: 'Bombole ossigeno (fissa e portatile) cariche (> 150 bar)',
        descrizione: 'Verificare manometro bombole e tenuta valvole di sicurezza.',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-san-2',
        categoria: 'Vano Sanitario & Elettromedicali',
        titolo: 'Defibrillatore DAE con spia verde OK, piastre integre e non scadute',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-san-3',
        categoria: 'Vano Sanitario & Elettromedicali',
        titolo: 'Aspiratore chirurgico secreti testato con vuoto regolare',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-san-4',
        categoria: 'Vano Sanitario & Elettromedicali',
        titolo: 'Barella autocaricante, sedia portantina e telo soccorso verificati',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-san-5',
        categoria: 'Vano Sanitario & Elettromedicali',
        titolo: 'Zaino soccorso/trauma completo di medicazioni e collari cervicali',
        critica: false,
        obbligatoria: true
      },
      // 5. Pulizia & DPI
      {
        id: 'v-pul-1',
        categoria: 'Pulizia, Sanificazione & DPI',
        titolo: 'Vano sanitario pulito, sanificato e privo di odori anomali',
        critica: false,
        obbligatoria: true
      },
      {
        id: 'v-pul-2',
        categoria: 'Pulizia, Sanificazione & DPI',
        titolo: 'Scorta guanti monouso, mascherine e sacco rifiuti speciali a bordo',
        critica: false,
        obbligatoria: true
      }
    ]
  },
  {
    id: 'chk-pc-fuoristrada',
    titolo: 'Checklist Inizio Turno Fuoristrada 4x4 & Protezione Civile',
    descrizione: 'Controlli per veicoli operativi di protezione civile, antincendio boschivo e logistica.',
    tipologiaMezzo: 'Fuoristrada 4x4',
    attiva: true,
    dataCreazione: '05/01/2026',
    dataUltimaModifica: '28/10/2026',
    autore: 'Responsabile Protezione Civile',
    voci: [
      {
        id: 'v-pc-1',
        categoria: 'Documenti & Dotazioni Bordo',
        titolo: 'Libretto di circolazione, assicurazione e libretto radio di bordo',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-pc-2',
        categoria: 'Documenti & Dotazioni Bordo',
        titolo: 'Binda / cric idraulico, chiave ruote, gancio traino e grilli',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-pc-3',
        categoria: 'Stato Meccanico & Livelli',
        titolo: 'Livelli olio motore, liquido radiatore e freni nella norma',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-pc-4',
        categoria: 'Stato Meccanico & Livelli',
        titolo: 'Trazione 4x4 e marce ridotte testate e perfettamente inseribili',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-pc-5',
        categoria: 'Stato Meccanico & Livelli',
        titolo: 'Pressione e stato battistrada pneumatici tassellati All-Terrain',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-pc-6',
        categoria: 'Dispositivi Emergenza & Luci',
        titolo: 'Lampeggiante arancio/blu e fari da lavoro brandeggianti operativi',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-pc-7',
        categoria: 'Attrezzatura Protezione Civile',
        titolo: 'Radio portatile VHF/UHF accesa con batteria carica di scorta',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-pc-8',
        categoria: 'Attrezzatura Protezione Civile',
        titolo: 'Kit attrezzi manuali (pale, badili, motosega/carburante se previsto)',
        critica: false,
        obbligatoria: true
      },
      {
        id: 'v-pc-9',
        categoria: 'Pulizia, Sanificazione & DPI',
        titolo: 'DPI equipaggio presenti (caschi, guanti da lavoro, occhiali protezione)',
        critica: true,
        obbligatoria: true
      }
    ]
  },
  {
    id: 'chk-pulmino-disabili',
    titolo: 'Checklist Inizio Turno Pulmino Trasporto Disabili & Sociale',
    descrizione: 'Verifiche di sicurezza specifiche per trasporto persone non deambulanti in carrozzina e servizi sociali.',
    tipologiaMezzo: 'Pulmino Disabili',
    attiva: true,
    dataCreazione: '10/01/2026',
    dataUltimaModifica: '28/10/2026',
    autore: 'Responsabile Servizi Sociali & Parco Mezzi',
    voci: [
      {
        id: 'v-pulm-1',
        categoria: 'Documenti & Dotazioni Bordo',
        titolo: 'Documenti veicolo, assicurazione passeggeri e autorizzazioni sanitarie',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-pulm-2',
        categoria: 'Stato Meccanico & Livelli',
        titolo: 'Livelli olio motore, freni e pressione pneumatici conformi',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-pulm-3',
        categoria: 'Vano Sanitario & Elettromedicali',
        titolo: 'Pedana idraulica sollevamento carrozzine testata (salita e discesa)',
        descrizione: 'Provare l\'apertura completa della pedana e i telecomandi di comando.',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-pulm-4',
        categoria: 'Vano Sanitario & Elettromedicali',
        titolo: 'Cinture di sicurezza e ancoraggi carrozzine a 4 punti integri e completi',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-pulm-5',
        categoria: 'Stato Meccanico & Livelli',
        titolo: 'Riscaldamento e climatizzazione vano passeggeri efficienti',
        critica: false,
        obbligatoria: true
      },
      {
        id: 'v-pulm-6',
        categoria: 'Pulizia, Sanificazione & DPI',
        titolo: 'Interni puliti, igienizzati e cassetta pronto soccorso presente',
        critica: false,
        obbligatoria: true
      }
    ]
  },
  {
    id: 'chk-automedica',
    titolo: 'Checklist Inizio Turno Automedica / Intervento Rapido',
    descrizione: 'Controllo rapido veicolo per trasporto medico/infermiere e supporto avanzato.',
    tipologiaMezzo: 'Automedica',
    attiva: true,
    dataCreazione: '15/01/2026',
    dataUltimaModifica: '28/10/2026',
    autore: 'Centrale Operativa',
    voci: [
      {
        id: 'v-auto-1',
        categoria: 'Documenti & Dotazioni Bordo',
        titolo: 'Documenti di bordo e carte rifornimento verificate',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-auto-2',
        categoria: 'Stato Meccanico & Livelli',
        titolo: 'Livelli motore, pressione gomme e carburante al massimo',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-auto-3',
        categoria: 'Dispositivi Emergenza & Luci',
        titolo: 'Lampeggianti blu, fari a led e sirena bitonale testati',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-auto-4',
        categoria: 'Vano Sanitario & Elettromedicali',
        titolo: 'DAE / Monitor multiparametrico con batterie cariche e zaino rianimazione',
        critica: true,
        obbligatoria: true
      },
      {
        id: 'v-auto-5',
        categoria: 'Vano Sanitario & Elettromedicali',
        titolo: 'Bombola ossigeno portatile carica con mascherine',
        critica: true,
        obbligatoria: true
      }
    ]
  }
];

export const CHECKLIST_COMPILATE_INIZIALI: ChecklistCompilataTurno[] = [
  {
    id: 'chk-comp-1',
    templateId: 'chk-amb-emergenza',
    templateTitolo: 'Checklist Inizio Turno Ambulanza Emergenza & Soccorso Veterinario',
    tipologiaMezzo: 'Ambulanza Emergenza',
    mezzoSigla: 'T4606',
    mezzoModello: 'Fiat Ducato Maxi 2.3 Multijet',
    volontarioId: 'vol-156',
    volontarioNome: 'Claudio Simonini',
    qualificaTurno: 'Autista',
    dataOraCompilazione: '28/10/2026 07:15',
    tuttoConforme: true,
    totaleVoci: 16,
    vociConformi: 16,
    vociNonConformi: 0,
    anomalieRilevate: [],
    kmInizialiDichiarati: 42150,
    noteGenerali: 'Mezzo in perfette condizioni. Bombole O2 a 190 bar.',
    risultati: [
      { voceId: 'v-doc-1', titolo: 'Libretto e assicurazione', categoria: 'Documenti & Dotazioni Bordo', conforme: true },
      { voceId: 'v-doc-2', titolo: 'Telepass e torcia', categoria: 'Documenti & Dotazioni Bordo', conforme: true },
      { voceId: 'v-doc-3', titolo: 'Giubbotti alta visibilità', categoria: 'Documenti & Dotazioni Bordo', conforme: true },
      { voceId: 'v-mec-1', titolo: 'Carburante > 1/2', categoria: 'Stato Meccanico & Livelli', conforme: true },
      { voceId: 'v-mec-2', titolo: 'Olio e liquido radiatore', categoria: 'Stato Meccanico & Livelli', conforme: true },
      { voceId: 'v-mec-3', titolo: 'Pneumatici', categoria: 'Stato Meccanico & Livelli', conforme: true },
      { voceId: 'v-mec-4', titolo: 'Tergicristalli', categoria: 'Stato Meccanico & Livelli', conforme: true },
      { voceId: 'v-luc-1', titolo: 'Lampeggianti blu', categoria: 'Dispositivi Emergenza & Luci', conforme: true },
      { voceId: 'v-luc-2', titolo: 'Sirena bitonale', categoria: 'Dispositivi Emergenza & Luci', conforme: true },
      { voceId: 'v-luc-3', titolo: 'Fari e luci', categoria: 'Dispositivi Emergenza & Luci', conforme: true },
      { voceId: 'v-san-1', titolo: 'Bombole ossigeno > 150 bar', categoria: 'Vano Sanitario & Elettromedicali', conforme: true },
      { voceId: 'v-san-2', titolo: 'DAE defibrillatore OK', categoria: 'Vano Sanitario & Elettromedicali', conforme: true },
      { voceId: 'v-san-3', titolo: 'Aspiratore secreti', categoria: 'Vano Sanitario & Elettromedicali', conforme: true },
      { voceId: 'v-san-4', titolo: 'Barella e sedia portantina', categoria: 'Vano Sanitario & Elettromedicali', conforme: true },
      { voceId: 'v-san-5', titolo: 'Zaino soccorso', categoria: 'Vano Sanitario & Elettromedicali', conforme: true },
      { voceId: 'v-pul-1', titolo: 'Vano sanificato', categoria: 'Pulizia, Sanificazione & DPI', conforme: true },
      { voceId: 'v-pul-2', titolo: 'Guanti e DPI', categoria: 'Pulizia, Sanificazione & DPI', conforme: true }
    ],
    statoCentrale: 'Presa in Carico'
  }
];

export function deduciTipoMezzoDaNome(mezzo: string): string {
  if (!mezzo) return 'Ambulanza Emergenza';
  const m = mezzo.toLowerCase();
  if (m.includes('fuoristrada') || m.includes('4x4') || m.includes('protezione civile') || m.includes('t4608')) {
    return 'Fuoristrada 4x4';
  }
  if (m.includes('disabili') || m.includes('pulmino') || m.includes('trasporto') || m.includes('t4610')) {
    return 'Pulmino Disabili';
  }
  if (m.includes('automedica') || m.includes('medica') || m.includes('t4614')) {
    return 'Automedica';
  }
  return 'Ambulanza Emergenza';
}

export function trovaTemplatePerTipo(templates: ChecklistTemplate[], tipo: string, mezzo?: string): ChecklistTemplate | undefined {
  if (!templates || templates.length === 0) return undefined;
  if (mezzo) {
    const mezzoNorm = mezzo.toUpperCase();
    const specifico = templates.find(t => t.attiva && t.mezziAssegnati && t.mezziAssegnati.some(sigla => mezzoNorm.includes(sigla.toUpperCase())));
    if (specifico) return specifico;
  }
  const perTipo = templates.find(t => t.attiva && t.tipologiaMezzo.toLowerCase() === tipo.toLowerCase());
  if (perTipo) return perTipo;
  const generico = templates.find(t => t.attiva && (t.tipologiaMezzo === 'Tutte' || t.tipologiaMezzo.toLowerCase().includes('emergenza')));
  return generico || templates[0];
}
