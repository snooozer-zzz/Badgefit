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

export function saveSelection(sel: Selection): void {
  try {
    localStorage.setItem(SELECTION_KEY, JSON.stringify(sel));
  } catch {
    /* ignore: remembering the selection is a convenience only */
  }
}
