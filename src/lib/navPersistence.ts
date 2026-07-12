/**
 * Grobe Persistenz des Navigations-Zustands (§3.2): nur der letzte Viewport
 * pro Kampagne, damit ein Neustart im richtigen Kartenausschnitt landet.
 * localStorage reicht dafür — das ist bewusst kein Teil des Event-Logs.
 */

import type { Viewport } from '../features/nav/navSlice';

const key = (campaignId: string) => `campagnion-viewport-${campaignId}`;

export function saveViewport(campaignId: string, viewport: Viewport): void {
  try {
    localStorage.setItem(key(campaignId), JSON.stringify(viewport));
  } catch {
    // Quota/Privatmodus: Restore ist nice-to-have, kein Datenverlust.
  }
}

export function loadViewport(campaignId: string): Viewport | null {
  try {
    const raw = localStorage.getItem(key(campaignId));
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
