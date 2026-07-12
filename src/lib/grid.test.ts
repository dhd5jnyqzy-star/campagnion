import { describe, expect, it } from 'vitest';
import {
  columnIndex,
  columnLabel,
  gridRefToNormalized,
  normalizedToGridRef,
} from './grid';

describe('grid', () => {
  it('bildet Spaltenindizes im Excel-Schema ab', () => {
    expect(columnLabel(0)).toBe('A');
    expect(columnLabel(25)).toBe('Z');
    expect(columnLabel(26)).toBe('AA');
    expect(columnLabel(27)).toBe('AB');
    expect(columnLabel(51)).toBe('AZ');
    expect(columnLabel(52)).toBe('BA');
  });

  it('columnIndex ist die Umkehrung von columnLabel', () => {
    for (const i of [0, 1, 25, 26, 27, 51, 52, 700]) {
      expect(columnIndex(columnLabel(i))).toBe(i);
    }
    expect(() => columnIndex('7')).toThrow();
  });

  it('rechnet Grid-Referenzen in Zellmitten um', () => {
    const grid = { columns: 10, rows: 5 };
    expect(gridRefToNormalized({ column: 'A', row: 1 }, grid)).toEqual({ x: 0.05, y: 0.1 });
    expect(gridRefToNormalized({ column: 'J', row: 5 }, grid)).toEqual({ x: 0.95, y: 0.9 });
  });

  it('findet die Zelle zu einer normalisierten Position (inkl. Randklemmung)', () => {
    const grid = { columns: 10, rows: 5 };
    expect(normalizedToGridRef({ x: 0.51, y: 0.55 }, grid)).toEqual({ column: 'F', row: 3 });
    expect(normalizedToGridRef({ x: 0, y: 0 }, grid)).toEqual({ column: 'A', row: 1 });
    expect(normalizedToGridRef({ x: 1, y: 1 }, grid)).toEqual({ column: 'J', row: 5 });
  });
});
