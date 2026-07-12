/**
 * IndexedDB-Anbindung (M1.3, §3.1/§3.3).
 *
 * Zwei Ebenen:
 * 1. Meta-Datenbank `campagnion-meta`: Register aller Kampagnen für den
 *    Kampagnen-Wähler (M1.4).
 * 2. Pro Kampagne eine eigene Datenbank `campagnion-campaign-<id>` — komplett
 *    eigener Namespace (§3.3 Campaign) mit Stores:
 *    - events:    Event-Log, Schlüssel = autoIncrement-Sequenznummer →
 *                 Einfügereihenfolge ist Log-Reihenfolge. Append-only.
 *    - snapshots: eingefrorene GameStates mit lastSeq (§3.1 Snapshots)
 *    - assets:    Blobs (Kartenbilder, PDFs), Schlüssel = AssetId — ab M2 genutzt,
 *                 Store von Anfang an angelegt, um spätere Schema-Upgrades zu sparen
 *
 * Events werden sofort beim Entstehen geschrieben (kein Speichern-Button);
 * Edge Case 2 (Tablet geht aus / Browser gekillt) hängt an genau dieser Stelle.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { CampaignId, GameEvent, IsoDateTime } from '../types';
import type { Snapshot } from '../types';

const META_DB = 'campagnion-meta';
const CAMPAIGN_DB_PREFIX = 'campagnion-campaign-';

// ---------------------------------------------------------------------------
// Meta: Kampagnen-Register
// ---------------------------------------------------------------------------

/** Eintrag im Kampagnen-Wähler. Der Game-State selbst lebt in der Kampagnen-DB. */
export interface CampaignRef {
  id: CampaignId;
  name: string;
  createdAt: IsoDateTime;
  lastOpenedAt: IsoDateTime;
}

function openMeta(): Promise<IDBPDatabase> {
  return openDB(META_DB, 1, {
    upgrade(db) {
      db.createObjectStore('campaigns', { keyPath: 'id' });
    },
  });
}

/** Alle Kampagnen, zuletzt geöffnete zuerst. */
export async function listCampaigns(): Promise<CampaignRef[]> {
  const db = await openMeta();
  try {
    const refs = (await db.getAll('campaigns')) as CampaignRef[];
    return refs.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
  } finally {
    db.close();
  }
}

export async function registerCampaign(ref: CampaignRef): Promise<void> {
  const db = await openMeta();
  try {
    await db.put('campaigns', ref);
  } finally {
    db.close();
  }
}

/** lastOpenedAt aktualisieren (Sortierung des Wählers). */
export async function touchCampaign(id: CampaignId, lastOpenedAt: IsoDateTime): Promise<void> {
  const db = await openMeta();
  try {
    const ref = (await db.get('campaigns', id)) as CampaignRef | undefined;
    if (ref) await db.put('campaigns', { ...ref, lastOpenedAt });
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Kampagnen-Datenbank
// ---------------------------------------------------------------------------

/** Event mit seiner Log-Sequenznummer (IndexedDB-autoIncrement, 1-basiert). */
export interface StoredEvent {
  seq: number;
  event: GameEvent;
}

export interface StoredSnapshot {
  /** Sequenznummer des letzten im Snapshot enthaltenen Events. */
  lastSeq: number;
  snapshot: Snapshot;
}

export class CampaignStore {
  private constructor(
    private readonly db: IDBPDatabase,
    readonly campaignId: CampaignId,
  ) {}

  static async open(campaignId: CampaignId): Promise<CampaignStore> {
    const db = await openDB(CAMPAIGN_DB_PREFIX + campaignId, 1, {
      upgrade(db) {
        db.createObjectStore('events', { autoIncrement: true });
        db.createObjectStore('snapshots', { autoIncrement: true });
        db.createObjectStore('assets');
      },
    });
    return new CampaignStore(db, campaignId);
  }

  /** Append-only; liefert die vergebene Sequenznummer. */
  async appendEvent(event: GameEvent): Promise<number> {
    return (await this.db.add('events', event)) as number;
  }

  /** Alle Events mit seq > afterSeq, in Log-Reihenfolge. afterSeq 0 = kompletter Log. */
  async getEventsAfter(afterSeq: number): Promise<StoredEvent[]> {
    const tx = this.db.transaction('events');
    const range = afterSeq > 0 ? IDBKeyRange.lowerBound(afterSeq, true) : undefined;
    const out: StoredEvent[] = [];
    let cursor = await tx.store.openCursor(range);
    while (cursor) {
      out.push({ seq: cursor.key as number, event: cursor.value as GameEvent });
      cursor = await cursor.continue();
    }
    await tx.done;
    return out;
  }

  async saveSnapshot(snapshot: Snapshot, lastSeq: number): Promise<void> {
    const stored: StoredSnapshot = { lastSeq, snapshot };
    await this.db.add('snapshots', stored);
  }

  /** Jüngster Snapshot (höchster autoIncrement-Schlüssel) oder null. */
  async getLatestSnapshot(): Promise<StoredSnapshot | null> {
    const cursor = await this.db.transaction('snapshots').store.openCursor(null, 'prev');
    return cursor ? (cursor.value as StoredSnapshot) : null;
  }

  close(): void {
    this.db.close();
  }
}

// ---------------------------------------------------------------------------
// Aktuell geöffnete Kampagne (Singleton — Einzelnutzer, ein Gerät, §1)
// ---------------------------------------------------------------------------

let current: CampaignStore | null = null;

export function setCurrentStore(store: CampaignStore): void {
  if (current && current !== store) current.close();
  current = store;
}

export function getCurrentStore(): CampaignStore {
  if (!current) throw new Error('Keine Kampagne geöffnet');
  return current;
}

export function closeCurrentStore(): void {
  current?.close();
  current = null;
}

// ---------------------------------------------------------------------------
// Storage-Persistenz
// ---------------------------------------------------------------------------

/**
 * Beim Start anfordern (§2): bittet den Browser, die IndexedDB-Daten von der
 * automatischen Bereinigung auszunehmen (Edge Case 3). Safari gewährt das für
 * installierte PWAs; Ablehnung ist kein Fehler — Export bleibt das echte Backup.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
