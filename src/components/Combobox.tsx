// A dropdown you can type into, used for every choice on the selection screen.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { filterOptions, type Option } from '../lib/selection';

interface Props {
  label: string;
  options: Option[];
  /** Id of the chosen option, or null. */
  value: string | null;
  onChange: (id: string) => void;
  placeholder?: string;
  /** Shown instead of the list while the field cannot be used, e.g. "Pick a service first". */
  disabledReason?: string;
}

/**
 * A dropdown you can type into (ARIA combobox with a listbox). Typing filters the options, the arrow keys move
 * through them, Enter picks, Escape closes. Options can be disabled with a reason under them.
 */
export function Combobox({ label, options, value, onChange, placeholder = 'Select', disabledReason }: Props) {
  const uid = useId();
  const listId = `${uid}-list`;
  const optionId = (id: string) => `${uid}-opt-${id}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string | null>(null);

  const disabled = disabledReason !== undefined;
  const selected = options.find((o) => o.id === value) ?? null;
  const shown = useMemo(() => filterOptions(options, query), [options, query]);

  // Keep a valid line highlighted while the list changes under the cursor.
  useEffect(() => {
    if (!open) return;
    if (active && shown.some((o) => o.id === active && !o.disabled)) return;
    setActive(shown.find((o) => !o.disabled)?.id ?? null);
  }, [open, shown, active]);

  useEffect(() => {
    if (open && active) listRef.current?.querySelector(`[id="${optionId(active)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opens the list, with the chosen option highlighted.
  const openList = () => {
    if (disabled || open) return;
    setQuery('');
    setActive(selected && !selected.disabled ? selected.id : null);
    setOpen(true);
  };

  // Closes the list and forgets what was typed.
  const close = () => {
    setOpen(false);
    setQuery('');
  };

  // Chooses an option (a disabled one cannot be chosen).
  const pick = (o: Option) => {
    if (o.disabled) return;
    onChange(o.id);
    close();
  };

  // Moves the highlight down (1) or up (-1) through the enabled options, wrapping round at the ends.
  const move = (step: 1 | -1) => {
    const enabled = shown.filter((o) => !o.disabled);
    if (enabled.length === 0) return;
    const at = enabled.findIndex((o) => o.id === active);
    setActive(enabled[(at + step + enabled.length) % enabled.length].id);
  };

  // Arrow keys move, Enter picks, Escape closes.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) openList();
      else move(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Enter') {
      if (open) {
        e.preventDefault();
        const o = shown.find((x) => x.id === active);
        if (o) pick(o);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        close();
      }
    }
  };

  return (
    <div className={disabled ? 'combo disabled' : 'combo'}>
      <div className="combo-field">
        <input
          ref={inputRef}
          className="combo-input"
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active ? optionId(active) : undefined}
          aria-disabled={disabled}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={disabled ? disabledReason : placeholder}
          value={open ? query : (selected?.label ?? '')}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={openList}
          onClick={openList}
          onBlur={close}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="combo-toggle"
          tabIndex={-1}
          aria-label={open ? `Close ${label} list` : `Open ${label} list`}
          disabled={disabled}
          // mouse down would blur the input and close the list before the click arrives
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (open ? close() : (inputRef.current?.focus(), openList()))}
        >
          <svg viewBox="0 0 12 8" width="12" height="8" aria-hidden="true">
            <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {open && (
        <ul ref={listRef} id={listId} className="combo-list" role="listbox" aria-label={label}>
          {shown.length === 0 && <li className="combo-empty">No match</li>}
          {shown.map((o) => (
            <li
              key={o.id}
              id={optionId(o.id)}
              role="option"
              aria-selected={o.id === value}
              aria-disabled={o.disabled || undefined}
              className={['combo-option', o.id === active ? 'active' : '', o.id === value ? 'chosen' : '', o.disabled ? 'off' : ''].join(' ').trim()}
              onMouseDown={(e) => e.preventDefault()}
              onMouseMove={() => !o.disabled && setActive(o.id)}
              onClick={() => pick(o)}
            >
              <span>{o.label}</span>
              {o.disabled && o.reason && <small>{o.reason}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
