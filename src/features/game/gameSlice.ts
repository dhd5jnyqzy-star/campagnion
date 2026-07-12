/**
 * Game-Slice (§2 State): der event-sourced Teil des Redux-States.
 *
 * Hält ausschließlich den aus dem Event-Log berechneten GameState plus
 * Lade-Metadaten. Der Log selbst lebt in IndexedDB (persistence/db.ts) und
 * wird nicht im Redux-State gespiegelt. Mutationen laufen nie über eigene
 * Reducer, sondern ausschließlich über die Thunks (persistieren → einrechnen).
 *
 * historyState (M4, §3.4): eine Vergangenheits-Sicht aus dem History-
 * Zeitregler — reine Anzeige, niemals Ziel von Mutationen; null = Gegenwart.
 */

import { createSlice, current, isAnyOf } from '@reduxjs/toolkit';
import type { CampaignId, GameState } from '../../types';
import { applyEvent } from './replay';
import {
  addBattlemap,
  appendGameEvent,
  applyContentPackage,
  createCampaign,
  endSession,
  importMapImage,
  openCampaign,
  placeEncounter,
  undoLastEvent,
  uploadSheet,
  viewHistory,
  type AppendResult,
} from './thunks';

/** Thunks mit einem einzelnen AppendResult (können Korrektur-Replays tragen). */
const singleThunks = [appendGameEvent, endSession, undoLastEvent] as const;
/** Thunks, die einen Batch von AppendResults liefern (nie Korrektur-Events). */
const batchThunks = [
  importMapImage,
  placeEncounter,
  uploadSheet,
  addBattlemap,
  applyContentPackage,
] as const;

export interface GameSliceState {
  campaignId: CampaignId | null;
  /** Berechneter Zustand; null solange keine Kampagne geöffnet ist. */
  state: GameState | null;
  /** Log-Sequenznummer des letzten eingerechneten Events. */
  lastSeq: number;
  /** Vergangenheits-Sicht des History-Zeitreglers; null = Gegenwart. */
  historyState: GameState | null;
  historyLabel: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}

const initialState: GameSliceState = {
  campaignId: null,
  state: null,
  lastSeq: 0,
  historyState: null,
  historyLabel: null,
  status: 'idle',
  error: null,
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    /** Zurück zum Kampagnen-Wähler; der CampaignStore wird vom Aufrufer geschlossen. */
    campaignClosed() {
      return initialState;
    },
    /** History-Zeitregler verlassen: zurück in die Gegenwart. */
    historyExited(s) {
      s.historyState = null;
      s.historyLabel = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(viewHistory.fulfilled, (s, action) => {
        s.historyState = action.payload.state;
        s.historyLabel = action.payload.label;
      })
      .addMatcher(isAnyOf(...singleThunks.map((t) => t.fulfilled)), (s, action) => {
        const { seq, event, replaced } = action.payload;
        s.lastSeq = seq;
        // Korrektur-Events erzwingen vollen Replay; alles andere wird live
        // eingerechnet. Wichtig: applyEvent nutzt selbst immer/produce und darf
        // deshalb nie auf dem Draft laufen — current() entdraftet zuerst,
        // sonst landen widerrufene Proxies im Store.
        s.state = replaced
          ? replaced.state
          : applyEvent(s.state ? (current(s) as GameSliceState).state : null, event);
      })
      .addMatcher(isAnyOf(...batchThunks.map((t) => t.fulfilled)), (s, action) => {
        let state = s.state ? (current(s) as GameSliceState).state : null;
        for (const { seq, event } of action.payload as AppendResult[]) {
          s.lastSeq = seq;
          state = applyEvent(state, event);
        }
        s.state = state;
      })
      .addMatcher(isAnyOf(createCampaign.pending, openCampaign.pending), (s) => {
        s.status = 'loading';
        s.error = null;
      })
      .addMatcher(isAnyOf(createCampaign.fulfilled, openCampaign.fulfilled), (s, action) => {
        s.campaignId = action.payload.campaignId;
        s.state = action.payload.state;
        s.lastSeq = action.payload.lastSeq;
        s.historyState = null;
        s.historyLabel = null;
        s.status = 'ready';
      })
      .addMatcher(
        isAnyOf(
          createCampaign.rejected,
          openCampaign.rejected,
          viewHistory.rejected,
          ...singleThunks.map((t) => t.rejected),
          ...batchThunks.map((t) => t.rejected),
        ),
        (s, action) => {
          // "Nichts zum Zurücknehmen" ist kein App-Fehler, nur ein No-Op.
          if (undoLastEvent.rejected.match(action)) return;
          s.status = 'error';
          s.error = action.error.message ?? 'Unbekannter Fehler';
        },
      );
  },
});

export const { campaignClosed, historyExited } = gameSlice.actions;
export default gameSlice.reducer;
