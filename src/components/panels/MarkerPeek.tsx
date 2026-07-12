/**
 * Marker-Peek (§4.2): Typ, Position, n:m-Verknüpfungen zu Encountern, NSCs
 * und Quests (kanonisch am Marker, §3.3) sowie letzte Ereignisse aus dem Log.
 * Verknüpfen eines Pool-Encounters speist ihn hier gleichzeitig ein.
 */

import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { describeEvent } from '../../features/game/describeEvent';
import { selectPrimaryMapImage } from '../../features/game/selectors';
import { appendGameEvent } from '../../features/game/thunks';
import { gotoRequested } from '../../features/nav/navSlice';
import { formatGameTime } from '../../lib/gameTime';
import { gridRefLabel, normalizedToGridRef } from '../../lib/grid';
import { getCurrentStore } from '../../persistence/db';
import type { GameEvent, Marker, MarkerType } from '../../types';
import { Chips, LinkAdder, PanelHead, Section } from './common';

const TYPE_LABELS: Record<MarkerType, string> = {
  location: 'Ort',
  encounter: 'Encounter',
  npc: 'NSC',
  quest: 'Quest',
  note: 'Notiz',
};

/** Betrifft dieses Event den Marker? (für "Letzte Ereignisse") */
function concernsMarker(e: GameEvent, markerId: string): boolean {
  switch (e.type) {
    case 'marker.created':
      return e.payload.marker.id === markerId;
    case 'marker.moved':
    case 'marker.updated':
    case 'encounter.placed':
      return e.payload.markerId === markerId;
    default:
      return false;
  }
}

export function MarkerPeek({ marker }: { marker: Marker }) {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game.state);
  const lastSeq = useAppSelector((s) => s.game.lastSeq);
  const [events, setEvents] = useState<GameEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    void getCurrentStore()
      .getEventsAfter(0)
      .then((stored) => {
        if (cancelled) return;
        const relevant = stored.map((s) => s.event).filter((e) => concernsMarker(e, marker.id));
        setEvents(relevant.slice(-5).reverse());
      });
    return () => {
      cancelled = true;
    };
  }, [marker.id, lastSeq]);

  if (!game) return null;
  const area = game.areas[marker.areaId];
  const mapImage =
    (marker.mapImageId ? game.mapImages[marker.mapImageId] : undefined) ??
    selectPrimaryMapImage(game, marker.areaId);
  const gridLabel = mapImage?.grid
    ? gridRefLabel(normalizedToGridRef(marker.position, mapImage.grid))
    : null;

  const update = (changes: Partial<Omit<Marker, 'id'>>) =>
    void dispatch(
      appendGameEvent({ type: 'marker.updated', payload: { markerId: marker.id, changes } }),
    );

  const linkEncounter = (encounterId: string) => {
    update({ encounterIds: [...marker.encounterIds, encounterId] });
    // Pool-Encounter beim Verknüpfen gleich einspeisen (§3.3 Random-Pool).
    if (game.encounters[encounterId] && !game.encounters[encounterId].markerId) {
      void dispatch(
        appendGameEvent({ type: 'encounter.placed', payload: { encounterId, markerId: marker.id } }),
      );
    }
  };

  return (
    <>
      <PanelHead name={marker.name ?? ''} onCommitName={(name) => update({ name })} />

      <div className="sidepanel-meta">
        <label className="field">
          <span>Typ</span>
          <select
            value={marker.type}
            onChange={(e) => update({ type: e.target.value as MarkerType })}
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          {area?.name ?? 'Unbekannter Bereich'}
          {gridLabel ? ` · Feld ${gridLabel}` : ''}
        </p>
      </div>

      <button
        className="sidepanel-goto"
        onClick={() =>
          dispatch(
            gotoRequested({
              label: marker.name ?? 'Marker',
              target: { markerId: marker.id, areaId: marker.areaId },
            }),
          )
        }
      >
        Goto — hinzoomen
      </button>

      <Section title="Encounter">
        <Chips
          items={marker.encounterIds
            .filter((id) => game.encounters[id])
            .map((id) => ({ id, label: game.encounters[id].name, peek: 'encounter' as const }))}
          onRemove={(id) =>
            update({ encounterIds: marker.encounterIds.filter((x) => x !== id) })
          }
          emptyText="Keine Encounter verknüpft."
        />
        <LinkAdder
          placeholder="Encounter verknüpfen …"
          options={Object.values(game.encounters)
            .filter((e) => !marker.encounterIds.includes(e.id) && e.state !== 'completed')
            .map((e) => ({ id: e.id, label: e.markerId ? e.name : `${e.name} (Pool)` }))}
          onAdd={linkEncounter}
        />
      </Section>

      <Section title="NSCs">
        <Chips
          items={marker.npcIds
            .filter((id) => game.npcs[id])
            .map((id) => ({ id, label: game.npcs[id].name, peek: 'npc' as const }))}
          onRemove={(id) => update({ npcIds: marker.npcIds.filter((x) => x !== id) })}
          emptyText="Keine NSCs verknüpft."
        />
        <LinkAdder
          placeholder="NSC verknüpfen …"
          options={Object.values(game.npcs)
            .filter((n) => !marker.npcIds.includes(n.id))
            .map((n) => ({ id: n.id, label: n.name }))}
          onAdd={(id) => update({ npcIds: [...marker.npcIds, id] })}
        />
      </Section>

      <Section title="Quests">
        <Chips
          items={marker.questIds
            .filter((id) => game.quests[id])
            .map((id) => ({ id, label: game.quests[id].name, peek: 'quest' as const }))}
          onRemove={(id) => update({ questIds: marker.questIds.filter((x) => x !== id) })}
          emptyText="Keine Quests verknüpft."
        />
        <LinkAdder
          placeholder="Quest verknüpfen …"
          options={Object.values(game.quests)
            .filter((q) => !marker.questIds.includes(q.id))
            .map((q) => ({ id: q.id, label: q.name }))}
          onAdd={(id) => update({ questIds: [...marker.questIds, id] })}
        />
      </Section>

      <Section title="Letzte Ereignisse">
        {events.length === 0 && <p className="muted">Keine Einträge.</p>}
        <ul className="event-list">
          {events.map((e) => (
            <li key={e.id}>
              <span>{describeEvent(e)}</span>
              <span className="muted"> — {formatGameTime(e.gameTime)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
