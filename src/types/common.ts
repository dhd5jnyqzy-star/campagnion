/**
 * Gemeinsame Basistypen: IDs, Zeit, Positionen.
 *
 * Diese Typen sind das Vokabular für alle Entitäten (entities.ts),
 * Events (events.ts) und das Austauschformat (exchange.ts).
 */

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------
// Alle IDs sind UUIDs (v4). Neue Entitäten bekommen frische UUIDs — auch in
// Import-Paketen (§3.3, §5): Pakete verwenden frische IDs für Neues und
// referenzieren Bestehendes nur per ID.

export type CampaignId = string;
export type AreaId = string;
export type MapImageId = string;
export type MarkerId = string;
export type EncounterId = string;
export type EnemyId = string;
export type QuestId = string;
export type NpcId = string;
export type CharacterId = string;
export type GroupId = string;
export type SessionId = string;
export type AssetId = string;
export type EventId = string;
export type SheetVersionId = string;
export type CombatantId = string;
export type CommentId = string;
export type ImportId = string;
export type HandoutId = string;
export type DeckId = string;
export type DeckCardId = string;

// ---------------------------------------------------------------------------
// Zeit
// ---------------------------------------------------------------------------

/** Realzeit als ISO-8601-String, z. B. "2026-07-12T14:03:00.000Z". */
export type IsoDateTime = string;

/** Tageszeit der Spielwelt-Uhr (§3.4). */
export type TimeOfDay = 'morning' | 'noon' | 'evening' | 'night';

/** Zeitstempel der Spielwelt-Uhr: In-Game-Tag + Tageszeit (§3.4). */
export interface GameTime {
  /** Kampagnentag, 1-basiert, monoton steigend. */
  day: number;
  timeOfDay: TimeOfDay;
}

// ---------------------------------------------------------------------------
// Positionen
// ---------------------------------------------------------------------------

/**
 * Kanonische Position auf einem Kartenbild: normalisiert auf 0–1 relativ zu
 * Breite/Höhe des Bildes (§3.3 MapImage). Es werden nie Pixel gespeichert —
 * so überlebt eine Position den deckungsgleichen Bildtausch (Edge Case 5).
 */
export interface NormalizedPosition {
  /** 0 = linker Rand, 1 = rechter Rand. */
  x: number;
  /** 0 = oberer Rand, 1 = unterer Rand. */
  y: number;
}

/** Rechteck in normalisierten Koordinaten, z. B. Zone eines Bereichs auf der Elternkarte. */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Konfiguration des Grid-Overlays pro Kartenbild (§4.1): das Bild wird in
 * columns × rows gleich große Zellen geteilt. Zellen werden als Buchstabe+Zahl
 * referenziert (Spalte A–Z, AA–…, Zeile 1-basiert), z. B. "F7".
 */
export interface GridConfig {
  columns: number;
  rows: number;
}

/** Grid-Zellreferenz ("F7"). Nur sinnvoll zusammen mit dem GridConfig der Zielkarte. */
export interface GridRef {
  /** Spaltenbuchstabe(n): "A"–"Z", danach "AA", "AB", … */
  column: string;
  /** Zeile, 1-basiert. */
  row: number;
}

/**
 * Position im Austauschformat: entweder normalisiert oder als Grid-Koordinate
 * (gemeinsame Referenzsprache für die Vorbereitung, §4.1). Intern wird immer
 * normalisiert gespeichert; Grid-Angaben werden beim Import über den GridConfig
 * der Zielkarte in die Zellmitte umgerechnet.
 */
export type MapPosition =
  | ({ kind: 'normalized' } & NormalizedPosition)
  | ({ kind: 'grid' } & GridRef);

// ---------------------------------------------------------------------------
// Statuseffekte
// ---------------------------------------------------------------------------

/** Freier Tag; die UI bietet eine Vorschlagsliste an (§3.3 Character). */
export type StatusEffect = string;

/** Vorschlagsliste für die Tag-Eingabe — erweiterbar, keine Einschränkung des Typs. */
export const SUGGESTED_STATUS_EFFECTS: readonly StatusEffect[] = [
  'unconscious',
  'prone',
  'poisoned',
  'stunned',
  'frightened',
  'grappled',
  'restrained',
  'blinded',
  'charmed',
  'invisible',
  'concentrating',
];
