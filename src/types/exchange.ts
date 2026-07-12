/**
 * Austauschformat für Import/Export & Backup (§5).
 *
 * Diese Typen sind gleichzeitig die Dokumentation des Formats für die
 * KI-gestützte Vorbereitung: Encounter mit Grid-Position, Gegnerliste inkl.
 * HP, NPCs und Quests werden als fertiges ContentPackage geliefert und
 * additiv importiert.
 *
 * Zwei Formate:
 * 1. CampaignExport — Vollexport (campaign.json im ZIP + Asset-Dateien).
 *    Immer der komplette Event-Log → Backup = vollständige Kopie inkl.
 *    Historie; Import auf anderem Gerät = identischer Stand.
 * 2. ContentPackage — Teilexport/-import einzelner Pakete (z. B. NPCs der
 *    nördlichen Stadt in eine andere Kampagne übernehmen, KI-Lieferungen).
 *
 * Import-Regeln (§5):
 * - Import ist additiv und wird als Batch von Events angewendet (alle mit
 *   derselben importId, abgeschlossen durch ein import.applied-Event).
 * - Neues bekommt frische UUIDs; Bestehendes wird nur per ID referenziert.
 * - ID-Kollision → Konfliktdialog, nie stumm überschreiben (Edge Case 6).
 */

import type {
  AreaId,
  CampaignId,
  IsoDateTime,
  MapImageId,
  MapPosition,
} from './common';
import type { Area, AssetMeta, Encounter, Marker, Npc, Quest } from './entities';
import type { GameEvent } from './events';

/** Wird bei inkompatiblen Änderungen am Format hochgezählt; Importer prüfen sie. */
export const EXCHANGE_FORMAT_VERSION = 1;

// ---------------------------------------------------------------------------
// Vollexport (Backup)
// ---------------------------------------------------------------------------

/**
 * Inhalt von campaign.json im Export-ZIP. Die Asset-Blobs liegen als Dateien
 * daneben (siehe AssetManifestEntry.path).
 */
export interface CampaignExport {
  formatVersion: number;
  exportedAt: IsoDateTime;
  campaignId: CampaignId;
  campaignName: string;
  /** Der komplette Event-Log in Entstehungsreihenfolge — inklusive Korrektur-Events. */
  events: GameEvent[];
  assets: AssetManifestEntry[];
}

export interface AssetManifestEntry {
  asset: AssetMeta;
  /** Pfad der Blob-Datei relativ zur ZIP-Wurzel, z. B. "assets/<assetId>.png". */
  path: string;
}

// ---------------------------------------------------------------------------
// Teilpaket (Teilimport / KI-Lieferung)
// ---------------------------------------------------------------------------

/**
 * Ein additiv importierbares Paket. Alle Entitäten tragen frische UUIDs;
 * Verweise auf Bestehendes (z. B. areaId einer vorhandenen Karte) nutzen
 * deren bekannte IDs. Kommt das Paket als ZIP mit Bildern, beschreibt
 * assets die Dateien; reine JSON-Pakete lassen assets weg.
 */
export interface ContentPackage {
  formatVersion: number;
  name: string;
  description?: string;
  areas?: Area[];
  markers?: PackagedMarker[];
  encounters?: PackagedEncounter[];
  npcs?: Npc[];
  quests?: Quest[];
  assets?: AssetManifestEntry[];
}

/**
 * Marker im Paket: Position darf als Grid-Koordinate ("F7") angegeben werden —
 * die gemeinsame Referenzsprache der Vorbereitung (§4.1). Beim Import wird sie
 * über den GridConfig der Zielkarte in normalisierte Koordinaten umgerechnet.
 */
export type PackagedMarker = Omit<Marker, 'position'> & { position: MapPosition };

/**
 * Encounter im Paket: immer im Zustand 'prepared', nie mit laufendem Kampf.
 * Mit placement erzeugt der Import einen Marker an der angegebenen Position;
 * ohne placement landet der Encounter im Random-Pool (§3.3).
 */
export type PackagedEncounter = Omit<Encounter, 'state' | 'combat' | 'markerId'> & {
  placement?: EncounterPlacement;
};

export interface EncounterPlacement {
  areaId: AreaId;
  /** Weglassen = Hauptkarte des Bereichs. */
  mapImageId?: MapImageId;
  position: MapPosition;
}

// ---------------------------------------------------------------------------
// Import-Konflikte
// ---------------------------------------------------------------------------

/**
 * Ergebnis der ID-Prüfung vor dem Anwenden eines Imports. Konflikte werden
 * dem Nutzer im Konfliktdialog vorgelegt — nie stumm überschreiben (§5).
 */
export interface ImportConflict {
  /** Kollidierende ID (existiert bereits in der Ziel-Kampagne). */
  id: string;
  entityKind: 'area' | 'marker' | 'encounter' | 'npc' | 'quest' | 'asset';
  /** Anzeigename der vorhandenen bzw. importierten Entität für den Dialog. */
  existingName: string;
  incomingName: string;
}

/** Entscheidung des Nutzers pro Konflikt. */
export type ImportConflictResolution =
  | { id: string; action: 'skip' }
  | { id: string; action: 'importAsNew'; /** Import erhält eine frische UUID. */ newId: string };
