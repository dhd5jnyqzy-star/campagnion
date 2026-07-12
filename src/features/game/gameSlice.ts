/**
 * Game-Slice (§2 State): der event-sourced Teil des Redux-States.
 *
 * Hält ausschließlich den aus dem Event-Log berechneten GameState plus
 * Lade-Metadaten. Der Log selbst lebt in IndexedDB (persistence/db.ts) und
 * wird nicht im Redux-State gespiegelt — Timeline-Ansichten (M4) lesen ihn
 * direkt aus der DB. Mutationen laufen nie über eigene Reducer, sondern
 * ausschließlich über appendGameEvent (persistieren → einrechnen).
 */

import { createSlice, isAnyOf } from '@reduxjs/toolkit';
import type { CampaignId, GameState } from '../../types';
import { applyEvent } from './replay';
import {
  addBattlemap,
  appendGameEvent,
  createCampaign,
  importMapImage,
  openCampaign,
  placeEncounter,
  uploadSheet,
  type AppendResult,
} from './thunks';

/** Thunks, die einen Batch von AppendResults liefern (nie Korrektur-Events). */
const batchThunks = [importMapImage, placeEncounter, uploadSheet, addBattlemap] as const;

export interface GameSliceState {
  campaignId: CampaignId | null;
  /** Berechneter Zustand; null solange keine Kampagne geöffnet ist. */
  state: GameState | null;
  /** Log-Sequenznummer des letzten eingerechneten Events. */
  lastSeq: number;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}

const initialState: GameSliceState = {
  campaignId: null,
  state: null,
  lastSeq: 0,
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(appendGameEvent.fulfilled, (s, action) => {
        const { seq, event, replaced } = action.payload;
        s.lastSeq = seq;
        // Korrektur-Events erzwingen vollen Replay; alles andere wird live eingerechnet.
        s.state = replaced ? replaced.state : applyEvent(s.state as GameState | null, event);
      })
      .addMatcher(isAnyOf(...batchThunks.map((t) => t.fulfilled)), (s, action) => {
        for (const { seq, event } of action.payload as AppendResult[]) {
          s.lastSeq = seq;
          s.state = applyEvent(s.state as GameState | null, event);
        }
      })
      .addMatcher(isAnyOf(createCampaign.pending, openCampaign.pending), (s) => {
        s.status = 'loading';
        s.error = null;
      })
      .addMatcher(isAnyOf(createCampaign.fulfilled, openCampaign.fulfilled), (s, action) => {
        s.campaignId = action.payload.campaignId;
        s.state = action.payload.state;
        s.lastSeq = action.payload.lastSeq;
        s.status = 'ready';
      })
      .addMatcher(
        isAnyOf(
          createCampaign.rejected,
          openCampaign.rejected,
          appendGameEvent.rejected,
          ...batchThunks.map((t) => t.rejected),
        ),
        (s, action) => {
          s.status = 'error';
          s.error = action.error.message ?? 'Unbekannter Fehler';
        },
      );
  },
});

export const { campaignClosed } = gameSlice.actions;
export default gameSlice.reducer;
