/**
 * Navigation-Slice (§3.2): Session-flüchtiger UI-Zustand, strikt getrennt vom
 * event-sourced Game-State. In M1 nur die Wahl zwischen Kampagnen-Wähler und
 * Kampagnen-Ansicht; der echte Navigationsstack (Viewport-Historie, Zurück-
 * Leiste, grobe Persistenz für den Restore) kommt mit dem Canvas in M2.
 */

import { createSlice, isAnyOf } from '@reduxjs/toolkit';
import { campaignClosed } from '../game/gameSlice';
import { createCampaign, openCampaign } from '../game/thunks';

export interface NavSliceState {
  screen: 'selector' | 'campaign';
}

const initialState: NavSliceState = { screen: 'selector' };

const navSlice = createSlice({
  name: 'nav',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(campaignClosed, (s) => {
        s.screen = 'selector';
      })
      .addMatcher(isAnyOf(createCampaign.fulfilled, openCampaign.fulfilled), (s) => {
        s.screen = 'campaign';
      });
  },
});

export default navSlice.reducer;
