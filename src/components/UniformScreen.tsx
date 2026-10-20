import { useEffect, useMemo, useState } from 'react';
import { badges, categories, mountedList, options } from '../data';
import type { Badge, Uniform } from '../data/schema';
import { resolveMounted } from '../lib/art';
import { libraryBadges, libraryCategories } from '../lib/library';
import { badgeKey, findAnchor, layoutBadges, placeBadge } from '../lib/placement';
import { describeSelection, loadoutFor, loadoutKeys, type Selection } from '../lib/selection';
import { BadgeLibrary } from './BadgeLibrary';
import { UniformStage } from './UniformStage';

/** Badges are always drawn at real-world size; there is no size control. */
const BADGE_SCALE = 1;

const badgeByKey = new Map(badges.map((b) => [badgeKey(b), b]));
const pickableCategories = libraryCategories(categories);
const pickableBadges = libraryBadges(badges, categories);
const pickableKeys = new Set(pickableBadges.map(badgeKey));

/** The badges the user picked on this uniform last time. Anything no longer pickable is dropped. */
function loadPicked(storageKey: string): Badge[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const keys: unknown = JSON.parse(raw);
    if (!Array.isArray(keys)) return [];
    return keys.flatMap((k) => (typeof k === 'string' && pickableKeys.has(k) ? [badgeByKey.get(k)!] : []));
  } catch {
    return []; // storage can be unavailable (private mode, blocked site data)
  }
}

interface Props {
  uniform: Uniform;
  selection: Selection;
  onChangeUniform: () => void;
}

/** The finished uniform: the selection's rank and branch are worn already, the library adds badges and medals. */
export function UniformScreen({ uniform, selection, onChangeUniform }: Props) {
  const storageKey = `uv:placed:${uniform.id}`;

  const [picked, setPicked] = useState<Badge[]>(() => loadPicked(storageKey));
  const [message, setMessage] = useState<string | null>(null);
  const [showAnchors, setShowAnchors] = useState(false);
  const [hint, setHint] = useState<Badge | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(picked.map(badgeKey)));
    } catch {
      /* ignore: persistence is a convenience only */
    }
  }, [picked, storageKey]);

  // What the selection wears: it changes only by going back to the selection screen.
  const loadout = useMemo(() => loadoutFor(selection, uniform, badges, categories, options), [selection, uniform]);
  const lockedKeys = useMemo(() => loadoutKeys(loadout), [loadout]);
  const worn = useMemo(() => [...loadout.badges, ...picked], [loadout, picked]);

  const boxes = useMemo(() => layoutBadges(uniform, worn, categories, BADGE_SCALE), [uniform, worn]);
  const pickedKeys = useMemo(() => new Set(picked.map(badgeKey)), [picked]);
  const mounted = useMemo(() => resolveMounted(mountedList, uniform.mountedFrom ?? uniform.id, selection.service), [uniform.mountedFrom, uniform.id, selection.service]);
  const hintAnchor = hint ? findAnchor(uniform, hint) : undefined;

  const remove = (badge: Badge) => {
    if (lockedKeys.has(badgeKey(badge))) {
      setMessage(`${badge.name} is part of your selection. Use Change uniform to change it.`);
      return;
    }
    setPicked(picked.filter((p) => badgeKey(p) !== badgeKey(badge)));
    setMessage(`${badge.name} removed.`);
  };

  const place = (badge: Badge) => {
    if (pickedKeys.has(badgeKey(badge))) {
      remove(badge); // picking a placed badge again takes it off
      return;
    }
    const result = placeBadge(uniform, badge, worn, categories);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    setPicked([...picked, badge]);
    setMessage(`${badge.name} placed on: ${result.anchor.label}.`);
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>Uniform Visualiser</h1>
        <span className="sub">{uniform.name}</span>
        <button type="button" className="ghost change" onClick={onChangeUniform}>
          Change uniform
        </button>
      </header>

      <main className="layout">
        <section className="stage-wrap" aria-label="Uniform">
          <p className="chosen">{describeSelection(selection, badges, options)}</p>
          <UniformStage
            uniform={uniform}
            boxes={boxes}
            mounted={mounted}
            service={selection.service}
            lockedKeys={lockedKeys}
            showAnchors={showAnchors}
            highlightAnchorId={hintAnchor?.id ?? null}
            onRemove={remove}
          />

          <div className="controls">
            <label className="check">
              <input type="checkbox" checked={showAnchors} onChange={(e) => setShowAnchors(e.target.checked)} />
              Show placement spots
            </label>
            <button className="ghost" onClick={() => { setPicked([]); setMessage('Cleared.'); }} disabled={picked.length === 0}>
              Clear all
            </button>
          </div>

          {loadout.notes.map((note) => (
            <p key={note} className="notice">{note}</p>
          ))}
          <p className="status" role="status" aria-live="polite">
            {message ?? 'Pick a badge from the library to place it; pick it again, or click it on the uniform, to remove it. Your rank and branch stay until you change the uniform. Scroll to zoom, drag to move.'}
          </p>
        </section>

        <BadgeLibrary
          categories={pickableCategories}
          badges={pickableBadges}
          placedKeys={pickedKeys}
          onPlace={place}
          onHint={setHint}
        />
      </main>
    </div>
  );
}
