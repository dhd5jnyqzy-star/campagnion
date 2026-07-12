/**
 * Teilimport/-export (§5): ContentPackages sind additive Pakete — auch das
 * Lieferformat der KI-gestützten Vorbereitung. Dieser Kern ist pur:
 *
 * - findPackageConflicts: ID-Kollisionen mit der Ziel-Kampagne finden
 *   (→ Konfliktdialog, nie stumm überschreiben)
 * - planPackageImport: Paket + Konflikt-Entscheidungen → Event-Batch.
 *   Grid-Positionen ("F7") werden über das Raster der Zielkarte in
 *   normalisierte Koordinaten umgerechnet (§4.1/§5).
 * - buildContentPackage: Teilexport der ausgewählten Entitäten, ortsbezogene
 *   Referenzen werden entfernt, damit das Paket kampagnenübergreifend trägt.
 */

import type {
  ContentPackage,
  GameState,
  ImportConflict,
  MapPosition,
  Marker,
  NormalizedPosition,
} from '../../types';
import type { NewGameEvent } from '../game/thunks';
import { EXCHANGE_FORMAT_VERSION } from '../../types';
import { gridRefToNormalized } from '../../lib/grid';
import { newId } from '../../lib/ids';
import { selectPrimaryMapImage } from '../game/selectors';

export type ConflictResolution = 'skip' | 'importAsNew';

// ---------------------------------------------------------------------------
// Konflikte
// ---------------------------------------------------------------------------

export function findPackageConflicts(state: GameState, pkg: ContentPackage): ImportConflict[] {
  const conflicts: ImportConflict[] = [];
  const check = (
    kind: ImportConflict['entityKind'],
    items: { id: string }[] | undefined,
    existingName: (id: string) => string | undefined,
    incomingName: (item: never) => string,
  ) => {
    for (const item of items ?? []) {
      const existing = existingName(item.id);
      if (existing !== undefined) {
        conflicts.push({
          id: item.id,
          entityKind: kind,
          existingName: existing,
          incomingName: incomingName(item as never),
        });
      }
    }
  };
  check('area', pkg.areas, (id) => state.areas[id]?.name, (a: { name: string }) => a.name);
  check('marker', pkg.markers, (id) => state.markers[id]?.name ?? (state.markers[id] ? 'Marker' : undefined), (m: { name?: string }) => m.name ?? 'Marker');
  check('encounter', pkg.encounters, (id) => state.encounters[id]?.name, (e: { name: string }) => e.name);
  check('npc', pkg.npcs, (id) => state.npcs[id]?.name, (n: { name: string }) => n.name);
  check('quest', pkg.quests, (id) => state.quests[id]?.name, (q: { name: string }) => q.name);
  check(
    'handout',
    pkg.handouts,
    (id) => state.handouts[id]?.title,
    (h: { title: string }) => h.title,
  );
  check('deck', pkg.decks, (id) => state.decks[id]?.name, (d: { name: string }) => d.name);
  check(
    'asset',
    (pkg.assets ?? []).map((a) => ({ id: a.asset.id })),
    (id) => state.assets[id]?.fileName,
    () => 'Asset',
  );
  return conflicts;
}

// ---------------------------------------------------------------------------
// Import-Plan
// ---------------------------------------------------------------------------

export interface ImportPlan {
  /** Events in Anwendungsreihenfolge (ohne importId — setzt der Thunk). */
  events: NewGameEvent[];
  /** AssetId (nach Remap) → ursprüngliche AssetId im Paket (für Blob-Zuordnung). */
  assetIdMap: Map<string, string>;
  summary: string;
  skippedIds: string[];
}

/**
 * Paket in einen Event-Batch übersetzen. resolutions entscheidet pro
 * kollidierender ID: 'skip' = vorhandene Entität weiterverwenden (Referenzen
 * zeigen dann auf sie), 'importAsNew' = frische UUID, paketinterne Referenzen
 * werden mit umgeschrieben.
 */
export function planPackageImport(
  state: GameState,
  pkg: ContentPackage,
  resolutions: Record<string, ConflictResolution>,
): ImportPlan {
  const skipped = new Set<string>();
  const renamed = new Map<string, string>();
  for (const [id, resolution] of Object.entries(resolutions)) {
    if (resolution === 'skip') skipped.add(id);
    else renamed.set(id, newId());
  }
  const mapId = (id: string): string => renamed.get(id) ?? id;
  const mapIds = (ids: string[] | undefined): string[] => (ids ?? []).map(mapId);

  const events: NewGameEvent[] = [];
  const counts: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);

  // Paketinterne Bereiche (für die Positionsauflösung unten).
  const packageAreaIds = new Set((pkg.areas ?? []).map((a) => mapId(a.id)));

  const resolvePosition = (
    areaId: string,
    mapImageId: string | undefined,
    position: MapPosition,
    what: string,
  ): NormalizedPosition => {
    if (position.kind === 'normalized') return { x: position.x, y: position.y };
    const map = mapImageId
      ? state.mapImages[mapImageId]
      : state.areas[areaId]
        ? selectPrimaryMapImage(state, areaId)
        : undefined;
    if (!map?.grid) {
      throw new Error(
        packageAreaIds.has(areaId)
          ? `${what}: Grid-Position auf einem paketinternen Bereich ohne Karte — bitte normalisierte Koordinaten verwenden`
          : `${what}: Zielkarte hat kein Raster für Grid-Position ${position.column}${position.row}`,
      );
    }
    return gridRefToNormalized(position, map.grid);
  };

  // Reihenfolge: Assets → Bereiche → NSCs → Encounter → Quests → Marker.
  // Spätere referenzieren frühere; der Replay ist ohnehin tolerant.
  for (const entry of pkg.assets ?? []) {
    if (skipped.has(entry.asset.id)) continue;
    const id = mapId(entry.asset.id);
    events.push({ type: 'asset.imported', payload: { asset: { ...entry.asset, id } } });
    bump('Assets');
  }
  for (const area of pkg.areas ?? []) {
    if (skipped.has(area.id)) continue;
    events.push({
      type: 'area.created',
      payload: {
        area: { ...area, id: mapId(area.id), parentId: area.parentId ? mapId(area.parentId) : null },
      },
    });
    bump('Bereiche');
  }
  for (const npc of pkg.npcs ?? []) {
    if (skipped.has(npc.id)) continue;
    events.push({
      type: 'npc.created',
      payload: {
        npc: {
          ...npc,
          id: mapId(npc.id),
          homeAreaId: npc.homeAreaId ? mapId(npc.homeAreaId) : undefined,
          homeMarkerId: npc.homeMarkerId ? mapId(npc.homeMarkerId) : undefined,
          comments: npc.comments ?? [],
        },
      },
    });
    bump('NSCs');
  }
  for (const packaged of pkg.encounters ?? []) {
    if (skipped.has(packaged.id)) continue;
    const { placement, ...rest } = packaged;
    const encounterId = mapId(packaged.id);
    events.push({
      type: 'encounter.created',
      payload: {
        encounter: {
          ...rest,
          id: encounterId,
          battlemapAssetIds: mapIds(packaged.battlemapAssetIds),
          enemies: (packaged.enemies ?? []).map((enemy) => ({ ...enemy, id: mapId(enemy.id) })),
          state: 'prepared',
        },
      },
    });
    bump('Encounter');
    if (placement) {
      const areaId = mapId(placement.areaId);
      const mapImageId = placement.mapImageId ? mapId(placement.mapImageId) : undefined;
      const marker: Marker = {
        id: newId(),
        areaId,
        mapImageId,
        position: resolvePosition(areaId, mapImageId, placement.position, packaged.name),
        type: 'encounter',
        name: packaged.name,
        encounterIds: [encounterId],
        npcIds: [],
        questIds: [],
      };
      events.push({ type: 'marker.created', payload: { marker } });
      events.push({ type: 'encounter.placed', payload: { encounterId, markerId: marker.id } });
    }
  }
  for (const quest of pkg.quests ?? []) {
    if (skipped.has(quest.id)) continue;
    events.push({
      type: 'quest.created',
      payload: {
        quest: {
          ...quest,
          id: mapId(quest.id),
          comments: quest.comments ?? [],
          npcIds: mapIds(quest.npcIds),
          areaIds: mapIds(quest.areaIds),
          encounterIds: mapIds(quest.encounterIds),
        },
      },
    });
    bump('Quests');
  }
  for (const handout of pkg.handouts ?? []) {
    if (skipped.has(handout.id)) continue;
    // Ortsbezug nur übernehmen, wenn der Zielbereich existiert — sonst Bibliothek.
    const areaKnown = handout.areaId && state.areas[mapId(handout.areaId)];
    events.push({
      type: 'handout.created',
      payload: {
        handout: {
          ...handout,
          id: mapId(handout.id),
          areaId: areaKnown ? mapId(handout.areaId!) : undefined,
          mapImageId: areaKnown && handout.mapImageId ? mapId(handout.mapImageId) : undefined,
          position: areaKnown ? handout.position : undefined,
        },
      },
    });
    bump('Handouts');
  }
  for (const deck of pkg.decks ?? []) {
    if (skipped.has(deck.id)) continue;
    const areaKnown = deck.areaId && state.areas[mapId(deck.areaId)];
    events.push({
      type: 'deck.created',
      payload: {
        deck: {
          ...deck,
          id: mapId(deck.id),
          cards: deck.cards.map((card) => ({ ...card, id: mapId(card.id) })),
          areaId: areaKnown ? mapId(deck.areaId!) : undefined,
          mapImageId: areaKnown && deck.mapImageId ? mapId(deck.mapImageId) : undefined,
          position: areaKnown ? deck.position : undefined,
          lastDrawnCardId: undefined,
        },
      },
    });
    bump('Decks');
  }
  for (const packaged of pkg.markers ?? []) {
    if (skipped.has(packaged.id)) continue;
    const areaId = mapId(packaged.areaId);
    const mapImageId = packaged.mapImageId ? mapId(packaged.mapImageId) : undefined;
    events.push({
      type: 'marker.created',
      payload: {
        marker: {
          ...packaged,
          id: mapId(packaged.id),
          areaId,
          mapImageId,
          position: resolvePosition(
            areaId,
            mapImageId,
            packaged.position,
            packaged.name ?? 'Marker',
          ),
          encounterIds: mapIds(packaged.encounterIds),
          npcIds: mapIds(packaged.npcIds),
          questIds: mapIds(packaged.questIds),
        },
      },
    });
    bump('Marker');
  }

  const assetIdMap = new Map<string, string>();
  for (const entry of pkg.assets ?? []) {
    if (!skipped.has(entry.asset.id)) assetIdMap.set(mapId(entry.asset.id), entry.asset.id);
  }

  const summary =
    Object.entries(counts)
      .map(([k, n]) => `${n} ${k}`)
      .join(', ') || 'leer';
  return { events, assetIdMap, summary, skippedIds: [...skipped] };
}

// ---------------------------------------------------------------------------
// Teilexport
// ---------------------------------------------------------------------------

export interface PackageSelection {
  npcIds: string[];
  questIds: string[];
  encounterIds: string[];
}

/**
 * Teilexport (§5): ausgewählte NSCs/Quests/Encounter als portables Paket.
 * Ortsbezüge (Bereiche, Marker, Battlemaps) werden entfernt — Encounter
 * kommen drüben im Random-Pool an; Verknüpfungen untereinander bleiben,
 * sofern beide Seiten mit exportiert werden. Gegner-Slots werden auf
 * volle HP zurückgesetzt (Pakete liefern Vorbereitung, keine Historie).
 */
export function buildContentPackage(
  state: GameState,
  name: string,
  selection: PackageSelection,
): ContentPackage {
  const npcSet = new Set(selection.npcIds);
  const encounterSet = new Set(selection.encounterIds);
  return {
    formatVersion: EXCHANGE_FORMAT_VERSION,
    name,
    npcs: selection.npcIds
      .map((id) => state.npcs[id])
      .filter(Boolean)
      .map((npc) => ({ ...npc, homeAreaId: undefined, homeMarkerId: undefined })),
    quests: selection.questIds
      .map((id) => state.quests[id])
      .filter(Boolean)
      .map((quest) => ({
        ...quest,
        npcIds: quest.npcIds.filter((id) => npcSet.has(id)),
        encounterIds: quest.encounterIds.filter((id) => encounterSet.has(id)),
        areaIds: [],
      })),
    encounters: selection.encounterIds
      .map((id) => state.encounters[id])
      .filter(Boolean)
      .map(({ state: _state, combat: _combat, markerId: _markerId, ...encounter }) => ({
        ...encounter,
        battlemapAssetIds: [],
        enemies: encounter.enemies.map((enemy) => ({
          ...enemy,
          slots: enemy.slots.map(() => ({
            hp: enemy.maxHp,
            statusEffects: [],
            defeated: false,
          })),
        })),
      })),
  };
}
