// Remembers the last selection between visits (browser localStorage, which can be unavailable).
import { parseSelection, type Selection } from './selection';

const SELECTION_KEY = 'uv:selection';

/** The last selection, or an empty one. localStorage can be unavailable (private mode, blocked site data). */
export function loadSelection(): Selection {
  try {
    return parseSelection(localStorage.getItem(SELECTION_KEY));
  } catch {
    return parseSelection(null);
  }
}

/** Saves the selection. Failing to save is fine: remembering it is only a convenience. */
export function saveSelection(sel: Selection): void {
  try {
    localStorage.setItem(SELECTION_KEY, JSON.stringify(sel));
  } catch {
    // ignore
  }
}

/** The badge keys the user picked on one uniform last time (storageKey is per uniform). Unreadable gives none. */
export function loadPickedKeys(storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    const keys: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(keys) ? keys.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

/** Saves the badge keys picked on one uniform. Failing to save is fine. */
export function savePickedKeys(storageKey: string, keys: string[]): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(keys));
  } catch {
    // ignore
  }
}
