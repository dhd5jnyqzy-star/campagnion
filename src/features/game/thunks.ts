/**
 * Async-Thunks: die Brücke zwischen IndexedDB (Event-Log) und Redux (State).
 *
 * Ablauf beim Anwenden eines neuen Events (§3.1): Envelope bauen (Spielwelt-
 * Zeitstempel + Session werden automatisch angeheftet, §3.4) → SOFORT in
 * IndexedDB persistieren → erst dann in den Redux-State einrechnen. Scheitert
 * das Schreiben, erreicht das Event den State nie — es gibt keinen
 * ungespeicherten Zustand (Edge Case 2).
 */

import { createAsyncThunk } from '@reduxjs/toolkit';
import type {
  AreaId,
  CampaignId,
  GameEvent,
  GameState,
  MapImage,
  MapImageId,
  Marker,
  NormalizedPosition,
} from '../../types';
import { newId, nowIso } from '../../lib/ids';
import { prepareImageImport } from '../../lib/image';
import { defaultGrid } from '../../lib/grid';
import {
  CampaignStore,
  getCurrentStore,
  registerCampaign,
  setCurrentStore,
  touchCampaign,
} from '../../persistence/db';
import { applyEvent, isCorrectionEvent, replay } from './replay';
import { selectPrimaryMapImage, selectRootArea } from './selectors';

/** Ergebnis von createCampaign/openCampaign. */
export interface OpenCampaignResult {
  campaignId: CampaignId;
  state: GameState | null;
  /** Sequenznummer des letzten eingerechneten Events. */
  lastSeq: number;
}

/**
 * Neues Event ohne die automatisch vergebenen Envelope-Felder — id, campaignId,
 * realTime, gameTime und sessionId setzt der Thunk. Distributiv über die Union,
 * damit type/payload zusammenpassen müssen.
 */
type DistributiveOmit<T, K extends keyof GameEvent> = T extends unknown ? Omit<T, K> : never;
export type NewGameEvent = DistributiveOmit<
  GameEvent,
  'id' | 'campaignId' | 'realTime' | 'gameTime' | 'sessionId'
>;

export interface AppendResult {
  seq: number;
  event: GameEvent;
  /** Gesetzt, wenn ein Korrektur-Event einen vollen Replay erzwungen hat. */
  replaced?: { state: GameState | null };
}

/** Minimaler Blick auf den Store-State, um zirkuläre Typimporte zu vermeiden. */
interface GameStateSlice {
  game: { campaignId: CampaignId | null; state: GameState | null };
}

/**
 * Kern des Event-Wegs: Envelope vervollständigen, persistieren, Ergebnis
 * liefern. `snapshot` ist der Game-State VOR dem Event (für Uhr + Session).
 */
async function persistEvent(
  campaignId: CampaignId,
  snapshot: GameState,
  input: NewGameEvent,
): Promise<AppendResult> {
  const store = getCurrentStore();
  const event = {
    ...input,
    id: newId(),
    campaignId,
    realTime: nowIso(),
    // Automatisches Anheften des Spielwelt-Zeitstempels (§3.4) und der Session.
    gameTime: { ...snapshot.campaign.clock },
    sessionId: snapshot.activeSessionId,
  } as GameEvent;

  const seq = await store.appendEvent(event);

  if (isCorrectionEvent(event)) {
    const all = await store.getEventsAfter(0);
    return { seq, event, replaced: { state: replay(all.map((s) => s.event)) } };
  }
  return { seq, event };
}

function requireOpenGame(state: unknown): { campaignId: CampaignId; game: GameState } {
  const { game } = state as GameStateSlice;
  if (!game.campaignId || !game.state) throw new Error('Keine Kampagne geöffnet');
  return { campaignId: game.campaignId, game: game.state };
}

export const createCampaign = createAsyncThunk(
  'game/createCampaign',
  async (name: string): Promise<OpenCampaignResult> => {
    const id = newId();
    const createdAt = nowIso();
    await registerCampaign({ id, name, createdAt, lastOpenedAt: createdAt });
    const store = await CampaignStore.open(id);
    setCurrentStore(store);
    const event: GameEvent = {
      id: newId(),
      campaignId: id,
      type: 'campaign.created',
      payload: { name },
      realTime: createdAt,
      gameTime: { day: 1, timeOfDay: 'morning' },
      sessionId: null,
    };
    const seq = await store.appendEvent(event);
    return { campaignId: id, state: applyEvent(null, event), lastSeq: seq };
  },
);

export const openCampaign = createAsyncThunk(
  'game/openCampaign',
  async (campaignId: CampaignId): Promise<OpenCampaignResult> => {
    const store = await CampaignStore.open(campaignId);
    setCurrentStore(store);
    await touchCampaign(campaignId, nowIso());

    // App-Start (§3.1): letzter Snapshot + nachfolgende Events. Enthält der
    // Log-Rest Korrektur-Events, können die Events VOR dem Snapshot betreffen
    // → kompletter Replay von vorn (korrekt vor schnell).
    const snap = await store.getLatestSnapshot();
    const rest = await store.getEventsAfter(snap?.lastSeq ?? 0);
    let state: GameState | null;
    let lastSeq = rest.length > 0 ? rest[rest.length - 1].seq : (snap?.lastSeq ?? 0);
    if (snap && !rest.some(({ event }) => isCorrectionEvent(event))) {
      state = rest.reduce<GameState | null>(
        (st, { event }) => applyEvent(st, event),
        snap.snapshot.state,
      );
    } else {
      const all = snap ? await store.getEventsAfter(0) : rest;
      state = replay(all.map(({ event }) => event));
      lastSeq = all.length > 0 ? all[all.length - 1].seq : 0;
    }
    return { campaignId, state, lastSeq };
  },
);

export const appendGameEvent = createAsyncThunk(
  'game/appendEvent',
  async (input: NewGameEvent, thunkApi): Promise<AppendResult> => {
    const { campaignId, game } = requireOpenGame(thunkApi.getState());
    return persistEvent(campaignId, game, input);
  },
);

/**
 * Hilfskonstrukt für Event-Batches: Events nacheinander persistieren, wobei
 * jedes Folge-Event auf dem Zwischenstand aufbaut (Area → MapImage usw.).
 */
function makeBatch(campaignId: CampaignId, start: GameState) {
  const results: AppendResult[] = [];
  let state = start;
  return {
    append: async (input: NewGameEvent) => {
      const result = await persistEvent(campaignId, state, input);
      state = applyEvent(state, result.event) ?? state;
      results.push(result);
    },
    get state() {
      return state;
    },
    results,
  };
}

/**
 * Kartenbild importieren (M2/M3, §3.3 MapImage): Blob herunterskalieren und in
 * IndexedDB ablegen, dann als Event-Batch anwenden:
 * - asset.imported (Metadaten)
 * - ohne areaId und ohne Wurzelbereich: area.created "Übersicht" + mapImage.added
 * - Bereich ohne Karte: mapImage.added; Bereich mit Karte: mapImage.replaced —
 *   deckungsgleicher Tausch, Marker bleiben (Edge Case 5, ohne Kalibrierung)
 */
export const importMapImage = createAsyncThunk(
  'game/importMapImage',
  async (args: { file: File; areaId?: AreaId }, thunkApi): Promise<AppendResult[]> => {
    const { campaignId, game } = requireOpenGame(thunkApi.getState());
    const prepared = await prepareImageImport(args.file);

    const assetId = newId();
    await getCurrentStore().putAsset(assetId, prepared.blob);

    const batch = makeBatch(campaignId, game);
    await batch.append({
      type: 'asset.imported',
      payload: {
        asset: {
          id: assetId,
          kind: 'mapImage',
          fileName: args.file.name,
          mimeType: prepared.mimeType,
          byteSize: prepared.blob.size,
          width: prepared.width,
          height: prepared.height,
        },
      },
    });

    let targetArea = args.areaId ? batch.state.areas[args.areaId] : selectRootArea(batch.state);
    if (!targetArea) {
      targetArea = {
        id: newId(),
        name: 'Übersicht',
        parentId: null,
        zoomThreshold: 0,
        badge: { showQuestMarkers: false, showEncounterCount: false, showText: false },
      };
      await batch.append({ type: 'area.created', payload: { area: targetArea } });
    }

    const existing = selectPrimaryMapImage(batch.state, targetArea.id);
    if (existing) {
      await batch.append({
        type: 'mapImage.replaced',
        payload: { mapImageId: existing.id, assetId },
      });
    } else {
      const mapImage: MapImage = {
        id: newId(),
        areaId: targetArea.id,
        assetId,
        order: 0,
        grid: defaultGrid(prepared.width, prepared.height),
      };
      await batch.append({ type: 'mapImage.added', payload: { mapImage } });
    }

    return batch.results;
  },
);

/**
 * Encounter aus dem Random-Pool einspeisen (§3.3): Marker anlegen (kanonische
 * Verknüpfung Marker→Encounter) + encounter.placed.
 */
export const placeEncounter = createAsyncThunk(
  'game/placeEncounter',
  async (
    args: {
      encounterId: string;
      areaId: AreaId;
      mapImageId?: MapImageId;
      position: NormalizedPosition;
    },
    thunkApi,
  ): Promise<AppendResult[]> => {
    const { campaignId, game } = requireOpenGame(thunkApi.getState());
    const encounter = game.encounters[args.encounterId];
    if (!encounter) throw new Error('Encounter nicht gefunden');

    const marker: Marker = {
      id: newId(),
      areaId: args.areaId,
      mapImageId: args.mapImageId,
      position: args.position,
      type: 'encounter',
      name: encounter.name,
      encounterIds: [args.encounterId],
      npcIds: [],
      questIds: [],
    };

    const batch = makeBatch(campaignId, game);
    await batch.append({ type: 'marker.created', payload: { marker } });
    await batch.append({
      type: 'encounter.placed',
      payload: { encounterId: args.encounterId, markerId: marker.id },
    });
    return batch.results;
  },
);

/**
 * Charakter-Sheet hochladen (§3.3 Character): PDF-Blob ablegen, als Version
 * anhängen und direkt aktivieren. Kein Löschen — nur Deaktivieren.
 */
export const uploadSheet = createAsyncThunk(
  'game/uploadSheet',
  async (args: { characterId: string; file: File }, thunkApi): Promise<AppendResult[]> => {
    const { campaignId, game } = requireOpenGame(thunkApi.getState());
    const assetId = newId();
    await getCurrentStore().putAsset(assetId, args.file);

    const sheetId = newId();
    const batch = makeBatch(campaignId, game);
    await batch.append({
      type: 'asset.imported',
      payload: {
        asset: {
          id: assetId,
          kind: 'sheetPdf',
          fileName: args.file.name,
          mimeType: args.file.type || 'application/pdf',
          byteSize: args.file.size,
        },
      },
    });
    await batch.append({
      type: 'character.sheetUploaded',
      payload: {
        characterId: args.characterId,
        sheet: { id: sheetId, assetId, uploadedAt: nowIso(), deactivated: false },
      },
    });
    await batch.append({
      type: 'character.sheetActivated',
      payload: { characterId: args.characterId, sheetVersionId: sheetId },
    });
    return batch.results;
  },
);

/**
 * Session beenden (§3.3 Session): session.ended-Event + Auto-Snapshot an der
 * Sessionsgrenze (§5) — App-Start lädt dann Snapshot + Log-Rest statt des
 * ganzen Logs (Edge Case 8).
 */
export const endSession = createAsyncThunk(
  'game/endSession',
  async (_: void, thunkApi): Promise<AppendResult> => {
    const { campaignId, game } = requireOpenGame(thunkApi.getState());
    if (!game.activeSessionId) throw new Error('Keine Session aktiv');
    const session = game.sessions[game.activeSessionId];
    const result = await persistEvent(campaignId, game, {
      type: 'session.ended',
      payload: { sessionId: game.activeSessionId },
    });
    const after = applyEvent(game, result.event);
    if (after) {
      await getCurrentStore().saveSnapshot(
        {
          campaignId,
          lastEventId: result.event.id,
          takenAt: nowIso(),
          label: `Ende ${session?.name ?? 'Session'}`,
          state: after,
        },
        result.seq,
      );
    }
    return result;
  },
);

/** Kontext fürs Undo (§3.2): "Undo im Encounter wirkt auf letzte Aktion dort". */
export type UndoScope = { scope: 'all' } | { scope: 'encounter'; encounterId: string };

function eventMatchesScope(e: GameEvent, scope: UndoScope): boolean {
  if (scope.scope === 'all') return true;
  const id = scope.encounterId;
  switch (e.type) {
    case 'combat.started':
    case 'combat.enemyAdded':
    case 'combat.initiativeSet':
    case 'combat.turnAdvanced':
    case 'combat.hpChanged':
    case 'combat.defeatToggled':
    case 'combat.ended':
    case 'encounter.updated':
    case 'encounter.placed':
    case 'encounter.completed':
      return e.payload.encounterId === id;
    case 'statusEffect.added':
    case 'statusEffect.removed':
      return e.payload.target.kind === 'enemy' && e.payload.target.encounterId === id;
    default:
      return false;
  }
}

/**
 * Kontextbezogenes Undo (§3.1/§3.2): nimmt das letzte noch wirksame Event im
 * Kontext per Korrektur-Event (event.revoked) zurück — nichts wird gelöscht,
 * der Replay rechnet die Rücknahme ein.
 */
export const undoLastEvent = createAsyncThunk(
  'game/undoLastEvent',
  async (args: UndoScope & { reason?: string }, thunkApi): Promise<AppendResult> => {
    const { campaignId, game } = requireOpenGame(thunkApi.getState());
    const stored = await getCurrentStore().getEventsAfter(0);
    const alreadyRevoked = new Set(
      stored
        .filter(({ event }) => event.type === 'event.revoked' && event.revokes)
        .map(({ event }) => event.revokes as string),
    );
    const candidates = stored.filter(
      ({ event }) =>
        event.type !== 'event.revoked' &&
        event.type !== 'campaign.created' &&
        event.amends === undefined &&
        !alreadyRevoked.has(event.id) &&
        eventMatchesScope(event, args),
    );
    const target = candidates[candidates.length - 1];
    if (!target) throw new Error('Nichts zum Zurücknehmen');
    return persistEvent(campaignId, game, {
      type: 'event.revoked',
      payload: { reason: args.reason },
      revokes: target.event.id,
    });
  },
);

/**
 * History-Zeitregler (§3.4): den Log bis zu einem Schnitt abspielen —
 * nach Spielwelt-Tag (Filter auf gameTime) oder bis zum Ende einer Session
 * (Schnitt in Log-Reihenfolge). Beides sind nur Sichten auf denselben Log.
 */
export const viewHistory = createAsyncThunk(
  'game/viewHistory',
  async (
    args: { mode: 'day'; day: number } | { mode: 'session'; sessionId: string },
    thunkApi,
  ): Promise<{ state: GameState | null; label: string }> => {
    const { game } = requireOpenGame(thunkApi.getState());
    const all = (await getCurrentStore().getEventsAfter(0)).map(({ event }) => event);
    if (args.mode === 'day') {
      const events = all.filter((e) => e.gameTime.day <= args.day);
      return { state: replay(events), label: `Ende Tag ${args.day}` };
    }
    const endIdx = all.findIndex(
      (e) => e.type === 'session.ended' && e.payload.sessionId === args.sessionId,
    );
    const events = endIdx >= 0 ? all.slice(0, endIdx + 1) : all;
    const name = game.sessions[args.sessionId]?.name ?? 'Session';
    return { state: replay(events), label: `Ende ${name}` };
  },
);

/** Battlemap-Bild an einen Encounter hängen (§3.3 Encounter). */
export const addBattlemap = createAsyncThunk(
  'game/addBattlemap',
  async (args: { encounterId: string; file: File }, thunkApi): Promise<AppendResult[]> => {
    const { campaignId, game } = requireOpenGame(thunkApi.getState());
    const encounter = game.encounters[args.encounterId];
    if (!encounter) throw new Error('Encounter nicht gefunden');

    const prepared = await prepareImageImport(args.file);
    const assetId = newId();
    await getCurrentStore().putAsset(assetId, prepared.blob);

    const batch = makeBatch(campaignId, game);
    await batch.append({
      type: 'asset.imported',
      payload: {
        asset: {
          id: assetId,
          kind: 'battlemap',
          fileName: args.file.name,
          mimeType: prepared.mimeType,
          byteSize: prepared.blob.size,
          width: prepared.width,
          height: prepared.height,
        },
      },
    });
    await batch.append({
      type: 'encounter.updated',
      payload: {
        encounterId: args.encounterId,
        changes: { battlemapAssetIds: [...encounter.battlemapAssetIds, assetId] },
      },
    });
    return batch.results;
  },
);
