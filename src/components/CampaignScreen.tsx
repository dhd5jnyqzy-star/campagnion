/**
 * Kampagnen-Ansicht (M2–M4): Kopfleiste mit Session-Steuerung und Spielwelt-
 * Uhr (§3.4), Canvas mit dem aktuellen Bereich, Zurück-Leiste (§4.3), Toolbar,
 * Bibliothek (§4.1), Sidepanel (§4.2), Kampfmodus (§4.4) und History-
 * Zeitregler. Im History-Modus ist die Karte schreibgeschützt — alle
 * Bearbeitungsflächen verschwinden, ein Banner zeigt den Zeitpunkt.
 */

import { useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { CanvasView, WORLD_W } from '../features/canvas/CanvasView';
import { useAssetUrl } from '../features/canvas/useAssetUrl';
import { campaignClosed, historyExited } from '../features/game/gameSlice';
import { selectCurrentArea, selectPrimaryMapImage } from '../features/game/selectors';
import {
  appendGameEvent,
  endSession,
  importMapImage,
  type NewGameEvent,
} from '../features/game/thunks';
import {
  dockToggled,
  gridToggled,
  jumpedBackTo,
  overviewRequested,
  placingChanged,
  type PlacingMode,
} from '../features/nav/navSlice';
import { formatGameTime } from '../lib/gameTime';
import { newId } from '../lib/ids';
import { closeCurrentStore } from '../persistence/db';
import type { Area, GameState, GameTime, TimeOfDay } from '../types';
import { CombatScreen } from './CombatScreen';
import { Dock } from './Dock';
import { DrawnCardOverlay } from './DrawnCardOverlay';
import { ExchangeMenu } from './ExchangeMenu';
import { HistoryBar } from './HistoryBar';
import { Sidepanel } from './Sidepanel';

const TIME_ORDER: readonly TimeOfDay[] = ['morning', 'noon', 'evening', 'night'];

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

function placingHint(placing: PlacingMode, subjectName?: string): string {
  switch (placing?.kind) {
    case 'marker':
      return 'Tippen, um einen Marker zu setzen';
    case 'area':
      return 'Tippen, um einen neuen Bereich zu platzieren';
    case 'encounter':
      return `Tippen, um "${subjectName ?? 'Encounter'}" einzuspeisen`;
    case 'group':
      return `Tippen, um "${subjectName ?? 'Gruppe'}" zu positionieren`;
    case 'handout':
      return `Tippen, um "${subjectName ?? 'Handout'}" abzulegen`;
    case 'deck':
      return `Tippen, um "${subjectName ?? 'Deck'}" abzulegen`;
    default:
      return '';
  }
}

function placingSubject(placing: PlacingMode, state: GameState): string | undefined {
  switch (placing?.kind) {
    case 'encounter':
      return state.encounters[placing.encounterId]?.name;
    case 'group':
      return state.groups[placing.groupId]?.name;
    case 'handout':
      return state.handouts[placing.handoutId]?.title;
    case 'deck':
      return state.decks[placing.deckId]?.name;
    default:
      return undefined;
  }
}

export function CampaignScreen() {
  const dispatch = useAppDispatch();
  const liveState = useAppSelector((s) => s.game.state);
  const historyState = useAppSelector((s) => s.game.historyState);
  const historyLabel = useAppSelector((s) => s.game.historyLabel);
  const error = useAppSelector((s) => s.game.error);
  const stack = useAppSelector((s) => s.nav.stack);
  const currentAreaId = useAppSelector((s) => s.nav.currentAreaId);
  const gridVisible = useAppSelector((s) => s.nav.gridVisible);
  const placing = useAppSelector((s) => s.nav.placing);
  const dockOpen = useAppSelector((s) => s.nav.dockOpen);
  const combatEncounterId = useAppSelector((s) => s.nav.combatEncounterId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  if (!liveState) return null;
  const inHistory = historyState !== null;
  // Karte & Bereiche rendern aus der Vergangenheits-Sicht, falls aktiv (§3.4).
  const state = historyState ?? liveState;
  const clock = liveState.campaign.clock;
  const activeSession = liveState.activeSessionId
    ? liveState.sessions[liveState.activeSessionId]
    : null;

  const area = selectCurrentArea(state, currentAreaId);
  const mapImage = area ? selectPrimaryMapImage(state, area.id) : undefined;
  const asset = mapImage ? state.assets[mapImage.assetId] : undefined;

  const hint = placingHint(placing, placingSubject(placing, liveState));

  const startSession = () => {
    const count = Object.keys(liveState.sessions).length;
    void dispatch(
      appendGameEvent({
        type: 'session.started',
        payload: { sessionId: newId(), name: `Session ${count + 1}` },
      }),
    );
  };

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
        <h1 className="topbar-title">{liveState.campaign.name}</h1>
        {activeSession ? (
          <button
            className="topbar-session active"
            title="Session beenden (legt einen Sicherungspunkt an)"
            onClick={() => void dispatch(endSession())}
          >
            ■ {activeSession.name}
          </button>
        ) : (
          <button className="topbar-session" onClick={startSession} disabled={inHistory}>
            ▶ Session
          </button>
        )}
        <button
          className={dockOpen ? 'topbar-dock active' : 'topbar-dock'}
          onClick={() => dispatch(dockToggled())}
          disabled={inHistory}
        >
          Bibliothek
        </button>
        <button
          className="topbar-clock"
          title="Spielwelt-Uhr weiterstellen"
          disabled={inHistory}
          onClick={() => void dispatch(appendGameEvent(advanceClockEvent(clock)))}
        >
          {formatGameTime(clock)} ▸
        </button>
        {!inHistory && <ExchangeMenu />}
      </header>

      {error && <p className="error banner-error">{error}</p>}
      {inHistory && (
        <div className="history-banner">
          <span>🕰 Vergangenheit — {historyLabel}</span>
          <button onClick={() => dispatch(historyExited())}>Zur Gegenwart</button>
        </div>
      )}

      <main className="stage">
        {area && mapImage && asset ? (
          <MapStage
            area={area}
            mapImage={mapImage}
            assetWidth={asset.width}
            assetHeight={asset.height}
          />
        ) : (
          <div className="canvas-placeholder">
            <p>
              {area
                ? `"${area.name}" hat noch keine Karte.`
                : 'Noch keine Karte in dieser Kampagne.'}
            </p>
            {!inHistory && (
              <button onClick={() => fileInputRef.current?.click()}>Karte importieren</button>
            )}
          </div>
        )}

        <div className="backbar">
          <button onClick={() => dispatch(overviewRequested())}>‹ Übersicht</button>
          {stack.slice(0, -1).map((entry, i) => (
            <button key={i} onClick={() => dispatch(jumpedBackTo(i))}>
              ‹ {entry.label}
            </button>
          ))}
          {stack.length > 0 && (
            <span className="backbar-current">{stack[stack.length - 1].label}</span>
          )}
        </div>

        {hint && !inHistory && (
          <div className="placing-bar">
            <span>{hint}</span>
            <button onClick={() => dispatch(placingChanged(null))}>Abbrechen</button>
          </div>
        )}

        {mapImage && (
          <div className="toolbar">
            {!inHistory && (
              <>
                <button
                  title="Kartenbild deckungsgleich tauschen"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Karte tauschen
                </button>
                <button
                  className={placing?.kind === 'marker' ? 'active' : ''}
                  onClick={() =>
                    dispatch(
                      placingChanged(placing?.kind === 'marker' ? null : { kind: 'marker' }),
                    )
                  }
                >
                  + Marker
                </button>
                <button
                  className={placing?.kind === 'area' ? 'active' : ''}
                  onClick={() =>
                    dispatch(placingChanged(placing?.kind === 'area' ? null : { kind: 'area' }))
                  }
                >
                  + Bereich
                </button>
              </>
            )}
            <button className={gridVisible ? 'active' : ''} onClick={() => dispatch(gridToggled())}>
              Raster
            </button>
            <button
              className={historyOpen || inHistory ? 'active' : ''}
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              Verlauf
            </button>
          </div>
        )}

        {historyOpen && <HistoryBar onClose={() => setHistoryOpen(false)} />}
        {dockOpen && !inHistory && <Dock />}
        {!inHistory && <Sidepanel />}
      </main>

      {combatEncounterId && !inHistory && <CombatScreen encounterId={combatEncounterId} />}
      <DrawnCardOverlay />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void dispatch(importMapImage({ file, areaId: area?.id }));
        }}
      />
    </div>
  );
}

/** Trennt das Laden der Blob-URL vom Canvas, damit Hooks stabil bleiben. */
function MapStage({
  area,
  mapImage,
  assetWidth,
  assetHeight,
}: {
  area: Area;
  mapImage: import('../types').MapImage;
  assetWidth: number | undefined;
  assetHeight: number | undefined;
}) {
  const imageUrl = useAssetUrl(mapImage.assetId);
  const worldH = assetWidth && assetHeight ? WORLD_W * (assetHeight / assetWidth) : WORLD_W;
  return <CanvasView area={area} mapImage={mapImage} imageUrl={imageUrl} worldH={worldH} />;
}
