/**
 * Encounter-Peek (§3.3/§4.2): Beschreibung/Atmosphäre, Gegnerliste (mit
 * count/HP-Slots nach §8), Battlemaps (öffnen direkt), Platzierung
 * (Random-Pool → Karte) und Abschluss als Gedächtnispunkt. Der Kampfmodus
 * selbst kommt in M4 — hier ist die Vorbereitung zu Hause.
 */

import { useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { buildInitialCombatants } from '../../features/combat/combatLogic';
import { selectQuestsForEncounter } from '../../features/game/selectors';
import { addBattlemap, appendGameEvent } from '../../features/game/thunks';
import { combatOpened, gotoRequested, peekClosed, placingChanged } from '../../features/nav/navSlice';
import { newId } from '../../lib/ids';
import type { Encounter, Enemy } from '../../types';
import { BattlemapViewer } from '../BattlemapViewer';
import { Chips, NumberField, PanelHead, Section, TextField } from './common';

const STATE_LABELS: Record<Encounter['state'], string> = {
  prepared: 'vorbereitet',
  active: 'aktiv',
  completed: 'erlebt',
};

export function EncounterPeek({ encounter }: { encounter: Encounter }) {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game.state);
  const fileRef = useRef<HTMLInputElement>(null);
  const [viewAssetId, setViewAssetId] = useState<string | null>(null);
  const [completionText, setCompletionText] = useState('');
  const [newEnemy, setNewEnemy] = useState({ name: '', count: 1, maxHp: 10 });

  if (!game) return null;
  const marker = encounter.markerId ? game.markers[encounter.markerId] : undefined;
  const quests = selectQuestsForEncounter(game, encounter.id);

  const update = (changes: Partial<Omit<Encounter, 'id' | 'state' | 'combat'>>) =>
    void dispatch(
      appendGameEvent({
        type: 'encounter.updated',
        payload: { encounterId: encounter.id, changes },
      }),
    );

  const addEnemy = () => {
    const name = newEnemy.name.trim();
    if (!name || newEnemy.count < 1 || newEnemy.maxHp < 1) return;
    const enemy: Enemy = {
      id: newId(),
      name,
      count: newEnemy.count,
      maxHp: newEnemy.maxHp,
      sharedInitiative: newEnemy.count > 1,
      slots: Array.from({ length: newEnemy.count }, () => ({
        hp: newEnemy.maxHp,
        statusEffects: [],
        defeated: false,
      })),
    };
    update({ enemies: [...encounter.enemies, enemy] });
    setNewEnemy({ name: '', count: 1, maxHp: 10 });
  };

  const startCombat = () => {
    if (!game) return;
    void dispatch(
      appendGameEvent({
        type: 'combat.started',
        payload: { encounterId: encounter.id, combatants: buildInitialCombatants(game, encounter) },
      }),
    )
      .unwrap()
      .then(() => dispatch(combatOpened(encounter.id)));
  };

  return (
    <>
      <PanelHead name={encounter.name} onCommitName={(name) => update({ name })} />
      <p className="muted">
        Zustand: {STATE_LABELS[encounter.state]}
        {marker ? '' : encounter.state === 'completed' ? '' : ' · im Random-Pool'}
      </p>

      {encounter.state === 'prepared' && (
        <button className="combat-start" onClick={startCombat}>
          ⚔ Kampf starten
        </button>
      )}
      {encounter.state === 'active' && encounter.combat && (
        <button className="combat-start" onClick={() => dispatch(combatOpened(encounter.id))}>
          ⚔ Zum Kampf (Runde {encounter.combat.round})
        </button>
      )}

      <TextField
        multiline
        placeholder="Beschreibung / Atmosphäre …"
        value={encounter.description}
        onCommit={(description) => update({ description })}
      />

      <Section title="Ort">
        {marker ? (
          <button
            className="sidepanel-goto"
            onClick={() =>
              dispatch(
                gotoRequested({
                  label: encounter.name,
                  target: { markerId: marker.id, areaId: marker.areaId },
                }),
              )
            }
          >
            Goto — {marker.name ?? 'Marker'}
          </button>
        ) : (
          <button
            onClick={() => {
              dispatch(placingChanged({ kind: 'encounter', encounterId: encounter.id }));
              dispatch(peekClosed());
            }}
          >
            Auf Karte platzieren …
          </button>
        )}
      </Section>

      <Section title={`Gegner (${encounter.enemies.length})`}>
        {encounter.enemies.map((enemy) => (
          <div key={enemy.id} className="enemy-row">
            <span>
              {enemy.count > 1 ? `${enemy.count}× ` : ''}
              {enemy.name}
              <span className="muted"> · {enemy.maxHp} HP</span>
              {enemy.count > 1 && (
                <span className="muted">
                  {' '}
                  · Initiative {enemy.sharedInitiative ? 'geteilt' : 'einzeln'}
                </span>
              )}
            </span>
            <button
              className="chip-remove"
              aria-label="Entfernen"
              onClick={() =>
                update({ enemies: encounter.enemies.filter((x) => x.id !== enemy.id) })
              }
            >
              ✕
            </button>
          </div>
        ))}
        <div className="enemy-add">
          <input
            type="text"
            placeholder="Gegnername"
            value={newEnemy.name}
            onChange={(e) => setNewEnemy({ ...newEnemy, name: e.target.value })}
          />
          <NumberField
            label="Anzahl"
            value={newEnemy.count}
            min={1}
            max={20}
            onCommit={(count) => setNewEnemy((s) => ({ ...s, count: Math.round(count) }))}
          />
          <NumberField
            label="Max-HP"
            value={newEnemy.maxHp}
            min={1}
            onCommit={(maxHp) => setNewEnemy((s) => ({ ...s, maxHp: Math.round(maxHp) }))}
          />
          <button onClick={addEnemy} disabled={!newEnemy.name.trim()}>
            Gegner hinzufügen
          </button>
        </div>
      </Section>

      <Section title={`Battlemaps (${encounter.battlemapAssetIds.length})`}>
        {encounter.battlemapAssetIds.map((assetId, i) => (
          <button key={assetId} onClick={() => setViewAssetId(assetId)}>
            Battlemap {i + 1} öffnen
          </button>
        ))}
        <button onClick={() => fileRef.current?.click()}>+ Battlemap importieren</button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void dispatch(addBattlemap({ encounterId: encounter.id, file }));
          }}
        />
      </Section>

      <Section title="Quests">
        <Chips
          items={quests.map((q) => ({ id: q.id, label: q.name, peek: 'quest' as const }))}
          emptyText="Keine Quest verweist hierher."
        />
      </Section>

      {encounter.state !== 'completed' ? (
        <Section title="Abschließen">
          <TextField
            multiline
            placeholder="Was ist passiert? (Gedächtnispunkt-Text)"
            value={completionText}
            onCommit={setCompletionText}
          />
          <button
            onClick={() =>
              void dispatch(
                appendGameEvent({
                  type: 'encounter.completed',
                  payload: { encounterId: encounter.id, comment: completionText || undefined },
                }),
              )
            }
          >
            Als erlebt markieren
          </button>
        </Section>
      ) : (
        encounter.completionComment && (
          <Section title="Gedächtnispunkt">
            <p>{encounter.completionComment}</p>
          </Section>
        )
      )}

      {viewAssetId && <BattlemapViewer assetId={viewAssetId} onClose={() => setViewAssetId(null)} />}
    </>
  );
}
