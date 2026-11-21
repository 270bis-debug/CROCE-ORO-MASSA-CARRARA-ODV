// Vercel Serverless Function: GET /api/vapid-public-key
import type { IncomingMessage, ServerResponse } from 'http';

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BBIgy7sPt5aiNKmumUH57K28pFivVG3qKun0xMT7ZLJq8Kc6c_hCzawksKptqyOI0pIXRZ7I6tmEr9D_jM4a6bc';

export default function handler(
  req: IncomingMessage & { method?: string },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }
) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const payload = { success: true, publicKey: VAPID_PUBLIC_KEY };
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(200).json(payload);
  }
  res.statusCode = 200;
  return res.end(JSON.stringify(payload));
}
