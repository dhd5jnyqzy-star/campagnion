/**
 * Gruppen-Peek (§3.3 Group): Mitgliedschaft läuft ausschließlich über
 * character.joinedGroup/leftGroup-Events — die historische Konstellation
 * stimmt beim Zurückspulen. Positions-Historie = group.moved-Events; die
 * Reiselinie zeichnet das Canvas.
 */

import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { appendGameEvent } from '../../features/game/thunks';
import { gotoRequested, peekClosed, placingChanged } from '../../features/nav/navSlice';
import type { Group } from '../../types';
import { Chips, LinkAdder, PanelHead, Section } from './common';

export function GroupPeek({ group }: { group: Group }) {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game.state);
  if (!game) return null;

  const lastWaypoint = group.waypoints[group.waypoints.length - 1];

  return (
    <>
      <PanelHead
        name={group.name}
        onCommitName={(name) =>
          void dispatch(
            appendGameEvent({
              type: 'group.updated',
              payload: { groupId: group.id, changes: { name } },
            }),
          )
        }
      />

      <Section title={`Mitglieder (${group.memberIds.length})`}>
        <Chips
          items={group.memberIds
            .filter((id) => game.characters[id])
            .map((id) => ({ id, label: game.characters[id].name, peek: 'character' as const }))}
          onRemove={(characterId) =>
            void dispatch(
              appendGameEvent({
                type: 'character.leftGroup',
                payload: { characterId, groupId: group.id },
              }),
            )
          }
          emptyText="Noch keine Mitglieder."
        />
        <LinkAdder
          placeholder="Charakter aufnehmen …"
          options={Object.values(game.characters)
            .filter((c) => !group.memberIds.includes(c.id))
            .map((c) => ({ id: c.id, label: c.name }))}
          onAdd={(characterId) =>
            void dispatch(
              appendGameEvent({
                type: 'character.joinedGroup',
                payload: { characterId, groupId: group.id },
              }),
            )
          }
        />
      </Section>

      <Section title="Position">
        {lastWaypoint ? (
          <p className="muted">
            Zuletzt: {game.areas[lastWaypoint.areaId]?.name ?? 'Unbekannt'} (Tag{' '}
            {lastWaypoint.gameDay})
          </p>
        ) : (
          <p className="muted">Noch keine Position gesetzt.</p>
        )}
        <button
          onClick={() => {
            dispatch(placingChanged({ kind: 'group', groupId: group.id }));
            dispatch(peekClosed());
          }}
        >
          Position auf Karte setzen …
        </button>
      </Section>

      <Section title={`Reiselinie (${group.waypoints.length} Wegpunkte)`}>
        <ul className="event-list">
          {[...group.waypoints]
            .slice(-8)
            .reverse()
            .map((wp, i) => (
              <li key={`${wp.gameDay}-${i}`}>
                <button
                  className="chip-label"
                  onClick={() =>
                    dispatch(
                      gotoRequested({
                        label: group.name,
                        target: { areaId: wp.areaId },
                      }),
                    )
                  }
                >
                  Tag {wp.gameDay} — {game.areas[wp.areaId]?.name ?? 'Unbekannt'}
                </button>
              </li>
            ))}
        </ul>
        <p className="muted">Die Linie verbindet die Wegpunkte auf der Karte.</p>
      </Section>
    </>
  );
}
