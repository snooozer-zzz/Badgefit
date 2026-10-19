import { useEffect, useMemo, useState } from 'react';
import { badges, categories, uniforms } from './data';
import type { Badge } from './data/schema';
import { badgeKey, canPlace, findAnchor, layoutBadges } from './lib/placement';
import { BadgeLibrary } from './components/BadgeLibrary';
import { UniformStage } from './components/UniformStage';

const badgeByKey = new Map(badges.map((b) => [badgeKey(b), b]));

function loadPlaced(storageKey: string): Badge[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const keys: unknown = JSON.parse(raw);
    if (!Array.isArray(keys)) return [];
    return keys.flatMap((k) => (typeof k === 'string' && badgeByKey.has(k) ? [badgeByKey.get(k)!] : []));
  } catch {
    return []; // storage can be unavailable (private mode, blocked site data)
  }
}

export default function App() {
  const uniform = uniforms[0]; // TODO: add a uniform picker once there is more than one
  const storageKey = `uv:placed:${uniform.id}`;

  const [placed, setPlaced] = useState<Badge[]>(() => loadPlaced(storageKey));
  const [message, setMessage] = useState<string | null>(null);
  const [showAnchors, setShowAnchors] = useState(false);
  const [scale, setScale] = useState(1.5);
  const [hint, setHint] = useState<Badge | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(placed.map(badgeKey)));
    } catch {
      /* ignore: persistence is a convenience only */
    }
  }, [placed, storageKey]);

  const boxes = useMemo(
    () => layoutBadges(uniform, placed, categories, scale),
    [uniform, placed, scale],
  );
  const placedKeys = useMemo(() => new Set(placed.map(badgeKey)), [placed]);
  const hintAnchor = hint ? findAnchor(uniform, hint) : undefined;

  const place = (badge: Badge) => {
    const result = canPlace(uniform, badge, placed, categories);
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    setPlaced([...placed, badge]);
    setMessage(`${badge.name} placed on: ${result.anchor.label}.`);
  };

  const remove = (badge: Badge) => {
    setPlaced(placed.filter((p) => badgeKey(p) !== badgeKey(badge)));
    setMessage(`${badge.name} removed.`);
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1>Uniform Visualiser</h1>
        <span className="sub">{uniform.name}</span>
      </header>

      <main className="layout">
        <section className="stage-wrap" aria-label="Uniform">
          <UniformStage
            uniform={uniform}
            boxes={boxes}
            showAnchors={showAnchors}
            highlightAnchorId={hintAnchor?.id ?? null}
            onRemove={remove}
          />

          <div className="controls">
            <label className="check">
              <input type="checkbox" checked={showAnchors} onChange={(e) => setShowAnchors(e.target.checked)} />
              Show placement spots
            </label>
            <label className="range">
              Badge size ×{scale.toFixed(1)}
              <input
                type="range"
                min={1}
                max={3}
                step={0.25}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
              />
            </label>
            <button className="ghost" onClick={() => { setPlaced([]); setMessage('Cleared.'); }} disabled={placed.length === 0}>
              Clear all
            </button>
          </div>

          <p className="status" role="status" aria-live="polite">
            {message ?? 'Pick a badge from the library to place it. Click a placed badge to remove it.'}
          </p>
        </section>

        <BadgeLibrary
          categories={categories}
          badges={badges}
          placedKeys={placedKeys}
          onPlace={place}
          onHint={setHint}
        />
      </main>
    </div>
  );
}
