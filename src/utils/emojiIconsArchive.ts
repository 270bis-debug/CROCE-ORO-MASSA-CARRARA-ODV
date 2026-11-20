/**
 * emojiIconsArchive.ts
 * Archivio centralizzato di Emoji operative (ampliato con icone standard Unicode)
 * e di icone personalizzate (.ico) caricate dagli utenti autorizzati.
 * Le icone .ico caricate vengono elaborate per allineare automaticamente lo sfondo
 * allo sfondo delle altre icone (rimozione sfondo solido opaco / preservazione trasparenza)
 * e rimangono salvate in modo permanente (localStorage + server + Firestore config shard)
 * finché non vengono rimosse manualmente.
 */

export interface CustomEmojiIcon {
  id: string;
  nome: string;
  dataUrl: string; // PNG trasparente compatto (max 64x64) derivato dal file .ico
  createdAt: number;
  createdBy?: string;
}

export const CUSTOM_ICON_PREFIX = 'custom-icon:';
export const CUSTOM_EMOJI_ICONS_STORAGE_KEY = 'CROCE_ORO_CUSTOM_EMOJI_ICONS';
export const CUSTOM_EMOJI_ICONS_UPDATED_AT_KEY = 'CROCE_ORO_CUSTOM_EMOJI_ICONS_UPDATED_AT';

export interface EmojiCategoryGroup {
  id: string;
  label: string;
  emojis: string[];
}

/**
 * Archivio ampliato di Emoji Unicode (soccorso, sanitario, mezzi, TLC/radio,
 * protezione civile, attrezzature, ruoli, formazione e amministrazione).
 */
export const EMOJI_ARCHIVE_GROUPS: EmojiCategoryGroup[] = [
  {
    id: 'sanitario',
    label: 'Sanitario & Emergenza',
    emojis: [
      '🚑', '🏥', '🩺', '🩹', '💊', '💉', '🧬', '🫀', '🫁', '🩻',
      '🩸', '🧪', '🌡️', '⚕️', '🆘', '🚨', '🩼', '🦽', '🦼', '🛟',
      '❤️‍🩹', '🏥'
    ].filter((v, i, a) => a.indexOf(v) === i),
  },
  {
    id: 'equipaggio',
    label: 'Equipaggio & Riconoscimenti',
    emojis: [
      '🧑‍⚕️', '👨‍⚕️', '👩‍⚕️', '🧑‍🚒', '👮', '👷', '👥', '🤝', '🫶', '👁️',
      '💪', '🏅', '🎖️', '🏆', '👑', '⭐', '🌟', '✨', '🎯', '🛡️'
    ],
  },
  {
    id: 'mezzi',
    label: 'Mezzi & Trasporti',
    emojis: [
      '🚐', '🚒', '🚓', '🚗', '🚙', '🚕', '🚌', '🚚', '🚛', '🚁',
      '🚤', '🛥️', '⛽', '🛞', '🚦', '🚧'
    ],
  },
  {
    id: 'centrale',
    label: 'Centrale, Radio & TLC',
    emojis: [
      '📻', '📡', '🎧', '📞', '☎️', '📱', '🎙️', '📢', '📣', '🔊',
      '🔔', '💬', '🖥️', '💻', '🗺️', '🧭', '📍'
    ],
  },
  {
    id: 'pc_attrezzature',
    label: 'Protezione Civile & Attrezzature',
    emojis: [
      '🦺', '⛑️', '🪖', '🧯', '🔥', '💧', '🌊', '🌪️', '⛰️', '🌲',
      '⚡', '🔦', '🧰', '🔧', '🔨', '🛠️', '⚙️', '🪓', '🪜', '🪢',
      '🔗', '⚠️'
    ],
  },
  {
    id: 'ufficio_formazione',
    label: 'Formazione, Categorie & Ufficio',
    emojis: [
      '🎓', '📚', '📋', '📝', '📁', '📂', '🗂️', '📅', '⏰', '🔑',
      '🔒', '✅', '💼', '👕', '🎒', '📦', '🏷️', '📌', '🧾', '💶'
    ],
  },
];

export const ALL_STANDARD_EMOJIS: string[] = Array.from(
  new Set(EMOJI_ARCHIVE_GROUPS.flatMap((g) => g.emojis))
);

export function isCustomIconValue(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.startsWith(CUSTOM_ICON_PREFIX) || trimmed.startsWith('data:image/');
}

export function extractCustomIconId(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith(CUSTOM_ICON_PREFIX)) return null;
  return trimmed.slice(CUSTOM_ICON_PREFIX.length) || null;
}

export function toCustomIconToken(id: string): string {
  return `${CUSTOM_ICON_PREFIX}${id}`;
}

export function getCustomEmojiIconsUpdatedAt(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(CUSTOM_EMOJI_ICONS_UPDATED_AT_KEY);
    const num = raw ? Number(raw) : 0;
    return Number.isFinite(num) && num > 0 ? num : 0;
  } catch {
    return 0;
  }
}

export function touchCustomEmojiIconsUpdatedAt(ts?: number): number {
  const val = typeof ts === 'number' && Number.isFinite(ts) && ts > 0 ? ts : Date.now();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CUSTOM_EMOJI_ICONS_UPDATED_AT_KEY, String(val));
    } catch {}
  }
  return val;
}

function emettiAggiornamentoCustomIconsLocal(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('croceoro_custom_icons_updated'));
  } catch {}
}

if (typeof window !== 'undefined') {
  try {
    window.addEventListener('storage', (e: StorageEvent) => {
      if (!e.key || e.key === CUSTOM_EMOJI_ICONS_STORAGE_KEY) {
        emettiAggiornamentoCustomIconsLocal();
      }
    });
  } catch {}
}

export function normalizzaCustomEmojiIcons(raw: any): CustomEmojiIcon[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CustomEmojiIcon[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const id = String(item.id || '').trim();
    const dataUrl = String(item.dataUrl || '').trim();
    if (!id || !dataUrl.startsWith('data:image/')) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      nome: String(item.nome || 'Icona').trim().slice(0, 80) || 'Icona',
      dataUrl,
      createdAt: Number(item.createdAt) || Date.now(),
      createdBy: item.createdBy ? String(item.createdBy).trim() : undefined,
    });
  }
  return out;
}

export function getCustomEmojiIcons(): CustomEmojiIcon[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_EMOJI_ICONS_STORAGE_KEY);
    if (!raw) return [];
    return normalizzaCustomEmojiIcons(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function salvaCustomEmojiIcons(
  icons: CustomEmojiIcon[],
  dispatch = true,
  updatedAt?: number
): CustomEmojiIcon[] {
  const norm = normalizzaCustomEmojiIcons(icons);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CUSTOM_EMOJI_ICONS_STORAGE_KEY, JSON.stringify(norm));
      touchCustomEmojiIconsUpdatedAt(updatedAt);
      if (dispatch) emettiAggiornamentoCustomIconsLocal();
    } catch (err) {
      console.error('Errore salvataggio archivio icone custom:', err);
    }
  }
  return norm;
}

export function applicaCustomEmojiIconsDaSync(
  icons?: any[] | null,
  updatedAt?: number
): boolean {
  if (typeof window === 'undefined' || !Array.isArray(icons)) return false;
  const incomingTs = typeof updatedAt === 'number' && Number.isFinite(updatedAt) ? updatedAt : 0;
  const localTs = getCustomEmojiIconsUpdatedAt();
  if (incomingTs > 0 && localTs > incomingTs) {
    return false;
  }
  const norm = normalizzaCustomEmojiIcons(icons);
  try {
    localStorage.setItem(CUSTOM_EMOJI_ICONS_STORAGE_KEY, JSON.stringify(norm));
    touchCustomEmojiIconsUpdatedAt(incomingTs > 0 ? incomingTs : undefined);
    emettiAggiornamentoCustomIconsLocal();
    return true;
  } catch {
    return false;
  }
}

export function aggiungiCustomEmojiIcon(icon: CustomEmojiIcon): CustomEmojiIcon[] {
  const attuali = getCustomEmojiIcons();
  const aggiornate = [...attuali.filter((i) => i.id !== icon.id), icon];
  return salvaCustomEmojiIcons(aggiornate);
}

export function rimuoviCustomEmojiIcon(id: string): CustomEmojiIcon[] {
  const attuali = getCustomEmojiIcons();
  const aggiornate = attuali.filter((i) => i.id !== id);
  return salvaCustomEmojiIcons(aggiornate);
}

export function resolveCustomIconDataUrl(
  value?: string | null,
  iconsList?: CustomEmojiIcon[]
): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.startsWith('data:image/')) return trimmed;
  const id = extractCustomIconId(trimmed);
  if (!id) return null;
  const list = iconsList || getCustomEmojiIcons();
  const found = list.find((i) => i.id === id);
  return found?.dataUrl || null;
}

/**
 * Converte un valore icona (emoji o custom-icon) in testo sicuro per <option>, notifiche radio e PDF.
 * Non restituisce mai stringhe tecniche tipo "custom-icon:..." o "data:image/...".
 */
export function formatIconaPerTesto(value?: string | null, fallback = ''): string {
  if (!value || typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (isCustomIconValue(trimmed)) {
    return fallback;
  }
  return trimmed;
}

/**
 * Estrae il frame migliore (più grande) da un buffer binario .ico se è un PNG incorporato,
 * altrimenti restituisce null per usare il decoder nativo del browser.
 */
function extractBestPngFromIcoBuffer(buffer: ArrayBuffer): Blob | null {
  try {
    const view = new DataView(buffer);
    if (buffer.byteLength < 22) return null;
    const reserved = view.getUint16(0, true);
    const type = view.getUint16(2, true);
    const count = view.getUint16(4, true);
    if (reserved !== 0 || type !== 1 || count < 1 || count > 64) return null;

    let bestOffset = -1;
    let bestSize = 0;
    let bestWidth = 0;

    for (let i = 0; i < count; i++) {
      const entryOffset = 6 + i * 16;
      if (entryOffset + 16 > buffer.byteLength) break;
      const wRaw = view.getUint8(entryOffset);
      const width = wRaw === 0 ? 256 : wRaw;
      const bytesInRes = view.getUint32(entryOffset + 8, true);
      const imageOffset = view.getUint32(entryOffset + 12, true);
      if (imageOffset + bytesInRes > buffer.byteLength || bytesInRes < 8) continue;

      // Controlla magic header PNG (89 50 4E 47)
      const isPng =
        view.getUint8(imageOffset) === 0x89 &&
        view.getUint8(imageOffset + 1) === 0x50 &&
        view.getUint8(imageOffset + 2) === 0x4e &&
        view.getUint8(imageOffset + 3) === 0x47;

      if (isPng && (width > bestWidth || (width === bestWidth && bytesInRes > bestSize))) {
        bestWidth = width;
        bestSize = bytesInRes;
        bestOffset = imageOffset;
      }
    }

    if (bestOffset >= 0 && bestSize > 0) {
      return new Blob([buffer.slice(bestOffset, bestOffset + bestSize)], { type: 'image/png' });
    }
    return null;
  } catch {
    return null;
  }
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Impossibile decodificare il file icona (.ico).'));
    };
    img.src = url;
  });
}

/**
 * Rimuove automaticamente uno sfondo solido opaco (es. bianco o colore uniforme ai bordi)
 * mediante flood-fill dai 4 lati con sfumatura morbida sui bordi, lasciando invariate
 * le icone che dispongono già di trasparenza nativa.
 * In questo modo lo sfondo dell'icona si allinea automaticamente allo sfondo delle altre icone.
 */
function alignBackgroundToTransparent(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  // 1. Controlla se l'icona possiede già una trasparenza significativa o angoli trasparenti
  let transparentCount = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 240) transparentCount++;
  }
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
  ];
  const transparentCorners = corners.filter((idx) => data[idx + 3] < 25).length;

  // Se l'icona è già trasparente ai bordi/angoli, preserva la trasparenza originale
  if (transparentCorners >= 2 || transparentCount / totalPixels > 0.06) {
    return;
  }

  // 2. Verifica se almeno 3 angoli condividono un colore di sfondo uniforme
  const cornerColors = corners.map((idx) => [data[idx], data[idx + 1], data[idx + 2]]);
  const colorDist = (a: number[], b: number[]) =>
    Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

  let bgColor: number[] | null = null;
  for (let i = 0; i < cornerColors.length; i++) {
    let matches = 0;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    for (let j = 0; j < cornerColors.length; j++) {
      if (colorDist(cornerColors[i], cornerColors[j]) <= 34) {
        matches++;
        sumR += cornerColors[j][0];
        sumG += cornerColors[j][1];
        sumB += cornerColors[j][2];
      }
    }
    if (matches >= 3) {
      bgColor = [Math.round(sumR / matches), Math.round(sumG / matches), Math.round(sumB / matches)];
      break;
    }
  }

  if (!bgColor) return;

  // 3. Flood-fill BFS dai bordi esterni per rimuovere solo lo sfondo collegato al perimetro
  const hardThreshold = 34;
  const featherThreshold = 62;
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const tryEnqueue = (x: number, y: number) => {
    const p = y * width + x;
    if (visited[p]) return;
    const idx = p * 4;
    const dist = colorDist([data[idx], data[idx + 1], data[idx + 2]], bgColor!);
    if (dist <= hardThreshold) {
      visited[p] = 1;
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < width; x++) {
    tryEnqueue(x, 0);
    tryEnqueue(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryEnqueue(0, y);
    tryEnqueue(width - 1, y);
  }

  // Se il flood-fill rischia di cancellare quasi tutta l'icona (>94%), annulla per sicurezza
  const cleared: number[] = [];
  while (head < tail) {
    const p = queue[head++];
    cleared.push(p);
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) tryEnqueue(x - 1, y);
    if (x < width - 1) tryEnqueue(x + 1, y);
    if (y > 0) tryEnqueue(x, y - 1);
    if (y < height - 1) tryEnqueue(x, y + 1);
  }

  if (cleared.length === 0 || cleared.length / totalPixels > 0.94) {
    return;
  }

  for (const p of cleared) {
    data[p * 4 + 3] = 0;
  }

  // Anti-aliasing morbido sui pixel adiacenti ai pixel rimossi
  for (const p of cleared) {
    const x = p % width;
    const y = (p - x) / width;
    const neighbors = [
      x > 0 ? p - 1 : -1,
      x < width - 1 ? p + 1 : -1,
      y > 0 ? p - width : -1,
      y < height - 1 ? p + width : -1,
    ];
    for (const np of neighbors) {
      if (np < 0 || visited[np]) continue;
      const idx = np * 4;
      const dist = colorDist([data[idx], data[idx + 1], data[idx + 2]], bgColor);
      if (dist <= featherThreshold) {
        const ratio = Math.max(0, Math.min(1, (dist - hardThreshold) / (featherThreshold - hardThreshold)));
        data[idx + 3] = Math.min(data[idx + 3], Math.round(ratio * 255));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Converte un file .ico caricato dall'utente in un'icona PNG trasparente compatta (64x64)
 * con allineamento automatico dello sfondo, pronta per l'archivio Emoji permanente.
 */
export async function processIcoFileToCustomIcon(
  file: File,
  createdBy?: string
): Promise<CustomEmojiIcon> {
  const lowerName = (file.name || '').toLowerCase();
  const validExt = lowerName.endsWith('.ico');
  const validMime =
    file.type === 'image/x-icon' ||
    file.type === 'image/vnd.microsoft.icon' ||
    file.type === 'image/ico' ||
    file.type === 'application/ico';

  if (!validExt && !validMime) {
    throw new Error('Seleziona un file in formato .ico valido.');
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Il file .ico supera il limite massimo di 2 MB.');
  }

  const buffer = await file.arrayBuffer();
  const embeddedPng = extractBestPngFromIcoBuffer(buffer);

  let img: HTMLImageElement;
  if (embeddedPng) {
    try {
      img = await loadImageFromBlob(embeddedPng);
    } catch {
      img = await loadImageFromBlob(file);
    }
  } else {
    img = await loadImageFromBlob(file);
  }

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contesto grafico non disponibile sul dispositivo.');
  }

  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const natW = img.naturalWidth || img.width || size;
  const natH = img.naturalHeight || img.height || size;
  const padding = 4;
  const avail = size - padding * 2;
  const scale = Math.min(avail / natW, avail / natH);
  const drawW = Math.max(1, Math.round(natW * scale));
  const drawH = Math.max(1, Math.round(natH * scale));
  const offsetX = Math.round((size - drawW) / 2);
  const offsetY = Math.round((size - drawH) / 2);

  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

  // Allinea automaticamente lo sfondo allo sfondo delle altre icone
  alignBackgroundToTransparent(ctx, size, size);

  const dataUrl = canvas.toDataURL('image/png');
  const cleanLabel = (file.name || 'icona')
    .replace(/\.ico$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .slice(0, 50) || 'Icona .ico';

  return {
    id: `ico-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nome: cleanLabel,
    dataUrl,
    createdAt: Date.now(),
    createdBy: createdBy || undefined,
  };
}
