/**
 * Berechneter Game-State und Snapshot-Format (§3.1).
 *
 * GameState ist das Ergebnis des Event-Replays — er wird nie direkt mutiert,
 * sondern vom Reducer aus dem Log berechnet. Snapshots frieren diesen Zustand
 * periodisch ein (an Sessionsgrenzen), damit der App-Start nicht den ganzen
 * Log abspielen muss: letzter Snapshot + nachfolgende Events (Edge Case 8).
 *
 * Der Navigation-State (Viewport, Zoom, Navigationsstack, §3.2) ist bewusst
 * NICHT Teil dieses Modells — er ist Session-flüchtig, lebt in einem eigenen
 * Redux-Slice und wird nur grob für den Restore persistiert.
 */

import type {
  AreaId,
  AssetId,
  CampaignId,
  CharacterId,
  DeckId,
  EncounterId,
  EventId,
  GroupId,
  HandoutId,
  IsoDateTime,
  MapImageId,
  MarkerId,
  NpcId,
  QuestId,
  SessionId,
} from './common';
import type {
  Area,
  AssetMeta,
  Campaign,
  Character,
  Deck,
  Encounter,
  Group,
  Handout,
  MapImage,
  Marker,
  Npc,
  Quest,
  Session,
} from './entities';

/** Vollständiger, aus dem Event-Log berechneter Zustand einer Kampagne. */
export interface GameState {
  campaign: Campaign;
  areas: Record<AreaId, Area>;
  mapImages: Record<MapImageId, MapImage>;
  markers: Record<MarkerId, Marker>;
  encounters: Record<EncounterId, Encounter>;
  quests: Record<QuestId, Quest>;
  npcs: Record<NpcId, Npc>;
  characters: Record<CharacterId, Character>;
  groups: Record<GroupId, Group>;
  handouts: Record<HandoutId, Handout>;
  decks: Record<DeckId, Deck>;
  sessions: Record<SessionId, Session>;
  assets: Record<AssetId, AssetMeta>;
  /** Laufende Session (session.started ohne session.ended), sonst null. */
  activeSessionId: SessionId | null;
}

/**
 * Benannter Sicherungspunkt (§5 Auto-Snapshots): eingefrorener GameState bis
 * einschließlich lastEventId. App-Start = Snapshot laden + Events danach
 * abspielen. Ältere Sessions müssen nicht auf dem Tablet abrufbar sein —
 * Snapshot + Log-Rest genügt (Edge Case 8).
 */
export interface Snapshot {
  campaignId: CampaignId;
  /** Letztes im Snapshot enthaltene Event. */
  lastEventId: EventId;
  takenAt: IsoDateTime;
  /** z. B. "Ende Session 12". */
  label?: string;
  state: GameState;
}
