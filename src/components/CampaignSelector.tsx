/**
 * Kampagnen-Wähler (M1.4, §3.3): Einstiegsbildschirm. Jede Kampagne ist ein
 * eigener IndexedDB-Namespace. Ab M5 auch: Vollimport aus einem Export-ZIP
 * (identischer Stand auf anderem Gerät, §5) mit Konfliktdialog — nie stumm
 * überschreiben — sowie die Speicheranzeige.
 */

import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  importCampaignFromZip,
  parseCampaignZip,
  type ParsedCampaignZip,
} from '../features/exchange/campaignZip';
import { createCampaign, openCampaign } from '../features/game/thunks';
import { formatBytes, getStorageInfo, type StorageInfo } from '../lib/storageInfo';
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
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  /** Vollimport-Konflikt: Kampagne existiert bereits lokal. */
  const [pendingImport, setPendingImport] = useState<ParsedCampaignZip | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => void listCampaigns().then(setCampaigns);

  useEffect(() => {
    refresh();
    void getStorageInfo().then(setStorage);
  }, []);

  const busy = status === 'loading' || importBusy;

  function onCreate() {
    const name = newName.trim();
    if (!name || busy) return;
    setNewName('');
    void dispatch(createCampaign(name));
  }

  const onZipFile = async (file: File) => {
    setImportError(null);
    setImportBusy(true);
    try {
      const parsed = await parseCampaignZip(file);
      const exists = (campaigns ?? []).some((c) => c.id === parsed.export.campaignId);
      if (exists) {
        setPendingImport(parsed); // → Konfliktdialog
      } else {
        await importCampaignFromZip(parsed, 'new');
        refresh();
      }
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImportBusy(false);
    }
  };

  const resolveConflict = async (mode: 'replace' | 'copy') => {
    if (!pendingImport) return;
    setImportBusy(true);
    setImportError(null);
    try {
      await importCampaignFromZip(pendingImport, mode);
      setPendingImport(null);
      refresh();
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="selector">
      <h1 className="selector-title">Campagnion</h1>
      <p className="selector-subtitle">Kampagne wählen</p>

      {error && <p className="error">{error}</p>}
      {importError && <p className="error">{importError}</p>}

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

      <button className="selector-import" disabled={busy} onClick={() => fileRef.current?.click()}>
        Kampagne importieren (ZIP-Backup)
      </button>

      <p className="muted selector-storage">
        Speicher: {formatBytes(storage?.usage ?? null)}
        {storage?.quota ? ` von ${formatBytes(storage.quota)}` : ''} ·{' '}
        {storage?.persisted ? 'dauerhaft gesichert' : 'nicht als dauerhaft markiert'}
      </p>

      {pendingImport && (
        <div className="combat-dialog">
          <h3>Kampagne existiert bereits</h3>
          <p>
            „{pendingImport.export.campaignName}" ist auf diesem Gerät schon vorhanden. Der
            lokale Stand kann ersetzt werden (Achtung: er geht dabei verloren) — oder das ZIP
            wird als unabhängige Kopie importiert.
          </p>
          <div className="combat-dialog-actions">
            <button onClick={() => setPendingImport(null)}>Abbrechen</button>
            <button disabled={busy} onClick={() => void resolveConflict('copy')}>
              Als Kopie
            </button>
            <button
              className="combat-end"
              disabled={busy}
              onClick={() => void resolveConflict('replace')}
            >
              Ersetzen
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void onZipFile(file);
        }}
      />
    </div>
  );
}
