/**
 * Paket-Dateien lesen (§5): reines JSON (KI-Lieferung, Teilexport) oder ZIP
 * mit Assets (package.json bzw. einzige .json-Datei + Dateien laut Manifest).
 */

import { unzip, strFromU8 } from 'fflate';
import type { ContentPackage } from '../../types';
import { EXCHANGE_FORMAT_VERSION } from '../../types';
import { asBlobPart } from './campaignZip';

export interface ParsedPackage {
  pkg: ContentPackage;
  /** Asset-Blobs nach (Original-)AssetId; leer bei reinem JSON. */
  blobs: Map<string, Blob>;
}

const unzipAsync = (data: Uint8Array): Promise<Record<string, Uint8Array>> =>
  new Promise((resolve, reject) => {
    unzip(data, (err, files) => (err ? reject(err) : resolve(files)));
  });

function validate(pkg: ContentPackage): ContentPackage {
  if (pkg.formatVersion !== EXCHANGE_FORMAT_VERSION) {
    throw new Error(`Unbekannte Formatversion ${pkg.formatVersion}`);
  }
  if (typeof pkg.name !== 'string') throw new Error('Paket ohne Namen — kein ContentPackage?');
  return pkg;
}

/**
 * Paket aus eingefügtem/geladenem JSON-Text (kein Datei-Umweg — hilft auf iOS,
 * wo Safari .json unhandlich als .json.txt speichert). ZIP-Pakete mit Assets
 * gehen weiterhin nur über die Datei-Variante.
 */
export function parsePackageText(text: string): ParsedPackage {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Kein Text eingefügt.');
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw new Error('Das ist kein gültiges JSON — bitte den kompletten Text einfügen.');
  }
  return { pkg: validate(raw as ContentPackage), blobs: new Map() };
}

export async function parsePackageFile(file: File): Promise<ParsedPackage> {
  const isZip =
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed' ||
    file.name.toLowerCase().endsWith('.zip');

  if (!isZip) {
    const pkg = validate(JSON.parse(await file.text()) as ContentPackage);
    return { pkg, blobs: new Map() };
  }

  const files = await unzipAsync(new Uint8Array(await file.arrayBuffer()));
  const jsonPath =
    'package.json' in files
      ? 'package.json'
      : Object.keys(files).find((p) => p.toLowerCase().endsWith('.json') && !p.includes('/'));
  if (!jsonPath) throw new Error('Keine Paket-JSON im ZIP gefunden');
  const pkg = validate(JSON.parse(strFromU8(files[jsonPath])) as ContentPackage);

  const blobs = new Map<string, Blob>();
  for (const entry of pkg.assets ?? []) {
    const data = files[entry.path];
    if (data)
      blobs.set(entry.asset.id, new Blob([asBlobPart(data)], { type: entry.asset.mimeType }));
  }
  return { pkg, blobs };
}
