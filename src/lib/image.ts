/**
 * Bild-Import mit automatischem Downscaling (§3.3 Asset, Edge Case 7):
 * Bilder werden beim Import auf eine sinnvolle Maximalgröße skaliert, bevor
 * sie als Blob in IndexedDB landen — Speicher auf dem iPad ist endlich.
 */

const MAX_EDGE = 4096;

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  mimeType: string;
}

/**
 * Liest eine Bilddatei, skaliert bei Bedarf auf MAX_EDGE herunter.
 * Kleine Bilder bleiben byte-identisch erhalten (kein Re-Encode).
 */
export async function prepareImageImport(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = bitmap;
    if (Math.max(width, height) <= MAX_EDGE) {
      return { blob: file, width, height, mimeType: file.type || 'image/png' };
    }

    const scale = MAX_EDGE / Math.max(width, height);
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas-Kontext nicht verfügbar');
    ctx.drawImage(bitmap, 0, 0, w, h);

    // JPEG bleibt JPEG (Fotos), alles andere wird PNG (verlustfrei, Alpha bleibt).
    const mimeType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht kodiert werden'))),
        mimeType,
        0.85,
      );
    });
    return { blob, width: w, height: h, mimeType };
  } finally {
    bitmap.close();
  }
}
