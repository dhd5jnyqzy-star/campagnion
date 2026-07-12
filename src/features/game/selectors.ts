/**
 * Abgeleitete Sichten auf den GameState — hier entstehen auch die
 * Rückverweise, die nicht kanonisch gespeichert sind (§3.3).
 */

import type { Area, AreaId, GameState, MapImage, Marker } from '../../types';

/** Wurzelbereich ("Übersicht"): erster Bereich ohne Eltern. */
export function selectRootArea(state: GameState): Area | undefined {
  return Object.values(state.areas).find((a) => a.parentId === null);
}

/** Hauptkarte eines Bereichs: niedrigste order. */
export function selectPrimaryMapImage(state: GameState, areaId: AreaId): MapImage | undefined {
  return Object.values(state.mapImages)
    .filter((m) => m.areaId === areaId)
    .sort((a, b) => a.order - b.order)[0];
}

/** Marker auf einer konkreten Karte (mapImageId weggelassen = Hauptkarte des Bereichs). */
export function selectMarkersOnMap(
  state: GameState,
  areaId: AreaId,
  mapImageId: string,
  isPrimary: boolean,
): Marker[] {
  return Object.values(state.markers).filter(
    (m) =>
      m.areaId === areaId &&
      (m.mapImageId === mapImageId || (isPrimary && m.mapImageId === undefined)),
  );
}
