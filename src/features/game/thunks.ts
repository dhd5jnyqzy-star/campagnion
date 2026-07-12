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
import type { CampaignId, GameEvent, GameState } from '../../types';
import { newId, nowIso } from '../../lib/ids';
import {
  CampaignStore,
  getCurrentStore,
  registerCampaign,
  setCurrentStore,
  touchCampaign,
} from '../../persistence/db';
import { applyEvent, isCorrectionEvent, replay } from './replay';

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
    const { game } = thunkApi.getState() as GameStateSlice;
    if (!game.campaignId || !game.state) throw new Error('Keine Kampagne geöffnet');
    const store = getCurrentStore();

    const event = {
      ...input,
      id: newId(),
      campaignId: game.campaignId,
      realTime: nowIso(),
      // Automatisches Anheften des Spielwelt-Zeitstempels (§3.4) und der Session.
      gameTime: { ...game.state.campaign.clock },
      sessionId: game.state.activeSessionId,
    } as GameEvent;

    const seq = await store.appendEvent(event);

    if (isCorrectionEvent(event)) {
      const all = await store.getEventsAfter(0);
      return { seq, event, replaced: { state: replay(all.map((s) => s.event)) } };
    }
    return { seq, event };
  },
);
