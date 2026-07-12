/** Simpler Vollbild-Viewer für Battlemaps (§3.3): öffnen direkt aus Encounter/Kampf. */

import { useAssetUrl } from '../features/canvas/useAssetUrl';

export function BattlemapViewer({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const url = useAssetUrl(assetId);
  return (
    <div className="overlay" onClick={onClose}>
      {url && <img src={url} alt="Battlemap" />}
      <p className="muted">Tippen zum Schließen</p>
    </div>
  );
}
