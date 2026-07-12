/**
 * Abgeleitete Sichten auf den GameState — hier entstehen auch die
 * Rückverweise, die nicht kanonisch gespeichert sind (§3.3): kanonisch sind
 * Marker.encounterIds/npcIds/questIds sowie Quest.npcIds/areaIds/encounterIds;
 * alles andere wird hier rückwärts eingesammelt.
 */

import type {
  Area,
  AreaId,
  Encounter,
  EncounterId,
  GameState,
  MapImage,
  Marker,
  NpcId,
  Quest,
  QuestId,
} from '../../types';

// ---------------------------------------------------------------------------
// Areas & Karten
// ---------------------------------------------------------------------------

/** Wurzelbereich ("Übersicht"): erster Bereich ohne Eltern. */
export function selectRootArea(state: GameState): Area | undefined {
  return Object.values(state.areas).find((a) => a.parentId === null);
}

/** Aktueller Bereich fürs Canvas: expliziter Bereich oder Wurzel. */
export function selectCurrentArea(state: GameState, currentAreaId: string | null): Area | undefined {
  if (currentAreaId) return state.areas[currentAreaId] ?? selectRootArea(state);
  return selectRootArea(state);
}

/** Hauptkarte eines Bereichs: niedrigste order. */
export function selectPrimaryMapImage(state: GameState, areaId: AreaId): MapImage | undefined {
  return Object.values(state.mapImages)
    .filter((m) => m.areaId === areaId)
    .sort((a, b) => a.order - b.order)[0];
}

/** Direkte Kind-Bereiche mit Zone auf der Karte des Elternbereichs. */
export function selectChildAreas(state: GameState, areaId: AreaId): Area[] {
  return Object.values(state.areas).filter((a) => a.parentId === areaId);
}

/** Alle Bereichs-IDs des Teilbaums (inkl. Wurzel des Teilbaums). */
export function selectAreaSubtreeIds(state: GameState, areaId: AreaId): Set<AreaId> {
  const ids = new Set<AreaId>();
  const walk = (id: AreaId) => {
    if (ids.has(id)) return; // Schutz vor zyklischen parentIds aus defekten Daten
    ids.add(id);
    for (const child of Object.values(state.areas)) {
      if (child.parentId === id) walk(child.id);
    }
  };
  walk(areaId);
  return ids;
}

export interface AreaStats {
  /** Nicht abgeschlossene Encounter mit Marker im Teilbaum. */
  encounterCount: number;
  /** Offene/aktive Quests, die mit dem Teilbaum verknüpft sind. */
  openQuestCount: number;
}

/**
 * Badge-Zahlen (§3.3 Area): Infos aus dem gesamten Teilbaum werden nach oben
 * durchgereicht; welche davon angezeigt werden, steuert BadgeConfig.
 */
export function selectAreaStats(state: GameState, areaId: AreaId): AreaStats {
  const subtree = selectAreaSubtreeIds(state, areaId);
  const markersInSubtree = Object.values(state.markers).filter((m) => subtree.has(m.areaId));

  const encounterIds = new Set<EncounterId>();
  for (const m of markersInSubtree) for (const id of m.encounterIds) encounterIds.add(id);
  for (const e of Object.values(state.encounters)) {
    if (e.markerId && state.markers[e.markerId] && subtree.has(state.markers[e.markerId].areaId)) {
      encounterIds.add(e.id);
    }
  }
  const encounterCount = [...encounterIds].filter(
    (id) => state.encounters[id] && state.encounters[id].state !== 'completed',
  ).length;

  const questIds = new Set<QuestId>();
  for (const q of Object.values(state.quests)) {
    if (q.areaIds.some((id) => subtree.has(id))) questIds.add(q.id);
  }
  for (const m of markersInSubtree) for (const id of m.questIds) questIds.add(id);
  const openQuestCount = [...questIds].filter(
    (id) => state.quests[id] && state.quests[id].status !== 'completed',
  ).length;

  return { encounterCount, openQuestCount };
}

// ---------------------------------------------------------------------------
// Marker
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Random-Pool & Rückverweise (§3.3)
// ---------------------------------------------------------------------------

/** Random-Pool (§3.3 Encounter): ohne Ort, wartet aufs Einspeisen. */
export function selectPoolEncounters(state: GameState): Encounter[] {
  return Object.values(state.encounters).filter((e) => !e.markerId && e.state !== 'completed');
}

export function selectMarkersForEncounter(state: GameState, encounterId: EncounterId): Marker[] {
  return Object.values(state.markers).filter((m) => m.encounterIds.includes(encounterId));
}

export function selectMarkersForNpc(state: GameState, npcId: NpcId): Marker[] {
  return Object.values(state.markers).filter((m) => m.npcIds.includes(npcId));
}

export function selectMarkersForQuest(state: GameState, questId: QuestId): Marker[] {
  return Object.values(state.markers).filter((m) => m.questIds.includes(questId));
}

export function selectQuestsForNpc(state: GameState, npcId: NpcId): Quest[] {
  return Object.values(state.quests).filter((q) => q.npcIds.includes(npcId));
}

export function selectQuestsForEncounter(state: GameState, encounterId: EncounterId): Quest[] {
  return Object.values(state.quests).filter((q) => q.encounterIds.includes(encounterId));
}

export function selectQuestsForArea(state: GameState, areaId: AreaId): Quest[] {
  return Object.values(state.quests).filter((q) => q.areaIds.includes(areaId));
}

/** Gruppen, in denen ein Charakter aktuell Mitglied ist. */
export function selectGroupsForCharacter(state: GameState, characterId: string) {
  return Object.values(state.groups).filter((g) => g.memberIds.includes(characterId));
}
