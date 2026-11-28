// Vercel Serverless Function: POST /api/push-subscribe
// Conferma la sottoscrizione Push sul dominio statico (la persistenza multi-dispositivo è su Firestore push_subscriptions)
import type { IncomingMessage, ServerResponse } from 'http';
import { applyStrictCors } from '../server-lib/apiAuth';

export default function handler(
  req: IncomingMessage & { method?: string; body?: any },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }
) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  const originAllowed = applyStrictCors(req, res, 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = originAllowed ? 204 : 403;
    return res.end();
  }

  const payload = { success: true, mode: 'cloud-firestore' };
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(200).json(payload);
  }
  res.statusCode = 200;
  return res.end(JSON.stringify(payload));
}
