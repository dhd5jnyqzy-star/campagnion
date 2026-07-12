/**
 * Entitäten des Game-States (§3.3).
 *
 * Wichtig fürs Verständnis: Diese Interfaces beschreiben den *berechneten*
 * Zustand nach Replay des Event-Logs. Sie werden nie direkt mutiert — jede
 * Änderung läuft als Event (events.ts). Verknüpfungen sind immer IDs; bei
 * n:m-Beziehungen ist eine Seite kanonisch (dokumentiert am Feld), die
 * Rückrichtung wird per Selektor abgeleitet (§3.3 NPC: "Sidepanel zeigt
 * rückwärts alle Vorkommen").
 */

import type {
  AreaId,
  AssetId,
  CampaignId,
  CharacterId,
  CombatantId,
  CommentId,
  DeckCardId,
  DeckId,
  EncounterId,
  HandoutId,
  EnemyId,
  GameTime,
  GridConfig,
  GroupId,
  IsoDateTime,
  MapImageId,
  MarkerId,
  NormalizedPosition,
  NormalizedRect,
  NpcId,
  QuestId,
  SessionId,
  SheetVersionId,
  StatusEffect,
} from './common';

// ---------------------------------------------------------------------------
// Campaign & Spielwelt-Uhr
// ---------------------------------------------------------------------------

/**
 * Eine Kampagne ist ein komplett eigener Namespace mit eigenem Event-Log und
 * eigenen Assets (§3.3). Der Kampagnen-Wähler ist der Einstiegsbildschirm.
 */
export interface Campaign {
  id: CampaignId;
  name: string;
  createdAt: IsoDateTime;
  /**
   * Globale Spielwelt-Uhr (§3.4): sichtbar in der Kopfleiste, wird jedem
   * entstehenden Event automatisch als gameTime angeheftet.
   */
  clock: GameTime;
}

// ---------------------------------------------------------------------------
// Area & MapImage
// ---------------------------------------------------------------------------

/**
 * Hierarchischer Bereich (§3.3), z. B. Übersicht → Westliche Bucht →
 * Stadt/Hafen → Taverne. Ein Bereich hat eine Zone auf der Elternkarte
 * UND/ODER eigene Karten (MapImage.areaId zeigt hierher).
 */
export interface Area {
  id: AreaId;
  name: string;
  /** null = oberste Ebene (Übersicht). */
  parentId: AreaId | null;
  description?: string;
  /** Zone auf der Karte des Elternbereichs, in normalisierten Koordinaten. */
  zoneOnParent?: NormalizedRect;
  /**
   * Semantisches Zoomen (§4.1): ab diesem Canvas-Zoomfaktor blättert sich der
   * Bereich auf; darunter verdichtet er sich zum konfigurierten Badge.
   */
  zoomThreshold: number;
  badge: BadgeConfig;
}

/**
 * Konfigurierbares Badge (§3.3 Area): welche Infos werden beim Rauszoomen
 * nach oben durchgereicht — pro Bereich per Häkchen steuerbar.
 */
export interface BadgeConfig {
  showQuestMarkers: boolean;
  showEncounterCount: boolean;
  showText: boolean;
  /** Freitext fürs Badge, nur relevant wenn showText. */
  text?: string;
}

/**
 * Kartenbild eines Bereichs (§3.3). Das Pixel-Bild liegt als Blob hinter
 * assetId; alle Positionen darauf sind normalisiert (0–1) und überleben so
 * einen deckungsgleichen Bildtausch (Edge Case 5 — bewusst ohne Kalibrierung).
 */
export interface MapImage {
  id: MapImageId;
  areaId: AreaId;
  assetId: AssetId;
  name?: string;
  /** Reihenfolge, wenn ein Bereich mehrere Karten hat. */
  order: number;
  /** Grid-Overlay (§4.1), per Toggle ein-/ausblendbar. */
  grid?: GridConfig;
}

// ---------------------------------------------------------------------------
// Marker
// ---------------------------------------------------------------------------

export type MarkerType = 'location' | 'encounter' | 'npc' | 'quest' | 'note';

/**
 * Marker auf einer Karte (§3.3). Die Darstellung hängt vom Zustand des
 * Verknüpften ab (vorbereitet = hohl/gestrichelt, erlebt = gefüllt →
 * Gedächtnispunkt) und wird abgeleitet, nicht gespeichert.
 */
export interface Marker {
  id: MarkerId;
  areaId: AreaId;
  /** Auf welcher Karte des Bereichs; weglassen = Hauptkarte (niedrigste order). */
  mapImageId?: MapImageId;
  position: NormalizedPosition;
  type: MarkerType;
  name?: string;
  /** Verknüpfungen (n:m) — kanonische Seite für Marker↔Encounter/NPC/Quest. */
  encounterIds: EncounterId[];
  npcIds: NpcId[];
  questIds: QuestId[];
}

// ---------------------------------------------------------------------------
// Encounter, Enemy & Kampf
// ---------------------------------------------------------------------------

export type EncounterState = 'prepared' | 'active' | 'completed';

export interface Encounter {
  id: EncounterId;
  name: string;
  /** Beschreibung/Atmosphäre — Vorlesetext, Stimmung, Taktik-Notizen. */
  description: string;
  /** Verknüpfte Battlemaps, öffnen direkt aus dem Encounter (§3.3). */
  battlemapAssetIds: AssetId[];
  /** Gegnerliste der Vorbereitung; wächst im Kampf um spontane Gegner. */
  enemies: Enemy[];
  state: EncounterState;
  /** Gedächtnispunkt-Text nach Abschluss ("Kampf beenden" → Kommentarfeld, §4.4). */
  completionComment?: string;
  /**
   * Random-Pool (§3.3): ohne markerId lebt der Encounter im Pool und erhält
   * erst beim Einspeisen eine Position (encounter.placed-Event).
   */
  markerId?: MarkerId;
  /**
   * Kampfzustand ist Zustand des Encounters, nicht global (§4.4) → mehrere
   * parallel aktive Kämpfe möglich. Nur gesetzt, solange ein Kampf läuft.
   */
  combat?: CombatState;
}

/**
 * Gegner-Eintrag (§3.3 Enemy, §8): count > 1 bildet gleichartige Gruppen
 * ("4 Piraten") ab. Jedes Individuum hat einen eigenen HP-Slot; die
 * Initiative ist wahlweise geteilt (sharedInitiative = ein Sammeleintrag in
 * der Initiative-Liste) oder pro Individuum — beide Spielstile aus §8 sind
 * damit abgedeckt.
 */
export interface Enemy {
  id: EnemyId;
  name: string;
  /** Anzahl Individuen; 1 = Einzelgegner. */
  count: number;
  /** Max-HP pro Individuum. */
  maxHp: number;
  /** true = ein gemeinsamer Initiative-Eintrag für die ganze Gruppe. */
  sharedInitiative: boolean;
  /** Genau count Einträge, Index = Individuum ("Pirat 1" … "Pirat 4"). */
  slots: EnemySlot[];
  notes?: string;
}

export interface EnemySlot {
  /** Aktuelle HP. */
  hp: number;
  statusEffects: StatusEffect[];
  /**
   * tot/kampfunfähig (§4.4): wird bei hp ≤ 0 automatisch gesetzt
   * (durchgestrichen, rutscht ans Listenende, bleibt in der Liste),
   * ist aber manuell umschaltbar.
   */
  defeated: boolean;
}

/** Laufender Kampf eines Encounters (§4.4). */
export interface CombatState {
  startedAt: IsoDateTime;
  /** Rundenzähler, zählt automatisch pro Durchlauf der Initiative-Liste. */
  round: number;
  /** "Wer ist dran"-Marker, lebt pro Kampf. null = noch nicht gestartet. */
  activeCombatantId: CombatantId | null;
  /** Initiative-Liste; Sortierung nach initiative ist Sache der UI. */
  combatants: Combatant[];
}

/**
 * Eintrag in der Initiative-Liste: entweder ein Gruppenmitglied oder ein
 * Gegner. Bei Gegnern mit sharedInitiative steht slotIndex auf null
 * (Sammeleintrag für die ganze Gruppe), sonst zeigt er auf ein Individuum.
 * Statuseffekte hängen an Character.statusEffects bzw. EnemySlot.statusEffects.
 */
export type Combatant =
  | {
      id: CombatantId;
      kind: 'character';
      characterId: CharacterId;
      /** Gewürfelter Wert, manuell eingetippt; null = noch nicht eingetragen. */
      initiative: number | null;
    }
  | {
      id: CombatantId;
      kind: 'enemy';
      enemyId: EnemyId;
      /** null = Sammeleintrag (sharedInitiative), sonst Index in Enemy.slots. */
      slotIndex: number | null;
      initiative: number | null;
    };

// ---------------------------------------------------------------------------
// Quest & NPC
// ---------------------------------------------------------------------------

export type QuestStatus = 'open' | 'active' | 'completed';

export interface Quest {
  id: QuestId;
  name: string;
  description?: string;
  status: QuestStatus;
  /** Bauchgefühl-Fortschritt als Freitext, z. B. "1/3" (§3.3). */
  progressNote?: string;
  comments: Comment[];
  /** n:m Quest↔NPC — kanonische Seite; NPC-Sidepanel leitet Rückverweise ab. */
  npcIds: NpcId[];
  /** Weitere Verknüpfungen; die Marker-Seite ist kanonisch für Marker↔Quest. */
  areaIds: AreaId[];
  encounterIds: EncounterId[];
}

/**
 * Eigenständige NPC-Entität (§3.3): gleichzeitig an Marker UND Quests
 * verlinkbar. Die Verknüpfungen liegen kanonisch auf Marker.npcIds bzw.
 * Quest.npcIds; das Sidepanel zeigt rückwärts alle Vorkommen per Selektor.
 */
export interface Npc {
  id: NpcId;
  name: string;
  description?: string;
  /** Heimat-Location: Bereich und/oder konkreter Marker. */
  homeAreaId?: AreaId;
  homeMarkerId?: MarkerId;
  comments: Comment[];
}

/** Kommentar/Notiz mit beiden Zeitstempeln (Realzeit + Spielwelt-Zeit). */
export interface Comment {
  id: CommentId;
  text: string;
  realTime: IsoDateTime;
  gameTime: GameTime;
}

// ---------------------------------------------------------------------------
// Character & Group
// ---------------------------------------------------------------------------

export interface Character {
  id: CharacterId;
  name: string;
  /** Klasse, z. B. "Paladin". ("class" ist als Bezeichner ungünstig.) */
  className: string;
  race: string;
  level: number;
  maxHp: number;
  /** Freie Tags mit Vorschlagsliste (SUGGESTED_STATUS_EFFECTS). */
  statusEffects: StatusEffect[];
  /**
   * Sheet-Versionen (§3.3): Upload = Event, kein Löschen, nur Deaktivieren.
   * Chronologisch, neueste zuletzt.
   */
  sheets: SheetVersion[];
  /** Zeiger auf das aktive Sheet; null = keins aktiv. */
  activeSheetId: SheetVersionId | null;
}

export interface SheetVersion {
  id: SheetVersionId;
  /** PDF-Asset. */
  assetId: AssetId;
  uploadedAt: IsoDateTime;
  label?: string;
  deactivated: boolean;
}

/**
 * Gruppe (§3.3): Mitgliedschaft entsteht ausschließlich über
 * character.joinedGroup/leftGroup-Events → die historische Konstellation
 * stimmt beim Zurückspulen. memberIds und waypoints sind der materialisierte
 * Ist-Zustand nach Replay.
 */
export interface Group {
  id: GroupId;
  name: string;
  /** Aktuelle Mitglieder, abgeleitet aus den Join/Leave-Events. */
  memberIds: CharacterId[];
  /**
   * Positions-Historie = group.moved-Events; die Reiselinie auf der Karte ist
   * die gezeichnete Verbindung dieser Wegpunkte, mit Tagesangabe pro Punkt.
   */
  waypoints: GroupWaypoint[];
}

export interface GroupWaypoint {
  areaId: AreaId;
  mapImageId?: MapImageId;
  position: NormalizedPosition;
  /** Spielwelt-Tag der Ankunft an diesem Wegpunkt. */
  gameDay: number;
}

// ---------------------------------------------------------------------------
// Handout & Deck (Schema-Erweiterung M6)
// ---------------------------------------------------------------------------

/**
 * Handout (M6): frei platzierbare, aufklappbare Text-Kachel auf dem Canvas —
 * Vorlesetexte, Spickzettel, Briefe, Ortsnotizen. Ersetzt die Zettelwirtschaft:
 * zusammengeklappt nur der Titel, aufgeklappt der volle Text; der Zustand
 * bleibt gespeichert ("manche offen lassen"). Ohne Position lebt das Handout
 * in der Bibliothek und wird von dort platziert.
 */
export interface Handout {
  id: HandoutId;
  title: string;
  /** Fließtext; Leerzeilen trennen Absätze, "• " beginnt Aufzählungszeilen. */
  body: string;
  /** Gruppierung in der Bibliothek, z. B. "Cheat-Sheet", "Orte", "Briefe". */
  category?: string;
  areaId?: AreaId;
  mapImageId?: MapImageId;
  position?: NormalizedPosition;
  /** Aufgeklappt auf dem Canvas — bewusst persistiert (§3.1: alles ist Event). */
  expanded: boolean;
}

/**
 * Kartendeck (M6): eine Kategorie von Zieh-Karten (z. B. Überfahrtskarten
 * "Gute See"). Auf dem Canvas nur die Kategorie-Kachel; ein Tipp zieht eine
 * zufällige Karte der Kategorie (deck.cardDrawn-Event → Historie).
 */
export interface Deck {
  id: DeckId;
  name: string;
  /** Akzentfarbe der Kachel/Karten (CSS-Farbe). */
  color: string;
  cards: DeckCard[];
  areaId?: AreaId;
  mapImageId?: MapImageId;
  position?: NormalizedPosition;
  /** Zuletzt gezogene Karte (Replay-Ergebnis der cardDrawn-Events). */
  lastDrawnCardId?: DeckCardId;
}

export interface DeckCard {
  id: DeckCardId;
  title: string;
  /** Kartentext; gleiche Konventionen wie Handout.body. */
  body: string;
}

// ---------------------------------------------------------------------------
// Session & Asset
// ---------------------------------------------------------------------------

/**
 * Spielabend (§3.3): begrenzt durch session.started/ended-Events. Die History
 * ist nach Sessions filterbar; an Sessionsgrenzen entstehen Snapshots.
 */
export interface Session {
  id: SessionId;
  /** Laufende Nummer oder Name, z. B. "Session 12". */
  name?: string;
  startedAt: IsoDateTime;
  /** undefined = Session läuft noch. */
  endedAt?: IsoDateTime;
  /** Stand der Spielwelt-Uhr beim Sessionstart. */
  startGameTime: GameTime;
}

export type AssetKind = 'mapImage' | 'battlemap' | 'sheetPdf' | 'other';

/**
 * Asset-Metadaten (§3.3). Der Blob selbst liegt separat in IndexedDB bzw. als
 * Datei im Export-ZIP. Bilder werden beim Import automatisch auf eine
 * sinnvolle Maximalgröße skaliert (Edge Case 7); width/height beschreiben den
 * Zustand nach dem Downscaling.
 */
export interface AssetMeta {
  id: AssetId;
  kind: AssetKind;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width?: number;
  height?: number;
}
