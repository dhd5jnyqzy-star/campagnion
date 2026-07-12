/**
 * Grid-Overlay-Mathematik (§4.1): Zellen heißen Buchstabe+Zahl ("F7") —
 * die gemeinsame Referenzsprache für die Vorbereitung. Umrechnung zwischen
 * Grid-Referenzen und normalisierten Koordinaten (0–1); beim Import von
 * Paketen mit Grid-Positionen wird in die Zellmitte umgerechnet (§5).
 */

import type { GridConfig, GridRef, NormalizedPosition } from '../types';

const A = 'A'.charCodeAt(0);

/** 0 → "A", 25 → "Z", 26 → "AA", 27 → "AB", … (Excel-Schema, bijektiv). */
export function columnLabel(index: number): string {
  let label = '';
  let i = index;
  for (;;) {
    label = String.fromCharCode(A + (i % 26)) + label;
    i = Math.floor(i / 26) - 1;
    if (i < 0) return label;
  }
}

/** Umkehrung von columnLabel; wirft bei ungültiger Eingabe. */
export function columnIndex(label: string): number {
  if (!/^[A-Z]+$/.test(label)) throw new Error(`Ungültige Grid-Spalte: "${label}"`);
  let index = 0;
  for (const ch of label) {
    index = index * 26 + (ch.charCodeAt(0) - A + 1);
  }
  return index - 1;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Zellmitte der referenzierten Zelle in normalisierten Koordinaten. */
export function gridRefToNormalized(ref: GridRef, grid: GridConfig): NormalizedPosition {
  const col = columnIndex(ref.column);
  const row = ref.row - 1; // 1-basiert → 0-basiert
  return {
    x: clamp01((col + 0.5) / grid.columns),
    y: clamp01((row + 0.5) / grid.rows),
  };
}

/** Zelle, in der die normalisierte Position liegt. */
export function normalizedToGridRef(pos: NormalizedPosition, grid: GridConfig): GridRef {
  const col = Math.min(grid.columns - 1, Math.max(0, Math.floor(clamp01(pos.x) * grid.columns)));
  const row = Math.min(grid.rows - 1, Math.max(0, Math.floor(clamp01(pos.y) * grid.rows)));
  return { column: columnLabel(col), row: row + 1 };
}

/** Anzeige-Label einer Zelle, z. B. "F7". */
export function gridRefLabel(ref: GridRef): string {
  return `${ref.column}${ref.row}`;
}

/** Sinnvolles Standard-Grid für ein frisch importiertes Kartenbild: ~quadratische Zellen. */
export function defaultGrid(width: number, height: number): GridConfig {
  const columns = 24;
  const rows = Math.max(1, Math.round(columns * (height / width)));
  return { columns, rows };
}
