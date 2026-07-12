/**
 * Zentrale Typdefinitionen des Blauwasser GM Tools (M1.1, PLAN.md).
 *
 * - common.ts    IDs, Zeit (Realzeit + Spielwelt-Uhr), Positionen, Grid
 * - entities.ts  Entitäten des berechneten Game-States (§3.3)
 * - events.ts    Event-Envelope + vollständiger Event-Katalog (§3.1)
 * - state.ts     GameState (Replay-Ergebnis) und Snapshot-Format
 * - exchange.ts  Import/Export: Vollexport (Backup) und ContentPackage (§5)
 */

export * from './common';
export * from './entities';
export * from './events';
export * from './state';
export * from './exchange';
