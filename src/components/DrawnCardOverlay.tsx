/**
 * Gezogene Deck-Karte (M6): Vollbild-Overlay im Stil der Überfahrtskarten —
 * Kategorie-Farbband, Titel, Text. "Neu ziehen" zieht (als Event) nach.
 */

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { appendGameEvent } from '../features/game/thunks';
import { cardOverlayClosed, cardShown } from '../features/nav/navSlice';
import { RichText } from './RichText';

export function DrawnCardOverlay() {
  const dispatch = useAppDispatch();
  const drawn = useAppSelector((s) => s.nav.drawnCard);
  const deck = useAppSelector((s) =>
    drawn ? s.game.state?.decks[drawn.deckId] : undefined,
  );
  if (!drawn || !deck) return null;
  const card = deck.cards.find((c) => c.id === drawn.cardId);
  if (!card) return null;

  const drawAgain = () => {
    const next = deck.cards[Math.floor(Math.random() * deck.cards.length)];
    void dispatch(
      appendGameEvent({ type: 'deck.cardDrawn', payload: { deckId: deck.id, cardId: next.id } }),
    );
    dispatch(cardShown({ deckId: deck.id, cardId: next.id }));
  };

  return (
    <div className="overlay card-overlay" onClick={() => dispatch(cardOverlayClosed())}>
      <div className="drawn-card" onClick={(e) => e.stopPropagation()}>
        <div className="drawn-card-band" style={{ background: deck.color }}>
          {deck.name}
        </div>
        <h2 style={{ color: deck.color }}>{card.title}</h2>
        <RichText body={card.body} />
        <div className="drawn-card-actions">
          <button onClick={drawAgain}>Neu ziehen</button>
          <button onClick={() => dispatch(cardOverlayClosed())}>Schließen</button>
        </div>
      </div>
    </div>
  );
}
