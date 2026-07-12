/** Speicheranzeige (§3.3 Asset / Edge Case 7). */

export interface StorageInfo {
  usage: number | null;
  quota: number | null;
  persisted: boolean;
}

export async function getStorageInfo(): Promise<StorageInfo> {
  let usage: number | null = null;
  let quota: number | null = null;
  let persisted = false;
  try {
    const estimate = await navigator.storage?.estimate?.();
    usage = estimate?.usage ?? null;
    quota = estimate?.quota ?? null;
    persisted = (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    // Ältere Browser: keine Anzeige, kein Fehler.
  }
  return { usage, quota, persisted };
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '–';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
