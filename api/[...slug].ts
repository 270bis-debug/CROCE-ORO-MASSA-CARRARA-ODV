// Vercel Serverless Catch-All Function: /api/*
// 1. Esegue realmente tutti gli invii email SMTP (/api/notifica-*, /api/invia-email-*, /api/promemoria-turni/*, etc.)
//    con autenticazione rigorosa del chiamante e credenziali SMTP lette solo da process.env.
// 2. Evita 404 sugli endpoint REST legacy quando la sincronizzazione usa Firebase Cloud Firestore.
import type { IncomingMessage, ServerResponse } from 'http';
import { applyStrictCors, readJsonBody, verifyApiCaller } from '../server-lib/apiAuth';
import { handleServerlessEmailRoute, isServerlessEmailPathname } from '../server-lib/smtpMailer';

export default async function handler(
  req: IncomingMessage & { method?: string; url?: string; body?: any },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }
) {
  const send = (status: number, data: any) => {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(status).json(data);
    }
    res.statusCode = status;
    return res.end(JSON.stringify(data));
  };

  if (!applyStrictCors(req, res, 'GET, POST, PUT, DELETE, OPTIONS')) {
    return send(403, { ok: false, error: 'Origine non autorizzata.' });
  }
  res.setHeader('X-Sync-Mode', 'cloud-firestore');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const pathname = (req.url || '').split('?')[0].toLowerCase();

  // Gestione reale invii Email SMTP in produzione (Vercel Serverless)
  if (req.method === 'POST' && isServerlessEmailPathname(pathname)) {
    const caller = await verifyApiCaller(req);
    if (!caller.authorized) {
      return send(401, {
        ok: false,
        success: false,
        inviata: false,
        error: caller.reason || 'Non autorizzato',
      });
    }
    const body = await readJsonBody(req, 10_000_000);
    const result = await handleServerlessEmailRoute(pathname, body);
    return send(result.status, result.payload);
  }

  if (pathname.endsWith('/volontari')) {
    return send(200, { ok: true, mode: 'cloud-firestore', volontari: [] });
  }
  if (pathname.endsWith('/turni')) {
    return send(200, { ok: true, mode: 'cloud-firestore', turni: [] });
  }
  if (pathname.endsWith('/sedi') || pathname.endsWith('/luoghi-timbratura')) {
    return send(200, []);
  }
  if (pathname.endsWith('/bacheca')) {
    return send(200, { ok: true, mode: 'cloud-firestore', bacheca: [] });
  }
  if (pathname.endsWith('/giornale-bordo')) {
    return send(200, { ok: true, mode: 'cloud-firestore', giornaleBordo: [] });
  }
  if (pathname.endsWith('/timbrature')) {
    return send(200, { ok: true, mode: 'cloud-firestore', timbrature: [] });
  }
  if (pathname.endsWith('/indirizzi-collezionati')) {
    return send(200, { ok: true, mode: 'cloud-firestore', indirizziCollezionati: [] });
  }
  if (pathname.endsWith('/magazzino-mezzi')) {
    return send(200, { ok: true, success: false, mode: 'cloud-firestore', magazzinoParti: [], magazzinoMezzi: [] });
  }

  return send(200, { ok: true, mode: 'cloud-firestore' });
}
