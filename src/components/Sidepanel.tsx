/**
 * Generisches Sidepanel (Peek, §4.2): Detailansicht der angetippten Entität,
 * ohne den Viewport zu verändern. In M2 gibt es Marker; Encounter, NPCs,
 * Quests und Gruppen docken in M3 an dieselbe Stelle an.
 *
 * "Goto" springt animiert hin und landet im Navigationsstack — das Peeken
 * selbst nicht (§3.2).
 */

import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { describeEvent } from '../features/game/describeEvent';
import { selectPrimaryMapImage } from '../features/game/selectors';
import { appendGameEvent } from '../features/game/thunks';
import { gotoRequested, peekClosed } from '../features/nav/navSlice';
import { formatGameTime } from '../lib/gameTime';
import { gridRefLabel, normalizedToGridRef } from '../lib/grid';
import { getCurrentStore } from '../persistence/db';
import type { GameEvent, Marker, MarkerType } from '../types';

const TYPE_LABELS: Record<MarkerType, string> = {
  location: 'Ort',
  encounter: 'Encounter',
  npc: 'NSC',
  quest: 'Quest',
  note: 'Notiz',
};

export function Sidepanel() {
  const peek = useAppSelector((s) => s.nav.peek);
  const marker = useAppSelector((s) =>
    peek?.kind === 'marker' ? s.game.state?.markers[peek.id] : undefined,
  );
  if (!peek || !marker) return null;
  return <MarkerPeek key={marker.id} marker={marker} />;
}

/** Betrifft dieses Event den Marker? (für "Letzte Ereignisse") */
function concernsMarker(e: GameEvent, markerId: string): boolean {
  switch (e.type) {
    case 'marker.created':
      return e.payload.marker.id === markerId;
    case 'marker.moved':
    case 'marker.updated':
      return e.payload.markerId === markerId;
    case 'encounter.placed':
      return e.payload.markerId === markerId;
    default:
      return false;
  }
}

function MarkerPeek({ marker }: { marker: Marker }) {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game.state);
  const lastSeq = useAppSelector((s) => s.game.lastSeq);
  const [name, setName] = useState(marker.name ?? '');
  const [events, setEvents] = useState<GameEvent[]>([]);

  // Letzte Ereignisse zum Marker — direkt aus dem Log (Event-Sourcing zahlt sich aus).
  useEffect(() => {
    let cancelled = false;
    void getCurrentStore()
      .getEventsAfter(0)
      .then((stored) => {
        if (cancelled) return;
        const relevant = stored
          .map((s) => s.event)
          .filter((e) => concernsMarker(e, marker.id));
        setEvents(relevant.slice(-5).reverse());
      });
    return () => {
      cancelled = true;
    };
  }, [marker.id, lastSeq]);

  const area = game?.areas[marker.areaId];
  const mapImage = game
    ? (marker.mapImageId ? game.mapImages[marker.mapImageId] : undefined) ??
      selectPrimaryMapImage(game, marker.areaId)
    : undefined;
  const gridLabel = mapImage?.grid
    ? gridRefLabel(normalizedToGridRef(marker.position, mapImage.grid))
    : null;

  const commitName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== marker.name) {
      void dispatch(
        appendGameEvent({
          type: 'marker.updated',
          payload: { markerId: marker.id, changes: { name: trimmed } },
        }),
      );
    } else {
      setName(marker.name ?? '');
    }
  };

  return (
    <aside className="sidepanel">
      <div className="sidepanel-head">
        <input
          className="sidepanel-title"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-label="Markername"
        />
        <button className="sidepanel-close" onClick={() => dispatch(peekClosed())}>
          ✕
        </button>
      </div>

      <div className="sidepanel-meta">
        <label>
          Typ
          <select
            value={marker.type}
            onChange={(e) =>
              void dispatch(
                appendGameEvent({
                  type: 'marker.updated',
                  payload: {
                    markerId: marker.id,
                    changes: { type: e.target.value as MarkerType },
                  },
                }),
              )
            }
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
              target: { markerId: marker.id },
            }),
          )
        }
      >
        Goto — hinzoomen
      </button>

      <div className="sidepanel-section">
        <h3>Verknüpfungen</h3>
        <p className="muted">
          {marker.encounterIds.length} Encounter · {marker.npcIds.length} NSCs ·{' '}
          {marker.questIds.length} Quests (ab M3 verknüpfbar)
        </p>
      </div>

      <div className="sidepanel-section">
        <h3>Letzte Ereignisse</h3>
        {events.length === 0 && <p className="muted">Keine Einträge.</p>}
        <ul className="event-list">
          {events.map((e) => (
            <li key={e.id}>
              <span>{describeEvent(e)}</span>
              <span className="muted"> — {formatGameTime(e.gameTime)}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
