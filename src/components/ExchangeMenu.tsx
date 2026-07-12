/**
 * Austausch-Menü (§5) in der Kopfleiste: Vollexport (ZIP-Backup), Teilexport
 * (Paket aus NSCs/Quests/Encountern) und Teilimport (JSON/ZIP-Paket, additiv,
 * mit Konfliktdialog — nie stumm überschreiben). Dazu die Speicheranzeige.
 */

import { useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { buildCampaignZip } from '../features/exchange/campaignZip';
import {
  buildContentPackage,
  findPackageConflicts,
  planPackageImport,
  type ConflictResolution,
} from '../features/exchange/packageCore';
import {
  parsePackageFile,
  parsePackageText,
  type ParsedPackage,
} from '../features/exchange/packageIo';
import { applyContentPackage } from '../features/game/thunks';
import { downloadBlob, downloadJson, slugify } from '../lib/download';
import { formatBytes, getStorageInfo, type StorageInfo } from '../lib/storageInfo';
import { getCurrentStore } from '../persistence/db';
import type { GameState, ImportConflict } from '../types';

export function ExchangeMenu() {
  const state = useAppSelector((s) => s.game.state);
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<'export' | 'import' | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (open) void getStorageInfo().then(setStorage);
  }, [open]);

  if (!state) return null;

  const exportZip = async () => {
    setBusy(true);
    try {
      const blob = await buildCampaignZip(state, getCurrentStore());
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `campagnion-${slugify(state.campaign.name)}-${date}.zip`);
      setNotice('Backup erstellt — Download gestartet.');
    } catch (err) {
      setNotice(`Export fehlgeschlagen: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button className="topbar-menu" onClick={() => setOpen(!open)} title="Import/Export">
        ⋯
      </button>
      {open && (
        <div className="exchange-menu">
          <button disabled={busy} onClick={() => void exportZip()}>
            Backup exportieren (ZIP)
          </button>
          <button onClick={() => setDialog('export')}>Paket exportieren …</button>
          <button onClick={() => setDialog('import')}>Paket importieren …</button>
          <p className="muted exchange-storage">
            Speicher: {formatBytes(storage?.usage ?? null)}
            {storage?.quota ? ` von ${formatBytes(storage.quota)}` : ''} ·{' '}
            {storage?.persisted ? 'dauerhaft gesichert' : 'nicht als dauerhaft markiert'}
          </p>
          {notice && <p className="muted exchange-storage">{notice}</p>}
        </div>
      )}
      {dialog === 'export' && (
        <PackageExportDialog
          state={state}
          onClose={() => {
            setDialog(null);
            setOpen(false);
          }}
        />
      )}
      {dialog === 'import' && (
        <PackageImportDialog
          state={state}
          onClose={() => {
            setDialog(null);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Teilexport
// ---------------------------------------------------------------------------

function PackageExportDialog({ state, onClose }: { state: GameState; onClose: () => void }) {
  const [name, setName] = useState('Paket');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const sections: { title: string; items: { id: string; label: string }[] }[] = [
    {
      title: 'NSCs',
      items: Object.values(state.npcs).map((n) => ({ id: n.id, label: n.name })),
    },
    {
      title: 'Quests',
      items: Object.values(state.quests).map((q) => ({ id: q.id, label: q.name })),
    },
    {
      title: 'Encounter',
      items: Object.values(state.encounters).map((e) => ({ id: e.id, label: e.name })),
    },
  ];

  const doExport = () => {
    const pkg = buildContentPackage(state, name.trim() || 'Paket', {
      npcIds: Object.keys(state.npcs).filter((id) => selected.has(id)),
      questIds: Object.keys(state.quests).filter((id) => selected.has(id)),
      encounterIds: Object.keys(state.encounters).filter((id) => selected.has(id)),
    });
    downloadJson(pkg, `campagnion-paket-${slugify(pkg.name)}.json`);
    onClose();
  };

  return (
    <div className="combat-dialog exchange-dialog">
      <h3>Paket exportieren</h3>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Paketname" />
      <div className="exchange-pick">
        {sections.map((section) => (
          <div key={section.title}>
            <h4>{section.title}</h4>
            {section.items.length === 0 && <p className="muted">Keine vorhanden.</p>}
            {section.items.map((item) => (
              <label key={item.id} className="check">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                />
                {item.label}
              </label>
            ))}
          </div>
        ))}
      </div>
      <p className="muted">
        Ortsbezüge und Battlemap-Bilder bleiben außen vor — Encounter kommen drüben im
        Random-Pool an.
      </p>
      <div className="combat-dialog-actions">
        <button onClick={onClose}>Abbrechen</button>
        <button onClick={doExport} disabled={selected.size === 0}>
          Exportieren ({selected.size})
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Teilimport
// ---------------------------------------------------------------------------

function PackageImportDialog({ state, onClose }: { state: GameState; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedPackage | null>(null);
  const [conflicts, setConflicts] = useState<ImportConflict[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolution>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pasteText, setPasteText] = useState('');
  // Ist ein beigelegtes Paket neben der App abrufbar? (fürs Ein-Tipp-Laden)
  const [bundledUrl, setBundledUrl] = useState<string | null>(null);

  useEffect(() => {
    // Relativ zum App-Basispfad (z. B. /campagnion/blauwasser-paket.json).
    const url = new URL('blauwasser-paket.json', document.baseURI).href;
    let cancelled = false;
    void fetch(url, { method: 'HEAD' })
      .then((r) => {
        if (!cancelled && r.ok) setBundledUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  /** Ein geparstes Paket übernehmen: Konflikte prüfen, Standard = Vorhandenes nutzen. */
  const accept = (p: ParsedPackage) => {
    setParsed(p);
    const found = findPackageConflicts(state, p.pkg);
    setConflicts(found);
    setResolutions(Object.fromEntries(found.map((c) => [c.id, 'skip' as const])));
  };

  const onFile = async (file: File) => {
    setError(null);
    try {
      accept(await parsePackageFile(file));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  /** Import aus eingefügtem Text (Zwischenablage) — ohne Datei-Umweg. */
  const onText = (text: string) => {
    setError(null);
    try {
      accept(parsePackageText(text));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  /** Zwischenablage direkt lesen (Secure Context nötig; sonst manuell einfügen). */
  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPasteText(text);
      onText(text);
    } catch {
      setError('Zwischenablage nicht lesbar — bitte den Text unten manuell einfügen.');
    }
  };

  /** Beigelegtes Paket direkt von der Seite laden (ein Tipp, keine Datei). */
  const loadBundled = async () => {
    if (!bundledUrl) return;
    setError(null);
    setBusy(true);
    try {
      const resp = await fetch(bundledUrl);
      if (!resp.ok) throw new Error(`Konnte Paket nicht laden (${resp.status}).`);
      accept(parsePackageText(await resp.text()));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const plan = planPackageImport(state, parsed.pkg, resolutions);
      const assetBlobs = new Map<string, Blob>();
      for (const [newAssetId, originalId] of plan.assetIdMap) {
        const blob = parsed.blobs.get(originalId);
        if (blob) assetBlobs.set(newAssetId, blob);
      }
      await dispatch(
        applyContentPackage({
          packageName: parsed.pkg.name,
          events: plan.events,
          summary: plan.summary,
          assetBlobs,
        }),
      ).unwrap();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const counts = parsed
    ? [
        ['NSCs', parsed.pkg.npcs?.length ?? 0],
        ['Quests', parsed.pkg.quests?.length ?? 0],
        ['Encounter', parsed.pkg.encounters?.length ?? 0],
        ['Handouts', parsed.pkg.handouts?.length ?? 0],
        ['Decks', parsed.pkg.decks?.length ?? 0],
        ['Marker', parsed.pkg.markers?.length ?? 0],
        ['Bereiche', parsed.pkg.areas?.length ?? 0],
        ['Assets', parsed.pkg.assets?.length ?? 0],
      ].filter(([, n]) => (n as number) > 0)
    : [];

  return (
    <div className="combat-dialog exchange-dialog">
      <h3>Paket importieren</h3>
      {!parsed ? (
        <>
          <p className="muted">
            ContentPackage als JSON — z. B. eine KI-gelieferte Vorbereitung oder ein Teilexport.
            Der Import ist additiv.
          </p>
          {bundledUrl && (
            <button className="sidepanel-goto" disabled={busy} onClick={() => void loadBundled()}>
              Beigelegtes Blauwasser-Paket laden
            </button>
          )}
          <label className="field" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <span>JSON hier einfügen (aus Zwischenablage):</span>
            <textarea
              rows={4}
              placeholder='{ "formatVersion": 1, "name": … }'
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
          </label>
          <div className="panel-actions">
            <button onClick={() => void pasteFromClipboard()}>Aus Zwischenablage</button>
            <button disabled={!pasteText.trim()} onClick={() => onText(pasteText)}>
              Aus Text importieren
            </button>
            <button onClick={() => fileRef.current?.click()}>Datei wählen …</button>
          </div>
        </>
      ) : (
        <>
          <p>
            <strong>{parsed.pkg.name}</strong>
            {parsed.pkg.description ? ` — ${parsed.pkg.description}` : ''}
          </p>
          <p className="muted">{counts.map(([label, n]) => `${n} ${label}`).join(' · ')}</p>
          {conflicts.length > 0 && (
            <div className="exchange-conflicts">
              <h4>ID-Konflikte ({conflicts.length})</h4>
              {conflicts.map((c) => (
                <div key={c.id} className="conflict-row">
                  <span className="conflict-name">
                    {c.incomingName} <span className="muted">({c.entityKind})</span>
                  </span>
                  <div className="segmented">
                    <button
                      className={resolutions[c.id] === 'skip' ? 'active' : ''}
                      onClick={() => setResolutions({ ...resolutions, [c.id]: 'skip' })}
                    >
                      Vorhandenes nutzen
                    </button>
                    <button
                      className={resolutions[c.id] === 'importAsNew' ? 'active' : ''}
                      onClick={() => setResolutions({ ...resolutions, [c.id]: 'importAsNew' })}
                    >
                      Als neu
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {error && <p className="error">{error}</p>}
      <div className="combat-dialog-actions">
        <button onClick={onClose}>Abbrechen</button>
        {parsed && (
          <button onClick={() => void doImport()} disabled={busy}>
            Importieren
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.zip,application/json,application/zip"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void onFile(file);
        }}
      />
    </div>
  );
}
