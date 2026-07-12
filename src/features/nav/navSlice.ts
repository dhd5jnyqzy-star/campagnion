/**
 * Navigation-Slice (§3.2): Session-flüchtiger UI-Zustand, strikt getrennt vom
 * event-sourced Game-State.
 *
 * Ab M3 kommt die Bereichs-Navigation dazu: currentAreaId bestimmt, welcher
 * Bereich auf dem Canvas liegt (null = Wurzelbereich "Übersicht"). Goto-Ziele
 * tragen ihren Bereich mit, damit ein Sprung zu einem Marker in einer anderen
 * Karte zuerst den Bereich wechselt. Der Peek im Sidepanel bleibt ohne
 * Viewport- und Stack-Wirkung (§3.2).
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
export type NavTarget =
  | 'fit'
  | { markerId: string; areaId: string }
  | { areaId: string }
  | Viewport;

export interface NavStackEntry {
  label: string;
  target: NavTarget;
}

export type PeekKind =
  | 'marker'
  | 'encounter'
  | 'npc'
  | 'quest'
  | 'character'
  | 'group'
  | 'area'
  | 'handout'
  | 'deck';

export interface PeekTarget {
  kind: PeekKind;
  id: string;
}

/** Aktiver Platzier-Modus: der nächste Tipp aufs Canvas setzt etwas. */
export type PlacingMode =
  | { kind: 'marker' }
  | { kind: 'area' }
  | { kind: 'encounter'; encounterId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'handout'; handoutId: string }
  | { kind: 'deck'; deckId: string }
  | null;

export interface NavSliceState {
  screen: 'selector' | 'campaign';
  /** null = Wurzelbereich. */
  currentAreaId: string | null;
  viewport: Viewport | null;
  stack: NavStackEntry[];
  peek: PeekTarget | null;
  flyTo: { target: NavTarget; nonce: number } | null;
  gridVisible: boolean;
  placing: PlacingMode;
  /** Bibliotheks-Panel (Encounter/Quests/NSCs/Gruppe) ein-/ausgeklappt (§4.1). */
  dockOpen: boolean;
  /**
   * Geöffneter Kampfbildschirm (§4.4). Der Kampf-ZUSTAND lebt am Encounter —
   * hier steht nur, welcher Kampf gerade angezeigt wird; parallele Kämpfe
   * laufen weiter und sind per Navigation erreichbar.
   */
  combatEncounterId: string | null;
  /** Gerade gezogene Deck-Karte (Overlay); das Ziehen selbst ist ein Event. */
  drawnCard: { deckId: string; cardId: string } | null;
}

const initialState: NavSliceState = {
  screen: 'selector',
  currentAreaId: null,
  viewport: null,
  stack: [],
  peek: null,
  flyTo: null,
  gridVisible: true,
  placing: null,
  dockOpen: false,
  combatEncounterId: null,
  drawnCard: null,
};

let flyNonce = 0;

function areaOfTarget(target: NavTarget): string | null | undefined {
  if (target === 'fit') return null;
  if (typeof target === 'object' && 'areaId' in target) return target.areaId;
  return undefined; // reiner Viewport: Bereich unverändert
}

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
    dockToggled(s) {
      s.dockOpen = !s.dockOpen;
    },
    placingChanged(s, action: PayloadAction<PlacingMode>) {
      s.placing = action.payload;
    },
    /** Peek im Sidepanel — bewusst ohne Viewport- oder Stack-Wirkung (§3.2). */
    peeked(s, action: PayloadAction<PeekTarget>) {
      s.peek = action.payload;
    },
    peekClosed(s) {
      s.peek = null;
    },
    combatOpened(s, action: PayloadAction<string>) {
      s.combatEncounterId = action.payload;
      s.peek = null;
      s.placing = null;
    },
    combatClosed(s) {
      s.combatEncounterId = null;
    },
    cardShown(s, action: PayloadAction<{ deckId: string; cardId: string }>) {
      s.drawnCard = action.payload;
    },
    cardOverlayClosed(s) {
      s.drawnCard = null;
    },
    /** Goto (§4.2): animierter Sprung, landet als Ebene im Navigationsstack. */
    gotoRequested(s, action: PayloadAction<NavStackEntry>) {
      s.stack.push(action.payload);
      const area = areaOfTarget(action.payload.target);
      if (area !== undefined) s.currentAreaId = area;
      s.flyTo = { target: action.payload.target, nonce: ++flyNonce };
      s.placing = null;
    },
    /** Zurück-Leiste: zu einer früheren Ebene springen (Schrittwahl, §4.3). */
    jumpedBackTo(s, action: PayloadAction<number>) {
      const entry = s.stack[action.payload];
      if (!entry) return;
      s.stack = s.stack.slice(0, action.payload + 1);
      const area = areaOfTarget(entry.target);
      if (area !== undefined) s.currentAreaId = area;
      s.flyTo = { target: entry.target, nonce: ++flyNonce };
    },
    /** Basis-Ebene: Wurzelkarte (Fit-View), Stack wird geleert. */
    overviewRequested(s) {
      s.stack = [];
      s.currentAreaId = null;
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
  dockToggled,
  placingChanged,
  peeked,
  peekClosed,
  combatOpened,
  combatClosed,
  cardShown,
  cardOverlayClosed,
  gotoRequested,
  jumpedBackTo,
  overviewRequested,
} = navSlice.actions;
export default navSlice.reducer;
