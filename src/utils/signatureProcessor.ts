/**
 * Utility per la rimozione automatica dello sfondo bianco e conversione
 * di scansioni/foto di firme su carta in PNG con trasparenza pura.
 */

export interface ElaborazioneFirmaOpzioni {
  sogliaBianco?: number; // 0 - 255, default 215
  intensitaTratto?: boolean; // Se true, uniforma il tratto a inchiostro scuro/nero profondo
  ritagliaMargini?: boolean; // Se true, ritaglia i bordi trasparenti vuoti
}

export function elaboraImmagineFirmaTrasparente(
  sorgente: File | Blob | string,
  opzioni: ElaborazioneFirmaOpzioni = {}
): Promise<string> {
  const {
    sogliaBianco = 215,
    intensitaTratto = true,
    ritagliaMargini = true
  } = opzioni;

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const origWidth = img.naturalWidth || img.width;
        const origHeight = img.naturalHeight || img.height;

        if (origWidth === 0 || origHeight === 0) {
          reject(new Error('Dimensioni immagine non valide'));
          return;
        }

        // Scala se l'immagine è gigantesca (es. foto 4K da smartphone 4000x3000)
        // per velocizzare l'elaborazione e contenere il payload base64 nel database/PDF
        const maxDim = 1200;
        let scale = 1;
        if (origWidth > maxDim || origHeight > maxDim) {
          scale = maxDim / Math.max(origWidth, origHeight);
        }

        const width = Math.round(origWidth * scale);
        const height = Math.round(origHeight * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (!ctx) {
          reject(new Error('Impossibile inizializzare il contesto Canvas 2D'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Trova il bounding box del tratto d'inchiostro per il ritaglio finale
        let minX = width;
        let minY = height;
        let maxX = 0;
        let maxY = 0;
        let pixelInchiostroTrovati = 0;

        const deltaSfumatura = 80;
        const sogliaBassa = Math.max(0, sogliaBianco - deltaSfumatura);

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          // Se il pixel è già completamente trasparente (es. PNG trasparente), prosegui
          if (a === 0) continue;

          // Luminanza percepita (formula standard ITU-R BT.601)
          const luminanza = 0.299 * r + 0.587 * g + 0.114 * b;
          // Media canali
          const mediaRGB = (r + g + b) / 3;
          // Prendi il valore massimo tra luminanza e mediaRGB per catturare sfondi chiari
          const chiarezza = Math.max(luminanza, mediaRGB);

          if (chiarezza >= sogliaBianco) {
            // Sfondo bianco o quasi bianco -> trasparenza pura (alpha = 0)
            data[i + 3] = 0;
          } else if (chiarezza <= sogliaBassa) {
            // Inchiostro scuro pieno -> opacità massima (alpha = 255)
            data[i + 3] = 255;
            if (intensitaTratto) {
              // Rendi il tratto nero inchiostro nitido preservando eventuali tonalità blu scuro
              const isBlu = b > r + 20 && b > g + 10;
              if (isBlu) {
                data[i] = Math.min(r, 20);
                data[i + 1] = Math.min(g, 35);
                data[i + 2] = Math.min(b, 100);
              } else {
                data[i] = Math.min(r, 25);
                data[i + 1] = Math.min(g, 25);
                data[i + 2] = Math.min(b, 30);
              }
            }

            // Calcola coordinate per bounding box
            const pixelIdx = i / 4;
            const px = pixelIdx % width;
            const py = Math.floor(pixelIdx / width);
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
            pixelInchiostroTrovati++;
          } else {
            // Sfumatura antialiasing sul bordo della firma per evitare aloni bianchi scalettati
            const fattore = (sogliaBianco - chiarezza) / deltaSfumatura; // da 0 a 1
            const nuovoAlpha = Math.round(fattore * 255);
            data[i + 3] = Math.min(a, nuovoAlpha);

            if (intensitaTratto) {
              const isBlu = b > r + 20 && b > g + 10;
              if (isBlu) {
                data[i] = Math.min(r, 20);
                data[i + 1] = Math.min(g, 35);
                data[i + 2] = Math.min(b, 100);
              } else {
                data[i] = Math.min(r, 25);
                data[i + 1] = Math.min(g, 25);
                data[i + 2] = Math.min(b, 30);
              }
            }

            if (nuovoAlpha > 30) {
              const pixelIdx = i / 4;
              const px = pixelIdx % width;
              const py = Math.floor(pixelIdx / width);
              if (px < minX) minX = px;
              if (px > maxX) maxX = px;
              if (py < minY) minY = py;
              if (py > maxY) maxY = py;
              pixelInchiostroTrovati++;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // Se è richiesto il ritaglio e abbiamo trovato del tratto utile
        if (ritagliaMargini && pixelInchiostroTrovati > 10 && maxX > minX && maxY > minY) {
          const padding = 16;
          const cropX = Math.max(0, minX - padding);
          const cropY = Math.max(0, minY - padding);
          const cropW = Math.min(width - cropX, maxX - minX + padding * 2);
          const cropH = Math.min(height - cropY, maxY - minY + padding * 2);

          const croppedCanvas = document.createElement('canvas');
          croppedCanvas.width = cropW;
          croppedCanvas.height = cropH;
          const croppedCtx = croppedCanvas.getContext('2d');
          if (croppedCtx) {
            croppedCtx.drawImage(
              canvas,
              cropX, cropY, cropW, cropH,
              0, 0, cropW, cropH
            );
            resolve(croppedCanvas.toDataURL('image/png'));
            return;
          }
        }

        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      reject(new Error("Errore nel caricamento dell'immagine selezionata"));
    };

    if (typeof sorgente === 'string') {
      img.src = sorgente;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        } else {
          reject(new Error('Impossibile leggere il file immagine'));
        }
      };
      reader.onerror = () => reject(new Error('Errore durante la lettura del file'));
      reader.readAsDataURL(sorgente);
    }
  });
}
