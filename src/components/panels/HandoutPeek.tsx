/**
 * Handout-Peek (M6): Titel, Kategorie und Volltext bearbeiten, auf der Karte
 * platzieren, auf-/zuklappen. Handouts ohne Position leben in der Bibliothek.
 */

import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { appendGameEvent } from '../../features/game/thunks';
import { peekClosed, placingChanged } from '../../features/nav/navSlice';
import type { Handout } from '../../types';
import { RichText } from '../RichText';
import { PanelHead, Section, TextField } from './common';

export function HandoutPeek({ handout }: { handout: Handout }) {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game.state);
  if (!game) return null;

  const update = (changes: Partial<Omit<Handout, 'id' | 'expanded'>>) =>
    void dispatch(
      appendGameEvent({ type: 'handout.updated', payload: { handoutId: handout.id, changes } }),
    );

  return (
    <>
      <PanelHead name={handout.title} onCommitName={(title) => update({ title })} />
      <p className="muted">
        {handout.category ? `${handout.category} · ` : ''}
        {handout.position
          ? `auf "${game.areas[handout.areaId ?? '']?.name ?? 'Karte'}"`
          : 'noch nicht platziert'}
      </p>

      <div className="panel-actions">
        <button
          onClick={() =>
            void dispatch(
              appendGameEvent({
                type: 'handout.toggled',
                payload: { handoutId: handout.id, expanded: !handout.expanded },
              }),
            )
          }
        >
          {handout.expanded ? 'Zuklappen' : 'Aufklappen'}
        </button>
        <button
          onClick={() => {
            dispatch(placingChanged({ kind: 'handout', handoutId: handout.id }));
            dispatch(peekClosed());
          }}
        >
          {handout.position ? 'Verschieben …' : 'Auf Karte platzieren …'}
        </button>
      </div>

      <Section title="Text">
        <TextField
          multiline
          placeholder="Text des Handouts …"
          value={handout.body}
          onCommit={(body) => update({ body })}
        />
      </Section>

      <Section title="Vorschau">
        <div className="handout-preview">
          <RichText body={handout.body} />
        </div>
      </Section>
    </>
  );
}
