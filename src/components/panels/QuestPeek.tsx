/**
 * Quest-Peek (§3.3): Status, Bauchgefühl-Fortschritt als Freitext, Kommentare,
 * n:m-Verknüpfungen zu NSCs/Bereichen/Encountern (kanonisch an der Quest) und
 * Marker-Rückverweise (kanonisch am Marker).
 */

import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectMarkersForQuest } from '../../features/game/selectors';
import { appendGameEvent } from '../../features/game/thunks';
import { newId } from '../../lib/ids';
import { formatGameTime } from '../../lib/gameTime';
import { nowIso } from '../../lib/ids';
import type { Quest, QuestStatus } from '../../types';
import { Chips, LinkAdder, PanelHead, Section, TextField } from './common';

const STATUS_LABELS: Record<QuestStatus, string> = {
  open: 'offen',
  active: 'aktiv',
  completed: 'abgeschlossen',
};

export function QuestPeek({ quest }: { quest: Quest }) {
  const dispatch = useAppDispatch();
  const game = useAppSelector((s) => s.game.state);
  const [comment, setComment] = useState('');
  if (!game) return null;

  const markers = selectMarkersForQuest(game, quest.id);

  const update = (changes: Partial<Omit<Quest, 'id' | 'status' | 'comments'>>) =>
    void dispatch(
      appendGameEvent({ type: 'quest.updated', payload: { questId: quest.id, changes } }),
    );

  const addComment = () => {
    const text = comment.trim();
    if (!text) return;
    void dispatch(
      appendGameEvent({
        type: 'quest.commentAdded',
        payload: {
          questId: quest.id,
          comment: { id: newId(), text, realTime: nowIso(), gameTime: game.campaign.clock },
        },
      }),
    );
    setComment('');
  };

  return (
    <>
      <PanelHead name={quest.name} onCommitName={(name) => update({ name })} />

      <div className="segmented">
        {(Object.keys(STATUS_LABELS) as QuestStatus[]).map((status) => (
          <button
            key={status}
            className={quest.status === status ? 'active' : ''}
            onClick={() =>
              quest.status !== status &&
              void dispatch(
                appendGameEvent({
                  type: 'quest.statusChanged',
                  payload: { questId: quest.id, status },
                }),
              )
            }
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <TextField
        label="Fortschritt (Bauchgefühl)"
        placeholder='z. B. "1/3"'
        value={quest.progressNote ?? ''}
        onCommit={(progressNote) => update({ progressNote })}
      />
      <TextField
        multiline
        placeholder="Beschreibung …"
        value={quest.description ?? ''}
        onCommit={(description) => update({ description })}
      />

      <Section title="NSCs">
        <Chips
          items={quest.npcIds
            .filter((id) => game.npcs[id])
            .map((id) => ({ id, label: game.npcs[id].name, peek: 'npc' as const }))}
          onRemove={(id) => update({ npcIds: quest.npcIds.filter((x) => x !== id) })}
          emptyText="Keine NSCs verknüpft."
        />
        <LinkAdder
          placeholder="NSC verknüpfen …"
          options={Object.values(game.npcs)
            .filter((n) => !quest.npcIds.includes(n.id))
            .map((n) => ({ id: n.id, label: n.name }))}
          onAdd={(id) => update({ npcIds: [...quest.npcIds, id] })}
        />
      </Section>

      <Section title="Bereiche">
        <Chips
          items={quest.areaIds
            .filter((id) => game.areas[id])
            .map((id) => ({ id, label: game.areas[id].name, peek: 'area' as const }))}
          onRemove={(id) => update({ areaIds: quest.areaIds.filter((x) => x !== id) })}
          emptyText="Keine Bereiche verknüpft."
        />
        <LinkAdder
          placeholder="Bereich verknüpfen …"
          options={Object.values(game.areas)
            .filter((a) => !quest.areaIds.includes(a.id))
            .map((a) => ({ id: a.id, label: a.name }))}
          onAdd={(id) => update({ areaIds: [...quest.areaIds, id] })}
        />
      </Section>

      <Section title="Encounter">
        <Chips
          items={quest.encounterIds
            .filter((id) => game.encounters[id])
            .map((id) => ({ id, label: game.encounters[id].name, peek: 'encounter' as const }))}
          onRemove={(id) => update({ encounterIds: quest.encounterIds.filter((x) => x !== id) })}
          emptyText="Keine Encounter verknüpft."
        />
        <LinkAdder
          placeholder="Encounter verknüpfen …"
          options={Object.values(game.encounters)
            .filter((e) => !quest.encounterIds.includes(e.id))
            .map((e) => ({ id: e.id, label: e.name }))}
          onAdd={(id) => update({ encounterIds: [...quest.encounterIds, id] })}
        />
      </Section>

      <Section title="Marker">
        <Chips
          items={markers.map((m) => ({ id: m.id, label: m.name ?? 'Marker', peek: 'marker' as const }))}
          emptyText="Kein Marker verweist hierher."
        />
      </Section>

      <Section title={`Kommentare (${quest.comments.length})`}>
        <ul className="event-list">
          {[...quest.comments].reverse().map((c) => (
            <li key={c.id}>
              <span>{c.text}</span>
              <span className="muted"> — {formatGameTime(c.gameTime)}</span>
            </li>
          ))}
        </ul>
        <TextField
          multiline
          placeholder="Neuer Kommentar …"
          value={comment}
          onCommit={setComment}
        />
        <button onClick={addComment} disabled={!comment.trim()}>
          Kommentar hinzufügen
        </button>
      </Section>
    </>
  );
}
