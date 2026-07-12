/**
 * Tests für Import/Export (§5): Vollexport-Roundtrip (ZIP), Konflikt-Erkennung
 * und die Übersetzung eines ContentPackage in einen Event-Batch inkl.
 * Grid→normalisiert-Umrechnung und ID-Remapping.
 */

import { describe, expect, it } from 'vitest';
import type { ContentPackage, GameEvent, GameState } from '../../types';
import { replay } from '../game/replay';
import { buildCampaignExport, parseCampaignZip } from './campaignZip';
import { buildContentPackage, findPackageConflicts, planPackageImport } from './packageCore';
import { zip, strToU8 } from 'fflate';

let counter = 0;
function ev<T extends GameEvent['type']>(
  type: T,
  payload: Extract<GameEvent, { type: T }>['payload'],
): GameEvent {
  return {
    id: `e${++counter}`,
    campaignId: 'c1',
    type,
    payload,
    realTime: '2026-07-12T12:00:00.000Z',
    gameTime: { day: 1, timeOfDay: 'morning' },
    sessionId: null,
  } as GameEvent;
}

function baseState(): { state: GameState; events: GameEvent[] } {
  const events = [
    ev('campaign.created', { name: 'Blauwasser' }),
    ev('area.created', {
      area: {
        id: 'root',
        name: 'Übersicht',
        parentId: null,
        zoomThreshold: 0,
        badge: { showQuestMarkers: false, showEncounterCount: false, showText: false },
      },
    }),
    ev('asset.imported', {
      asset: {
        id: 'as1',
        kind: 'mapImage',
        fileName: 'karte.png',
        mimeType: 'image/png',
        byteSize: 3,
        width: 100,
        height: 50,
      },
    }),
    ev('mapImage.added', {
      mapImage: { id: 'map1', areaId: 'root', assetId: 'as1', order: 0, grid: { columns: 10, rows: 5 } },
    }),
    ev('npc.created', { npc: { id: 'npc1', name: 'Grubb', comments: [] } }),
  ];
  const state = replay(events);
  if (!state) throw new Error('State fehlt');
  return { state, events };
}

describe('Vollexport (ZIP)', () => {
  it('überlebt den Roundtrip aus Bauen und Parsen', async () => {
    const { state, events } = baseState();
    const exportData = buildCampaignExport(state, events);
    expect(exportData.assets).toHaveLength(1);
    expect(exportData.assets[0].path).toBe('assets/as1.png');

    const files: Record<string, Uint8Array> = {
      'campaign.json': strToU8(JSON.stringify(exportData)),
      'assets/as1.png': new Uint8Array([1, 2, 3]),
    };
    const zipped = await new Promise<Uint8Array>((res, rej) =>
      zip(files, (err, data) => (err ? rej(err) : res(data))),
    );
    const parsed = await parseCampaignZip(new Blob([zipped as Uint8Array<ArrayBuffer>]));
    expect(parsed.export.campaignName).toBe('Blauwasser');
    expect(parsed.export.events).toHaveLength(events.length);
    expect(parsed.blobs.get('as1')?.size).toBe(3);
    // Replay des importierten Logs ergibt denselben Zustand
    expect(replay(parsed.export.events)).toEqual(state);
  });
});

describe('Teilimport', () => {
  const pkg: ContentPackage = {
    formatVersion: 1,
    name: 'Nordstadt',
    npcs: [{ id: 'npc1', name: 'Grubb (neu)', comments: [] }], // Kollision!
    quests: [
      {
        id: 'q1',
        name: 'Schmuggler',
        status: 'open',
        comments: [],
        npcIds: ['npc1'],
        areaIds: [],
        encounterIds: ['enc1'],
      },
    ],
    encounters: [
      {
        id: 'enc1',
        name: 'Hinterhalt',
        description: '',
        battlemapAssetIds: [],
        enemies: [],
        placement: {
          areaId: 'root',
          position: { kind: 'grid', column: 'F', row: 3 },
        },
      },
    ],
  };

  it('erkennt ID-Kollisionen', () => {
    const { state } = baseState();
    const conflicts = findPackageConflicts(state, pkg);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ id: 'npc1', entityKind: 'npc', existingName: 'Grubb' });
  });

  it('übersetzt das Paket in Events: Grid→normalisiert, Remap, Platzierung', () => {
    const { state } = baseState();
    const plan = planPackageImport(state, pkg, { npc1: 'importAsNew' });

    const types = plan.events.map((e) => e.type);
    expect(types).toEqual([
      'npc.created',
      'encounter.created',
      'marker.created',
      'encounter.placed',
      'quest.created',
    ]);

    // Remap: neuer NSC bekommt frische ID, die Quest referenziert sie
    const npcEvent = plan.events[0] as Extract<typeof plan.events[0], { type: 'npc.created' }>;
    expect(npcEvent.payload.npc.id).not.toBe('npc1');
    const questEvent = plan.events[4] as Extract<typeof plan.events[0], { type: 'quest.created' }>;
    expect(questEvent.payload.quest.npcIds).toEqual([npcEvent.payload.npc.id]);

    // Grid F3 auf 10×5-Raster → Zellmitte (0.55, 0.5)
    const markerEvent = plan.events[2] as Extract<typeof plan.events[0], { type: 'marker.created' }>;
    expect(markerEvent.payload.marker.position).toEqual({ x: 0.55, y: 0.5 });

    // Angewendet: Events zu vollen GameEvents aufblasen und replayen
    const fullEvents = plan.events.map((input) => ({
      ...input,
      id: `x${++counter}`,
      campaignId: 'c1',
      realTime: '2026-07-12T13:00:00.000Z',
      gameTime: { day: 1, timeOfDay: 'morning' as const },
      sessionId: null,
    })) as GameEvent[];
    const applied = replay([...baseState().events, ...fullEvents]);
    const enc = applied?.encounters['enc1'];
    expect(enc?.state).toBe('prepared');
    expect(enc?.markerId).toBe(markerEvent.payload.marker.id);
  });

  it('skip lässt Referenzen auf die vorhandene Entität zeigen', () => {
    const { state } = baseState();
    const plan = planPackageImport(state, pkg, { npc1: 'skip' });
    const types = plan.events.map((e) => e.type);
    expect(types).not.toContain('npc.created');
    const questEvent = plan.events.find((e) => e.type === 'quest.created') as Extract<
      (typeof plan.events)[0],
      { type: 'quest.created' }
    >;
    expect(questEvent.payload.quest.npcIds).toEqual(['npc1']);
  });
});

describe('Teilexport', () => {
  it('baut ein portables Paket ohne Ortsbezüge', () => {
    const events = [
      ...baseState().events,
      ev('encounter.created', {
        encounter: {
          id: 'enc1',
          name: 'Piraten',
          description: 'Atmo',
          battlemapAssetIds: ['as1'],
          enemies: [
            {
              id: 'en1',
              name: 'Pirat',
              count: 2,
              maxHp: 10,
              sharedInitiative: true,
              slots: [
                { hp: 3, statusEffects: ['prone'], defeated: false },
                { hp: 0, statusEffects: [], defeated: true },
              ],
            },
          ],
          state: 'active',
          markerId: 'm1',
        },
      }),
      ev('quest.created', {
        quest: {
          id: 'q1',
          name: 'Quest',
          status: 'open',
          comments: [],
          npcIds: ['npc1', 'npc-fremd'],
          areaIds: ['root'],
          encounterIds: ['enc1'],
        },
      }),
    ];
    const state = replay(events);
    if (!state) throw new Error('State fehlt');
    const pkg = buildContentPackage(state, 'Test', {
      npcIds: ['npc1'],
      questIds: ['q1'],
      encounterIds: ['enc1'],
    });
    // Encounter: frisch, ohne Ort/Battlemaps, Slots zurückgesetzt
    expect(pkg.encounters?.[0]).not.toHaveProperty('markerId');
    expect(pkg.encounters?.[0].battlemapAssetIds).toEqual([]);
    expect(pkg.encounters?.[0].enemies[0].slots).toEqual([
      { hp: 10, statusEffects: [], defeated: false },
      { hp: 10, statusEffects: [], defeated: false },
    ]);
    // Quest: nur mit-exportierte Referenzen bleiben
    expect(pkg.quests?.[0].npcIds).toEqual(['npc1']);
    expect(pkg.quests?.[0].areaIds).toEqual([]);
  });
});
