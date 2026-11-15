/**
 * Utility per l'elaborazione delle firme digitali.
 * Rimuove il colore bianco/chiaro dello sfondo di scansioni o foto di firme
 * e produce un'immagine PNG con sfondo perfettamente trasparente e tratto nitido,
 * con ritaglio automatico dei bordi vuoti (auto-crop).
 */

export const validaImmagineFirma = (file: File): string | null => {
  const tipiValidi = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!tipiValidi.includes(file.type.toLowerCase())) {
    return 'Formato non supportato. Carica un\'immagine PNG, JPG o WEBP.';
  }
  // Limite massimo 10 MB
  if (file.size > 10 * 1024 * 1024) {
    return 'Il file è troppo grande (max 10 MB).';
  }
  return null;
};

export const rimuoviSfondoBiancoETrendiTrasparente = (
  fileOrDataUrl: File | string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const caricaImmagine = (src: string) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onerror = () => reject(new Error('Impossibile caricare l\'immagine della firma.'));
      img.onload = () => {
        try {
          const origW = img.naturalWidth || img.width;
          const origH = img.naturalHeight || img.height;

          if (!origW || !origH) {
            reject(new Error('Dimensioni immagine non valide.'));
            return;
          }

          // Scala l'immagine a risoluzione ottimale (max 900px) per evitare payload base64 enormi
          let targetW = origW;
          let targetH = origH;
          const maxDim = 900;
          if (targetW > maxDim || targetH > maxDim) {
            if (targetW > targetH) {
              targetH = Math.round((targetH * maxDim) / targetW);
              targetW = maxDim;
            } else {
              targetW = Math.round((targetW * maxDim) / targetH);
              targetH = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Impossibile inizializzare il canvas grafico.'));
            return;
          }

          ctx.drawImage(img, 0, 0, targetW, targetH);
          const imgData = ctx.getImageData(0, 0, targetW, targetH);
          const data = imgData.data;

          // Variabili per il calcolo del bounding box del tratto (auto-crop)
          let minX = targetW;
          let minY = targetH;
          let maxX = 0;
          let maxY = 0;
          let foundInk = false;

          // Rileva e rimuove lo sfondo bianco / carta chiara
          // Tratta i pixel per rendere trasparente il bianco e preservare l'inchiostro
          for (let y = 0; y < targetH; y++) {
            for (let x = 0; x < targetW; x++) {
              const idx = (y * targetW + x) * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const a = data[idx + 3];

              if (a === 0) continue;

              // Calcolo luminosità percepita
              const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
              const minVal = Math.min(r, g, b);

              // Se il pixel è bianco o carta molto chiara (luminanza >= 215 o tutti i canali >= 210)
              if (luminance >= 220 || minVal >= 215) {
                data[idx + 3] = 0; // Trasparente al 100%
              } else if (luminance >= 165) {
                // Zona di transizione / anti-aliasing sul bordo del tratto
                // Rampa morbida per eliminare aloni bianchi
                const alphaFactor = (220 - luminance) / (220 - 165);
                const newAlpha = Math.round(a * Math.pow(alphaFactor, 1.3));
                data[idx + 3] = newAlpha;

                // Tinge il bordo verso il colore dell'inchiostro scuro per evitare l'alone bianco
                data[idx] = Math.min(r, 20);
                data[idx + 1] = Math.min(g, 30);
                data[idx + 2] = Math.min(b, 50);

                if (newAlpha > 30) {
                  foundInk = true;
                  if (x < minX) minX = x;
                  if (x > maxX) maxX = x;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                }
              } else {
                // Inchiostro vero e proprio: preserva massima opacità e scurisce nitidamente
                data[idx + 3] = 255;
                // Ottimizzazione colore tratto: blu notte / inchiostro scuro uniforme
                data[idx] = Math.min(r, 20);
                data[idx + 1] = Math.min(g, 30);
                data[idx + 2] = Math.min(b, 55);

                foundInk = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);

          // Se abbiamo trovato inchiostro, eseguiamo l'auto-crop con un leggero padding
          if (foundInk && maxX >= minX && maxY >= minY) {
            const padding = 12;
            const cropX = Math.max(0, minX - padding);
            const cropY = Math.max(0, minY - padding);
            const cropW = Math.min(targetW - cropX, (maxX - minX) + padding * 2);
            const cropH = Math.min(targetH - cropY, (maxY - minY) + padding * 2);

            const croppedCanvas = document.createElement('canvas');
            croppedCanvas.width = cropW;
            croppedCanvas.height = cropH;
            const croppedCtx = croppedCanvas.getContext('2d');
            if (croppedCtx) {
              croppedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
              resolve(croppedCanvas.toDataURL('image/png'));
              return;
            }
          }

          // Fallback se crop non eseguibile
          resolve(canvas.toDataURL('image/png'));
        } catch (err: any) {
          reject(new Error(err?.message || 'Errore durante la rimozione dello sfondo.'));
        }
      };
      img.src = src;
    };

    if (typeof fileOrDataUrl === 'string') {
      caricaImmagine(fileOrDataUrl);
    } else {
      const err = validaImmagineFirma(fileOrDataUrl);
      if (err) {
        reject(new Error(err));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Errore durante la lettura del file.'));
      reader.onload = (e) => {
        if (e.target?.result) {
          caricaImmagine(e.target.result as string);
        } else {
          reject(new Error('Impossibile convertire il file.'));
        }
      };
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
};
