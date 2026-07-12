/**
 * Bereichs-Peek (§3.3 Area): Badge-Konfiguration (welche Infos werden beim
 * Verdichten nach oben durchgereicht — per Häkchen), Zoomschwellwert fürs
 * semantische Zoomen, Zonen-Geometrie auf der Elternkarte und eigene Karte.
 */

import { useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectPrimaryMapImage, selectQuestsForArea } from '../../features/game/selectors';
import { appendGameEvent, importMapImage } from '../../features/game/thunks';
import { gotoRequested } from '../../features/nav/navSlice';
import type { Area } from '../../types';
import { Chips, NumberField, PanelHead, Section, TextField } from './common';

export function AreaPeek({ area }: { area: Area }) {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game.state);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!game) return null;

  const mapImage = selectPrimaryMapImage(game, area.id);
  const quests = selectQuestsForArea(game, area.id);
  const zone = area.zoneOnParent;

  const update = (changes: Partial<Omit<Area, 'id'>>) =>
    void dispatch(appendGameEvent({ type: 'area.updated', payload: { areaId: area.id, changes } }));
  const updateBadge = (patch: Partial<Area['badge']>) => update({ badge: { ...area.badge, ...patch } });
  const updateZone = (patch: Partial<NonNullable<Area['zoneOnParent']>>) => {
    if (zone) update({ zoneOnParent: { ...zone, ...patch } });
  };

  return (
    <>
      <PanelHead name={area.name} onCommitName={(name) => update({ name })} />
      {area.parentId === null && <p className="muted">Wurzelbereich</p>}

      <button
        className="sidepanel-goto"
        onClick={() => dispatch(gotoRequested({ label: area.name, target: { areaId: area.id } }))}
      >
        Bereich öffnen
      </button>

      <Section title="Karte">
        <button onClick={() => fileRef.current?.click()}>
          {mapImage ? 'Kartenbild tauschen (deckungsgleich)' : 'Karte importieren'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void dispatch(importMapImage({ file, areaId: area.id }));
          }}
        />
        {!mapImage && <p className="muted">Ohne Karte zeigt der Bereich nur seine Marker-Liste.</p>}
      </Section>

      <Section title="Semantisches Zoomen">
        <NumberField
          label="Aufblättern ab Zoom"
          value={area.zoomThreshold}
          min={0}
          max={40}
          step={0.5}
          onCommit={(zoomThreshold) => update({ zoomThreshold })}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={area.badge.showEncounterCount}
            onChange={(e) => updateBadge({ showEncounterCount: e.target.checked })}
          />
          Encounter-Anzahl im Badge
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={area.badge.showQuestMarkers}
            onChange={(e) => updateBadge({ showQuestMarkers: e.target.checked })}
          />
          Quest-Anzahl im Badge
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={area.badge.showText}
            onChange={(e) => updateBadge({ showText: e.target.checked })}
          />
          Freitext im Badge
        </label>
        {area.badge.showText && (
          <TextField
            placeholder="Badge-Text …"
            value={area.badge.text ?? ''}
            onCommit={(text) => updateBadge({ text })}
          />
        )}
      </Section>

      {zone && (
        <Section title="Zone auf der Elternkarte (%)">
          <div className="zone-fields">
            <NumberField label="X" value={Math.round(zone.x * 100)} min={0} max={100} onCommit={(v) => updateZone({ x: v / 100 })} />
            <NumberField label="Y" value={Math.round(zone.y * 100)} min={0} max={100} onCommit={(v) => updateZone({ y: v / 100 })} />
            <NumberField label="Breite" value={Math.round(zone.width * 100)} min={2} max={100} onCommit={(v) => updateZone({ width: v / 100 })} />
            <NumberField label="Höhe" value={Math.round(zone.height * 100)} min={2} max={100} onCommit={(v) => updateZone({ height: v / 100 })} />
          </div>
        </Section>
      )}

      <Section title="Quests">
        <Chips
          items={quests.map((q) => ({ id: q.id, label: q.name, peek: 'quest' as const }))}
          emptyText="Keine Quest verweist hierher."
        />
      </Section>
    </>
  );
}
