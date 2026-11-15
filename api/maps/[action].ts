// Vercel Serverless Function: /api/maps/[action] (config, search-places, geocode, reverse-geocode)
import type { IncomingMessage, ServerResponse } from 'http';

async function readJsonBody(req: IncomingMessage & { body?: any }): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch {
    return {};
  }
}

export default async function handler(
  req: IncomingMessage & { method?: string; url?: string; query?: Record<string, any>; body?: any },
  res: ServerResponse & { status?: (code: number) => any; json?: (data: any) => any }
) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const send = (code: number, data: any) => {
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(code).json(data);
    }
    res.statusCode = code;
    return res.end(JSON.stringify(data));
  };

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const rawAction = String(req.query?.action || req.url?.split('?')[0]?.split('/').pop() || '').toLowerCase();
  const apiKey = (process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

  if (rawAction === 'config') {
    return send(200, { success: true, hasGoogleMapsKey: Boolean(apiKey), apiKey });
  }

  const body = await readJsonBody(req);

  if (rawAction === 'search-places') {
    const query = String(body?.query || '').trim();
    if (query.length < 2) {
      return send(200, { success: true, results: [], quotaExceeded: false });
    }
    let quotaExceeded = false;
    const results: any[] = [];

    if (apiKey) {
      try {
        const gRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.primaryTypeDisplayName',
          },
          body: JSON.stringify({
            textQuery: query,
            languageCode: 'it',
            regionCode: 'it',
            pageSize: 8,
            locationBias: {
              circle: { center: { latitude: 44.0365, longitude: 10.1415 }, radius: 45000.0 },
            },
          }),
        });
        const gData: any = await gRes.json().catch(() => ({}));
        if (gRes.status === 429 || gData?.error?.status === 'RESOURCE_EXHAUSTED') {
          quotaExceeded = true;
        } else if (gRes.ok && Array.isArray(gData?.places)) {
          for (const p of gData.places) {
            const formattedAddress = String(p?.formattedAddress || p?.displayName?.text || '').trim();
            if (!formattedAddress) continue;
            results.push({
              placeId: p?.id,
              displayName: String(p?.displayName?.text || '').trim(),
              formattedAddress,
              lat: typeof p?.location?.latitude === 'number' ? p.location.latitude : undefined,
              lng: typeof p?.location?.longitude === 'number' ? p.location.longitude : undefined,
              googleMapsUri: p?.googleMapsUri,
              typeLabel: p?.primaryTypeDisplayName?.text,
              source: 'google_maps',
            });
          }
        }
      } catch {}
    }

    if (results.length === 0) {
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&countrycodes=it&addressdetails=1&limit=7&accept-language=it&viewbox=9.65,44.45,10.55,43.75`;
        const nRes = await fetch(nomUrl, { headers: { 'User-Agent': 'CroceOroMassaCarrara-Centrale/1.0' } });
        if (nRes.ok) {
          const nData: any = await nRes.json().catch(() => []);
          if (Array.isArray(nData)) {
            for (const item of nData) {
              const full = String(item?.display_name || '').trim();
              if (!full) continue;
              const addr = item?.address || {};
              const via = [addr.road || addr.pedestrian || addr.square, addr.house_number].filter(Boolean).join(' ');
              const city = addr.city || addr.town || addr.village || addr.municipality || '';
              const cap = addr.postcode || '';
              const compact = [via, [cap, city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
              const formattedAddress = compact && compact.length >= 6 ? compact : full;
              const displayName = String(item?.name || addr.amenity || addr.shop || formattedAddress.split(',')[0] || '').trim();
              results.push({
                placeId: item?.place_id ? `osm-${item.place_id}` : undefined,
                displayName,
                formattedAddress,
                lat: item?.lat ? Number(item.lat) : undefined,
                lng: item?.lon ? Number(item.lon) : undefined,
                googleMapsUri: item?.lat && item?.lon ? `https://www.google.com/maps?q=${item.lat},${item.lon}` : undefined,
                typeLabel: item?.type ? String(item.type).replace(/_/g, ' ') : undefined,
                source: 'openstreetmap',
              });
            }
          }
        }
      } catch {}
    }
    return send(200, { success: true, results, quotaExceeded });
  }

  if (rawAction === 'geocode') {
    const address = String(body?.address || '').trim();
    if (!address) return send(200, { success: true, result: null, quotaExceeded: false });
    let quotaExceeded = false;
    let result: any = null;
    if (apiKey) {
      try {
        const gRes = await fetch(
          `https://geocode.googleapis.com/v4/geocode/address/${encodeURIComponent(address)}?languageCode=it&regionCode=it`,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': 'results.placeId,results.location,results.formattedAddress',
            },
          }
        );
        const gData: any = await gRes.json().catch(() => ({}));
        if (gRes.status === 429 || gData?.error?.status === 'RESOURCE_EXHAUSTED') {
          quotaExceeded = true;
        } else if (gRes.ok && Array.isArray(gData?.results) && gData.results[0]) {
          const first = gData.results[0];
          if (typeof first?.location?.latitude === 'number' && typeof first?.location?.longitude === 'number') {
            result = {
              formattedAddress: first.formattedAddress || address,
              lat: first.location.latitude,
              lng: first.location.longitude,
              placeId: first.placeId,
              source: 'google_maps',
            };
          }
        }
      } catch {}
    }
    if (!result) {
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(address)}&countrycodes=it&limit=1&accept-language=it`;
        const nRes = await fetch(nomUrl, { headers: { 'User-Agent': 'CroceOroMassaCarrara-Centrale/1.0' } });
        if (nRes.ok) {
          const nData: any = await nRes.json().catch(() => []);
          if (Array.isArray(nData) && nData[0]) {
            result = {
              formattedAddress: nData[0].display_name || address,
              lat: Number(nData[0].lat),
              lng: Number(nData[0].lon),
              placeId: nData[0].place_id ? `osm-${nData[0].place_id}` : undefined,
              source: 'openstreetmap',
            };
          }
        }
      } catch {}
    }
    return send(200, { success: true, result, quotaExceeded });
  }

  if (rawAction === 'reverse-geocode') {
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return send(400, { success: false, result: null, quotaExceeded: false });
    }
    let result: any = null;
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=it`;
      const nRes = await fetch(nomUrl, { headers: { 'User-Agent': 'CroceOroMassaCarrara-Centrale/1.0' } });
      if (nRes.ok) {
        const item: any = await nRes.json().catch(() => null);
        if (item) {
          result = {
            formattedAddress: item.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            lat,
            lng,
            placeId: item.place_id ? `osm-${item.place_id}` : undefined,
            source: 'openstreetmap',
          };
        }
      }
    } catch {}
    return send(200, { success: true, result, quotaExceeded: false });
  }

  return send(404, { success: false, error: 'Maps action not found' });
}
