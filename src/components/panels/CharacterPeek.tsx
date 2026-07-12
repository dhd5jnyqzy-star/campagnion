/**
 * Charakter-Peek (§3.3 Character): Stammdaten, Statuseffekte als freie Tags
 * mit Vorschlagsliste und Sheet-Versionen — Upload = Event, kein Löschen,
 * nur Deaktivieren; Zeiger auf das aktive Sheet.
 */

import { useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectGroupsForCharacter } from '../../features/game/selectors';
import { appendGameEvent, uploadSheet } from '../../features/game/thunks';
import { getCurrentStore } from '../../persistence/db';
import { SUGGESTED_STATUS_EFFECTS } from '../../types';
import type { Character } from '../../types';
import { Chips, NumberField, PanelHead, Section, TextField } from './common';

export function CharacterPeek({ character }: { character: Character }) {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game.state);
  const fileRef = useRef<HTMLInputElement>(null);
  const [effectInput, setEffectInput] = useState('');
  if (!game) return null;

  const groups = selectGroupsForCharacter(game, character.id);

  const update = (
    changes: Partial<Omit<Character, 'id' | 'sheets' | 'activeSheetId' | 'statusEffects'>>,
  ) =>
    void dispatch(
      appendGameEvent({
        type: 'character.updated',
        payload: { characterId: character.id, changes },
      }),
    );

  const addEffect = () => {
    const effect = effectInput.trim();
    if (!effect || character.statusEffects.includes(effect)) return;
    void dispatch(
      appendGameEvent({
        type: 'statusEffect.added',
        payload: { target: { kind: 'character', characterId: character.id }, effect },
      }),
    );
    setEffectInput('');
  };

  const openSheet = (assetId: string) => {
    void getCurrentStore()
      .getAsset(assetId)
      .then((blob) => {
        if (blob) window.open(URL.createObjectURL(blob), '_blank');
      });
  };

  return (
    <>
      <PanelHead name={character.name} onCommitName={(name) => update({ name })} />

      <div className="field-grid">
        <TextField label="Klasse" value={character.className} onCommit={(className) => update({ className })} />
        <TextField label="Rasse" value={character.race} onCommit={(race) => update({ race })} />
        <NumberField label="Level" value={character.level} min={1} max={20} onCommit={(level) => update({ level: Math.round(level) })} />
        <NumberField label="Max-HP" value={character.maxHp} min={1} onCommit={(maxHp) => update({ maxHp: Math.round(maxHp) })} />
      </div>

      <Section title="Statuseffekte">
        <Chips
          items={character.statusEffects.map((e) => ({ id: e, label: e }))}
          onRemove={(effect) =>
            void dispatch(
              appendGameEvent({
                type: 'statusEffect.removed',
                payload: { target: { kind: 'character', characterId: character.id }, effect },
              }),
            )
          }
          emptyText="Keine Effekte."
        />
        <div className="tag-add">
          <input
            type="text"
            list="status-effects"
            placeholder="Effekt hinzufügen …"
            value={effectInput}
            onChange={(e) => setEffectInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addEffect();
            }}
          />
          <datalist id="status-effects">
            {SUGGESTED_STATUS_EFFECTS.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
          <button onClick={addEffect} disabled={!effectInput.trim()}>
            +
          </button>
        </div>
      </Section>

      <Section title={`Sheets (${character.sheets.length})`}>
        {character.sheets.length === 0 && <p className="muted">Noch kein Sheet hochgeladen.</p>}
        <ul className="sheet-list">
          {[...character.sheets].reverse().map((sheet) => (
            <li key={sheet.id} className={sheet.deactivated ? 'sheet deactivated' : 'sheet'}>
              <span>
                {new Date(sheet.uploadedAt).toLocaleDateString('de-DE')}
                {sheet.id === character.activeSheetId && <strong> · aktiv</strong>}
                {sheet.deactivated && <span className="muted"> · deaktiviert</span>}
              </span>
              <span className="sheet-actions">
                <button onClick={() => openSheet(sheet.assetId)}>Ansehen</button>
                {sheet.id !== character.activeSheetId && !sheet.deactivated && (
                  <button
                    onClick={() =>
                      void dispatch(
                        appendGameEvent({
                          type: 'character.sheetActivated',
                          payload: { characterId: character.id, sheetVersionId: sheet.id },
                        }),
                      )
                    }
                  >
                    Aktivieren
                  </button>
                )}
                {!sheet.deactivated && (
                  <button
                    onClick={() =>
                      void dispatch(
                        appendGameEvent({
                          type: 'character.sheetDeactivated',
                          payload: { characterId: character.id, sheetVersionId: sheet.id },
                        }),
                      )
                    }
                  >
                    Deaktivieren
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        <button onClick={() => fileRef.current?.click()}>+ Sheet hochladen (PDF)</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void dispatch(uploadSheet({ characterId: character.id, file }));
          }}
        />
      </Section>

      <Section title="Gruppen">
        <Chips
          items={groups.map((g) => ({ id: g.id, label: g.name, peek: 'group' as const }))}
          emptyText="In keiner Gruppe."
        />
      </Section>
    </>
  );
}
