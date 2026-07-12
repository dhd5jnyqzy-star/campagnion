/**
 * Vollexport & Vollimport (§5): Export ist immer der komplette Event-Log +
 * Assets als ZIP → Backup = vollständige Kopie inkl. Historie; Import auf
 * einem anderen Gerät = identischer Stand. Das ist der Sync-Weg PC ↔ iPad.
 *
 * ZIP-Layout: campaign.json (CampaignExport) + assets/<assetId>.<ext>
 */

import { unzip, zip, strFromU8, strToU8 } from 'fflate';
import type { AssetManifestEntry, CampaignExport, GameEvent, GameState } from '../../types';
import { EXCHANGE_FORMAT_VERSION } from '../../types';
import { newId, nowIso } from '../../lib/ids';
import { CampaignStore, registerCampaign, type CampaignRef } from '../../persistence/db';

function extensionFor(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}

/** fflate liefert reguläre ArrayBuffer-gestützte Arrays; TS 5.7 braucht den Hinweis. */
export const asBlobPart = (u8: Uint8Array): Uint8Array<ArrayBuffer> =>
  u8 as Uint8Array<ArrayBuffer>;

const zipAsync = (files: Record<string, Uint8Array>): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    zip(files, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data)));
  });

const unzipAsync = (data: Uint8Array): Promise<Record<string, Uint8Array>> =>
  new Promise((resolve, reject) => {
    unzip(data, (err, files) => (err ? reject(err) : resolve(files)));
  });

/** campaign.json bauen — pur, damit der Roundtrip testbar ist. */
export function buildCampaignExport(state: GameState, events: GameEvent[]): CampaignExport {
  const assets: AssetManifestEntry[] = Object.values(state.assets).map((asset) => ({
    asset,
    path: `assets/${asset.id}.${extensionFor(asset.mimeType)}`,
  }));
  return {
    formatVersion: EXCHANGE_FORMAT_VERSION,
    exportedAt: nowIso(),
    campaignId: state.campaign.id,
    campaignName: state.campaign.name,
    events,
    assets,
  };
}

/** Kompletten Stand der geöffneten Kampagne als ZIP-Blob bauen. */
export async function buildCampaignZip(state: GameState, store: CampaignStore): Promise<Blob> {
  const events = (await store.getEventsAfter(0)).map(({ event }) => event);
  const exportData = buildCampaignExport(state, events);
  const files: Record<string, Uint8Array> = {
    'campaign.json': strToU8(JSON.stringify(exportData, null, 2)),
  };
  for (const entry of exportData.assets) {
    const blob = await store.getAsset(entry.asset.id);
    if (blob) files[entry.path] = new Uint8Array(await blob.arrayBuffer());
  }
  return new Blob([asBlobPart(await zipAsync(files))], { type: 'application/zip' });
}

export interface ParsedCampaignZip {
  export: CampaignExport;
  /** Asset-Blobs nach AssetId. */
  blobs: Map<string, Blob>;
}

export async function parseCampaignZip(file: File | Blob): Promise<ParsedCampaignZip> {
  const files = await unzipAsync(new Uint8Array(await file.arrayBuffer()));
  const json = files['campaign.json'];
  if (!json) throw new Error('Kein campaign.json im ZIP — ist das ein Campagnion-Export?');
  const exportData = JSON.parse(strFromU8(json)) as CampaignExport;
  if (exportData.formatVersion !== EXCHANGE_FORMAT_VERSION) {
    throw new Error(`Unbekannte Formatversion ${exportData.formatVersion}`);
  }
  const blobs = new Map<string, Blob>();
  for (const entry of exportData.assets ?? []) {
    const data = files[entry.path];
    if (data) {
      blobs.set(entry.asset.id, new Blob([asBlobPart(data)], { type: entry.asset.mimeType }));
    }
  }
  return { export: exportData, blobs };
}

export type FullImportMode = 'new' | 'replace' | 'copy';

/**
 * Vollimport in einen (neuen) Kampagnen-Namespace.
 * - 'new':     Kampagne existiert lokal nicht → identischer Stand (§5)
 * - 'replace': bestehende Kampagne wird nach explizitem Dialog ersetzt
 * - 'copy':    frische campaignId, Events werden umgeschrieben
 */
export async function importCampaignFromZip(
  parsed: ParsedCampaignZip,
  mode: FullImportMode,
): Promise<CampaignRef> {
  const source = parsed.export;
  const campaignId = mode === 'copy' ? newId() : source.campaignId;
  if (mode === 'replace') {
    await CampaignStore.deleteDatabase(campaignId);
  }

  const events =
    mode === 'copy' ? source.events.map((e) => ({ ...e, campaignId })) : source.events;

  const store = await CampaignStore.open(campaignId);
  try {
    await store.appendEvents(events);
    for (const [assetId, blob] of parsed.blobs) {
      await store.putAsset(assetId, blob);
    }
  } finally {
    store.close();
  }

  const ref: CampaignRef = {
    id: campaignId,
    name: mode === 'copy' ? `${source.campaignName} (Kopie)` : source.campaignName,
    createdAt: events[0]?.realTime ?? nowIso(),
    lastOpenedAt: nowIso(),
  };
  await registerCampaign(ref);
  return ref;
}
