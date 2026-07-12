/**
 * Grobe Persistenz des Navigations-Zustands (§3.2): der letzte Viewport pro
 * Kampagne UND Bereich, damit ein Neustart bzw. eine Rückkehr in einen Bereich
 * im vertrauten Ausschnitt landet. localStorage reicht dafür — das ist bewusst
 * kein Teil des Event-Logs.
 */

import type { Viewport } from '../features/nav/navSlice';

const key = (campaignId: string, areaId: string | null) =>
  `campagnion-viewport-${campaignId}-${areaId ?? 'root'}`;

export function saveViewport(campaignId: string, areaId: string | null, viewport: Viewport): void {
  try {
    localStorage.setItem(key(campaignId, areaId), JSON.stringify(viewport));
  } catch {
    // Quota/Privatmodus: Restore ist nice-to-have, kein Datenverlust.
  }
}

export function loadViewport(campaignId: string, areaId: string | null): Viewport | null {
  try {
    const raw = localStorage.getItem(key(campaignId, areaId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Viewport;
    if ([v.cx, v.cy, v.zoom].every((n) => typeof n === 'number' && Number.isFinite(n))) {
      return v;
    }
    return null;
  } catch {
    return null;
  }
}
