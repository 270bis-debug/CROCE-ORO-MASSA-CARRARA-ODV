// Vercel Serverless Function: GET /api/vapid-public-key
import type { IncomingMessage, ServerResponse } from 'http';
import { applyStrictCors } from '../server-lib/apiAuth.js';

function sendJson(
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any },
  statusCode: number,
  payload: any
) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(payload);
  }
  res.statusCode = statusCode;
  return res.end(JSON.stringify(payload));
}

export default function handler(
  req: IncomingMessage & { method?: string },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }
) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  applyStrictCors(req, res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
  if (!publicKey) {
    return sendJson(res, 503, {
      success: false,
      error: 'Chiave pubblica VAPID non configurata (impostare VAPID_PUBLIC_KEY nelle variabili ambiente).',
    });
  }

  return sendJson(res, 200, { success: true, publicKey });
}
