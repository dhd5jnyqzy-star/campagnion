/**
 * Navigation-Slice (§3.2): Session-flüchtiger UI-Zustand, strikt getrennt vom
 * event-sourced Game-State.
 *
 * Kernstücke ab M2:
 * - viewport: zuletzt bestätigter Kartenausschnitt (bei Gestenende committet;
 *   grob nach localStorage persistiert für den Restore)
 * - stack: Navigationsstack der Goto-Sprünge; die Zurück-Leiste bietet
 *   mehrere Ebenen gleichzeitig an (§4.3). Basis-Ebene "Übersicht" ist
 *   implizit immer da (Fit-View).
 * - peek: im Sidepanel geöffnete Entität — verändert den Viewport NICHT und
 *   landet NICHT im Stack (§3.2); erst die Goto-Aktion springt und pusht.
 * - flyTo: Auftrag an das Canvas, animiert zu einem Ziel zu zoomen. Ziele
 *   werden erst im Canvas aufgelöst (Fit braucht Containermaße, Marker können
 *   sich bewegt haben) — deshalb kein fertiger Viewport im Stack.
 */

import { createSlice, isAnyOf, type PayloadAction } from '@reduxjs/toolkit';
import { campaignClosed } from '../game/gameSlice';
import { createCampaign, openCampaign } from '../game/thunks';

/** Kartenausschnitt: Weltmittelpunkt + Zoom (Bildschirm-Pixel pro Welteinheit). */
export interface Viewport {
  cx: number;
  cy: number;
  zoom: number;
}

/** Navigationsziel; Auflösung zum konkreten Viewport passiert im Canvas. */
export type NavTarget = 'fit' | { markerId: string } | Viewport;

export interface NavStackEntry {
  label: string;
  target: NavTarget;
}

export type PeekTarget = { kind: 'marker'; id: string };

export interface NavSliceState {
  screen: 'selector' | 'campaign';
  viewport: Viewport | null;
  stack: NavStackEntry[];
  peek: PeekTarget | null;
  flyTo: { target: NavTarget; nonce: number } | null;
  gridVisible: boolean;
  placingMarker: boolean;
}

const initialState: NavSliceState = {
  screen: 'selector',
  viewport: null,
  stack: [],
  peek: null,
  flyTo: null,
  gridVisible: true,
  placingMarker: false,
};

let flyNonce = 0;

const navSlice = createSlice({
  name: 'nav',
  initialState,
  reducers: {
    /** Gestenende/Animationsende: Viewport als "aktuell" festhalten. */
    viewportCommitted(s, action: PayloadAction<Viewport>) {
      s.viewport = action.payload;
    },
    gridToggled(s) {
      s.gridVisible = !s.gridVisible;
    },
    markerPlacementToggled(s) {
      s.placingMarker = !s.placingMarker;
    },
    /** Peek im Sidepanel — bewusst ohne Viewport- oder Stack-Wirkung (§3.2). */
    peeked(s, action: PayloadAction<PeekTarget>) {
      s.peek = action.payload;
    },
    peekClosed(s) {
      s.peek = null;
    },
    /** Goto (§4.2): animierter Sprung, landet als Ebene im Navigationsstack. */
    gotoRequested(s, action: PayloadAction<NavStackEntry>) {
      s.stack.push(action.payload);
      s.flyTo = { target: action.payload.target, nonce: ++flyNonce };
      s.placingMarker = false;
    },
    /** Zurück-Leiste: zu einer früheren Ebene springen (Schrittwahl, §4.3). */
    jumpedBackTo(s, action: PayloadAction<number>) {
      const entry = s.stack[action.payload];
      if (!entry) return;
      s.stack = s.stack.slice(0, action.payload + 1);
      s.flyTo = { target: entry.target, nonce: ++flyNonce };
    },
    /** Basis-Ebene: ganze Karte (Fit-View), Stack wird geleert. */
    overviewRequested(s) {
      s.stack = [];
      s.flyTo = { target: 'fit', nonce: ++flyNonce };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(campaignClosed, () => ({ ...initialState }))
      .addMatcher(isAnyOf(createCampaign.fulfilled, openCampaign.fulfilled), () => ({
        ...initialState,
        screen: 'campaign' as const,
      }));
  },
});

export const {
  viewportCommitted,
  gridToggled,
  markerPlacementToggled,
  peeked,
  peekClosed,
  gotoRequested,
  jumpedBackTo,
  overviewRequested,
} = navSlice.actions;
export default navSlice.reducer;
