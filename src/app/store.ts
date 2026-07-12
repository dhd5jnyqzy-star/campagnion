/**
 * Redux-Store (§2): zwei getrennte Slice-Gruppen —
 * game (event-sourced, Quelle: IndexedDB-Log) und nav (Session-flüchtig).
 */

import { configureStore } from '@reduxjs/toolkit';
import gameReducer from '../features/game/gameSlice';
import navReducer from '../features/nav/navSlice';

export const store = configureStore({
  reducer: {
    game: gameReducer,
    nav: navReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
