/**
 * History-Zeitregler (§3.4): durch die Vergangenheit blättern — zwei Modi,
 * nach Spielwelt-Tag (Schieberegler) oder nach Session (Auswahl). Beides sind
 * nur Sichten auf denselben Event-Log; die Karte zeigt dann den Stand von
 * damals, schreibgeschützt. Dazu: globales Undo per Korrektur-Event.
 */

import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { historyExited } from '../features/game/gameSlice';
import { undoLastEvent, viewHistory } from '../features/game/thunks';

export function HistoryBar({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s.game.state);
  const historyLabel = useAppSelector((s) => s.game.historyLabel);
  const [mode, setMode] = useState<'day' | 'session'>('day');
  const [day, setDay] = useState<number | null>(null);
  if (!state) return null;

  const currentDay = state.campaign.clock.day;
  const sessions = Object.values(state.sessions).filter((s) => s.endedAt);
  const shownDay = day ?? currentDay;

  const exit = () => {
    dispatch(historyExited());
    setDay(null);
  };

  return (
    <div className="history-bar">
      <div className="segmented history-modes">
        <button className={mode === 'day' ? 'active' : ''} onClick={() => setMode('day')}>
          Tag
        </button>
        <button
          className={mode === 'session' ? 'active' : ''}
          onClick={() => setMode('session')}
          disabled={sessions.length === 0}
          title={sessions.length === 0 ? 'Noch keine beendete Session' : undefined}
        >
          Session
        </button>
      </div>

      {mode === 'day' ? (
        <div className="history-slider">
          <input
            type="range"
            min={1}
            max={currentDay}
            value={shownDay}
            disabled={currentDay <= 1}
            onChange={(e) => {
              const d = Number(e.target.value);
              setDay(d);
              void dispatch(viewHistory({ mode: 'day', day: d }));
            }}
          />
          <span className="history-label">
            {historyLabel ? `Stand: ${historyLabel}` : `Tag ${shownDay} (heute)`}
          </span>
        </div>
      ) : (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) {
              void dispatch(viewHistory({ mode: 'session', sessionId: e.target.value }));
            }
          }}
        >
          <option value="">{historyLabel ? `Stand: ${historyLabel}` : 'Session wählen …'}</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name ?? 'Session'} — {new Date(s.startedAt).toLocaleDateString('de-DE')}
            </option>
          ))}
        </select>
      )}

      <button
        onClick={() =>
          void dispatch(undoLastEvent({ scope: 'all', reason: 'Globales Undo' }))
        }
        title="Letztes Ereignis per Korrektur-Event zurücknehmen"
      >
        ⎌ Undo
      </button>
      <button
        onClick={() => {
          exit();
          onClose();
        }}
      >
        Schließen
      </button>
    </div>
  );
}
