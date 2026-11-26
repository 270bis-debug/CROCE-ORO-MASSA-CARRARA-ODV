import {
  LuogoTimbratura,
  SedeAssociativaCompleta,
  TurnoSedeOperativa,
  CorsoFormazione,
  ComunicazioneBacheca
} from '../types/adminTypes';
import { sortComunicazioniBacheca } from './bachecaSort';

export type CanonicalSedeKey = 'ronchi' | 'lejare' | 'carrara' | 'pietrasanta' | 'lunigiana';

export interface CanonicalSedeMeta {
  key: CanonicalSedeKey;
  sedeId: string;
  luogoId: string;
  codiceSede: string;
  codiceLuogo: string;
  nome: string;
  sezioneBreve: string;
  indirizzoBase: string;
  indirizzoCompletoConCap: string;
  coordinate: { lat: number; lng: number };
  staleCoords: { lat: number; lng: number }[];
}

export const SEDI_CANONICHE: Record<CanonicalSedeKey, CanonicalSedeMeta> = {
  ronchi: {
    key: 'ronchi',
    sedeId: 'sede-massa-ronchi',
    luogoId: 'luogo-ronchi',
    codiceSede: 'SEDE-01-RONCHI',
    codiceLuogo: 'TIMB-02-RONCHI',
    nome: 'Sede Legale & Direzione Generale Massa (Ronchi)',
    sezioneBreve: 'Massa (Ronchi)',
    indirizzoBase: 'Via Como, 12 Località Ronchi',
    indirizzoCompletoConCap: 'Via Como, 12 Località Ronchi, 54100 Marina di Massa (MS)',
    coordinate: { lat: 43.99419, lng: 10.12367 },
    staleCoords: [{ lat: 44.0185, lng: 10.1062 }]
  },
  lejare: {
    key: 'lejare',
    sedeId: 'sede-massa-lejare',
    luogoId: 'luogo-lejare',
    codiceSede: 'SEDE-02-LEJARE',
    codiceLuogo: 'TIMB-01-LEJARE',
    nome: 'Sede Operativa H24 & Autoparco Emergenze Massa (Le Jare)',
    sezioneBreve: 'Massa (Le Jare)',
    indirizzoBase: 'Via Delle Jare, 9',
    indirizzoCompletoConCap: 'Via Delle Jare, 9, 54100 Massa (MS)',
    coordinate: { lat: 44.01700, lng: 10.15121 },
    staleCoords: [{ lat: 44.0321, lng: 10.1345 }]
  },
  carrara: {
    key: 'carrara',
    sedeId: 'sede-carrara-fossone',
    luogoId: 'luogo-fossone',
    codiceSede: 'SEDE-03-FOSSONE',
    codiceLuogo: 'TIMB-03-FOSSONE',
    nome: 'Sezione Territoriale Carrara (Fossone / Monteverde)',
    sezioneBreve: 'Carrara (Fossone / Monteverde)',
    indirizzoBase: 'Strada Comunale di Monteverde, 49 Località Fossone',
    indirizzoCompletoConCap: 'Strada Comunale di Monteverde, 49 Località Fossone, 54033 Carrara (MS)',
    coordinate: { lat: 44.066716, lng: 10.049207 },
    staleCoords: [{ lat: 44.0532, lng: 10.0612 }]
  },
  pietrasanta: {
    key: 'pietrasanta',
    sedeId: 'sede-pietrasanta',
    luogoId: 'luogo-pietrasanta',
    codiceSede: 'SEDE-04-PIETRASANTA',
    codiceLuogo: 'TIMB-04-PIETRASANTA',
    nome: 'Presidio Territoriale Versilia (Marina di Pietrasanta)',
    sezioneBreve: 'Pietrasanta',
    indirizzoBase: 'Piazza Villeparisis, 14 Località Marina di Pietrasanta',
    indirizzoCompletoConCap: 'Piazza Villeparisis, 14 Località Marina di Pietrasanta, 55045 Pietrasanta (LU)',
    coordinate: { lat: 43.92771, lng: 10.20194 },
    staleCoords: [{ lat: 43.9572, lng: 10.2312 }]
  },
  lunigiana: {
    key: 'lunigiana',
    sedeId: 'sede-lunigiana',
    luogoId: 'luogo-aulla',
    codiceSede: 'SEDE-05-LUNIGIANA',
    codiceLuogo: 'TIMB-05-AULLA',
    nome: 'Sezione Territoriale Lunigiana (Aulla)',
    sezioneBreve: 'Lunigiana (Aulla)',
    indirizzoBase: 'Piazza Cavour / Piazza della Vittoria',
    indirizzoCompletoConCap: 'Piazza Cavour / Piazza della Vittoria, 54011 Aulla (MS)',
    coordinate: { lat: 44.21455, lng: 9.96779 },
    staleCoords: [{ lat: 44.2145, lng: 9.9682 }]
  }
};

function approxCoordEqual(
  a: { lat?: number; lng?: number } | null | undefined,
  b: { lat: number; lng: number },
  tol = 0.0006
): boolean {
  if (!a || typeof a.lat !== 'number' || typeof a.lng !== 'number') return false;
  return Math.abs(a.lat - b.lat) <= tol && Math.abs(a.lng - b.lng) <= tol;
}

export function isStaleIndirizzoSede(indirizzo?: string): boolean {
  if (!indirizzo) return false;
  const low = indirizzo.toLowerCase();
  return (
    low.includes('galilei 150') ||
    low.includes('starda monteverde') ||
    (low.includes('strada monteverde') && !low.includes('comunale')) ||
    low.includes('via le jare 45') ||
    low.includes('via ronchi 12') ||
    low.includes('viale roma 88') ||
    low.includes('piazza cavour 4')
  );
}

export function normalizzaNomeCarraraTesto(val?: string): string {
  if (!val) return '';
  let out = val.trim();
  if (/^sezione\s+territoriale\s+carrara\s*\(?\s*fossone\s*\)?$/i.test(out)) {
    return SEDI_CANONICHE.carrara.nome;
  }
  if (/^sede\s+croce\s+oro\s+carrara/i.test(out)) {
    return SEDI_CANONICHE.carrara.nome;
  }
  if (/^(sezione\s+)?carrara\s*[\(\s-]*fossone[\)\s]*$/i.test(out)) {
    return SEDI_CANONICHE.carrara.nome;
  }
  out = out.replace(
    /Sezione Territoriale Carrara \(Fossone\)/gi,
    SEDI_CANONICHE.carrara.nome
  );
  out = out.replace(/\bCarrara\s*\(Fossone\)/gi, 'Carrara (Fossone / Monteverde)');
  out = out.replace(/\bSezione\s+Carrara\s+Fossone\b/gi, 'Sezione Carrara (Fossone / Monteverde)');
  out = out.replace(/\bCarrara\s+Fossone\b/gi, 'Carrara (Fossone / Monteverde)');
  return out;
}

export function detectCanonicalSedeKey(input: {
  id?: string;
  codice?: string;
  nome?: string;
  indirizzo?: string;
  coordinate?: { lat?: number; lng?: number };
}): CanonicalSedeKey | null {
  const id = (input.id || '').toLowerCase();
  const cod = (input.codice || '').toLowerCase();
  const nome = (input.nome || '').toLowerCase();
  const ind = (input.indirizzo || '').toLowerCase();

  if (
    id === 'luogo-fossone' ||
    id === 'sede-carrara-fossone' ||
    id === 'sede-sede-carrara-fossone' ||
    id === 'sede-croce-oro-carrara' ||
    cod.includes('fossone') ||
    nome.includes('fossone') ||
    nome.includes('monteverde') ||
    nome.includes('carrara') ||
    ind.includes('monteverde') ||
    ind.includes('galilei 150') ||
    approxCoordEqual(input.coordinate, SEDI_CANONICHE.carrara.staleCoords[0]) ||
    approxCoordEqual(input.coordinate, SEDI_CANONICHE.carrara.coordinate, 0.0002)
  ) {
    // Esclude esplicitamente eventi a Marina di Carrara / CarraraFiere
    if (!nome.includes('carrarafiere') && !id.includes('carrarafiere')) {
      return 'carrara';
    }
  }
  if (
    id === 'luogo-lejare' ||
    id === 'sede-massa-lejare' ||
    id === 'sede-sede-massa-lejare' ||
    id === 'sede-croce-oro-massa-jare' ||
    cod.includes('lejare') ||
    nome.includes('le jare') ||
    ind.includes('jare') ||
    approxCoordEqual(input.coordinate, SEDI_CANONICHE.lejare.staleCoords[0])
  ) {
    return 'lejare';
  }
  if (
    id === 'luogo-ronchi' ||
    id === 'sede-massa-ronchi' ||
    id === 'sede-sede-massa-ronchi' ||
    id === 'sede-croce-oro-massa' ||
    cod.includes('ronchi') ||
    nome.includes('ronchi') ||
    ind.includes('como, 12') ||
    ind.includes('como 12') ||
    ind.includes('via ronchi 12') ||
    approxCoordEqual(input.coordinate, SEDI_CANONICHE.ronchi.staleCoords[0])
  ) {
    return 'ronchi';
  }
  if (
    id === 'luogo-pietrasanta' ||
    id === 'sede-pietrasanta' ||
    id === 'sede-sede-pietrasanta' ||
    id === 'sede-croce-oro-pietrasanta' ||
    cod.includes('pietrasanta') ||
    nome.includes('pietrasanta') ||
    nome.includes('versilia') ||
    ind.includes('villeparisis') ||
    approxCoordEqual(input.coordinate, SEDI_CANONICHE.pietrasanta.staleCoords[0])
  ) {
    return 'pietrasanta';
  }
  if (
    id === 'luogo-aulla' ||
    id === 'sede-lunigiana' ||
    id === 'sede-sede-lunigiana' ||
    id === 'sede-croce-oro-lunigiana' ||
    cod.includes('aulla') ||
    cod.includes('lunigiana') ||
    nome.includes('lunigiana') ||
    nome.includes('aulla')
  ) {
    return 'lunigiana';
  }

  return null;
}

export function normalizzaListaSediAssociative(
  sedi: SedeAssociativaCompleta[]
): SedeAssociativaCompleta[] {
  if (!Array.isArray(sedi)) return [];
  const seenKeys = new Set<string>();
  const out: SedeAssociativaCompleta[] = [];

  for (const s of sedi) {
    if (!s) continue;
    const key = detectCanonicalSedeKey({
      id: s.id,
      codice: s.codice,
      nome: s.nome,
      indirizzo: s.indirizzoCompleto,
      coordinate: s.coordinate
    });

    if (key) {
      if (seenKeys.has(key)) {
        // Evita duplicati tipo "Carrara Fossone" + "Carrara (Fossone / Monteverde)"
        continue;
      }
      seenKeys.add(key);
      const canon = SEDI_CANONICHE[key];
      const hasStaleInd = isStaleIndirizzoSede(s.indirizzoCompleto);
      const hasStaleCoord = canon.staleCoords.some((sc) => approxCoordEqual(s.coordinate, sc));
      const nomeNorm = key === 'carrara' ? normalizzaNomeCarraraTesto(s.nome) : s.nome;

      out.push({
        ...s,
        id: s.id || canon.sedeId,
        codice: s.codice || canon.codiceSede,
        nome: nomeNorm || canon.nome,
        indirizzoCompleto: hasStaleInd || !s.indirizzoCompleto ? canon.indirizzoBase : s.indirizzoCompleto,
        coordinate:
          !s.coordinate ||
          typeof s.coordinate.lat !== 'number' ||
          typeof s.coordinate.lng !== 'number' ||
          hasStaleCoord
            ? { ...canon.coordinate }
            : s.coordinate
      });
    } else {
      const dedupeKey = (s.id || s.nome || '').toLowerCase();
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);
      out.push(s);
    }
  }

  return out;
}

export function normalizzaListaLuoghiTimbratura(
  luoghi: LuogoTimbratura[],
  sedi?: SedeAssociativaCompleta[]
): LuogoTimbratura[] {
  if (!Array.isArray(luoghi)) return [];
  const sediNormalizzate = sedi ? normalizzaListaSediAssociative(sedi) : [];
  const seenKeys = new Set<string>();
  const out: LuogoTimbratura[] = [];

  for (const l of luoghi) {
    if (!l) continue;
    const key = detectCanonicalSedeKey({
      id: l.id,
      codice: l.codice,
      nome: l.nome,
      indirizzo: l.indirizzo,
      coordinate: l.coordinate
    });

    if (key) {
      if (seenKeys.has(key)) {
        // Deduplica luoghi appartenenti alla stessa sede (es. "Carrara Fossone" + "Carrara (Fossone / Monteverde)")
        continue;
      }
      seenKeys.add(key);
      const canon = SEDI_CANONICHE[key];
      const sedeMatch = sediNormalizzate.find(
        (s) =>
          s.id === canon.sedeId ||
          detectCanonicalSedeKey({ id: s.id, codice: s.codice, nome: s.nome }) === key
      );

      const hasStaleInd = isStaleIndirizzoSede(l.indirizzo);
      const hasStaleCoord = canon.staleCoords.some((sc) => approxCoordEqual(l.coordinate, sc));
      const isDefaultLuogoId = l.id === canon.luogoId || l.id === `sede-${canon.sedeId}`;

      // Se l'indirizzo/coordinata salvata corrisponde al vecchio refuso o al default non personalizzato,
      // aggiorna usando le coordinate reali della Sede (dalla mappa sedi) o i valori canonici ufficiali
      const targetCoords =
        !l.coordinate ||
        typeof l.coordinate.lat !== 'number' ||
        typeof l.coordinate.lng !== 'number' ||
        hasStaleCoord ||
        hasStaleInd ||
        (isDefaultLuogoId && sedeMatch?.coordinate && !approxCoordEqual(l.coordinate, sedeMatch.coordinate, 0.0001) && hasStaleCoord)
          ? (sedeMatch?.coordinate || canon.coordinate)
          : l.coordinate;

      // Se la sede ha coordinate aggiornate rispetto a staleCoords, usa sempre sedeMatch/canon se luogo era rimasto fermo su coord/ind vecchi
      const finalCoords =
        sedeMatch?.coordinate && (hasStaleCoord || hasStaleInd)
          ? { ...sedeMatch.coordinate }
          : { ...targetCoords };

      const targetIndirizzo =
        hasStaleInd || !l.indirizzo
          ? sedeMatch?.indirizzoCompleto
            ? `${sedeMatch.indirizzoCompleto}${sedeMatch.cap ? `, ${sedeMatch.cap}` : ''}${sedeMatch.comune ? ` ${sedeMatch.comune}` : ''}${sedeMatch.provincia ? ` (${sedeMatch.provincia})` : ''}`
            : canon.indirizzoCompletoConCap
          : l.indirizzo;

      const finalNome = key === 'carrara' ? normalizzaNomeCarraraTesto(l.nome) || canon.nome : l.nome;

      out.push({
        ...l,
        nome: finalNome,
        indirizzo: targetIndirizzo,
        coordinate: finalCoords
      });
    } else {
      const dedupeKey = (l.id || l.nome || '').toLowerCase();
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);
      out.push(l);
    }
  }

  return out;
}

export function normalizzaTurniSedi(turni: TurnoSedeOperativa[]): TurnoSedeOperativa[] {
  if (!Array.isArray(turni)) return [];
  return turni.map((t) => {
    if (!t) return t;
    const isCarrara =
      t.sedeId === 'sede-carrara-fossone' ||
      (t.sedeNome || '').toLowerCase().includes('carrara');
    if (!isCarrara) return t;
    const nomeNorm = normalizzaNomeCarraraTesto(t.sedeNome);
    return nomeNorm && nomeNorm !== t.sedeNome ? { ...t, sedeNome: nomeNorm } : t;
  });
}

export function normalizzaComunicazioniBacheca(
  comunicazioni: ComunicazioneBacheca[]
): ComunicazioneBacheca[] {
  if (!Array.isArray(comunicazioni)) return [];
  return comunicazioni
    .filter((c): c is ComunicazioneBacheca => Boolean(c && typeof c === 'object' && c.id))
    .map((c) => {
      const titoloNorm = normalizzaNomeCarraraTesto(c.titolo || '');
      const contenutoNorm = normalizzaNomeCarraraTesto(c.contenuto || '');
      const targetNorm = c.sezioneTargetNome ? normalizzaNomeCarraraTesto(c.sezioneTargetNome) : 'Tutte le Sezioni Territoriali';
      const attivaNorm = c.attiva !== false;
      if (
        titoloNorm !== c.titolo ||
        contenutoNorm !== c.contenuto ||
        targetNorm !== c.sezioneTargetNome ||
        attivaNorm !== c.attiva
      ) {
        return {
          ...c,
          titolo: titoloNorm,
          contenuto: contenutoNorm,
          sezioneTargetNome: targetNorm,
          attiva: attivaNorm
        };
      }
      return c;
    });
}

/**
 * Unisce in modo sicuro due elenchi di comunicazioni bacheca (locale + remoto)
 * impedendo che snapshot stale sovrascrivano o facciano sparire post appena pubblicati,
 * rispettando al contempo le eliminazioni esplicite tramite `deletedIds`.
 */
export function mergeComunicazioniBachecaSafe(
  base: ComunicazioneBacheca[] | null | undefined,
  incoming: ComunicazioneBacheca[] | null | undefined,
  deletedIds?: string[] | null
): ComunicazioneBacheca[] {
  const deletedSet = new Set(
    (Array.isArray(deletedIds) ? deletedIds : []).map((id) => String(id || '').trim()).filter(Boolean)
  );
  const byId = new Map<string, ComunicazioneBacheca>();

  const insertOrMerge = (item: ComunicazioneBacheca) => {
    if (!item || !item.id || deletedSet.has(item.id)) return;
    const prev = byId.get(item.id);
    if (!prev) {
      byId.set(item.id, item);
      return;
    }
    const prevTs = Number(prev.updatedAt || 0);
    const nextTs = Number(item.updatedAt || 0);
    // Unisci commenti e likes per non perdere interazioni concorrenti
    const commentsMap = new Map<string, any>();
    [...(prev.commenti || []), ...(item.commenti || [])].forEach((cm) => {
      if (cm && cm.id) commentsMap.set(cm.id, cm);
    });
    const mergedComments = Array.from(commentsMap.values()).sort(
      (a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0)
    );
    const mergedLikes = Array.from(new Set([...(prev.likes || []), ...(item.likes || [])]));

    const winner = nextTs >= prevTs ? item : prev;
    const other = nextTs >= prevTs ? prev : item;
    byId.set(item.id, {
      ...other,
      ...winner,
      immaginePostDataUrl: winner.immaginePostDataUrl ?? other.immaginePostDataUrl,
      immaginePostNome: winner.immaginePostNome ?? other.immaginePostNome,
      allegatoDataUrl: winner.allegatoDataUrl ?? other.allegatoDataUrl,
      allegatoNome: winner.allegatoNome ?? other.allegatoNome,
      allegatoTipo: winner.allegatoTipo ?? other.allegatoTipo,
      allegatoMime: winner.allegatoMime ?? other.allegatoMime,
      allegatoDimensione: winner.allegatoDimensione ?? other.allegatoDimensione,
      likes: mergedLikes,
      commenti: mergedComments,
      updatedAt: Math.max(prevTs, nextTs),
    });
  };

  normalizzaComunicazioniBacheca(Array.isArray(base) ? base : []).forEach(insertOrMerge);
  normalizzaComunicazioniBacheca(Array.isArray(incoming) ? incoming : []).forEach(insertOrMerge);

  return sortComunicazioniBacheca(Array.from(byId.values()));
}

export function normalizzaCorsiFormazione(
  corsi: CorsoFormazione[],
  sedi?: SedeAssociativaCompleta[]
): CorsoFormazione[] {
  if (!Array.isArray(corsi)) return [];
  const sediNorm = sedi ? normalizzaListaSediAssociative(sedi) : [];

  const healSedePayload = (
    sedeId?: string,
    sedeNome?: string,
    indirizzo?: string,
    coord?: { lat: number; lng: number }
  ) => {
    const key = detectCanonicalSedeKey({
      id: sedeId,
      nome: sedeNome,
      indirizzo,
      coordinate: coord
    });
    if (!key) return { sedeNome, indirizzo, coord };
    const canon = SEDI_CANONICHE[key];
    const sedeMatch = sediNorm.find((s) => s.id === canon.sedeId);
    const hasStaleInd = isStaleIndirizzoSede(indirizzo);
    const hasStaleCoord = canon.staleCoords.some((sc) => approxCoordEqual(coord, sc));
    return {
      sedeNome: key === 'carrara' && sedeNome ? normalizzaNomeCarraraTesto(sedeNome) : sedeNome,
      indirizzo: hasStaleInd ? canon.indirizzoCompletoConCap : indirizzo,
      coord: hasStaleCoord || hasStaleInd ? (sedeMatch?.coordinate || canon.coordinate) : coord
    };
  };

  const LEGACY_MOCK_IDS = new Set([
    'corso-psv-01',
    'corso-aut-01',
    'corso-blsd-01',
    'corso-pc0-01',
    'corso-pcbase-01',
    'corso-form-psv-01'
  ]);
  return corsi
    .filter((c) => Boolean(c && c.id && !LEGACY_MOCK_IDS.has(c.id)))
    .map((c) => {
    const main = healSedePayload(c.sedeSvolgimentoSedeId, c.sedeCorso, c.indirizzoCompleto, c.coordinate);
    const lezioniAgg = Array.isArray(c.lezioni)
      ? c.lezioni.map((l) => {
          const lz = healSedePayload(l.sedeSvolgimentoSedeId, l.sedeNome, l.indirizzoCompleto, l.coordinate);
          return {
            ...l,
            sedeNome: lz.sedeNome || l.sedeNome,
            indirizzoCompleto: lz.indirizzo ?? l.indirizzoCompleto ?? '',
            coordinate: lz.coord ?? l.coordinate
          };
        })
      : c.lezioni;
    const iscrittiAgg = Array.isArray(c.iscritti)
      ? c.iscritti.map((isc) => ({
          ...isc,
          timbratureLezioni: Array.isArray(isc.timbratureLezioni)
            ? isc.timbratureLezioni.map((tl) => ({
                ...tl,
                sedeLezioneNome: tl.sedeLezioneNome
                  ? normalizzaNomeCarraraTesto(tl.sedeLezioneNome)
                  : tl.sedeLezioneNome
              }))
            : isc.timbratureLezioni
        }))
      : c.iscritti;
    const sezioniDestNomiAgg = Array.isArray(c.sezioniDestinatarieNomi)
      ? c.sezioniDestinatarieNomi.map((n) => normalizzaNomeCarraraTesto(n))
      : c.sezioniDestinatarieNomi;

    return {
      ...c,
      sedeCorso: main.sedeNome || c.sedeCorso,
      indirizzoCompleto: main.indirizzo ?? c.indirizzoCompleto,
      coordinate: main.coord ?? c.coordinate,
      lezioni: lezioniAgg,
      iscritti: iscrittiAgg,
      sezioniDestinatarieNomi: sezioniDestNomiAgg
    };
  });
}
