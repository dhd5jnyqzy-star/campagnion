/**
 * Bibliotheks-Panel (§4.1): einklappbare Sammlung von Encountern (inkl.
 * Random-Pool), Quests, NSCs und Gruppe/Charakteren. Antippen öffnet den
 * Peek im Sidepanel; "+ Neu" legt eine Entität mit Standardwerten an und
 * öffnet sie direkt zum Ausfüllen.
 */

import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { appendGameEvent, type NewGameEvent } from '../features/game/thunks';
import { peeked, type PeekKind } from '../features/nav/navSlice';
import { newId } from '../lib/ids';

type Tab = 'encounters' | 'quests' | 'npcs' | 'party';

const TAB_LABELS: Record<Tab, string> = {
  encounters: 'Encounter',
  quests: 'Quests',
  npcs: 'NSCs',
  party: 'Gruppe',
};

const ENCOUNTER_STATE_DOT: Record<string, string> = {
  prepared: 'dot-prepared',
  active: 'dot-active',
  completed: 'dot-completed',
};

const QUEST_STATUS_DOT: Record<string, string> = {
  open: 'dot-prepared',
  active: 'dot-active',
  completed: 'dot-completed',
};

export function Dock() {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game.state);
  const [tab, setTab] = useState<Tab>('encounters');
  if (!game) return null;

  /** Entität anlegen und sofort zum Bearbeiten öffnen. */
  const create = (input: NewGameEvent, kind: PeekKind, id: string) =>
    void dispatch(appendGameEvent(input))
      .unwrap()
      .then(() => dispatch(peeked({ kind, id })));

  const createEncounter = () => {
    const id = newId();
    create(
      {
        type: 'encounter.created',
        payload: {
          encounter: {
            id,
            name: 'Neuer Encounter',
            description: '',
            battlemapAssetIds: [],
            enemies: [],
            state: 'prepared',
          },
        },
      },
      'encounter',
      id,
    );
  };

  const createQuest = () => {
    const id = newId();
    create(
      {
        type: 'quest.created',
        payload: {
          quest: {
            id,
            name: 'Neue Quest',
            status: 'open',
            comments: [],
            npcIds: [],
            areaIds: [],
            encounterIds: [],
          },
        },
      },
      'quest',
      id,
    );
  };

  const createNpc = () => {
    const id = newId();
    create(
      { type: 'npc.created', payload: { npc: { id, name: 'Neuer NSC', comments: [] } } },
      'npc',
      id,
    );
  };

  const createCharacter = () => {
    const id = newId();
    create(
      {
        type: 'character.created',
        payload: {
          character: {
            id,
            name: 'Neuer Charakter',
            className: '',
            race: '',
            level: 1,
            maxHp: 10,
            statusEffects: [],
            sheets: [],
            activeSheetId: null,
          },
        },
      },
      'character',
      id,
    );
  };

  const createGroup = () => {
    const id = newId();
    create(
      {
        type: 'group.created',
        payload: { group: { id, name: 'Neue Gruppe', memberIds: [], waypoints: [] } },
      },
      'group',
      id,
    );
  };

  const item = (kind: PeekKind, id: string, label: string, dotClass?: string, hint?: string) => (
    <button key={id} className="dock-item" onClick={() => dispatch(peeked({ kind, id }))}>
      {dotClass && <span className={`dot ${dotClass}`} />}
      <span className="dock-item-label">{label}</span>
      {hint && <span className="muted">{hint}</span>}
    </button>
  );

  return (
    <div className="dock">
      <div className="dock-tabs">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="dock-list">
        {tab === 'encounters' && (
          <>
            {Object.values(game.encounters).map((e) =>
              item(
                'encounter',
                e.id,
                e.name,
                ENCOUNTER_STATE_DOT[e.state],
                e.markerId ? undefined : e.state !== 'completed' ? 'Pool' : undefined,
              ),
            )}
            <button className="dock-new" onClick={createEncounter}>
              + Neuer Encounter
            </button>
          </>
        )}
        {tab === 'quests' && (
          <>
            {Object.values(game.quests).map((q) =>
              item('quest', q.id, q.name, QUEST_STATUS_DOT[q.status], q.progressNote),
            )}
            <button className="dock-new" onClick={createQuest}>
              + Neue Quest
            </button>
          </>
        )}
        {tab === 'npcs' && (
          <>
            {Object.values(game.npcs).map((n) => item('npc', n.id, n.name))}
            <button className="dock-new" onClick={createNpc}>
              + Neuer NSC
            </button>
          </>
        )}
        {tab === 'party' && (
          <>
            {Object.values(game.groups).map((g) =>
              item('group', g.id, g.name, undefined, `${g.memberIds.length} Mitglieder`),
            )}
            {Object.values(game.characters).map((c) =>
              item(
                'character',
                c.id,
                c.name,
                undefined,
                [c.className, `Lvl ${c.level}`].filter(Boolean).join(' · '),
              ),
            )}
            <button className="dock-new" onClick={createGroup}>
              + Neue Gruppe
            </button>
            <button className="dock-new" onClick={createCharacter}>
              + Neuer Charakter
            </button>
          </>
        )}
      </div>
    </div>
  );
}
