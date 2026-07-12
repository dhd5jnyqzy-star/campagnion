/**
 * Pure Kampflogik (§4.4) — getrennt von der UI, damit sie testbar ist.
 *
 * Initiative-Liste: vorbefüllt mit Gruppenmitgliedern + vorbereiteten Gegnern;
 * Gegner mit sharedInitiative bekommen EINEN Sammeleintrag (slotIndex null),
 * sonst einen Eintrag pro Individuum (§8). Die Liste sortiert sich selbst:
 * Initiative absteigend, ohne Wert ans Ende, Besiegte ganz nach unten
 * ("rutscht nach unten, bleibt in der Liste").
 */

import type { Combatant, Encounter, Enemy, GameState } from '../../types';
import { newId } from '../../lib/ids';

/** Initiative-Einträge für einen Gegner (Sammeleintrag oder pro Individuum, §8). */
export function buildEnemyCombatants(enemy: Enemy): Combatant[] {
  if (enemy.sharedInitiative) {
    return [{ id: newId(), kind: 'enemy', enemyId: enemy.id, slotIndex: null, initiative: null }];
  }
  return enemy.slots.map((_, slotIndex) => ({
    id: newId(),
    kind: 'enemy' as const,
    enemyId: enemy.id,
    slotIndex,
    initiative: null,
  }));
}

/** Vorbefüllung beim Kampfstart: alle Gruppenmitglieder + vorbereitete Gegner (§4.4). */
export function buildInitialCombatants(game: GameState, encounter: Encounter): Combatant[] {
  const memberIds = new Set(Object.values(game.groups).flatMap((g) => g.memberIds));
  const characters: Combatant[] = [...memberIds]
    .filter((id) => game.characters[id])
    .map((characterId) => ({ id: newId(), kind: 'character', characterId, initiative: null }));
  const enemies = encounter.enemies.flatMap(buildEnemyCombatants);
  return [...characters, ...enemies];
}

/** Besiegt: Gegner-Slot nach Flag; Sammeleintrag erst, wenn ALLE Slots besiegt sind. */
export function isCombatantDefeated(encounter: Encounter, c: Combatant): boolean {
  if (c.kind === 'character') return false;
  const enemy = encounter.enemies.find((e) => e.id === c.enemyId);
  if (!enemy) return true;
  if (c.slotIndex === null) return enemy.slots.every((s) => s.defeated);
  return enemy.slots[c.slotIndex]?.defeated ?? true;
}

/**
 * Selbstsortierende Liste (§4.4): Initiative absteigend; Einträge ohne Wert
 * dahinter; Besiegte ganz ans Ende (durchgestrichen, aber in der Liste).
 * Bei Gleichstand bleibt die Einfügereihenfolge stabil.
 */
export function sortForInitiative(encounter: Encounter, combatants: Combatant[]): Combatant[] {
  const rank = (c: Combatant) => {
    if (isCombatantDefeated(encounter, c)) return 2;
    return c.initiative === null ? 1 : 0;
  };
  return [...combatants].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) return (b.initiative ?? 0) - (a.initiative ?? 0);
    return 0;
  });
}

/**
 * "Wer ist dran" weiterschalten (§4.4): nächster nicht-besiegter Eintrag in
 * Sortierreihenfolge; beim Umbruch ans Listenende zählt die Runde hoch.
 * Ist der aktuelle Eintrag inzwischen besiegt/entfernt, geht es beim
 * Listenanfang weiter (ohne Rundenzählung — konservativ).
 */
export function nextTurn(
  encounter: Encounter,
  combatants: Combatant[],
  activeCombatantId: string | null,
  round: number,
): { activeCombatantId: string; round: number } | null {
  const alive = sortForInitiative(encounter, combatants).filter(
    (c) => !isCombatantDefeated(encounter, c),
  );
  if (alive.length === 0) return null;
  const idx = alive.findIndex((c) => c.id === activeCombatantId);
  if (idx === -1) {
    return { activeCombatantId: alive[0].id, round };
  }
  const nextIdx = (idx + 1) % alive.length;
  return {
    activeCombatantId: alive[nextIdx].id,
    round: nextIdx === 0 ? round + 1 : round,
  };
}
