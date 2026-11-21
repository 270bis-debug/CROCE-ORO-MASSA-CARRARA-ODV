// Vercel Serverless Function: POST /api/push-subscribe
// Conferma la sottoscrizione Push sul dominio statico (la persistenza multi-dispositivo è su Firestore push_subscriptions)
import type { IncomingMessage, ServerResponse } from 'http';

export default function handler(
  req: IncomingMessage & { method?: string; body?: any },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }
) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const payload = { success: true, mode: 'cloud-firestore' };
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(200).json(payload);
  }
  res.statusCode = 200;
  return res.end(JSON.stringify(payload));
}
