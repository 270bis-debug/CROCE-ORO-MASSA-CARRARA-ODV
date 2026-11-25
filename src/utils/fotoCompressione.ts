/**
 * Utility client-side per compressione leggera di foto operative (scontrini carburante,
 * foto guasti/sinistri mezzi) e allegati SOP compatibili con il limite 1 MB di Firestore.
 */

export async function comprimiFotoOperativa(
  file: File,
  maxSide: number = 640,
  quality: number = 0.62
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossibile leggere il file immagine.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato immagine non valido.'));
      img.onload = () => {
        try {
          let w = img.naturalWidth || img.width;
          let h = img.naturalHeight || img.height;
          if (w > maxSide || h > maxSide) {
            if (w >= h) {
              h = Math.round((h * maxSide) / w);
              w = maxSide;
            } else {
              w = Math.round((w * maxSide) / h);
              h = maxSide;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, w);
          canvas.height = Math.max(1, h);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas non supportato dal browser.'));
            return;
          }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

export async function leggiAllegatoDocumentoSop(
  file: File,
  maxBytes: number = 350 * 1024
): Promise<{ dataUrl: string; nome: string; mime: string; dimensione: number }> {
  if (file.type.startsWith('image/')) {
    const compressed = await comprimiFotoOperativa(file, 960, 0.72);
    const approxBytes = Math.round((compressed.length * 3) / 4);
    return {
      dataUrl: compressed,
      nome: file.name,
      mime: 'image/jpeg',
      dimensione: approxBytes,
    };
  }
  if (file.size > maxBytes) {
    throw new Error(
      `Il file supera il limite di ${Math.round(maxBytes / 1024)} KB per la sincronizzazione cloud diretta. Comprimi il PDF oppure inserisci un link esterno (Google Drive / sito).`
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Errore nella lettura del file.'));
    reader.onload = () =>
      resolve({
        dataUrl: String(reader.result || ''),
        nome: file.name,
        mime: file.type || 'application/pdf',
        dimensione: file.size,
      });
    reader.readAsDataURL(file);
  });
}
