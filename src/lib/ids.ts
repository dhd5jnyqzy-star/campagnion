/** Frische UUID (v4) — für alle IDs (§3.3). Safari 15.4+ / alle Zielbrowser. */
export function newId(): string {
  return crypto.randomUUID();
}

/** Aktuelle Realzeit als ISO-8601-String für Event-Envelopes. */
export function nowIso(): string {
  return new Date().toISOString();
}
