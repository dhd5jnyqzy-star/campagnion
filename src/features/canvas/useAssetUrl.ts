/**
 * Blob-URL für ein Asset aus der Kampagnen-DB. Lädt den Blob, erzeugt eine
 * Object-URL und räumt sie beim Unmount/Wechsel wieder ab.
 */

import { useEffect, useState } from 'react';
import type { AssetId } from '../../types';
import { getCurrentStore } from '../../persistence/db';

export function useAssetUrl(assetId: AssetId | undefined): string | undefined {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!assetId) {
      setUrl(undefined);
      return;
    }
    let objectUrl: string | undefined;
    let cancelled = false;
    void getCurrentStore()
      .getAsset(assetId)
      .then((blob) => {
        if (cancelled || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(undefined);
    };
  }, [assetId]);

  return url;
}
