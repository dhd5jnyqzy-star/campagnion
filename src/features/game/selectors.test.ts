/**
 * Tests für Teilbaum-Statistiken (Badges, §3.3) und Rückverweise (§3.3 NPC).
 */

import { describe, expect, it } from 'vitest';
import type { GameState } from '../../types';
import { replay } from './replay';
import {
  selectAreaStats,
  selectAreaSubtreeIds,
  selectMarkersForNpc,
  selectPoolEncounters,
  selectQuestsForNpc,
} from './selectors';
import type { GameEvent } from '../../types';

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

const baseArea = {
  parentId: null,
  zoomThreshold: 0,
  badge: { showQuestMarkers: true, showEncounterCount: true, showText: false },
};

function buildState(): GameState {
  const state = replay([
    ev('campaign.created', { name: 'Test' }),
    ev('area.created', { area: { ...baseArea, id: 'root', name: 'Übersicht' } }),
    ev('area.created', { area: { ...baseArea, id: 'bucht', name: 'Bucht', parentId: 'root' } }),
    ev('area.created', { area: { ...baseArea, id: 'hafen', name: 'Hafen', parentId: 'bucht' } }),
    ev('marker.created', {
      marker: {
        id: 'm1',
        areaId: 'hafen',
        position: { x: 0.5, y: 0.5 },
        type: 'encounter',
        encounterIds: ['enc1'],
        npcIds: ['npc1'],
        questIds: [],
      },
    }),
    ev('encounter.created', {
      encounter: {
        id: 'enc1',
        name: 'Piraten',
        description: '',
        battlemapAssetIds: [],
        enemies: [],
        state: 'prepared',
        markerId: 'm1',
      },
    }),
    ev('encounter.created', {
      encounter: {
        id: 'enc2',
        name: 'Poolgegner',
        description: '',
        battlemapAssetIds: [],
        enemies: [],
        state: 'prepared',
      },
    }),
    ev('quest.created', {
      quest: {
        id: 'q1',
        name: 'Schmuggler',
        status: 'active',
        comments: [],
        npcIds: ['npc1'],
        areaIds: ['bucht'],
        encounterIds: [],
      },
    }),
    ev('quest.created', {
      quest: {
        id: 'q2',
        name: 'Erledigt',
        status: 'completed',
        comments: [],
        npcIds: [],
        areaIds: ['bucht'],
        encounterIds: [],
      },
    }),
    ev('npc.created', { npc: { id: 'npc1', name: 'Harbormaster', comments: [] } }),
  ]);
  if (!state) throw new Error('State fehlt');
  return state;
}

describe('selectors', () => {
  it('sammelt den Bereichs-Teilbaum ein', () => {
    const state = buildState();
    expect([...selectAreaSubtreeIds(state, 'root')].sort()).toEqual(['bucht', 'hafen', 'root']);
    expect([...selectAreaSubtreeIds(state, 'bucht')].sort()).toEqual(['bucht', 'hafen']);
  });

  it('reicht Badge-Zahlen aus dem Teilbaum nach oben durch (§3.3)', () => {
    const state = buildState();
    // Encounter am Hafen-Marker zählt in Bucht und Root; abgeschlossene Quests nicht.
    expect(selectAreaStats(state, 'bucht')).toEqual({ encounterCount: 1, openQuestCount: 1 });
    expect(selectAreaStats(state, 'root')).toEqual({ encounterCount: 1, openQuestCount: 1 });
    expect(selectAreaStats(state, 'hafen')).toEqual({ encounterCount: 1, openQuestCount: 0 });
  });

  it('kennt den Random-Pool und Rückverweise', () => {
    const state = buildState();
    expect(selectPoolEncounters(state).map((e) => e.id)).toEqual(['enc2']);
    expect(selectMarkersForNpc(state, 'npc1').map((m) => m.id)).toEqual(['m1']);
    expect(selectQuestsForNpc(state, 'npc1').map((q) => q.id)).toEqual(['q1']);
  });
});
