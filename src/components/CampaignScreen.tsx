/**
 * Kampagnen-Ansicht (M2): Kopfleiste mit Spielwelt-Uhr (§3.4), darunter das
 * Canvas mit Karte, Markern und Grid — plus Zurück-Leiste (Navigationsstack,
 * §4.3), Toolbar (Karte importieren, Raster, Marker setzen) und Sidepanel.
 */

import { useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { CanvasView, WORLD_W } from '../features/canvas/CanvasView';
import { useAssetUrl } from '../features/canvas/useAssetUrl';
import { campaignClosed } from '../features/game/gameSlice';
import { selectPrimaryMapImage, selectRootArea } from '../features/game/selectors';
import { appendGameEvent, importMapImage, type NewGameEvent } from '../features/game/thunks';
import {
  gridToggled,
  jumpedBackTo,
  markerPlacementToggled,
  overviewRequested,
} from '../features/nav/navSlice';
import { formatGameTime } from '../lib/gameTime';
import { closeCurrentStore } from '../persistence/db';
import type { GameTime, TimeOfDay } from '../types';
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

export function CampaignScreen() {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s.game.state);
  const error = useAppSelector((s) => s.game.error);
  const stack = useAppSelector((s) => s.nav.stack);
  const gridVisible = useAppSelector((s) => s.nav.gridVisible);
  const placingMarker = useAppSelector((s) => s.nav.placingMarker);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!state) return null;
  const clock = state.campaign.clock;

  const rootArea = selectRootArea(state);
  const mapImage = rootArea ? selectPrimaryMapImage(state, rootArea.id) : undefined;
  const asset = mapImage ? state.assets[mapImage.assetId] : undefined;

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
          {formatGameTime(clock)} ▸
        </button>
      </header>

      {error && <p className="error banner-error">{error}</p>}

      <main className="stage">
        {mapImage && asset ? (
          <MapStage mapImage={mapImage} assetWidth={asset.width} assetHeight={asset.height} />
        ) : (
          <div className="canvas-placeholder">
            <p>Noch keine Karte in dieser Kampagne.</p>
            <button onClick={() => fileInputRef.current?.click()}>Karte importieren</button>
          </div>
        )}

        {mapImage && (
          <>
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

            <div className="toolbar">
              <button
                title="Kartenbild deckungsgleich tauschen"
                onClick={() => fileInputRef.current?.click()}
              >
                Karte tauschen
              </button>
              <button
                className={gridVisible ? 'active' : ''}
                onClick={() => dispatch(gridToggled())}
              >
                Raster
              </button>
              <button
                className={placingMarker ? 'active' : ''}
                onClick={() => dispatch(markerPlacementToggled())}
              >
                {placingMarker ? 'Tippen zum Setzen …' : '+ Marker'}
              </button>
            </div>
          </>
        )}

        <Sidepanel />
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void dispatch(importMapImage(file));
        }}
      />
    </div>
  );
}

/** Trennt das Laden der Blob-URL vom Canvas, damit Hooks stabil bleiben. */
function MapStage({
  mapImage,
  assetWidth,
  assetHeight,
}: {
  mapImage: import('../types').MapImage;
  assetWidth: number | undefined;
  assetHeight: number | undefined;
}) {
  const imageUrl = useAssetUrl(mapImage.assetId);
  const worldH =
    assetWidth && assetHeight ? WORLD_W * (assetHeight / assetWidth) : WORLD_W;
  return <CanvasView mapImage={mapImage} imageUrl={imageUrl} worldH={worldH} />;
}
