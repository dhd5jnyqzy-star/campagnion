/**
 * Kampagnen-Ansicht (M2/M3): Kopfleiste mit Spielwelt-Uhr (§3.4), Canvas mit
 * dem aktuellen Bereich, Zurück-Leiste (Navigationsstack, §4.3), Toolbar,
 * Bibliotheks-Panel (§4.1, einklappbar) und Sidepanel (§4.2).
 */

import { useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { CanvasView, WORLD_W } from '../features/canvas/CanvasView';
import { useAssetUrl } from '../features/canvas/useAssetUrl';
import { campaignClosed } from '../features/game/gameSlice';
import { selectCurrentArea, selectPrimaryMapImage } from '../features/game/selectors';
import { appendGameEvent, importMapImage, type NewGameEvent } from '../features/game/thunks';
import {
  dockToggled,
  gridToggled,
  jumpedBackTo,
  overviewRequested,
  placingChanged,
  type PlacingMode,
} from '../features/nav/navSlice';
import { formatGameTime } from '../lib/gameTime';
import { closeCurrentStore } from '../persistence/db';
import type { Area, GameTime, TimeOfDay } from '../types';
import { Dock } from './Dock';
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

function placingHint(placing: PlacingMode, encounterName?: string, groupName?: string): string {
  switch (placing?.kind) {
    case 'marker':
      return 'Tippen, um einen Marker zu setzen';
    case 'area':
      return 'Tippen, um einen neuen Bereich zu platzieren';
    case 'encounter':
      return `Tippen, um "${encounterName ?? 'Encounter'}" einzuspeisen`;
    case 'group':
      return `Tippen, um "${groupName ?? 'Gruppe'}" zu positionieren`;
    default:
      return '';
  }
}

export function CampaignScreen() {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s.game.state);
  const error = useAppSelector((s) => s.game.error);
  const stack = useAppSelector((s) => s.nav.stack);
  const currentAreaId = useAppSelector((s) => s.nav.currentAreaId);
  const gridVisible = useAppSelector((s) => s.nav.gridVisible);
  const placing = useAppSelector((s) => s.nav.placing);
  const dockOpen = useAppSelector((s) => s.nav.dockOpen);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!state) return null;
  const clock = state.campaign.clock;

  const area = selectCurrentArea(state, currentAreaId);
  const mapImage = area ? selectPrimaryMapImage(state, area.id) : undefined;
  const asset = mapImage ? state.assets[mapImage.assetId] : undefined;

  const hint = placingHint(
    placing,
    placing?.kind === 'encounter' ? state.encounters[placing.encounterId]?.name : undefined,
    placing?.kind === 'group' ? state.groups[placing.groupId]?.name : undefined,
  );

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
          className={dockOpen ? 'topbar-dock active' : 'topbar-dock'}
          onClick={() => dispatch(dockToggled())}
        >
          Bibliothek
        </button>
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
        {area && mapImage && asset ? (
          <MapStage area={area} mapImage={mapImage} assetWidth={asset.width} assetHeight={asset.height} />
        ) : (
          <div className="canvas-placeholder">
            <p>{area ? `"${area.name}" hat noch keine Karte.` : 'Noch keine Karte in dieser Kampagne.'}</p>
            <button onClick={() => fileInputRef.current?.click()}>Karte importieren</button>
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

        {hint && (
          <div className="placing-bar">
            <span>{hint}</span>
            <button onClick={() => dispatch(placingChanged(null))}>Abbrechen</button>
          </div>
        )}

        {mapImage && (
          <div className="toolbar">
            <button
              title="Kartenbild deckungsgleich tauschen"
              onClick={() => fileInputRef.current?.click()}
            >
              Karte tauschen
            </button>
            <button className={gridVisible ? 'active' : ''} onClick={() => dispatch(gridToggled())}>
              Raster
            </button>
            <button
              className={placing?.kind === 'marker' ? 'active' : ''}
              onClick={() =>
                dispatch(placingChanged(placing?.kind === 'marker' ? null : { kind: 'marker' }))
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
          </div>
        )}

        {dockOpen && <Dock />}
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
