import { describe, expect, it } from 'vitest';
import type { Combatant, Encounter, GameState } from '../../types';
import {
  buildInitialCombatants,
  isCombatantDefeated,
  nextTurn,
  sortForInitiative,
} from './combatLogic';

function enc(partial?: Partial<Encounter>): Encounter {
  return {
    id: 'enc1',
    name: 'Test',
    description: '',
    battlemapAssetIds: [],
    enemies: [
      {
        id: 'en1',
        name: 'Pirat',
        count: 2,
        maxHp: 10,
        sharedInitiative: true,
        slots: [
          { hp: 10, statusEffects: [], defeated: false },
          { hp: 10, statusEffects: [], defeated: false },
        ],
      },
      {
        id: 'en2',
        name: 'Käpt’n',
        count: 1,
        maxHp: 20,
        sharedInitiative: false,
        slots: [{ hp: 20, statusEffects: [], defeated: false }],
      },
    ],
    state: 'active',
    ...partial,
  };
}

const gameStub = {
  groups: { g1: { id: 'g1', name: 'Crew', memberIds: ['ch1', 'ch2'], waypoints: [] } },
  characters: {
    ch1: { id: 'ch1', name: 'A' },
    ch2: { id: 'ch2', name: 'B' },
  },
} as unknown as GameState;

describe('combatLogic', () => {
  it('befüllt die Initiative-Liste mit Gruppenmitgliedern und Gegnern (§4.4/§8)', () => {
    const combatants = buildInitialCombatants(gameStub, enc());
    const kinds = combatants.map((c) => (c.kind === 'character' ? 'char' : `enemy:${c.slotIndex}`));
    // 2 Charaktere, 1 Sammeleintrag (shared), 1 Einzelgegner-Slot
    expect(kinds).toEqual(['char', 'char', 'enemy:null', 'enemy:0']);
  });

  it('sortiert nach Initiative, ohne Wert dahinter, Besiegte ans Ende', () => {
    const e = enc();
    e.enemies[1].slots[0].defeated = true;
    const combatants: Combatant[] = [
      { id: 'c1', kind: 'character', characterId: 'ch1', initiative: 12 },
      { id: 'c2', kind: 'character', characterId: 'ch2', initiative: null },
      { id: 'c3', kind: 'enemy', enemyId: 'en2', slotIndex: 0, initiative: 20 }, // besiegt
      { id: 'c4', kind: 'enemy', enemyId: 'en1', slotIndex: null, initiative: 18 },
    ];
    expect(sortForInitiative(e, combatants).map((c) => c.id)).toEqual(['c4', 'c1', 'c2', 'c3']);
  });

  it('Sammeleintrag gilt erst als besiegt, wenn alle Slots besiegt sind', () => {
    const e = enc();
    const group: Combatant = { id: 'x', kind: 'enemy', enemyId: 'en1', slotIndex: null, initiative: 5 };
    expect(isCombatantDefeated(e, group)).toBe(false);
    e.enemies[0].slots[0].defeated = true;
    expect(isCombatantDefeated(e, group)).toBe(false);
    e.enemies[0].slots[1].defeated = true;
    expect(isCombatantDefeated(e, group)).toBe(true);
  });

  it('schaltet weiter, überspringt Besiegte und zählt die Runde beim Umbruch', () => {
    const e = enc();
    const combatants: Combatant[] = [
      { id: 'c1', kind: 'character', characterId: 'ch1', initiative: 15 },
      { id: 'c2', kind: 'enemy', enemyId: 'en2', slotIndex: 0, initiative: 10 },
      { id: 'c3', kind: 'enemy', enemyId: 'en1', slotIndex: null, initiative: 5 },
    ];
    // Start: niemand dran → höchste Initiative, Runde bleibt 1
    let turn = nextTurn(e, combatants, null, 1);
    expect(turn).toEqual({ activeCombatantId: 'c1', round: 1 });
    // c2 wird besiegt → von c1 direkt zu c3
    e.enemies[1].slots[0].defeated = true;
    turn = nextTurn(e, combatants, 'c1', 1);
    expect(turn).toEqual({ activeCombatantId: 'c3', round: 1 });
    // Umbruch: von c3 zurück zu c1, Runde zählt hoch
    turn = nextTurn(e, combatants, 'c3', 1);
    expect(turn).toEqual({ activeCombatantId: 'c1', round: 2 });
  });

  it('liefert null, wenn niemand mehr kampffähig ist', () => {
    const e = enc();
    e.enemies[0].slots.forEach((s) => (s.defeated = true));
    e.enemies[1].slots[0].defeated = true;
    const combatants: Combatant[] = [
      { id: 'c3', kind: 'enemy', enemyId: 'en1', slotIndex: null, initiative: 5 },
      { id: 'c2', kind: 'enemy', enemyId: 'en2', slotIndex: 0, initiative: 10 },
    ];
    expect(nextTurn(e, combatants, 'c2', 3)).toBeNull();
  });
});
