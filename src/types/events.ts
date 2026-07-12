/**
 * Event-Format und Event-Katalog (§3.1).
 *
 * Grundprinzip: Nichts ändert den Game-State direkt. Jede Mutation ist ein
 * Event, das sofort beim Entstehen in IndexedDB geschrieben wird. Aktueller
 * State = Replay des Logs (bzw. letzter Snapshot + Events danach).
 *
 * Korrekturen (§3.1): Events werden nie gelöscht.
 * - Vollständige Rücknahme: neues Event vom Typ 'event.revoked' mit gesetztem
 *   envelope-Feld `revokes` → das Original wird beim Replay ignoriert.
 * - Inhaltliche Korrektur: neues Event *gleichen Typs* mit gesetztem `amends`
 *   → beim Replay gilt das neue payload anstelle des Originals, an der
 *   ursprünglichen Position im Log. So kann z. B. eine world.dayAdvanced-
 *   Korrektur betroffenen Events rückwirkend den richtigen Tag zuordnen (§3.4).
 * Die Timeline zeigt Korrekturen optional an.
 */

import type {
  AreaId,
  AssetId,
  CampaignId,
  CharacterId,
  CombatantId,
  EncounterId,
  EnemyId,
  EventId,
  GameTime,
  GroupId,
  ImportId,
  IsoDateTime,
  MarkerId,
  MapImageId,
  NormalizedPosition,
  NpcId,
  QuestId,
  SessionId,
  SheetVersionId,
  StatusEffect,
  TimeOfDay,
} from './common';
import type {
  Area,
  AssetMeta,
  Character,
  Combatant,
  Comment,
  Encounter,
  Enemy,
  Group,
  GroupWaypoint,
  MapImage,
  Marker,
  Npc,
  Quest,
  QuestStatus,
  SheetVersion,
} from './entities';

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

/** Gemeinsamer Umschlag aller Events: { id, campaignId, type, payload, realTime, gameTime, sessionId } (§3.1). */
export interface EventBase<TType extends string, TPayload> {
  id: EventId;
  campaignId: CampaignId;
  type: TType;
  payload: TPayload;
  /** Realzeit der Entstehung. */
  realTime: IsoDateTime;
  /** Stand der Spielwelt-Uhr — wird jedem Event automatisch angeheftet (§3.4). */
  gameTime: GameTime;
  /** null = außerhalb einer Session entstanden (z. B. Datenpflege am PC). */
  sessionId: SessionId | null;
  /** Dieses Event nimmt das referenzierte vollständig zurück (nur bei 'event.revoked'). */
  revokes?: EventId;
  /** Dieses Event ersetzt das payload des referenzierten Events gleichen Typs. */
  amends?: EventId;
  /** Gesetzt, wenn das Event durch einen Import entstand (§5: Import = Batch von Events). */
  importId?: ImportId;
}

/**
 * Hilfstyp für Update-Events: partielle Änderung einer Entität, ID ausgenommen.
 * Felder, die selbst event-getragen sind (z. B. Group.memberIds), dürfen nicht
 * über updated-Events geändert werden — das erzwingen die konkreten Payloads.
 */
export type Changes<T> = Partial<Omit<T, 'id'>>;

// ---------------------------------------------------------------------------
// Kampagne, Spielwelt-Uhr, Session, Korrektur, Import
// ---------------------------------------------------------------------------

/** Erstes Event in jedem Kampagnen-Log. */
export type CampaignCreated = EventBase<'campaign.created', { name: string }>;
export type CampaignRenamed = EventBase<'campaign.renamed', { name: string }>;

/**
 * Weiterstellen der Spielwelt-Uhr (§3.4) — Weiter-Button wie direkte Tagwahl.
 * Selbst ein Event → versioniert und korrigierbar.
 */
export type WorldDayAdvanced = EventBase<'world.dayAdvanced', { to: GameTime }>;
/** Nur die Tageszeit innerhalb des Tages weiterstellen. */
export type WorldTimeOfDayChanged = EventBase<'world.timeOfDayChanged', { to: TimeOfDay }>;

export type SessionStarted = EventBase<'session.started', { sessionId: SessionId; name?: string }>;
export type SessionEnded = EventBase<'session.ended', { sessionId: SessionId }>;

/** Rücknahme eines früheren Events; das Ziel steht im envelope-Feld `revokes`. */
export type EventRevoked = EventBase<'event.revoked', { reason?: string }>;

/** Marker-Event eines Import-Batches; die importierten Events tragen dieselbe importId. */
export type ImportApplied = EventBase<
  'import.applied',
  { importId: ImportId; packageName: string; summary?: string }
>;

// ---------------------------------------------------------------------------
// Areas, Karten, Marker
// ---------------------------------------------------------------------------

export type AreaCreated = EventBase<'area.created', { area: Area }>;
export type AreaUpdated = EventBase<'area.updated', { areaId: AreaId; changes: Changes<Area> }>;

export type MapImageAdded = EventBase<'mapImage.added', { mapImage: MapImage }>;
export type MapImageUpdated = EventBase<
  'mapImage.updated',
  { mapImageId: MapImageId; changes: Changes<MapImage> }
>;
/** Deckungsgleicher Bildtausch (Edge Case 5): nur der Blob wechselt, Positionen bleiben. */
export type MapImageReplaced = EventBase<
  'mapImage.replaced',
  { mapImageId: MapImageId; assetId: AssetId }
>;

export type MarkerCreated = EventBase<'marker.created', { marker: Marker }>;
export type MarkerMoved = EventBase<
  'marker.moved',
  { markerId: MarkerId; position: NormalizedPosition }
>;
/** Auch für Verknüpfungen (encounterIds/npcIds/questIds). */
export type MarkerUpdated = EventBase<
  'marker.updated',
  { markerId: MarkerId; changes: Changes<Marker> }
>;

// ---------------------------------------------------------------------------
// Encounter & Kampf (§4.4)
// ---------------------------------------------------------------------------

export type EncounterCreated = EventBase<'encounter.created', { encounter: Encounter }>;
/** Vorbereitung: Name, Beschreibung, Battlemaps, Gegnerliste (enemies komplett ersetzen erlaubt). */
export type EncounterUpdated = EventBase<
  'encounter.updated',
  { encounterId: EncounterId; changes: Changes<Omit<Encounter, 'state' | 'combat'>> }
>;
/** Aus dem Random-Pool einspeisen: Encounter bekommt seinen Marker (§3.3). */
export type EncounterPlaced = EventBase<
  'encounter.placed',
  { encounterId: EncounterId; markerId: MarkerId }
>;
/** Abschluss ohne Kampf (erlebt/übersprungen) → Gedächtnispunkt. */
export type EncounterCompleted = EventBase<
  'encounter.completed',
  { encounterId: EncounterId; comment?: string }
>;

/** "Kampf starten": Encounter → active, Initiative-Liste vorbefüllt mit Gruppe + vorbereiteten Gegnern. */
export type CombatStarted = EventBase<
  'combat.started',
  { encounterId: EncounterId; combatants: Combatant[] }
>;
/** Spontanen Gegner mit einem Tipp nachschieben; enemy wird am Encounter angelegt. */
export type CombatEnemyAdded = EventBase<
  'combat.enemyAdded',
  { encounterId: EncounterId; enemy: Enemy; combatants: Combatant[] }
>;
export type CombatInitiativeSet = EventBase<
  'combat.initiativeSet',
  { encounterId: EncounterId; combatantId: CombatantId; initiative: number }
>;
/** Weiterschalten des "Wer ist dran"-Markers; round zählt pro Durchlauf automatisch hoch. */
export type CombatTurnAdvanced = EventBase<
  'combat.turnAdvanced',
  { encounterId: EncounterId; activeCombatantId: CombatantId; round: number }
>;
/** HP-Änderung eines Gegner-Individuums; delta negativ = Schaden. hp ≤ 0 setzt defeated automatisch. */
export type CombatHpChanged = EventBase<
  'combat.hpChanged',
  { encounterId: EncounterId; enemyId: EnemyId; slotIndex: number; delta: number }
>;
/** Manuelles Umschalten des tot/kampfunfähig-Markers (§4.4). */
export type CombatDefeatToggled = EventBase<
  'combat.defeatToggled',
  { encounterId: EncounterId; enemyId: EnemyId; slotIndex: number; defeated: boolean }
>;
/** "Kampf beenden" → Zusammenfassung, Encounter wird Gedächtnispunkt (completed). */
export type CombatEnded = EventBase<
  'combat.ended',
  { encounterId: EncounterId; summary: string }
>;

/** Statuseffekt-Ziel: Gruppenmitglied oder Gegner-Individuum (Tags an jedem Eintrag, §4.4). */
export type StatusEffectTarget =
  | { kind: 'character'; characterId: CharacterId }
  | { kind: 'enemy'; encounterId: EncounterId; enemyId: EnemyId; slotIndex: number };

export type StatusEffectAdded = EventBase<
  'statusEffect.added',
  { target: StatusEffectTarget; effect: StatusEffect }
>;
export type StatusEffectRemoved = EventBase<
  'statusEffect.removed',
  { target: StatusEffectTarget; effect: StatusEffect }
>;

// ---------------------------------------------------------------------------
// Quest & NPC
// ---------------------------------------------------------------------------

export type QuestCreated = EventBase<'quest.created', { quest: Quest }>;
export type QuestUpdated = EventBase<
  'quest.updated',
  { questId: QuestId; changes: Changes<Omit<Quest, 'status' | 'comments'>> }
>;
/** Eigenes Event (statt updated), damit Statuswechsel in der Timeline lesbar sind. */
export type QuestStatusChanged = EventBase<
  'quest.statusChanged',
  { questId: QuestId; status: QuestStatus }
>;
export type QuestCommentAdded = EventBase<
  'quest.commentAdded',
  { questId: QuestId; comment: Comment }
>;

export type NpcCreated = EventBase<'npc.created', { npc: Npc }>;
export type NpcUpdated = EventBase<
  'npc.updated',
  { npcId: NpcId; changes: Changes<Omit<Npc, 'comments'>> }
>;
export type NpcCommentAdded = EventBase<'npc.commentAdded', { npcId: NpcId; comment: Comment }>;

// ---------------------------------------------------------------------------
// Character & Group
// ---------------------------------------------------------------------------

export type CharacterCreated = EventBase<'character.created', { character: Character }>;
export type CharacterUpdated = EventBase<
  'character.updated',
  {
    characterId: CharacterId;
    changes: Changes<Omit<Character, 'sheets' | 'activeSheetId' | 'statusEffects'>>;
  }
>;
/** Upload = Event; Sheets werden nie gelöscht, nur deaktiviert (§3.3). */
export type CharacterSheetUploaded = EventBase<
  'character.sheetUploaded',
  { characterId: CharacterId; sheet: SheetVersion }
>;
export type CharacterSheetActivated = EventBase<
  'character.sheetActivated',
  { characterId: CharacterId; sheetVersionId: SheetVersionId }
>;
export type CharacterSheetDeactivated = EventBase<
  'character.sheetDeactivated',
  { characterId: CharacterId; sheetVersionId: SheetVersionId }
>;

/**
 * Mitgliedschaft als Events (§3.3 Group) → historische Gruppenkonstellation
 * stimmt beim Zurückspulen. Event-Namen exakt wie im Plan.
 */
export type CharacterJoinedGroup = EventBase<
  'character.joinedGroup',
  { characterId: CharacterId; groupId: GroupId }
>;
export type CharacterLeftGroup = EventBase<
  'character.leftGroup',
  { characterId: CharacterId; groupId: GroupId }
>;

/** group.memberIds/waypoints sind bei Erstellung leer und wachsen nur über Events. */
export type GroupCreated = EventBase<'group.created', { group: Group }>;
export type GroupUpdated = EventBase<
  'group.updated',
  { groupId: GroupId; changes: Changes<Omit<Group, 'memberIds' | 'waypoints'>> }
>;
/** Positions-Historie der Gruppe; die Reiselinie verbindet diese Wegpunkte (§3.3). */
export type GroupMoved = EventBase<'group.moved', { groupId: GroupId; waypoint: GroupWaypoint }>;

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

/** Metadaten im Log; der Blob wird separat (IndexedDB / ZIP) abgelegt. */
export type AssetImported = EventBase<'asset.imported', { asset: AssetMeta }>;

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

/** Alle Events einer Kampagne — das ist der Inhalt des Event-Logs. */
export type GameEvent =
  | CampaignCreated
  | CampaignRenamed
  | WorldDayAdvanced
  | WorldTimeOfDayChanged
  | SessionStarted
  | SessionEnded
  | EventRevoked
  | ImportApplied
  | AreaCreated
  | AreaUpdated
  | MapImageAdded
  | MapImageUpdated
  | MapImageReplaced
  | MarkerCreated
  | MarkerMoved
  | MarkerUpdated
  | EncounterCreated
  | EncounterUpdated
  | EncounterPlaced
  | EncounterCompleted
  | CombatStarted
  | CombatEnemyAdded
  | CombatInitiativeSet
  | CombatTurnAdvanced
  | CombatHpChanged
  | CombatDefeatToggled
  | CombatEnded
  | StatusEffectAdded
  | StatusEffectRemoved
  | QuestCreated
  | QuestUpdated
  | QuestStatusChanged
  | QuestCommentAdded
  | NpcCreated
  | NpcUpdated
  | NpcCommentAdded
  | CharacterCreated
  | CharacterUpdated
  | CharacterSheetUploaded
  | CharacterSheetActivated
  | CharacterSheetDeactivated
  | CharacterJoinedGroup
  | CharacterLeftGroup
  | GroupCreated
  | GroupUpdated
  | GroupMoved
  | AssetImported;

/** String-Union aller Event-Typen, z. B. für Filter in der Timeline. */
export type GameEventType = GameEvent['type'];
