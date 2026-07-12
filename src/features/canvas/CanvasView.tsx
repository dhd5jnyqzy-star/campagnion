/**
 * SVG-Canvas (M2/M3, §4.1): Pan/Zoom-Fläche mit Kartenbild, Markern,
 * Grid-Overlay, Kind-Bereichs-Zonen (semantisches Zoomen) und Reiselinien.
 *
 * Gesten (Pointer Events, touch-action: none — §2 Zielgerät-Warnung):
 * - 1 Finger / Maus ziehen: Pan · 2 Finger: Pinch-Zoom · Mausrad: Zoom
 * - Tipp auf Marker/Zone: Peek bzw. Bereich betreten; Marker ziehen: verschieben
 * - Tipp auf freie Fläche: Peek schließen — oder platzieren, wenn ein
 *   Platzier-Modus aktiv ist (Marker, Bereich, Encounter aus dem Pool,
 *   Gruppen-Wegpunkt)
 *
 * Semantisches Zoomen (§4.1): Kind-Bereiche erscheinen unterhalb ihres
 * Zoomschwellwerts als verdichtetes Badge (konfigurierbar, §3.3) und blättern
 * sich darüber zur Zone mit eigener Karte auf; Tipp betritt den Bereich.
 */

import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { newId } from '../../lib/ids';
import { columnLabel, gridRefLabel, normalizedToGridRef } from '../../lib/grid';
import { loadViewport, saveViewport } from '../../lib/navPersistence';
import type { Area, GridConfig, MapImage, Marker, MarkerType } from '../../types';
import { appendGameEvent, placeEncounter } from '../game/thunks';
import {
  selectAreaStats,
  selectChildAreas,
  selectMarkersOnMap,
  selectPrimaryMapImage,
} from '../game/selectors';
import {
  gotoRequested,
  peeked,
  peekClosed,
  placingChanged,
  viewportCommitted,
  type NavTarget,
  type Viewport,
} from '../nav/navSlice';
import { useAssetUrl } from './useAssetUrl';

/** Weltbreite der Karte in Welteinheiten; Höhe folgt dem Seitenverhältnis. */
export const WORLD_W = 1000;

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 40;
/** Bewegungen unter dieser Schwelle (Bildschirm-px) gelten als Tipp. */
const TAP_SLOP = 8;
const FLY_MS = 450;

const MARKER_COLORS: Record<MarkerType, string> = {
  location: '#6ea8fe',
  encounter: '#ff7b72',
  npc: '#7ee787',
  quest: '#e3b341',
  note: '#9aa4b2',
};

interface Size {
  w: number;
  h: number;
}

interface Point {
  x: number;
  y: number;
}

function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** setPointerCapture kann bei bereits beendeten/synthetischen Pointern werfen — dann ohne Capture weiter. */
function capturePointer(el: Element, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* Gesten funktionieren auch ohne Capture, nur weniger robust am Rand. */
  }
}

interface Props {
  area: Area;
  mapImage: MapImage;
  imageUrl: string | undefined;
  worldH: number;
}

export function CanvasView({ area, mapImage, imageUrl, worldH }: Props) {
  const dispatch = useAppDispatch();
  const campaignId = useAppSelector((s) => s.game.campaignId);
  // History-Zeitregler (§3.4): aktive Vergangenheits-Sicht rendern, dann read-only.
  const game = useAppSelector((s) => s.game.historyState ?? s.game.state);
  const readOnly = useAppSelector((s) => s.game.historyState !== null);
  const flyTo = useAppSelector((s) => s.nav.flyTo);
  const gridVisible = useAppSelector((s) => s.nav.gridVisible);
  const placing = useAppSelector((s) => s.nav.placing);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const [view, setView] = useState<Viewport | null>(null);
  const viewRef = useRef(view);
  const updateView = (v: Viewport) => {
    viewRef.current = v;
    setView(v);
  };

  // --- Geometrie ---------------------------------------------------------

  const localPoint = (e: { clientX: number; clientY: number }): Point => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : { x: 0, y: 0 };
  };

  const screenToWorld = (p: Point, v: Viewport): Point => ({
    x: v.cx + (p.x - sizeRef.current.w / 2) / v.zoom,
    y: v.cy + (p.y - sizeRef.current.h / 2) / v.zoom,
  });

  const fitView = (): Viewport => {
    const { w, h } = sizeRef.current;
    const zoom = clampZoom(Math.min(w / WORLD_W, h / worldH) * 0.92 || 1);
    return { cx: WORLD_W / 2, cy: worldH / 2, zoom };
  };

  const pan = (v: Viewport, dx: number, dy: number): Viewport => ({
    ...v,
    cx: v.cx - dx / v.zoom,
    cy: v.cy - dy / v.zoom,
  });

  /** Zoom um einen Bildschirmpunkt: der Weltpunkt darunter bleibt fixiert. */
  const zoomAround = (v: Viewport, factor: number, p: Point): Viewport => {
    const zoom = clampZoom(v.zoom * factor);
    const w = screenToWorld(p, v);
    const { w: cw, h: ch } = sizeRef.current;
    return {
      zoom,
      cx: w.x - (p.x - cw / 2) / zoom,
      cy: w.y - (p.y - ch / 2) / zoom,
    };
  };

  // --- Containergröße & Initial-Viewport ---------------------------------

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      setSize((prev) => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        return prev.w === w && prev.h === h ? prev : { w, h };
      });
    };
    // Sofort messen (ResizeObserver ist nicht überall zuverlässig), dann beobachten.
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Initial-Viewport pro Bereich: zuletzt gesehener Ausschnitt oder Fit (§3.2).
  const initializedFor = useRef<string | null>(null);
  useEffect(() => {
    if (size.w === 0 || !campaignId) return;
    if (initializedFor.current === area.id) return;
    initializedFor.current = area.id;
    updateView(loadViewport(campaignId, area.id) ?? fitView());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, campaignId, area.id]);

  const commitView = () => {
    const v = viewRef.current;
    if (!v || !campaignId) return;
    dispatch(viewportCommitted(v));
    saveViewport(campaignId, area.id, v);
  };

  // --- Fly-To (Goto/Zurück-Leiste, §4.2/§4.3) ----------------------------

  const animRef = useRef<number | null>(null);
  const flyWatchdog = useRef<number | null>(null);
  const lastFlyNonce = useRef(0);

  const cancelFly = () => {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current);
    animRef.current = null;
    if (flyWatchdog.current !== null) clearTimeout(flyWatchdog.current);
    flyWatchdog.current = null;
  };

  const resolveTarget = (target: NavTarget): Viewport | null => {
    if (target === 'fit') return fitView();
    if ('markerId' in target) {
      const marker = game?.markers[target.markerId];
      if (!marker) return null;
      const zoom = clampZoom(Math.max(viewRef.current?.zoom ?? 1, fitView().zoom * 4));
      return { cx: marker.position.x * WORLD_W, cy: marker.position.y * worldH, zoom };
    }
    if ('areaId' in target) return fitView(); // Bereich betreten: ganze Karte
    return target;
  };

  useEffect(() => {
    if (!flyTo || flyTo.nonce === lastFlyNonce.current || size.w === 0) return;
    lastFlyNonce.current = flyTo.nonce;
    const from = viewRef.current;
    const to = resolveTarget(flyTo.target);
    if (!from || !to) return;
    cancelFly();
    const start = performance.now();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cancelFly();
      updateView(to);
      commitView();
    };
    const tick = (now: number) => {
      if (done) return;
      const t = Math.min(1, (now - start) / FLY_MS);
      const k = 1 - Math.pow(1 - t, 3); // ease-out cubic
      if (t >= 1) {
        finish();
        return;
      }
      updateView({
        cx: from.cx + (to.cx - from.cx) * k,
        cy: from.cy + (to.cy - from.cy) * k,
        zoom: from.zoom * Math.pow(to.zoom / from.zoom, k),
      });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    // Kommen keine Frames (gedrosselter/verdeckter Renderer), trotzdem ankommen:
    flyWatchdog.current = window.setTimeout(finish, FLY_MS + 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo, size]);

  useEffect(() => cancelFly, []);

  // --- Pan/Pinch-Gesten ---------------------------------------------------

  const pointers = useRef(new Map<number, Point>());
  const gestureRef = useRef<{
    moved: boolean;
    downAt: Point | null;
    panLast: Point | null;
    pinchLast: { d: number; c: Point } | null;
  }>({ moved: false, downAt: null, panLast: null, pinchLast: null });
  /** Von einer Zone bei pointerup gesetzt; der SVG-Handler wertet es aus. */
  const zoneTapRef = useRef<Area | null>(null);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    cancelFly();
    if (svgRef.current) capturePointer(svgRef.current, e.pointerId);
    const p = localPoint(e);
    pointers.current.set(e.pointerId, p);
    const g = gestureRef.current;
    if (pointers.current.size === 1) {
      g.moved = false;
      g.downAt = p;
      g.panLast = p;
      g.pinchLast = null;
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      g.panLast = null;
      g.pinchLast = { d: dist(a, b), c: mid(a, b) };
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = localPoint(e);
    pointers.current.set(e.pointerId, p);
    const g = gestureRef.current;
    const v = viewRef.current;
    if (!v) return;

    if (g.pinchLast && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = dist(a, b);
      const c = mid(a, b);
      let next = pan(v, c.x - g.pinchLast.c.x, c.y - g.pinchLast.c.y);
      if (g.pinchLast.d > 0) next = zoomAround(next, d / g.pinchLast.d, c);
      g.pinchLast = { d, c };
      g.moved = true;
      updateView(next);
    } else if (g.panLast && pointers.current.size === 1) {
      const dx = p.x - g.panLast.x;
      const dy = p.y - g.panLast.y;
      g.panLast = p;
      if (g.downAt && dist(g.downAt, p) > TAP_SLOP) g.moved = true;
      if (g.moved) updateView(pan(v, dx, dy));
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    const p = localPoint(e);
    pointers.current.delete(e.pointerId);
    const g = gestureRef.current;

    if (pointers.current.size === 1) {
      // Von Pinch zurück zu Pan mit dem verbleibenden Finger.
      g.pinchLast = null;
      g.panLast = [...pointers.current.values()][0];
      zoneTapRef.current = null;
      return;
    }
    if (pointers.current.size > 0) return;

    const v = viewRef.current;
    const tappedZone = zoneTapRef.current;
    zoneTapRef.current = null;
    if (!g.moved && v && e.type !== 'pointercancel') {
      if (placing) {
        placeAt(screenToWorld(p, v));
      } else if (tappedZone) {
        // Tipp auf eine Zone: Bereich betreten (semantisches Zoomen, §4.1).
        dispatch(gotoRequested({ label: tappedZone.name, target: { areaId: tappedZone.id } }));
      } else {
        dispatch(peekClosed());
      }
    }
    g.panLast = null;
    g.pinchLast = null;
    commitView();
  };

  // Mausrad (Desktop-Datenpflege): nativer Listener, weil preventDefault nötig ist.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      if (!v) return;
      cancelFly();
      updateView(zoomAround(v, Math.exp(-e.deltaY * 0.0015), localPoint(e)));
      commitView();
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Platzieren (Marker, Bereich, Encounter, Gruppen-Wegpunkt) ----------

  const placeAt = (w: Point) => {
    if (!game || !placing || readOnly) return;
    const position = { x: clamp01(w.x / WORLD_W), y: clamp01(w.y / worldH) };

    switch (placing.kind) {
      case 'marker': {
        const name = mapImage.grid
          ? `Marker ${gridRefLabel(normalizedToGridRef(position, mapImage.grid))}`
          : 'Marker';
        const marker: Marker = {
          id: newId(),
          areaId: area.id,
          mapImageId: mapImage.id,
          position,
          type: 'location',
          name,
          encounterIds: [],
          npcIds: [],
          questIds: [],
        };
        void dispatch(appendGameEvent({ type: 'marker.created', payload: { marker } }));
        break;
      }
      case 'area': {
        // Zone zentriert am Tipp-Punkt, Standardgröße; Feinjustage im Panel.
        const child: Area = {
          id: newId(),
          name: 'Neuer Bereich',
          parentId: area.id,
          zoneOnParent: {
            x: clamp01(position.x - 0.09),
            y: clamp01(position.y - 0.07),
            width: 0.18,
            height: 0.14,
          },
          zoomThreshold: 1.5,
          badge: { showQuestMarkers: true, showEncounterCount: true, showText: false },
        };
        void dispatch(appendGameEvent({ type: 'area.created', payload: { area: child } }))
          .unwrap()
          .then(() => dispatch(peeked({ kind: 'area', id: child.id })));
        break;
      }
      case 'encounter':
        void dispatch(
          placeEncounter({
            encounterId: placing.encounterId,
            areaId: area.id,
            mapImageId: mapImage.id,
            position,
          }),
        );
        break;
      case 'group':
        void dispatch(
          appendGameEvent({
            type: 'group.moved',
            payload: {
              groupId: placing.groupId,
              waypoint: {
                areaId: area.id,
                mapImageId: mapImage.id,
                position,
                gameDay: game.campaign.clock.day,
              },
            },
          }),
        );
        break;
    }
    dispatch(placingChanged(null));
  };

  // --- Marker: ziehen & peeken --------------------------------------------

  const [dragPos, setDragPos] = useState<{ id: string; wx: number; wy: number } | null>(null);
  // Weltposition lebt in der Ref (Wahrheit für pointerup); dragPos-State ist nur fürs Rendern.
  const markerDrag = useRef<{
    id: string;
    pointerId: number;
    downAt: Point;
    moved: boolean;
    wx: number;
    wy: number;
  } | null>(null);

  const onMarkerPointerDown = (e: React.PointerEvent<SVGGElement>, m: Marker) => {
    if (placing || readOnly) return; // im Platzier-Modus zählt der Tipp als Kartenposition
    e.stopPropagation();
    cancelFly();
    capturePointer(e.currentTarget, e.pointerId);
    markerDrag.current = {
      id: m.id,
      pointerId: e.pointerId,
      downAt: localPoint(e),
      moved: false,
      wx: m.position.x * WORLD_W,
      wy: m.position.y * worldH,
    };
  };

  const onMarkerPointerMove = (e: React.PointerEvent<SVGGElement>) => {
    const d = markerDrag.current;
    const v = viewRef.current;
    if (!d || !v || e.pointerId !== d.pointerId) return;
    const p = localPoint(e);
    if (!d.moved && dist(d.downAt, p) <= TAP_SLOP) return;
    d.moved = true;
    const w = screenToWorld(p, v);
    d.wx = w.x;
    d.wy = w.y;
    setDragPos({ id: d.id, wx: w.x, wy: w.y });
  };

  const onMarkerPointerUp = (e: React.PointerEvent<SVGGElement>, m: Marker) => {
    const d = markerDrag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    markerDrag.current = null;
    e.stopPropagation();
    if (d.moved) {
      const position = { x: clamp01(d.wx / WORLD_W), y: clamp01(d.wy / worldH) };
      void dispatch(
        appendGameEvent({ type: 'marker.moved', payload: { markerId: m.id, position } }),
      );
    } else if (!d.moved && e.type !== 'pointercancel') {
      // Tipp: Peek im Sidepanel — verändert den Viewport nicht (§3.2).
      dispatch(peeked({ kind: 'marker', id: m.id }));
    }
    setDragPos(null);
  };

  // --- Rendering -----------------------------------------------------------

  const markers = game ? selectMarkersOnMap(game, area.id, mapImage.id, true) : [];
  const childAreas = game
    ? selectChildAreas(game, area.id).filter((a) => a.zoneOnParent)
    : [];
  const groups = game ? Object.values(game.groups) : [];

  const v = view ?? { cx: WORLD_W / 2, cy: worldH / 2, zoom: 1 };
  const viewBox = `${v.cx - size.w / 2 / v.zoom} ${v.cy - size.h / 2 / v.zoom} ${
    Math.max(1, size.w) / v.zoom
  } ${Math.max(1, size.h) / v.zoom}`;

  return (
    <div ref={containerRef} className="canvas-root">
      <svg
        ref={svgRef}
        className={placing ? 'canvas placing' : 'canvas'}
        viewBox={viewBox}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {imageUrl && (
          <image
            href={imageUrl}
            x={0}
            y={0}
            width={WORLD_W}
            height={worldH}
            preserveAspectRatio="none"
          />
        )}
        {gridVisible && mapImage.grid && <GridOverlay grid={mapImage.grid} w={WORLD_W} h={worldH} />}

        {childAreas.map((child) => (
          <AreaZone
            key={child.id}
            area={child}
            zoom={v.zoom}
            worldH={worldH}
            onTapStart={() => {
              zoneTapRef.current = child;
            }}
          />
        ))}

        {groups.map((g) => (
          <TravelLine key={g.id} waypoints={g.waypoints} areaId={area.id} zoom={v.zoom} worldH={worldH} />
        ))}

        {markers.map((m) => {
          const wx = dragPos?.id === m.id ? dragPos.wx : m.position.x * WORLD_W;
          const wy = dragPos?.id === m.id ? dragPos.wy : m.position.y * worldH;
          return (
            <g
              key={m.id}
              className="marker"
              transform={`translate(${wx} ${wy}) scale(${1 / v.zoom})`}
              onPointerDown={(e) => onMarkerPointerDown(e, m)}
              onPointerMove={onMarkerPointerMove}
              onPointerUp={(e) => onMarkerPointerUp(e, m)}
              onPointerCancel={(e) => onMarkerPointerUp(e, m)}
            >
              {/* großzügige unsichtbare Touch-Fläche (§4.5) */}
              <circle r={22} fill="transparent" />
              <circle r={11} fill={MARKER_COLORS[m.type]} stroke="#0f1115" strokeWidth={2.5} />
              {m.name && (
                <text y={30} textAnchor="middle" className="marker-label">
                  {m.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Zone eines Kind-Bereichs (§4.1): unterhalb des Zoomschwellwerts nur das
 * konfigurierte Badge, darüber "aufgeblättert" — Zonenrahmen mit eigener
 * Karte, falls vorhanden. Tipp betritt den Bereich (via zoneTapRef im Parent).
 */
function AreaZone({
  area,
  zoom,
  worldH,
  onTapStart,
}: {
  area: Area;
  zoom: number;
  worldH: number;
  onTapStart: () => void;
}) {
  const game = useAppSelector((s) => s.game.historyState ?? s.game.state);
  const zone = area.zoneOnParent;
  const childMap = game ? selectPrimaryMapImage(game, area.id) : undefined;
  const childMapUrl = useAssetUrl(childMap?.assetId);
  if (!zone || !game) return null;

  const x = zone.x * WORLD_W;
  const y = zone.y * worldH;
  const w = zone.width * WORLD_W;
  const h = zone.height * worldH;
  const unfolded = zoom >= area.zoomThreshold;
  const stats = selectAreaStats(game, area.id);
  const badgeLines: string[] = [];
  if (area.badge.showEncounterCount && stats.encounterCount > 0) {
    badgeLines.push(`${stats.encounterCount} Encounter`);
  }
  if (area.badge.showQuestMarkers && stats.openQuestCount > 0) {
    badgeLines.push(`${stats.openQuestCount} Quests`);
  }
  if (area.badge.showText && area.badge.text) badgeLines.push(area.badge.text);

  return (
    <g className="area-zone" onPointerUp={onTapStart}>
      {unfolded ? (
        <>
          {childMapUrl && (
            <image
              href={childMapUrl}
              x={x}
              y={y}
              width={w}
              height={h}
              preserveAspectRatio="none"
              opacity={0.95}
            />
          )}
          <rect x={x} y={y} width={w} height={h} className="zone-rect unfolded" />
          <g transform={`translate(${x} ${y}) scale(${1 / zoom})`}>
            <text x={8} y={18} className="zone-name">
              {area.name}
            </text>
          </g>
        </>
      ) : (
        <>
          <rect x={x} y={y} width={w} height={h} className="zone-rect" />
          <g transform={`translate(${x + w / 2} ${y + h / 2}) scale(${1 / zoom})`}>
            <BadgeChip name={area.name} lines={badgeLines} />
          </g>
        </>
      )}
    </g>
  );
}

/** Verdichtetes Badge (§3.3): Name + konfigurierte Zusatzinfos, screen-fixiert. */
function BadgeChip({ name, lines }: { name: string; lines: string[] }) {
  const width = Math.max(name.length, ...lines.map((l) => l.length), 8) * 7.5 + 24;
  const height = 26 + lines.length * 16;
  return (
    <g className="badge-chip">
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        rx={10}
        className="badge-bg"
      />
      <text y={-height / 2 + 18} textAnchor="middle" className="badge-name">
        {name}
      </text>
      {lines.map((line, i) => (
        <text key={i} y={-height / 2 + 34 + i * 16} textAnchor="middle" className="badge-line">
          {line}
        </text>
      ))}
    </g>
  );
}

/** Reiselinie einer Gruppe (§3.3): Wegpunkte im aktuellen Bereich, Tag pro Punkt. */
function TravelLine({
  waypoints,
  areaId,
  zoom,
  worldH,
}: {
  waypoints: { areaId: string; position: { x: number; y: number }; gameDay: number }[];
  areaId: string;
  zoom: number;
  worldH: number;
}) {
  const here = waypoints.filter((wp) => wp.areaId === areaId);
  if (here.length === 0) return null;
  const pts = here.map((wp) => ({ x: wp.position.x * WORLD_W, y: wp.position.y * worldH }));
  return (
    <g className="travel" pointerEvents="none">
      {pts.length > 1 && (
        <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} className="travel-line" />
      )}
      {pts.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) scale(${1 / zoom})`}>
          <circle r={i === pts.length - 1 ? 9 : 6} className="travel-point" />
          <text y={-12} textAnchor="middle" className="travel-day">
            Tag {here[i].gameDay}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Grid-Overlay (§4.1): Linien + Spaltenbuchstaben/Zeilennummern am Rand. */
function GridOverlay({ grid, w, h }: { grid: GridConfig; w: number; h: number }) {
  const cellW = w / grid.columns;
  const cellH = h / grid.rows;
  const fs = Math.min(cellW, cellH) * 0.32;
  const lines: React.ReactNode[] = [];
  for (let i = 0; i <= grid.columns; i++) {
    lines.push(
      <line key={`v${i}`} x1={i * cellW} y1={0} x2={i * cellW} y2={h} className="grid-line" />,
    );
  }
  for (let j = 0; j <= grid.rows; j++) {
    lines.push(
      <line key={`h${j}`} x1={0} y1={j * cellH} x2={w} y2={j * cellH} className="grid-line" />,
    );
  }
  const labels: React.ReactNode[] = [];
  for (let i = 0; i < grid.columns; i++) {
    labels.push(
      <text
        key={`c${i}`}
        x={(i + 0.5) * cellW}
        y={-fs * 0.5}
        fontSize={fs}
        textAnchor="middle"
        className="grid-label"
      >
        {columnLabel(i)}
      </text>,
    );
  }
  for (let j = 0; j < grid.rows; j++) {
    labels.push(
      <text
        key={`r${j}`}
        x={-fs * 0.5}
        y={(j + 0.5) * cellH + fs * 0.35}
        fontSize={fs}
        textAnchor="end"
        className="grid-label"
      >
        {j + 1}
      </text>,
    );
  }
  return (
    <g pointerEvents="none">
      {lines}
      {labels}
    </g>
  );
}
