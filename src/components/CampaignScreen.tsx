/**
 * Kampagnen-Ansicht (M1): Kopfleiste mit Spielwelt-Uhr (§3.4) und Platzhalter
 * für das Canvas (M2). Der Weiter-Button der Uhr ist bereits der echte
 * Event-Sourcing-Pfad: Tipp → Event → IndexedDB → Replay in den State.
 */

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { campaignClosed } from '../features/game/gameSlice';
import { appendGameEvent, type NewGameEvent } from '../features/game/thunks';
import { closeCurrentStore } from '../persistence/db';
import type { GameTime, TimeOfDay } from '../types';

const TIME_ORDER: readonly TimeOfDay[] = ['morning', 'noon', 'evening', 'night'];

export const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: 'morgens',
  noon: 'mittags',
  evening: 'abends',
  night: 'nachts',
};

/** Nächster Schritt der Uhr: Tageszeit weiter, nach "nachts" beginnt der nächste Tag. */
function advanceClockEvent(clock: GameTime): NewGameEvent {
  const i = TIME_ORDER.indexOf(clock.timeOfDay);
  if (i === TIME_ORDER.length - 1) {
    return {
      type: 'world.dayAdvanced',
      payload: { to: { day: clock.day + 1, timeOfDay: 'morning' } },
    };
  }
  return { type: 'world.timeOfDayChanged', payload: { to: TIME_ORDER[i + 1] } };
}

export function CampaignScreen() {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s.game.state);
  const lastSeq = useAppSelector((s) => s.game.lastSeq);

  if (!state) return null;
  const clock = state.campaign.clock;

  return (
    <div className="campaign">
      <header className="topbar">
        <button
          className="topbar-back"
          onClick={() => {
            closeCurrentStore();
            dispatch(campaignClosed());
          }}
        >
          ‹ Kampagnen
        </button>
        <h1 className="topbar-title">{state.campaign.name}</h1>
        <button
          className="topbar-clock"
          title="Spielwelt-Uhr weiterstellen"
          onClick={() => void dispatch(appendGameEvent(advanceClockEvent(clock)))}
        >
          Tag {clock.day}, {TIME_LABELS[clock.timeOfDay]} ▸
        </button>
      </header>

      <main className="canvas-placeholder">
        <p>Hier entsteht das Canvas (M2).</p>
        <p className="muted">{lastSeq} Events im Log — jede Änderung ist sofort persistiert.</p>
      </main>
    </div>
  );
}
