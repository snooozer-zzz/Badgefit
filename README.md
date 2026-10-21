# Uniform Visualiser

Badgefit is a character-creator-style app that shows where badges, medals and rank insignia go on a Singapore Armed Forces uniform. Pick a service, gender, uniform (No. 1, No. 2, No. 5), rank and branch, then tap badges in the library to place them on the uniform. A placement guide shows the anchor spots and the dress rules (for example the limit of SAF badges on the left chest). Everything is driven by JSON data, so adding a badge or a uniform needs no UI code. Web first (Vite + React + TypeScript), mobile later (Capacitor).

## Set up on Windows

1. Install **Node.js 22 LTS** (https://nodejs.org) and **Git for Windows** (https://git-scm.com/downloads/win).
2. Open this folder in **Cursor** (File > Open Folder).
3. In Cursor's terminal (Ctrl+`):
   ```
   npm install
   npm run dev
   ```
   Open the address it prints (usually http://localhost:5173).

## Use Claude Code in Cursor

1. Install Claude Code. In PowerShell:
   ```
   irm https://claude.ai/install.ps1 | iex
   ```
   (or `winget install Anthropic.ClaudeCode`). Open a new terminal and check with `claude --version`.
2. In Cursor's terminal, from this folder, run `claude` and log in when asked.
3. Optional: install the Claude Code extension in Cursor (search "Claude Code" in Extensions) for inline diffs.

Claude Code reads `CLAUDE.md` automatically, and Cursor reads `.cursor/rules/project.mdc`, which points to it.
Install steps are from https://code.claude.com/docs/en/overview, so check there if anything has changed.

### Good first prompts

- "Add drag and snap so I can move a placed badge between the spots its category allows. Add tests for any new rules."
- "Add a quiz mode: show a badge name, I tap where it goes, tell me if it is right."
- "Add a uniform picker and set up Number 2 using `docs/ADDING_BADGES.md`."
- "Set up Capacitor for Android following `docs/PLAN.md`."

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Typecheck and production build |
| `npm test` | Unit tests |
| `npm run data:validate` | Check all data files and badge art |
| `npm run data:sync` | Same, and mark badges `redrawn` when their PNG exists |
| `npm run art:import -- <bundle folder>` | Bring in finished badge art from the `badge-art-pipeline` project (`docs/ART.md`) |

## Where things are

- `docs/PLAN.md` roadmap and open questions
- `docs/ART.md` how badge art is made (separate `badge-art-pipeline` program) and imported
- `docs/ADDING_BADGES.md` adding badges, categories and uniforms
- `src/data/` all content (JSON) and the schema
- `src/lib/placement.ts` placement rules, `src/lib/layout.ts` where badges are drawn
- `public/badges/<category>/<slug>.png` badge art (proficiency badges, and the imported shoulder boards, rank insignia and gorgets)

## Status

115 badges catalogued: the 3 proficiency badges and the 40 No.1 accessories (shoulder boards, rank insignia, gorgets) have art; the other 72 show placeholder tiles. Anchor positions and badge sizes are
approximate and marked unverified. Badge info is from https://www.army.gov.sg/our-forces/badges/.
