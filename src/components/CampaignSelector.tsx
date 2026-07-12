/**
 * Kampagnen-Wähler (M1.4, §3.3): Einstiegsbildschirm. Jede Kampagne ist ein
 * eigener IndexedDB-Namespace; hier wird gewählt oder neu angelegt.
 */

import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { createCampaign, openCampaign } from '../features/game/thunks';
import { listCampaigns, type CampaignRef } from '../persistence/db';

function formatLastOpened(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CampaignSelector() {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.game.status);
  const error = useAppSelector((s) => s.game.error);
  const [campaigns, setCampaigns] = useState<CampaignRef[] | null>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    let cancelled = false;
    void listCampaigns().then((refs) => {
      if (!cancelled) setCampaigns(refs);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const busy = status === 'loading';

  function onCreate() {
    const name = newName.trim();
    if (!name || busy) return;
    setNewName('');
    void dispatch(createCampaign(name));
  }

  return (
    <div className="selector">
      <h1 className="selector-title">Campagnion</h1>
      <p className="selector-subtitle">Kampagne wählen</p>

      {error && <p className="error">{error}</p>}

      <div className="campaign-list">
        {campaigns === null && <p className="muted">Lade Kampagnen …</p>}
        {campaigns?.length === 0 && (
          <p className="muted">Noch keine Kampagne — unten eine neue anlegen.</p>
        )}
        {campaigns?.map((ref) => (
          <button
            key={ref.id}
            className="campaign-card"
            disabled={busy}
            onClick={() => void dispatch(openCampaign(ref.id))}
          >
            <span className="campaign-card-name">{ref.name}</span>
            <span className="campaign-card-meta">
              zuletzt geöffnet {formatLastOpened(ref.lastOpenedAt)}
            </span>
          </button>
        ))}
      </div>

      <form
        className="new-campaign"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate();
        }}
      >
        <input
          type="text"
          value={newName}
          placeholder="Name der neuen Kampagne"
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" disabled={!newName.trim() || busy}>
          Anlegen
        </button>
      </form>
    </div>
  );
}
