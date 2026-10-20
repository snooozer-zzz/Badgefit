import { useMemo, useState } from 'react';
import type { Badge, Options, Uniform } from '../data/schema';
import {
  branchOptions,
  branchWorn,
  dressOptions,
  genderOptions,
  missingField,
  rankOptions,
  sanitizeSelection,
  serviceOptions,
  uniformFor,
  type Selection,
} from '../lib/selection';
import { Combobox } from './Combobox';

interface Props {
  options: Options;
  uniforms: Uniform[];
  badges: Badge[];
  /** The last selection, to prefill the screen. */
  initial: Selection;
  onCreate: (selection: Selection) => void;
}

/** The screen before the uniform: Service, Gender, Uniform, Rank and Branch, then Create. */
export function SelectionScreen({ options, uniforms, badges, initial, onCreate }: Props) {
  const [sel, setSel] = useState<Selection>(() => sanitizeSelection(initial, uniforms, badges, options));

  // Changing one field clears any later choice that is no longer valid (e.g. the uniform after a new service).
  const set = (patch: Partial<Selection>) => setSel((s) => sanitizeSelection({ ...s, ...patch }, uniforms, badges, options));

  const uniform = uniformFor(uniforms, sel.dress, sel.service, sel.gender);
  const missing = missingField(sel, uniform, options);
  const ranks = useMemo(() => rankOptions(badges, options), [badges, options]);
  const branches = useMemo(() => branchOptions(badges, options), [badges, options]);
  const dresses = useMemo(
    () => dressOptions(options, uniforms, sel.service, sel.gender),
    [options, uniforms, sel.service, sel.gender],
  );

  const branchReason = !uniform ? 'Pick a uniform first' : !branchWorn(uniform, options) ? 'Not worn on this uniform' : undefined;

  return (
    <main className="select-screen">
      <form
        className="select-card"
        aria-labelledby="select-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (!missing) onCreate(sel);
        }}
      >
        <h2 id="select-title">Choose your uniform</h2>

        <div className="select-row">
          <span className="select-label">Service</span>
          <Combobox label="Service" options={serviceOptions(options)} value={sel.service} onChange={(id) => set({ service: id })} />
        </div>
        <div className="select-row">
          <span className="select-label">Gender</span>
          <Combobox label="Gender" options={genderOptions(options)} value={sel.gender} onChange={(id) => set({ gender: id })} />
        </div>
        <div className="select-row">
          <span className="select-label">Uniform</span>
          <Combobox
            label="Uniform"
            options={dresses}
            value={sel.dress}
            onChange={(id) => set({ dress: id })}
            disabledReason={!sel.service || !sel.gender ? 'Pick a service and gender first' : undefined}
          />
        </div>
        <div className="select-row">
          <span className="select-label">Rank</span>
          <Combobox label="Rank" options={ranks} value={sel.rank} onChange={(id) => set({ rank: id })} placeholder="Select or type, e.g. 2LT" />
        </div>
        <div className="select-row">
          <span className="select-label">Branch</span>
          <Combobox label="Branch" options={branches} value={sel.branch} onChange={(id) => set({ branch: id })} disabledReason={branchReason} />
        </div>

        <p className="select-hint" role="status" aria-live="polite">
          {missing ? `Still to pick: ${missing}.` : 'Ready.'}
        </p>
        <button className="create" type="submit" disabled={missing !== null}>
          Create
        </button>
      </form>
    </main>
  );
}
