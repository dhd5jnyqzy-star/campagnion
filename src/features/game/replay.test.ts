/**
 * Tests für den Event-Sourcing-Kern: Replay, Korrektur-Mechanik (§3.1),
 * Gruppen-Mitgliedschaft über Events (§3.3) und Kampf-HP-Logik (§4.4).
 */

import { describe, expect, it } from 'vitest';
import type { Encounter, GameEvent, GameTime } from '../../types';
import { replay } from './replay';

let counter = 0;

/** Test-Event mit automatischer ID; Envelope-Defaults überschreibbar. */
function ev<T extends GameEvent['type']>(
  type: T,
  payload: Extract<GameEvent, { type: T }>['payload'],
  extra?: Partial<Pick<GameEvent, 'id' | 'revokes' | 'amends' | 'gameTime'>>,
): GameEvent {
  const gameTime: GameTime = { day: 1, timeOfDay: 'morning' };
  return {
    id: `e${++counter}`,
    campaignId: 'c1',
    type,
    payload,
    realTime: '2026-07-12T12:00:00.000Z',
    gameTime,
    sessionId: null,
    ...extra,
  } as GameEvent;
}

function testEncounter(): Encounter {
  return {
    id: 'enc1',
    name: 'Piraten am Kai',
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
    ],
    state: 'prepared',
  };
}

describe('replay', () => {
  it('baut den State aus campaign.created auf und wendet Folge-Events an', () => {
    const state = replay([
      ev('campaign.created', { name: 'Blauwasser' }),
      ev('campaign.renamed', { name: 'Blauwasser II' }),
      ev('world.dayAdvanced', { to: { day: 3, timeOfDay: 'evening' } }),
    ]);
    expect(state?.campaign.name).toBe('Blauwasser II');
    expect(state?.campaign.clock).toEqual({ day: 3, timeOfDay: 'evening' });
  });

  it('überspringt revozierte Events (event.revoked)', () => {
    const rename = ev('campaign.renamed', { name: 'Falscher Name' });
    const state = replay([
      ev('campaign.created', { name: 'Blauwasser' }),
      rename,
      ev('event.revoked', { reason: 'Tippfehler' }, { revokes: rename.id }),
    ]);
    expect(state?.campaign.name).toBe('Blauwasser');
  });

  it('ersetzt Events durch ihr Amendment an der Originalposition', () => {
    const advance = ev('world.dayAdvanced', { to: { day: 5, timeOfDay: 'morning' } });
    const state = replay([
      ev('campaign.created', { name: 'Blauwasser' }),
      advance,
      // Später am Abend gemerkt: es war erst Tag 4.
      ev('world.dayAdvanced', { to: { day: 4, timeOfDay: 'morning' } }, { amends: advance.id }),
    ]);
    expect(state?.campaign.clock.day).toBe(4);
  });

  it('lässt bei mehreren Amendments das späteste gewinnen, revozierte zählen nicht', () => {
    const advance = ev('world.dayAdvanced', { to: { day: 5, timeOfDay: 'morning' } });
    const amend1 = ev(
      'world.dayAdvanced',
      { to: { day: 4, timeOfDay: 'morning' } },
      { amends: advance.id },
    );
    const amend2 = ev(
      'world.dayAdvanced',
      { to: { day: 6, timeOfDay: 'morning' } },
      { amends: advance.id },
    );
    const state = replay([
      ev('campaign.created', { name: 'Blauwasser' }),
      advance,
      amend1,
      amend2,
      // Das späteste Amendment wird selbst revoziert → amend1 gilt.
      ev('event.revoked', {}, { revokes: amend2.id }),
    ]);
    expect(state?.campaign.clock.day).toBe(4);
  });

  it('führt Gruppen-Mitgliedschaft ausschließlich über Events (§3.3)', () => {
    const state = replay([
      ev('campaign.created', { name: 'Blauwasser' }),
      ev('group.created', { group: { id: 'g1', name: 'Die Crew', memberIds: [], waypoints: [] } }),
      ev('character.joinedGroup', { characterId: 'ch1', groupId: 'g1' }),
      ev('character.joinedGroup', { characterId: 'ch2', groupId: 'g1' }),
      ev('character.leftGroup', { characterId: 'ch1', groupId: 'g1' }),
    ]);
    expect(state?.groups['g1']?.memberIds).toEqual(['ch2']);
  });

  it('setzt defeated automatisch bei 0 HP und erlaubt manuelles Umschalten (§4.4)', () => {
    const state = replay([
      ev('campaign.created', { name: 'Blauwasser' }),
      ev('encounter.created', { encounter: testEncounter() }),
      ev('combat.started', { encounterId: 'enc1', combatants: [] }),
      ev('combat.hpChanged', { encounterId: 'enc1', enemyId: 'en1', slotIndex: 0, delta: -12 }),
      ev('combat.hpChanged', { encounterId: 'enc1', enemyId: 'en1', slotIndex: 1, delta: -4 }),
    ]);
    const slots = state?.encounters['enc1']?.enemies[0]?.slots;
    expect(slots?.[0]).toMatchObject({ hp: 0, defeated: true }); // geklemmt auf 0
    expect(slots?.[1]).toMatchObject({ hp: 6, defeated: false });

    const toggled = replay([
      ev('campaign.created', { name: 'Blauwasser' }),
      ev('encounter.created', { encounter: testEncounter() }),
      ev('combat.started', { encounterId: 'enc1', combatants: [] }),
      ev('combat.hpChanged', { encounterId: 'enc1', enemyId: 'en1', slotIndex: 0, delta: -12 }),
      ev('combat.defeatToggled', { encounterId: 'enc1', enemyId: 'en1', slotIndex: 0, defeated: false }),
    ]);
    expect(toggled?.encounters['enc1']?.enemies[0]?.slots[0]?.defeated).toBe(false);
  });

  it('beendet den Kampf: Encounter wird Gedächtnispunkt, Kampfzustand verschwindet', () => {
    const state = replay([
      ev('campaign.created', { name: 'Blauwasser' }),
      ev('encounter.created', { encounter: testEncounter() }),
      ev('combat.started', { encounterId: 'enc1', combatants: [] }),
      ev('combat.ended', { encounterId: 'enc1', summary: 'Piraten besiegt, einer entkommen.' }),
    ]);
    const enc = state?.encounters['enc1'];
    expect(enc?.state).toBe('completed');
    expect(enc?.completionComment).toBe('Piraten besiegt, einer entkommen.');
    expect(enc?.combat).toBeUndefined();
  });

  it('deaktiviert Sheets statt sie zu löschen und räumt den Aktiv-Zeiger auf', () => {
    const state = replay([
      ev('campaign.created', { name: 'Blauwasser' }),
      ev('character.created', {
        character: {
          id: 'ch1',
          name: 'Thorin',
          className: 'Paladin',
          race: 'Zwerg',
          level: 4,
          maxHp: 38,
          statusEffects: [],
          sheets: [],
          activeSheetId: null,
        },
      }),
      ev('character.sheetUploaded', {
        characterId: 'ch1',
        sheet: { id: 'sv1', assetId: 'a1', uploadedAt: '2026-07-12T12:00:00.000Z', deactivated: false },
      }),
      ev('character.sheetActivated', { characterId: 'ch1', sheetVersionId: 'sv1' }),
      ev('character.sheetDeactivated', { characterId: 'ch1', sheetVersionId: 'sv1' }),
    ]);
    const ch = state?.characters['ch1'];
    expect(ch?.sheets).toHaveLength(1);
    expect(ch?.sheets[0]?.deactivated).toBe(true);
    expect(ch?.activeSheetId).toBeNull();
  });

  it('lässt Events mit defekten Referenzen als No-Op durchlaufen', () => {
    const state = replay([
      ev('campaign.created', { name: 'Blauwasser' }),
      ev('marker.moved', { markerId: 'gibtsnicht', position: { x: 0.5, y: 0.5 } }),
      ev('quest.commentAdded', {
        questId: 'gibtsnicht',
        comment: { id: 'k1', text: 'x', realTime: '', gameTime: { day: 1, timeOfDay: 'morning' } },
      }),
    ]);
    expect(state?.campaign.name).toBe('Blauwasser');
  });
});
