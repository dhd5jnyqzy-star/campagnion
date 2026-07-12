/**
 * Deck-Peek (M6): Kategorie-Kachel der Zieh-Karten — Karte ziehen, Karten
 * durchsehen, platzieren. Von außen sieht man nur die Kategorie; erst das
 * Ziehen zeigt eine einzelne Karte (Überfahrtskarten-Feature).
 */

import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { appendGameEvent } from '../../features/game/thunks';
import { cardShown, peekClosed, placingChanged } from '../../features/nav/navSlice';
import type { Deck } from '../../types';
import { RichText } from '../RichText';
import { PanelHead, Section } from './common';

export function DeckPeek({ deck }: { deck: Deck }) {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game.state);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  if (!game) return null;

  const draw = () => {
    if (deck.cards.length === 0) return;
    const card = deck.cards[Math.floor(Math.random() * deck.cards.length)];
    void dispatch(
      appendGameEvent({ type: 'deck.cardDrawn', payload: { deckId: deck.id, cardId: card.id } }),
    );
    dispatch(cardShown({ deckId: deck.id, cardId: card.id }));
    dispatch(peekClosed());
  };

  return (
    <>
      <PanelHead
        name={deck.name}
        onCommitName={(name) =>
          void dispatch(
            appendGameEvent({ type: 'deck.updated', payload: { deckId: deck.id, changes: { name } } }),
          )
        }
      />
      <p className="muted">
        {deck.cards.length} Karten ·{' '}
        {deck.position
          ? `auf "${game.areas[deck.areaId ?? '']?.name ?? 'Karte'}"`
          : 'noch nicht platziert'}
      </p>

      <div className="panel-actions">
        <button className="sidepanel-goto" onClick={draw} disabled={deck.cards.length === 0}>
          Karte ziehen
        </button>
        <button
          onClick={() => {
            dispatch(placingChanged({ kind: 'deck', deckId: deck.id }));
            dispatch(peekClosed());
          }}
        >
          {deck.position ? 'Verschieben …' : 'Auf Karte platzieren …'}
        </button>
      </div>

      <Section title="Karten durchsehen">
        <div className="deck-card-list">
          {deck.cards.map((card) => (
            <div key={card.id}>
              <button
                className="chip-label"
                onClick={() => setOpenCardId(openCardId === card.id ? null : card.id)}
              >
                {openCardId === card.id ? '▾' : '▸'} {card.title}
              </button>
              {openCardId === card.id && (
                <div className="handout-preview">
                  <RichText body={card.body} />
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
