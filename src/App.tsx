import { useState } from 'react';
import { badges, options, uniforms } from './data';
import { SelectionScreen } from './components/SelectionScreen';
import { UniformScreen } from './components/UniformScreen';
import { loadSelection, saveSelection } from './lib/storage';
import { uniformFor, type Selection } from './lib/selection';

/** Two screens: pick the uniform, rank and branch, then see the uniform. */
export default function App() {
  const [selection, setSelection] = useState<Selection>(loadSelection);
  const [created, setCreated] = useState(false);

  const uniform = created ? uniformFor(uniforms, selection.dress, selection.service, selection.gender) : null;

  if (!uniform) {
    return (
      <div className="app">
        <header className="topbar">
          <h1>Uniform Visualiser</h1>
        </header>
        <SelectionScreen
          options={options}
          uniforms={uniforms}
          badges={badges}
          initial={selection}
          onCreate={(sel) => {
            saveSelection(sel);
            setSelection(sel);
            setCreated(true);
          }}
        />
      </div>
    );
  }

  return <UniformScreen key={uniform.id} uniform={uniform} selection={selection} onChangeUniform={() => setCreated(false)} />;
}
