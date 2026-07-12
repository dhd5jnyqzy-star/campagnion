/**
 * NSC-Peek (§3.3): Beschreibung, Heimat-Location und vor allem die
 * Rückverweise — "Sidepanel zeigt rückwärts alle Vorkommen": Marker und
 * Quests, die auf diesen NSC zeigen (kanonisch dort gespeichert).
 */

import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectMarkersForNpc, selectQuestsForNpc } from '../../features/game/selectors';
import { appendGameEvent } from '../../features/game/thunks';
import { formatGameTime } from '../../lib/gameTime';
import { newId, nowIso } from '../../lib/ids';
import type { Npc } from '../../types';
import { Chips, PanelHead, Section, TextField } from './common';

export function NpcPeek({ npc }: { npc: Npc }) {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game.state);
  const [comment, setComment] = useState('');
  if (!game) return null;

  const markers = selectMarkersForNpc(game, npc.id);
  const quests = selectQuestsForNpc(game, npc.id);

  const update = (changes: Partial<Omit<Npc, 'id' | 'comments'>>) =>
    void dispatch(appendGameEvent({ type: 'npc.updated', payload: { npcId: npc.id, changes } }));

  const addComment = () => {
    const text = comment.trim();
    if (!text) return;
    void dispatch(
      appendGameEvent({
        type: 'npc.commentAdded',
        payload: {
          npcId: npc.id,
          comment: { id: newId(), text, realTime: nowIso(), gameTime: game.campaign.clock },
        },
      }),
    );
    setComment('');
  };

  return (
    <>
      <PanelHead name={npc.name} onCommitName={(name) => update({ name })} />

      <TextField
        multiline
        placeholder="Beschreibung …"
        value={npc.description ?? ''}
        onCommit={(description) => update({ description })}
      />

      <label className="field">
        <span>Heimat-Bereich</span>
        <select
          value={npc.homeAreaId ?? ''}
          onChange={(e) => update({ homeAreaId: e.target.value || undefined })}
        >
          <option value="">— keiner —</option>
          {Object.values(game.areas).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <Section title="Vorkommen an Markern">
        <Chips
          items={markers.map((m) => ({ id: m.id, label: m.name ?? 'Marker', peek: 'marker' as const }))}
          emptyText="An keinem Marker verknüpft (im Marker-Panel verknüpfen)."
        />
      </Section>

      <Section title="Vorkommen in Quests">
        <Chips
          items={quests.map((q) => ({ id: q.id, label: q.name, peek: 'quest' as const }))}
          emptyText="In keiner Quest verknüpft (im Quest-Panel verknüpfen)."
        />
      </Section>

      <Section title={`Kommentare (${npc.comments.length})`}>
        <ul className="event-list">
          {[...npc.comments].reverse().map((c) => (
            <li key={c.id}>
              <span>{c.text}</span>
              <span className="muted"> — {formatGameTime(c.gameTime)}</span>
            </li>
          ))}
        </ul>
        <TextField multiline placeholder="Neuer Kommentar …" value={comment} onCommit={setComment} />
        <button onClick={addComment} disabled={!comment.trim()}>
          Kommentar hinzufügen
        </button>
      </Section>
    </>
  );
}
