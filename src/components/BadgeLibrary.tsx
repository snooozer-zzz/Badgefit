import { useMemo, useState } from 'react';
import type { Badge, Category } from '../data/schema';
import { badgeKey } from '../lib/placement';
import { BadgeImage } from './BadgeArt';

interface Props {
  categories: Category[];
  badges: Badge[];
  placedKeys: Set<string>;
  onPlace: (badge: Badge) => void;
  /** Called while a badge is hovered or focused, so the stage can show where it would go. */
  onHint: (badge: Badge | null) => void;
}

export function BadgeLibrary({ categories, badges, placedKeys, onPlace, onHint }: Props) {
  const sorted = useMemo(() => [...categories].sort((a, b) => a.order - b.order), [categories]);
  const [categoryId, setCategoryId] = useState<string>(sorted[0].id);
  const [query, setQuery] = useState('');

  const searching = query.trim().length > 0;
  const category = sorted.find((c) => c.id === categoryId) ?? sorted[0];
  const visible = badges.filter((b) =>
    searching ? b.name.toLowerCase().includes(query.trim().toLowerCase()) : b.category === category.id,
  );
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of badges) map.set(b.category, (map.get(b.category) ?? 0) + 1);
    return map;
  }, [badges]);

  return (
    <section className="library" aria-label="Badge library">
      <input
        className="search"
        type="search"
        placeholder="Search badges"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search badges"
      />

      <div className="tabs" role="tablist" aria-label="Badge categories">
        {sorted.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={!searching && c.id === category.id}
            className={!searching && c.id === category.id ? 'tab selected' : 'tab'}
            onClick={() => {
              setQuery('');
              setCategoryId(c.id);
            }}
          >
            {c.name} <span className="count">{counts.get(c.id) ?? 0}</span>
          </button>
        ))}
      </div>

      {!searching && (
        <p className="category-note">
          <strong>Worn:</strong> {category.wornOn ?? 'not stated on the source page'}
          {category.maxWorn !== null && <> · max {category.maxWorn} at once</>}
        </p>
      )}

      <div className="grid">
        {visible.map((b) => {
          const key = badgeKey(b);
          const placed = placedKeys.has(key);
          return (
            <button
              key={key}
              className={placed ? 'tile on' : 'tile'}
              onClick={() => onPlace(b)}
              onMouseEnter={() => onHint(b)}
              onMouseLeave={() => onHint(null)}
              onFocus={() => onHint(b)}
              onBlur={() => onHint(null)}
            >
              <span className="art">
                <BadgeImage badge={b} />
              </span>
              <span className="name">{b.name}</span>
              {b.notes && <span className="chip">{b.notes}</span>}
              {b.status === 'todo' && <span className="chip muted">art needed</span>}
              {placed && <span className="chip gold">on uniform</span>}
            </button>
          );
        })}
        {visible.length === 0 && <p className="empty">No badges match.</p>}
      </div>
    </section>
  );
}
