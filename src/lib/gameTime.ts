import type { GameTime, TimeOfDay } from '../types';

export const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: 'morgens',
  noon: 'mittags',
  evening: 'abends',
  night: 'nachts',
};

/** "Tag 3, abends" — Anzeige der Spielwelt-Uhr (§3.4). */
export function formatGameTime(gt: GameTime): string {
  return `Tag ${gt.day}, ${TIME_LABELS[gt.timeOfDay]}`;
}
