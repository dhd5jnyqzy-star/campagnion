/**
 * Event-Replay: der Kern des Event-Sourcings (§3.1).
 *
 * applyEvent ist die einzige Stelle, an der aus Events Game-State wird — sie
 * wird beim App-Start (Replay des Logs), beim Live-Anwenden neuer Events und
 * beim Fortschreiben ab Snapshot benutzt. Pure Funktion: (State, Event) → State.
 *
 * replay() rechnet zusätzlich die Korrektur-Mechanik ein:
 * - Ein Event, das von einem 'event.revoked' referenziert wird, wird übersprungen.
 * - Ein Event mit `amends` wirkt an der Log-Position des Originals (mit seinem
 *   eigenen payload und seiner eigenen gameTime — so bekommt z. B. eine
 *   world.dayAdvanced-Korrektur rückwirkend den richtigen Tag, §3.4) und wird
 *   an seiner eigenen Position übersprungen.
 * - `amends` zeigt immer auf das Original; das späteste nicht-revozierte
 *   Amendment gewinnt.
 */

import { produce } from 'immer';
import type { GameEvent } from '../../types';
import type { EnemySlot, GameState } from '../../types';

/** Frischer State aus dem ersten Event einer Kampagne. */
function initialState(e: GameEvent & { type: 'campaign.created' }): GameState {
  return {
    campaign: {
      id: e.campaignId,
      name: e.payload.name,
      createdAt: e.realTime,
      clock: { ...e.gameTime },
    },
    areas: {},
    mapImages: {},
    markers: {},
    encounters: {},
    quests: {},
    npcs: {},
    characters: {},
    groups: {},
    sessions: {},
    assets: {},
    activeSessionId: null,
  };
}

/** Partielle Änderungen anwenden, wenn das Ziel (noch) existiert. */
function assign<T extends object>(target: T | undefined, changes: Partial<T>): void {
  if (target) Object.assign(target, changes);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Ein Event auf den State anwenden. Events, deren Ziel nicht (mehr) existiert,
 * sind No-Ops — der Log ist die Wahrheit, defekte Referenzen dürfen den Replay
 * nie zum Absturz bringen.
 */
export function applyEvent(state: GameState | null, event: GameEvent): GameState | null {
  if (event.type === 'campaign.created') {
    return initialState(event as GameEvent & { type: 'campaign.created' });
  }
  if (!state) return state;
  return produce(state, (s) => {
    applyToDraft(s, event);
  });
}

function applyToDraft(s: GameState, e: GameEvent): void {
  switch (e.type) {
    // -- Kampagne & Spielwelt-Uhr (§3.4) --
    case 'campaign.created':
      return; // in applyEvent behandelt
    case 'campaign.renamed':
      s.campaign.name = e.payload.name;
      return;
    case 'world.dayAdvanced':
      s.campaign.clock = { ...e.payload.to };
      return;
    case 'world.timeOfDayChanged':
      s.campaign.clock.timeOfDay = e.payload.to;
      return;

    // -- Sessions --
    case 'session.started':
      s.sessions[e.payload.sessionId] = {
        id: e.payload.sessionId,
        name: e.payload.name,
        startedAt: e.realTime,
        startGameTime: { ...e.gameTime },
      };
      s.activeSessionId = e.payload.sessionId;
      return;
    case 'session.ended': {
      const session = s.sessions[e.payload.sessionId];
      if (session) session.endedAt = e.realTime;
      if (s.activeSessionId === e.payload.sessionId) s.activeSessionId = null;
      return;
    }

    // -- Korrektur & Import: keine direkte State-Wirkung --
    case 'event.revoked':
    case 'import.applied':
      return;

    // -- Areas, Karten, Marker --
    case 'area.created':
      s.areas[e.payload.area.id] = e.payload.area;
      return;
    case 'area.updated':
      assign(s.areas[e.payload.areaId], e.payload.changes);
      return;
    case 'mapImage.added':
      s.mapImages[e.payload.mapImage.id] = e.payload.mapImage;
      return;
    case 'mapImage.updated':
      assign(s.mapImages[e.payload.mapImageId], e.payload.changes);
      return;
    case 'mapImage.replaced':
      assign(s.mapImages[e.payload.mapImageId], { assetId: e.payload.assetId });
      return;
    case 'marker.created':
      s.markers[e.payload.marker.id] = e.payload.marker;
      return;
    case 'marker.moved':
      assign(s.markers[e.payload.markerId], { position: e.payload.position });
      return;
    case 'marker.updated':
      assign(s.markers[e.payload.markerId], e.payload.changes);
      return;

    // -- Encounter & Kampf (§4.4) --
    case 'encounter.created':
      s.encounters[e.payload.encounter.id] = e.payload.encounter;
      return;
    case 'encounter.updated':
      assign(s.encounters[e.payload.encounterId], e.payload.changes);
      return;
    case 'encounter.placed':
      assign(s.encounters[e.payload.encounterId], { markerId: e.payload.markerId });
      return;
    case 'encounter.completed': {
      const enc = s.encounters[e.payload.encounterId];
      if (!enc) return;
      enc.state = 'completed';
      if (e.payload.comment !== undefined) enc.completionComment = e.payload.comment;
      return;
    }
    case 'combat.started': {
      const enc = s.encounters[e.payload.encounterId];
      if (!enc) return;
      enc.state = 'active';
      enc.combat = {
        startedAt: e.realTime,
        round: 1,
        activeCombatantId: null,
        combatants: e.payload.combatants,
      };
      return;
    }
    case 'combat.enemyAdded': {
      const enc = s.encounters[e.payload.encounterId];
      if (!enc) return;
      enc.enemies.push(e.payload.enemy);
      enc.combat?.combatants.push(...e.payload.newCombatants);
      return;
    }
    case 'combat.initiativeSet': {
      const combatant = s.encounters[e.payload.encounterId]?.combat?.combatants.find(
        (c) => c.id === e.payload.combatantId,
      );
      if (combatant) combatant.initiative = e.payload.initiative;
      return;
    }
    case 'combat.turnAdvanced': {
      const combat = s.encounters[e.payload.encounterId]?.combat;
      if (!combat) return;
      combat.activeCombatantId = e.payload.activeCombatantId;
      combat.round = e.payload.round;
      return;
    }
    case 'combat.hpChanged': {
      const enemy = s.encounters[e.payload.encounterId]?.enemies.find(
        (en) => en.id === e.payload.enemyId,
      );
      const slot = enemy?.slots[e.payload.slotIndex];
      if (!enemy || !slot) return;
      slot.hp = clamp(slot.hp + e.payload.delta, 0, enemy.maxHp);
      // Bei 0 automatisch tot/kampfunfähig (§4.4); manuelles Umschalten via defeatToggled.
      slot.defeated = slot.hp <= 0;
      return;
    }
    case 'combat.defeatToggled': {
      const slot = s.encounters[e.payload.encounterId]?.enemies.find(
        (en) => en.id === e.payload.enemyId,
      )?.slots[e.payload.slotIndex];
      if (slot) slot.defeated = e.payload.defeated;
      return;
    }
    case 'combat.ended': {
      const enc = s.encounters[e.payload.encounterId];
      if (!enc) return;
      enc.state = 'completed';
      enc.completionComment = e.payload.summary;
      // Kampfverlauf steckt in den Events (§4.4); der Live-Zustand wird entfernt.
      delete enc.combat;
      return;
    }

    // -- Statuseffekte (Spieler wie Gegner, §4.4) --
    case 'statusEffect.added': {
      const effects = resolveStatusEffects(s, e.payload.target);
      if (effects && !effects.includes(e.payload.effect)) effects.push(e.payload.effect);
      return;
    }
    case 'statusEffect.removed': {
      const effects = resolveStatusEffects(s, e.payload.target);
      if (!effects) return;
      const i = effects.indexOf(e.payload.effect);
      if (i >= 0) effects.splice(i, 1);
      return;
    }

    // -- Quests & NPCs --
    case 'quest.created':
      s.quests[e.payload.quest.id] = e.payload.quest;
      return;
    case 'quest.updated':
      assign(s.quests[e.payload.questId], e.payload.changes);
      return;
    case 'quest.statusChanged':
      assign(s.quests[e.payload.questId], { status: e.payload.status });
      return;
    case 'quest.commentAdded':
      s.quests[e.payload.questId]?.comments.push(e.payload.comment);
      return;
    case 'npc.created':
      s.npcs[e.payload.npc.id] = e.payload.npc;
      return;
    case 'npc.updated':
      assign(s.npcs[e.payload.npcId], e.payload.changes);
      return;
    case 'npc.commentAdded':
      s.npcs[e.payload.npcId]?.comments.push(e.payload.comment);
      return;

    // -- Characters (inkl. Sheet-Versionen, §3.3) --
    case 'character.created':
      s.characters[e.payload.character.id] = e.payload.character;
      return;
    case 'character.updated':
      assign(s.characters[e.payload.characterId], e.payload.changes);
      return;
    case 'character.sheetUploaded':
      s.characters[e.payload.characterId]?.sheets.push(e.payload.sheet);
      return;
    case 'character.sheetActivated': {
      const character = s.characters[e.payload.characterId];
      if (!character) return;
      character.activeSheetId = e.payload.sheetVersionId;
      const sheet = character.sheets.find((sh) => sh.id === e.payload.sheetVersionId);
      if (sheet) sheet.deactivated = false;
      return;
    }
    case 'character.sheetDeactivated': {
      const character = s.characters[e.payload.characterId];
      if (!character) return;
      const sheet = character.sheets.find((sh) => sh.id === e.payload.sheetVersionId);
      if (sheet) sheet.deactivated = true;
      if (character.activeSheetId === e.payload.sheetVersionId) character.activeSheetId = null;
      return;
    }

    // -- Gruppen: Mitgliedschaft & Reiselinie nur über Events (§3.3) --
    case 'character.joinedGroup': {
      const group = s.groups[e.payload.groupId];
      if (group && !group.memberIds.includes(e.payload.characterId)) {
        group.memberIds.push(e.payload.characterId);
      }
      return;
    }
    case 'character.leftGroup': {
      const group = s.groups[e.payload.groupId];
      if (!group) return;
      group.memberIds = group.memberIds.filter((id) => id !== e.payload.characterId);
      return;
    }
    case 'group.created':
      s.groups[e.payload.group.id] = e.payload.group;
      return;
    case 'group.updated':
      assign(s.groups[e.payload.groupId], e.payload.changes);
      return;
    case 'group.moved':
      s.groups[e.payload.groupId]?.waypoints.push(e.payload.waypoint);
      return;

    // -- Assets --
    case 'asset.imported':
      s.assets[e.payload.asset.id] = e.payload.asset;
      return;
  }
}

function resolveStatusEffects(
  s: GameState,
  target: Extract<GameEvent, { type: 'statusEffect.added' }>['payload']['target'],
): string[] | EnemySlot['statusEffects'] | undefined {
  if (target.kind === 'character') {
    return s.characters[target.characterId]?.statusEffects;
  }
  return s.encounters[target.encounterId]?.enemies.find((en) => en.id === target.enemyId)?.slots[
    target.slotIndex
  ]?.statusEffects;
}

/**
 * Kompletten Log (oder Log-Abschnitt ab leerem State) abspielen,
 * Korrektur-Events eingerechnet.
 */
export function replay(events: readonly GameEvent[]): GameState | null {
  const revoked = new Set<string>();
  for (const e of events) {
    if (e.type === 'event.revoked' && e.revokes) revoked.add(e.revokes);
  }
  // Späteres, nicht selbst revoziertes Amendment gewinnt.
  const substitute = new Map<string, GameEvent>();
  for (const e of events) {
    if (e.amends && !revoked.has(e.id)) substitute.set(e.amends, e);
  }

  let state: GameState | null = null;
  for (const e of events) {
    if (e.type === 'event.revoked') continue;
    if (revoked.has(e.id)) continue;
    if (e.amends) continue; // wirkt an der Position des Originals
    state = applyEvent(state, substitute.get(e.id) ?? e);
  }
  return state;
}

/** true, wenn das Event vergangene Events verändert → voller Replay statt Live-Apply. */
export function isCorrectionEvent(event: GameEvent): boolean {
  return event.revokes !== undefined || event.amends !== undefined;
}
