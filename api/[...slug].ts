// Vercel Serverless Catch-All Function: /api/*
// Evita errori 404 sugli endpoint REST legacy su Vercel quando la sincronizzazione usa Firebase Cloud Firestore
import type { IncomingMessage, ServerResponse } from 'http';

export default function handler(
  req: IncomingMessage & { method?: string; url?: string },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }
) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Sync-Mode', 'cloud-firestore');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const pathname = (req.url || '').split('?')[0].toLowerCase();
  const send = (data: any) => {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(200).json(data);
    }
    res.statusCode = 200;
    return res.end(JSON.stringify(data));
  };

  if (pathname.endsWith('/volontari')) {
    return send({ ok: true, mode: 'cloud-firestore', volontari: [] });
  }
  if (pathname.endsWith('/turni')) {
    return send({ ok: true, mode: 'cloud-firestore', turni: [] });
  }
  if (pathname.endsWith('/sedi') || pathname.endsWith('/luoghi-timbratura')) {
    return send([]);
  }
  if (pathname.endsWith('/bacheca')) {
    return send({ ok: true, mode: 'cloud-firestore', bacheca: [] });
  }
  if (pathname.endsWith('/giornale-bordo')) {
    return send({ ok: true, mode: 'cloud-firestore', giornaleBordo: [] });
  }
  if (pathname.endsWith('/timbrature')) {
    return send({ ok: true, mode: 'cloud-firestore', timbrature: [] });
  }
  if (pathname.endsWith('/indirizzi-collezionati')) {
    return send({ ok: true, mode: 'cloud-firestore', indirizziCollezionati: [] });
  }
  if (pathname.endsWith('/magazzino-mezzi')) {
    return send({ ok: true, success: false, mode: 'cloud-firestore', magazzinoParti: [], magazzinoMezzi: [] });
  }

  return send({ ok: true, mode: 'cloud-firestore' });
}
