import { ComunicazioneBacheca } from '../types/adminTypes';
import { APP_VERSION } from '../version';

export type ReleaseAudienceScope =
  | 'tutti'
  | 'volontario'
  | 'centrale'
  | 'admin'
  | 'direttivo'
  | 'mezzi'
  | 'turni'
  | 'tesoreria'
  | 'bacheca'
  | 'formazione'
  | 'magazzino'
  | 'soci';

export interface AppReleaseChangeItem {
  /** Descrizione chiara e leggibile della novità apportata */
  testo: string;
  /** Profili o sezioni abilitate che possono effettivamente vedere/usare questa modifica */
  scopes: ReleaseAudienceScope[];
  /** Intestazione opzionale per raggruppare le voci nel testo del post */
  gruppoLabel?: string;
}

export interface AppReleaseNoteEntry {
  version: string;
  dataPubblicazione: string; // YYYY-MM-DD
  oraPubblicazione: string; // HH:mm
  updatedAt: number;
  titolo: string;
  priorita?: 'Ordinaria' | 'Importante';
  changes: AppReleaseChangeItem[];
}

export interface AccountReleaseContext {
  /** Chiave stabile dell'account loggato (usata per deduplica notifica e archiviazione locale) */
  accountKey: string;
  /** Insieme degli ambiti visibili a questo specifico account */
  scopes: Set<ReleaseAudienceScope>;
  /** Etichetta leggibile del profilo (es. "Amministratore & Centrale", "Operatore Centrale", "Volontario") */
  audienceLabel: string;
  /** True solo quando esiste un utente autenticato (Admin, Centrale o Volontario) */
  isAuthenticated: boolean;
}

/**
 * Registro ufficiale degli aggiornamenti dell'app mostrati automaticamente in Bacheca.
 * Ogni voce è visibile SOLO agli account i cui permessi/ruoli includono almeno uno degli `scopes` indicati.
 * Se per un determinato account nessuna modifica di una versione è visibile, il post NON viene mostrato.
 */
export const APP_RELEASE_NOTES: AppReleaseNoteEntry[] = [
  {
    version: '5.4.0',
    dataPubblicazione: '2026-11-28',
    oraPubblicazione: '01:30',
    updatedAt: 1795829444123,
    titolo: 'Novità Aggiornamento App v5.4.0',
    priorita: 'Importante',
    changes: [
      {
        gruppoLabel: 'Terminale Volontario & Operatività in Turno',
        scopes: ['volontario', 'centrale', 'admin'],
        testo:
          'Timbrature, conferme e orari missione, chilometri, rifornimenti, segnalazioni guasti e voti assembleari ora si sincronizzano subito anche con accesso tramite solo PIN (risolto il blocco "operazioni in coda").',
      },
      {
        gruppoLabel: 'Terminale Volontario & Operatività in Turno',
        scopes: ['volontario', 'centrale', 'admin'],
        testo:
          'Posizione GPS in tempo reale e Radio VHF/UHF (sia in ascolto che in trasmissione PTT) pienamente operative anche da smartphone autenticati con solo PIN.',
      },
      {
        gruppoLabel: 'Terminale Volontario & Operatività in Turno',
        scopes: ['volontario', 'centrale', 'admin'],
        testo:
          'Nuovo interruttore opzionale "Ascolto Radio Continuo in Turno" nel pannello Radio (spento di default per zero fruscii a riposo) e schermo mantenuto automaticamente attivo durante una missione in corso.',
      },
      {
        gruppoLabel: 'Bacheca & Notifiche',
        scopes: ['tutti'],
        testo:
          'Foto e documenti protetti allegati ai post in Bacheca ora si caricano su richiesta anche sugli smartphone dei volontari con accesso PIN.',
      },
      {
        gruppoLabel: 'Bacheca & Notifiche',
        scopes: ['tutti'],
        testo:
          'Notifiche Push estese anche ad assegnazione missioni, squillo Centrale e aggiornamenti turni, con soppressione automatica dei doppioni quando l’app è già aperta in primo piano.',
      },
      {
        gruppoLabel: 'Bacheca & Notifiche',
        scopes: ['tutti'],
        testo:
          'Nuovi avvisi automatici in Bacheca ad ogni aggiornamento app, personalizzati in base alle funzioni effettivamente visibili al tuo profilo.',
      },
      {
        gruppoLabel: 'Centrale Operativa',
        scopes: ['centrale', 'admin'],
        testo:
          'Stato personale "Loggato" reso più affidabile: rimane visibile durante l’intero turno anche con app in background e scade automaticamente dopo 18 ore senza attività per eliminare sessioni fantasma.',
      },
      {
        gruppoLabel: 'Centrale Operativa',
        scopes: ['centrale', 'admin'],
        testo:
          'Ricezione automatica in tempo reale dalla coda cloud di tutte le timbrature, conferme missione, rifornimenti e guasti inviati dagli equipaggi su smartphone.',
      },
      {
        gruppoLabel: 'Amministrazione & Sicurezza',
        scopes: ['admin'],
        testo:
          'Tutte le rotte email SMTP e Push ora operano con verifica lato server del chiamante, protezione CORS sui soli domini autorizzati e gestione credenziali esclusivamente tramite variabili d’ambiente.',
      },
      {
        gruppoLabel: 'Amministrazione & Sicurezza',
        scopes: ['admin'],
        testo:
          'Aggiornate e pubblicate le regole di sicurezza database a supporto di radio live, geolocalizzazione, media bacheca su richiesta e operazioni volontari verificate tramite PIN.',
      },
    ],
  },
];

export function compareSemver(a: string, b: string): number {
  const pa = String(a || '0.0.0')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0.0.0')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function buildAccountReleaseContext(params: {
  accountId?: string | null;
  ruolo: 'volontario' | 'admin' | null;
  isAdmin: boolean;
  isOperatoreCentrale: boolean;
  isVolontarioAttivo: boolean;
  caricaConsiglioDirettivo?: string | null;
  sezioniAbilitate?: string[];
}): AccountReleaseContext {
  const scopes = new Set<ReleaseAudienceScope>();
  const isAuthenticated = Boolean(
    params.isAdmin ||
      params.isOperatoreCentrale ||
      params.isVolontarioAttivo ||
      (params.accountId && params.accountId.trim())
  );

  if (!isAuthenticated) {
    return {
      accountKey: '',
      scopes,
      audienceLabel: '',
      isAuthenticated: false,
    };
  }

  scopes.add('tutti');

  const caricaNorm = String(params.caricaConsiglioDirettivo || '').toLowerCase();
  const isDirettivo =
    params.isAdmin ||
    Boolean(
      caricaNorm &&
        (caricaNorm.includes('presidente') ||
          caricaNorm.includes('segretar') ||
          caricaNorm.includes('tesorier') ||
          caricaNorm.includes('consiglier') ||
          caricaNorm.includes('direttiv'))
    );

  if (params.isAdmin) {
    scopes.add('admin');
    scopes.add('centrale');
    scopes.add('direttivo');
    scopes.add('volontario');
    scopes.add('mezzi');
    scopes.add('turni');
    scopes.add('tesoreria');
    scopes.add('bacheca');
    scopes.add('formazione');
    scopes.add('magazzino');
    scopes.add('soci');
  } else {
    if (params.isVolontarioAttivo || params.ruolo === 'volontario') {
      scopes.add('volontario');
    }
    if (params.isOperatoreCentrale) {
      scopes.add('centrale');
      scopes.add('volontario');
    }
    if (isDirettivo) {
      scopes.add('direttivo');
    }
    if (caricaNorm.includes('tesorier')) {
      scopes.add('tesoreria');
    }
    const secSet = new Set((params.sezioniAbilitate || []).map((s) => String(s).toLowerCase()));
    if (secSet.has('centrale')) scopes.add('centrale');
    if (secSet.has('mezzi')) scopes.add('mezzi');
    if (secSet.has('turni')) scopes.add('turni');
    if (secSet.has('tesoreria')) scopes.add('tesoreria');
    if (secSet.has('bacheca')) scopes.add('bacheca');
    if (secSet.has('formazione')) scopes.add('formazione');
    if (secSet.has('magazzino')) scopes.add('magazzino');
    if (secSet.has('soci')) scopes.add('soci');
  }

  const labelParts: string[] = [];
  if (params.isAdmin) {
    labelParts.push('Amministratore');
  } else {
    if (params.isOperatoreCentrale || scopes.has('centrale')) labelParts.push('Operatore Centrale');
    if (isDirettivo && !params.isAdmin) labelParts.push('Direttivo');
    if (scopes.has('volontario') && labelParts.length === 0) labelParts.push('Volontario');
  }
  const audienceLabel = labelParts.join(' & ') || 'Volontario';

  const cleanAccountId = String(params.accountId || '').trim();
  const accountKey = cleanAccountId || (params.isAdmin ? 'admin-centrale-root' : 'anon');

  return {
    accountKey,
    scopes,
    audienceLabel,
    isAuthenticated: true,
  };
}

export function getAutoReleaseNotePostId(version: string): string {
  return `release-note-v${String(version || '').trim()}`;
}

export function buildPersonalizedReleaseBachecaPosts(
  ctx: AccountReleaseContext,
  dismissedIds: string[] = [],
  currentAppVersion: string = APP_VERSION
): ComunicazioneBacheca[] {
  if (!ctx.isAuthenticated || ctx.scopes.size === 0) return [];
  const dismissedSet = new Set(dismissedIds);
  const posts: ComunicazioneBacheca[] = [];

  for (const entry of APP_RELEASE_NOTES) {
    // Mostra solo versioni già rilasciate fino alla versione corrente installata
    if (compareSemver(entry.version, currentAppVersion) > 0) continue;

    const postId = getAutoReleaseNotePostId(entry.version);
    if (dismissedSet.has(postId)) continue;

    // Filtra rigorosamente le sole modifiche che questo specifico account può vedere/usare
    const visibleChanges = entry.changes.filter((item) =>
      item.scopes.some((scope) => ctx.scopes.has(scope))
    );

    // Se nessuna modifica di questa versione riguarda questo account, NON creare alcun post
    if (visibleChanges.length === 0) continue;

    // Raggruppa in ordine preservando i titoli di sezione leggibili
    const groupsOrder: string[] = [];
    const grouped = new Map<string, string[]>();
    for (const ch of visibleChanges) {
      const grp = ch.gruppoLabel || 'Novità per il tuo profilo';
      if (!grouped.has(grp)) {
        grouped.set(grp, []);
        groupsOrder.push(grp);
      }
      grouped.get(grp)!.push(ch.testo);
    }

    const lines: string[] = [
      `L'app Croce Oro Massa Carrara è stata aggiornata alla versione ${entry.version}.`,
      `Di seguito trovi le novità attive per il tuo profilo (${ctx.audienceLabel}):`,
    ];

    for (const grp of groupsOrder) {
      const items = grouped.get(grp) || [];
      if (groupsOrder.length > 1) {
        lines.push('', `▸ ${grp}`);
      } else {
        lines.push('');
      }
      for (const txt of items) {
        lines.push(`• ${txt}`);
      }
    }

    posts.push({
      id: postId,
      titolo: entry.titolo || `Novità Aggiornamento App v${entry.version}`,
      contenuto: lines.join('\n'),
      sezioneTargetId: 'tutte',
      sezioneTargetNome: `Profilo: ${ctx.audienceLabel}`,
      priorita: entry.priorita || 'Ordinaria',
      categoria: 'Comunicazione Generale',
      dataPubblicazione: entry.dataPubblicazione,
      oraPubblicazione: entry.oraPubblicazione,
      autore: `Aggiornamento App v${entry.version}`,
      autoreId: 'system-release-notes',
      attiva: true,
      evidenziata: false,
      updatedAt: entry.updatedAt,
      isAutoReleaseNote: true,
      releaseVersion: entry.version,
      releaseAudienceLabel: ctx.audienceLabel,
    });
  }

  return posts;
}

export function mergeComunicazioniConReleaseNotes(
  comunicazioni: ComunicazioneBacheca[],
  ctx: AccountReleaseContext,
  dismissedIds: string[] = [],
  currentAppVersion: string = APP_VERSION
): ComunicazioneBacheca[] {
  const realPosts = (comunicazioni || []).filter((c) => !c.isAutoReleaseNote);
  const autoPosts = buildPersonalizedReleaseBachecaPosts(ctx, dismissedIds, currentAppVersion);
  if (autoPosts.length === 0) return realPosts;
  const existingIds = new Set(realPosts.map((c) => c.id));
  const uniqueAuto = autoPosts.filter((p) => !existingIds.has(p.id));
  return [...uniqueAuto, ...realPosts];
}
