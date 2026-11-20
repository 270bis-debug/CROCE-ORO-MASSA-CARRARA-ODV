// Validazione, ottimizzazione e lettura sicura per Immagini Post e Allegati Bacheca
// Formati allegati consentiti: pdf, jpeg, jpg, png, doc, docx, bmp, xls, xlsx

export type TipoAllegatoBacheca = 'pdf' | 'image' | 'word' | 'excel';

export const ESTENSIONI_ALLEGATI_CONSENTITE = [
  'pdf',
  'jpeg',
  'jpg',
  'png',
  'doc',
  'docx',
  'bmp',
  'xls',
  'xlsx',
] as const;

export const ACCEPT_ALLEGATI_BACHECA =
  '.pdf,.jpeg,.jpg,.png,.doc,.docx,.bmp,.xls,.xlsx,application/pdf,image/jpeg,image/png,image/bmp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const ACCEPT_IMMAGINE_POST_BACHECA =
  '.jpeg,.jpg,.png,.bmp,.webp,image/jpeg,image/png,image/bmp,image/webp';

const MAX_POST_IMAGE_DIMENSION = 1280;
const MAX_ATTACHMENT_BYTES_DIRECT = 620 * 1024; // ~620 KB base64 safe per sync Firestore multi-device
const MAX_ATTACHMENT_FILE_BYTES = 8 * 1024 * 1024; // 8 MB prima della compressione / controllo

export function getEstensioneFile(fileName: string): string {
  const clean = (fileName || '').trim().toLowerCase();
  const idx = clean.lastIndexOf('.');
  return idx >= 0 ? clean.slice(idx + 1) : '';
}

export function formatDimensioneFile(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function detectTipoAllegato(fileName: string, mime?: string): TipoAllegatoBacheca | null {
  const ext = getEstensioneFile(fileName);
  if (ext === 'pdf') return 'pdf';
  if (ext === 'jpeg' || ext === 'jpg' || ext === 'png' || ext === 'bmp') return 'image';
  if (ext === 'doc' || ext === 'docx') return 'word';
  if (ext === 'xls' || ext === 'xlsx') return 'excel';

  const m = (mime || '').toLowerCase();
  if (m === 'application/pdf') return 'pdf';
  if (m === 'image/jpeg' || m === 'image/png' || m === 'image/bmp') return 'image';
  if (m.includes('wordprocessingml') || m === 'application/msword') return 'word';
  if (m.includes('spreadsheetml') || m === 'application/vnd.ms-excel') return 'excel';
  return null;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Impossibile leggere il file selezionato.'));
    reader.readAsDataURL(file);
  });
}

function comprimiImmaginePerSync(
  file: File,
  maxDim = MAX_POST_IMAGE_DIMENSION,
  quality = 0.82
): Promise<{ dataUrl: string; approxBytes: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.max(1, Math.round(w * ratio));
          h = Math.max(1, Math.round(h * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Canvas non supportato dal browser.'));
          return;
        }
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        let q = quality;
        let dataUrl = canvas.toDataURL('image/jpeg', q);
        while (dataUrl.length > MAX_ATTACHMENT_BYTES_DIRECT && q > 0.42) {
          q -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', q);
        }
        // Se ancora troppo grande, riduci leggermente le dimensioni
        if (dataUrl.length > MAX_ATTACHMENT_BYTES_DIRECT) {
          const scale = 0.72;
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          const ctx2 = canvas.getContext('2d');
          if (ctx2) {
            ctx2.drawImage(img, 0, 0, canvas.width, canvas.height);
            dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          }
        }
        URL.revokeObjectURL(url);
        resolve({ dataUrl, approxBytes: Math.round((dataUrl.length * 3) / 4) });
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Immagine non valida o danneggiata.'));
    };
    img.src = url;
  });
}

/**
 * Elabora l'immagine principale di un post in bacheca (ridimensionamento automatico sicuro per PC e Mobile).
 */
export async function elaboraImmaginePostBacheca(file: File): Promise<{
  dataUrl: string;
  nome: string;
  dimensione: number;
}> {
  const ext = getEstensioneFile(file.name);
  const okExt = ['jpeg', 'jpg', 'png', 'bmp', 'webp'].includes(ext);
  const okMime = (file.type || '').toLowerCase().startsWith('image/');
  if (!okExt && !okMime) {
    throw new Error('Formato immagine non valido. Usa JPEG, PNG, BMP o WEBP.');
  }
  if (file.size > MAX_ATTACHMENT_FILE_BYTES) {
    throw new Error('Immagine troppo pesante (massimo 8 MB).');
  }
  const { dataUrl, approxBytes } = await comprimiImmaginePerSync(file, MAX_POST_IMAGE_DIMENSION, 0.82);
  return {
    dataUrl,
    nome: file.name,
    dimensione: approxBytes,
  };
}

/**
 * Elabora e valida un allegato bacheca (SOLO pdf, jpeg, jpg, png, doc, docx, bmp, xls, xlsx).
 */
export async function elaboraAllegatoBacheca(file: File): Promise<{
  dataUrl: string;
  nome: string;
  tipo: TipoAllegatoBacheca;
  mime: string;
  dimensione: number;
}> {
  const ext = getEstensioneFile(file.name);
  if (!(ESTENSIONI_ALLEGATI_CONSENTITE as readonly string[]).includes(ext)) {
    throw new Error(
      `Formato ".${ext || 'sconosciuto'}" non consentito. Sono ammessi SOLO: PDF, JPEG, PNG, DOC, DOCX, BMP, XLS, XLSX.`
    );
  }
  const tipo = detectTipoAllegato(file.name, file.type);
  if (!tipo) {
    throw new Error('Tipo file allegato non consentito.');
  }
  if (file.size > MAX_ATTACHMENT_FILE_BYTES) {
    throw new Error('Allegato troppo pesante (massimo 8 MB).');
  }

  if (tipo === 'image') {
    const { dataUrl, approxBytes } = await comprimiImmaginePerSync(file, 1400, 0.82);
    return {
      dataUrl,
      nome: file.name,
      tipo: 'image',
      mime: 'image/jpeg',
      dimensione: approxBytes,
    };
  }

  const dataUrl = await readFileAsDataUrl(file);
  if (dataUrl.length > 720 * 1024) {
    throw new Error(
      'Il documento supera il limite massimo per la sincronizzazione istantanea protetta (circa 500 KB). Comprimi leggermente il PDF/documento e riprova.'
    );
  }

  return {
    dataUrl,
    nome: file.name,
    tipo,
    mime: file.type || (tipo === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
    dimensione: file.size,
  };
}
