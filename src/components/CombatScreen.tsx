/**
 * Kampfmodus (§4.4): reduzierter Screen pro Encounter. Der Kampfzustand lebt
 * am Encounter (nicht global) — dieser Screen ist nur die Ansicht darauf;
 * Schließen lässt den Kampf weiterlaufen (parallele Kämpfe, Wechsel per
 * Navigation).
 *
 * - Initiative-Liste: vorbefüllt beim Start, Werte manuell eintippen, die
 *   Liste sortiert sich selbst; Besiegte rutschen ans Ende, bleiben aber drin
 * - HP: antippen → Schaden/Heilung eingeben; bei 0 automatisch kampfunfähig
 *   (umschaltbar); Statuseffekte als Tags an jedem Eintrag
 * - "Wer ist dran"-Marker mit Weiterschalten; Rundenzähler zählt automatisch
 * - "Kampf beenden" → Zusammenfassung → Encounter wird Gedächtnispunkt
 * - Rückgängig wirkt kontextbezogen auf die letzte Aktion in DIESEM Kampf
 */

import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  buildEnemyCombatants,
  isCombatantDefeated,
  nextTurn,
  sortForInitiative,
} from '../features/combat/combatLogic';
import { appendGameEvent, undoLastEvent } from '../features/game/thunks';
import { combatClosed } from '../features/nav/navSlice';
import { newId } from '../lib/ids';
import { SUGGESTED_STATUS_EFFECTS } from '../types';
import type { Combatant, Encounter, Enemy, EnemySlot } from '../types';
import { BattlemapViewer } from './BattlemapViewer';

export function CombatScreen({ encounterId }: { encounterId: string }) {
  const dispatch = useAppDispatch();
  const encounter = useAppSelector((s) => s.game.state?.encounters[encounterId]);
  const [battlemapId, setBattlemapId] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [summary, setSummary] = useState('');
  const [addingEnemy, setAddingEnemy] = useState(false);

  const close = () => dispatch(combatClosed());

  if (!encounter?.combat) {
    // Kampf wurde beendet (oder per Undo zurückgenommen) → zurück zur Karte.
    return (
      <div className="combat">
        <header className="combat-head">
          <h2>{encounter?.name ?? 'Encounter'}</h2>
          <button onClick={close}>Zur Karte</button>
        </header>
        <p className="muted combat-done">
          {encounter?.completionComment ?? 'Kein laufender Kampf.'}
        </p>
      </div>
    );
  }

  const combat = encounter.combat;
  const sorted = sortForInitiative(encounter, combat.combatants);

  const advance = () => {
    const turn = nextTurn(encounter, combat.combatants, combat.activeCombatantId, combat.round);
    if (!turn) return;
    void dispatch(
      appendGameEvent({
        type: 'combat.turnAdvanced',
        payload: { encounterId, activeCombatantId: turn.activeCombatantId, round: turn.round },
      }),
    );
  };

  const endCombat = () => {
    void dispatch(
      appendGameEvent({ type: 'combat.ended', payload: { encounterId, summary: summary.trim() } }),
    )
      .unwrap()
      .then(close);
  };

  return (
    <div className="combat">
      <header className="combat-head">
        <div className="combat-title">
          <h2>{encounter.name}</h2>
          <span className="combat-round">Runde {combat.round}</span>
        </div>
        <div className="combat-actions">
          {encounter.battlemapAssetIds.length > 0 && (
            <button onClick={() => setBattlemapId(encounter.battlemapAssetIds[0])}>
              Battlemap
            </button>
          )}
          <button
            onClick={() =>
              void dispatch(
                undoLastEvent({ scope: 'encounter', encounterId, reason: 'Undo im Kampf' }),
              )
            }
          >
            Rückgängig
          </button>
          <button onClick={close}>Zur Karte</button>
        </div>
      </header>

      <div className="combat-list">
        {sorted.map((c) => (
          <CombatantRow
            key={c.id}
            encounter={encounter}
            combatant={c}
            active={combat.activeCombatantId === c.id}
          />
        ))}
      </div>

      <footer className="combat-foot">
        <button className="combat-next" onClick={advance}>
          Weiter ▸
        </button>
        <button onClick={() => setAddingEnemy(true)}>+ Gegner</button>
        <button className="combat-end" onClick={() => setEnding(true)}>
          Kampf beenden
        </button>
      </footer>

      {addingEnemy && (
        <AddEnemyDialog encounterId={encounterId} onClose={() => setAddingEnemy(false)} />
      )}

      {ending && (
        <div className="combat-dialog">
          <h3>Kampf beenden</h3>
          <textarea
            autoFocus
            rows={4}
            placeholder="Zusammenfassung — der Encounter wird zum Gedächtnispunkt."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
          <div className="combat-dialog-actions">
            <button onClick={() => setEnding(false)}>Abbrechen</button>
            <button className="combat-end" onClick={endCombat}>
              Beenden
            </button>
          </div>
        </div>
      )}

      {battlemapId && <BattlemapViewer assetId={battlemapId} onClose={() => setBattlemapId(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zeile der Initiative-Liste
// ---------------------------------------------------------------------------

function CombatantRow({
  encounter,
  combatant,
  active,
}: {
  encounter: Encounter;
  combatant: Combatant;
  active: boolean;
}) {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game.state);
  const defeated = isCombatantDefeated(encounter, combatant);

  const setActive = () =>
    void dispatch(
      appendGameEvent({
        type: 'combat.turnAdvanced',
        payload: {
          encounterId: encounter.id,
          activeCombatantId: combatant.id,
          round: encounter.combat?.round ?? 1,
        },
      }),
    );

  let name: string;
  let enemy: Enemy | undefined;
  if (combatant.kind === 'character') {
    name = game?.characters[combatant.characterId]?.name ?? 'Charakter';
  } else {
    enemy = encounter.enemies.find((e) => e.id === combatant.enemyId);
    if (!enemy) return null;
    name =
      combatant.slotIndex === null
        ? `${enemy.count}× ${enemy.name}`
        : enemy.count > 1
          ? `${enemy.name} ${combatant.slotIndex + 1}`
          : enemy.name;
  }

  return (
    <div className={`combatant ${active ? 'active' : ''} ${defeated ? 'defeated' : ''}`}>
      <div className="combatant-main">
        <button className="turn-marker" title="Ist dran" onClick={setActive}>
          {active ? '▶' : ''}
        </button>
        <InitiativeInput encounterId={encounter.id} combatant={combatant} />
        <span className="combatant-name">{name}</span>
      </div>

      {combatant.kind === 'character' ? (
        <CharacterTags characterId={combatant.characterId} />
      ) : (
        enemy && (
          <div className="slot-list">
            {(combatant.slotIndex === null
              ? enemy.slots.map((s, i) => [s, i] as const)
              : [[enemy.slots[combatant.slotIndex], combatant.slotIndex] as const]
            ).map(([slot, i]) =>
              slot ? (
                <SlotEditor
                  key={i}
                  encounterId={encounter.id}
                  enemy={enemy!}
                  slot={slot}
                  slotIndex={i}
                  showIndex={combatant.slotIndex === null && enemy!.count > 1}
                />
              ) : null,
            )}
          </div>
        )
      )}
    </div>
  );
}

function InitiativeInput({
  encounterId,
  combatant,
}: {
  encounterId: string;
  combatant: Combatant;
}) {
  const dispatch = useAppDispatch();
  const [local, setLocal] = useState(combatant.initiative?.toString() ?? '');
  // Externe Änderungen (z. B. Undo) übernehmen.
  useEffect(() => setLocal(combatant.initiative?.toString() ?? ''), [combatant.initiative]);
  const commit = () => {
    const n = Number(local);
    if (local !== '' && Number.isFinite(n) && n !== combatant.initiative) {
      void dispatch(
        appendGameEvent({
          type: 'combat.initiativeSet',
          payload: { encounterId, combatantId: combatant.id, initiative: n },
        }),
      );
    } else {
      setLocal(combatant.initiative?.toString() ?? '');
    }
  };
  return (
    <input
      className="initiative-input"
      type="number"
      placeholder="–"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      aria-label="Initiative"
    />
  );
}

/** Statuseffekt-Tags eines Charakters (Spieler-HP werden bewusst nicht geführt, §1). */
function CharacterTags({ characterId }: { characterId: string }) {
  const dispatch = useAppDispatch();
  const character = useAppSelector((s) => s.game.state?.characters[characterId]);
  if (!character) return null;
  return (
    <EffectTags
      effects={character.statusEffects}
      onAdd={(effect) =>
        void dispatch(
          appendGameEvent({
            type: 'statusEffect.added',
            payload: { target: { kind: 'character', characterId }, effect },
          }),
        )
      }
      onRemove={(effect) =>
        void dispatch(
          appendGameEvent({
            type: 'statusEffect.removed',
            payload: { target: { kind: 'character', characterId }, effect },
          }),
        )
      }
    />
  );
}

/** HP-Zähler + Statuseffekte + tot/kampfunfähig für ein Gegner-Individuum (§4.4). */
function SlotEditor({
  encounterId,
  enemy,
  slot,
  slotIndex,
  showIndex,
}: {
  encounterId: string;
  enemy: Enemy;
  slot: EnemySlot;
  slotIndex: number;
  showIndex: boolean;
}) {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');

  const applyDelta = (sign: 1 | -1) => {
    const n = Math.abs(Number(amount));
    if (!Number.isFinite(n) || n === 0) return;
    void dispatch(
      appendGameEvent({
        type: 'combat.hpChanged',
        payload: { encounterId, enemyId: enemy.id, slotIndex, delta: sign * n },
      }),
    );
    setAmount('');
    setOpen(false);
  };

  const target = { kind: 'enemy' as const, encounterId, enemyId: enemy.id, slotIndex };

  return (
    <div className={`slot ${slot.defeated ? 'defeated' : ''}`}>
      <div className="slot-row">
        <button className="hp-chip" onClick={() => setOpen(!open)}>
          {showIndex && <span className="muted">{slotIndex + 1}: </span>}
          {slot.hp}/{enemy.maxHp} HP
        </button>
        <button
          className="defeat-toggle"
          title="tot/kampfunfähig umschalten"
          onClick={() =>
            void dispatch(
              appendGameEvent({
                type: 'combat.defeatToggled',
                payload: { encounterId, enemyId: enemy.id, slotIndex, defeated: !slot.defeated },
              }),
            )
          }
        >
          {slot.defeated ? '☠' : '♥'}
        </button>
        <EffectTags
          effects={slot.statusEffects}
          compact
          onAdd={(effect) =>
            void dispatch(
              appendGameEvent({ type: 'statusEffect.added', payload: { target, effect } }),
            )
          }
          onRemove={(effect) =>
            void dispatch(
              appendGameEvent({ type: 'statusEffect.removed', payload: { target, effect } }),
            )
          }
        />
      </div>
      {open && (
        <div className="hp-editor">
          <input
            type="number"
            autoFocus
            placeholder="Punkte"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyDelta(-1);
            }}
          />
          <button onClick={() => applyDelta(-1)}>Schaden</button>
          <button onClick={() => applyDelta(1)}>Heilen</button>
        </div>
      )}
    </div>
  );
}

/** Tag-Leiste: Chips + kompaktes Hinzufügen mit Vorschlagsliste. */
function EffectTags({
  effects,
  onAdd,
  onRemove,
  compact,
}: {
  effects: string[];
  onAdd: (effect: string) => void;
  onRemove: (effect: string) => void;
  compact?: boolean;
}) {
  const [input, setInput] = useState('');
  const add = () => {
    const effect = input.trim();
    if (effect && !effects.includes(effect)) onAdd(effect);
    setInput('');
  };
  return (
    <div className={`effect-tags ${compact ? 'compact' : ''}`}>
      {effects.map((e) => (
        <button key={e} className="effect-tag" title="Entfernen" onClick={() => onRemove(e)}>
          {e} ✕
        </button>
      ))}
      <input
        type="text"
        list="status-effects-combat"
        placeholder="+ Effekt"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={() => input.trim() && add()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') add();
        }}
      />
      <datalist id="status-effects-combat">
        {SUGGESTED_STATUS_EFFECTS.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>
    </div>
  );
}

/** Spontanen Gegner mit einem Tipp nachschieben (§4.4). */
function AddEnemyDialog({ encounterId, onClose }: { encounterId: string; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [name, setName] = useState('');
  const [count, setCount] = useState('1');
  const [maxHp, setMaxHp] = useState('10');

  const add = () => {
    const n = Math.max(1, Math.round(Number(count) || 1));
    const hp = Math.max(1, Math.round(Number(maxHp) || 1));
    if (!name.trim()) return;
    const enemy: Enemy = {
      id: newId(),
      name: name.trim(),
      count: n,
      maxHp: hp,
      sharedInitiative: n > 1,
      slots: Array.from({ length: n }, () => ({ hp, statusEffects: [], defeated: false })),
    };
    void dispatch(
      appendGameEvent({
        type: 'combat.enemyAdded',
        payload: { encounterId, enemy, newCombatants: buildEnemyCombatants(enemy) },
      }),
    );
    onClose();
  };

  return (
    <div className="combat-dialog">
      <h3>Spontaner Gegner</h3>
      <input
        type="text"
        autoFocus
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="combat-dialog-fields">
        <label>
          Anzahl
          <input type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} />
        </label>
        <label>
          Max-HP
          <input type="number" min={1} value={maxHp} onChange={(e) => setMaxHp(e.target.value)} />
        </label>
      </div>
      <div className="combat-dialog-actions">
        <button onClick={onClose}>Abbrechen</button>
        <button onClick={add} disabled={!name.trim()}>
          Hinzufügen
        </button>
      </div>
    </div>
  );
}
