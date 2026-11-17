# Praxis Atlas

A read-only visualiser for **Task / Method / Knowledge (TMK) skill models**. Praxis
Atlas turns three independent JSON documents into one interactive skill graph:
tasks point to the methods that discharge them, methods invoke goals, and
knowledge concepts and instances give the whole thing something to be about.

The MVP is a first draft for iteration: the data layer is deliberately decoupled
from presentation, so the same atlas can later power a visual JSON editor.

---

## Project structure

```
.
├── index.html                  App shell, title and pre-paint theme boot
├── scripts/
│   └── verify-models.mjs       Dependency-free schema and reference checks
├── src/
│   ├── App.tsx                 Application shell: view, selection, theme
│   ├── main.tsx                React entry point
│   ├── index.css               Agrarian palette, dark variants, type, textures
│   ├── types/
│   │   └── tmk.ts              TypeScript mirrors of the three JSON schemata
│   ├── data/
│   │   ├── sample-traces.txt   Two illustrative Ivy traces (raw text asset)
│   │   ├── task-model.json     Example Task model
│   │   ├── method-model.json   Example Method model (4 organisers)
│   │   ├── knowledge-model.json Example Knowledge model
│   │   └── index.ts            Bundled example model set, deepFreeze, documentsOf
│   ├── lib/
│   │   ├── atlas.ts            Pure projection: naming index, inferred links
│   │   ├── loader.ts           Reads local files/folders into validated model sets
│   │   ├── layout.ts           Deterministic d3-force layout, portrait-aware
│   │   ├── traces.ts           Ivy trace parser and filtered trace-graph builder
│   │   ├── kinds.ts            Colours, labels and glyphs per entity kind
│   │   └── navigation.ts       Workspace navigation model
│   ├── components/
│   │   ├── GraphCanvas.tsx     Interactive SVG graph: pan, zoom, focus, preview
│   │   ├── Inspector.tsx       Structured, read-only entity inspector
│   │   ├── FsmDiagram.tsx      Generic organiser state-machine diagram
│   │   ├── ModelLoader.tsx     Open files / open folder, library skill switcher
│   │   ├── TraceGraph.tsx      Trace-scoped TMK graph with direct in/out toggles
│   │   ├── CodeBlock.tsx       Read-only JSON with syntax colour and raw toggle
│   │   ├── Prose.tsx           Faithful prose, lists, code fences, inline code
│   │   ├── Sidebar.tsx         Desktop rail, mobile header, data-set summary
│   │   ├── PageHeader.tsx      Shared page masthead and statistics
│   │   ├── ui.tsx              Badges, filters, search, copy, read-only note
│   │   ├── Icon.tsx            Dependency-free icon set
│   │   └── Brand.tsx           Wordmark and mark
│   └── views/
│       ├── AtlasView.tsx       Graph workspace with filters and inspector
│       ├── LibraryView.tsx     Entity index plus relations and assertions
│       ├── OrganisersView.tsx  Organiser gallery
│       ├── TracesView.tsx      Paste traces, read each section, plot the 6-tuple
│       └── ModelsView.tsx      Model loading, source JSON, downloads, conventions
```

## Setup and scripts

This is a JavaScript/TypeScript project, so the Node toolchain is the setup
helper - there is no separate bootstrap function to run.

```bash
npm install          # install dependencies (the equivalent of pip install -r ...)
npm run dev          # local development at http://localhost:5173
npm run build        # production single-file build in dist/
npm run preview      # serve the production build
node scripts/verify-models.mjs   # optional: check the example model set
```

Requirements: Node 20+ and npm. No API keys, services or environment variables.
The build is inlined into `dist/index.html` by `vite-plugin-singlefile`.

## Loading your own models

The app opens on a bundled example. On the **Source models** page, *Load models*
reads your own, entirely in the browser (nothing is uploaded):

- **Open files** - select the Task, Method and Knowledge JSON files together in
  one dialog.
- **Open folder** - pick either a folder holding one triplet (`skill1/`) or a
  library folder with one subfolder per skill (`tmk_library/`). A library lists
  its skills as chips for switching between them.

```
tmk_library/
  skill1/
    Task.json
    Method.json
    Knowledge.json
  skill2/
    ...
```

A document is recognised by its `model` field (`Task`, `Method`, `Knowledge`),
so file names are free and unrelated JSON files are ignored. Each document is
checked against the `required` lists of its schema; a skill that is incomplete
or invalid is skipped and the reason is shown, without affecting the others.
Loaded models are held in memory only: reloading the page returns to the
example, and a folder is read once, when it is picked. Folder picking uses the
`webkitdirectory` input attribute (desktop Chrome, Edge, Firefox and Safari);
the button is hidden where it is unsupported.

`scripts/verify-models.mjs` checks the bundled example only.

## What the MVP does

- **One graph for three models.** Nodes are tasks (gold, flag), methods (sky,
  route), concepts (deep green, cube) and instances (muted, dashed, dot).
  Relations and assertions are named annotations rather than graph nodes, which
  keeps the canvas focused; they still appear in the index and inspector.
- **Inferred edges, not hard-coded foreign keys.** Every string leaf is matched
  case-insensitively against the names of all entities and annotations. Any
  field can therefore become a reference, including fields added in future.
  The edge label is derived from the field path (`means.mechanismReference`
  becomes `means`, `properties.type` becomes `property type`, and so on).
- **Hover to preview, click to inspect.** Hovering focuses a node's
  neighbourhood, labels its edges and shows a compact record card. Clicking
  opens the inspector with interface, context, means, organiser, assertions,
  concept properties, instance values, inferred connections and the raw record.
- **Organisers as state machines.** The `FsmDiagram` component ranks states by
  transition depth and draws guarded transitions. The success path is laid out
  separately from the failure state; every state can be selected to read its
  goal reference, declared type and actual arguments. The same component is
  reused in the inspector and on the Organisers page.
- **Never mutates the model.** Documents are deep-frozen at import. The atlas is
  a pure, memoised projection. Raw JSON is available for reading and copying,
  but there is no write path.
- **Designed for reading.** Agrarian palette, serif display type, light and dark
  field-note themes, keyboard-focusable nodes, a portrait-specific graph
  layout, and a mobile inspector drawer. Respects reduced-motion preferences.

## Ivy traces

The **Ivy traces** tab reads pasted traces and presents them as evidence, not as
code. It is additive: the atlas, library, organisers and source-model views are
unchanged.

- **Input.** Paste one trace, or several separated by a line containing only
  `***`. Use *Edit input* to replace the text, *Read traces* to parse it, and
  *Example traces* to restore the bundled illustration. The pasted text lives in
  memory for the session; it is never sent anywhere.
- **Faithful source.** The exact text is always reachable: *Raw* shows the whole
  trace as pasted, each document has a `pretty`/`raw` switch, and *Copy* copies
  either form. Pretty JSON is re-indented for reading only. Prose keeps its
  wording; only markers (bullets, numbering, code fences, inline code) become
  presentation.
- **Sections.** Headings are split on dashed dividers and kept as written.
  Identity anchor and stage-1 prompt are collapsed prompt material by default;
  the classification, retrieved documents, intermediate and final outputs are
  expanded. Missing sections are reported as parsing notes rather than invented.
- **6-tuple table.** `metadata_trace`, `sources_trace` and `scores_trace` are
  paired strictly by index, with no sorting or inference. Values that are absent
  stay absent. A tuple of any length is accepted; the examples happen to have
  four and three entries.
- **Trace graph.** The graph starts with exactly the 6-tuple sources. Optional
  checkboxes add nodes with a direct outgoing edge from a trace item and nodes
  with a direct incoming edge to one. No longer path is followed. Edges are
  derived from structured fields inside the retrieved entries (means,
  organisers, parameter types, properties) and, when a trace name exists in the
  loaded TMK, from that model's direct edges. Their origin is drawn differently
  and labelled in the legend; trace metadata always decides a node's kind.
- **Inspection.** Selecting a node shows its role, score, retrieved description,
  direct connections and the raw retrieved fields. If the name exists in the
  loaded TMK, *Inspect in atlas* opens it there; otherwise *Load its TMK* points
  to the model picker.

Where a section is unreadable as a structured document, the trace is not
repaired: its exact body is shown with a note saying so. The parser is tolerant
of Python-style literals, because stage-2 documents are Python `dict` reprs, but
it never rewrites a value to make parsing succeed.

## How references are inferred

`createAtlas` in `src/lib/atlas.ts`:

1. Builds one `NamedThing` index of tasks, methods, concepts, instances,
   relations and assertions. Entity names take precedence over annotations.
2. Walks every string leaf of every entity, skipping the `name` and `model`
   fields. An exact, case-insensitive match becomes a `ReferenceHit`.
3. Coalesces hits into unique directed edges for graph nodes; annotation hits
   stay available to the inspector. Every hit retains its JSON path.

This is intentionally permissive. The example data includes references in
`instance.values` that are not defined by the schema (for instance a `steward`
value), and the viewer links them too. A future version could add a formal
reference index without changing the UI, by returning the same `Atlas` shape.

## Architecture notes

- **Data flow:** frozen model set (bundled or loaded) -> `createAtlas` (pure) ->
  view state (ids only) ->
  presentational components. Selecting a reference looks the name up in the
  atlas index; it never rewrites a document.
- **Editor seam:** build a draft atlas from a cloned document and pass it to the
  same inputs. The inspector's structured sections already read through the
  atlas; a form layer could be added beside them. Raw records are isolated in
  one disclosure, which is the natural place to hang editing affordances.
- **Determinism:** layout uses a seeded random source and a fixed tick count, so
  the same model set draws the same map. Positions are normalised into the
  virtual canvas after the simulation is stopped.
- **Latest features used:** React 19, Tailwind CSS 4 (`@theme inline`,
  `@custom-variant`), Vite 7, TypeScript 5.9 and `ResizeObserver`.
- **Accessibility:** nodes and states are focusable buttons with names and
  pressed state; edge labels complement colour; the drawer closes on Escape and
  has a labelled backdrop; icons are decorative.

## Known limits / next iterations

- No live editing or URL state yet. Loaded models, libraries and pasted traces
  are not remembered across page reloads.
- Trace sections are recognised by heading text. A new heading still renders but
  appears as a generic section.
- Force layouts are good for exploration; very dense model sets would benefit
  from clustering, semantic zoom or an alternative matrix view.
- The graph shows derived links only. Link validity is not enforced against
  `relations.domain` / `relations.range`, by design in this draft.
- Organiser layout assumes a small number of states. Larger machines would
  justify crossing-reduction or a hierarchical layout library.
- Instance and manifest display conventions are editorial choices, not schema
  requirements; they are isolated in `src/lib/kinds.ts` and view copy.

## Design tokens

| Token | Light | Dark |
| --- | --- | --- |
| Agrarian blue | `#403F84` | unchanged |
| Agrarian sky | `#2F9FD9` | unchanged |
| Agrarian yellow | `#F8D727` | unchanged |
| Agrarian green | `#005C45` | used as ground |

Semantic tokens (`--surface`, `--ink`, `--line`, `--sidebar`, ...) and their dark
variants are defined in `src/index.css`. The four brand colours remain the data
encoding; the dark theme adjusts only surfaces and supporting text.

## Authoring conventions

- Two-space indentation; single quotes in TypeScript; ASCII comments.
- British spellings in prose and comments (`visualiser`, `normalise`). Schema
  field names and API keywords keep their original spelling.
- Functions and modules carry a short doc comment explaining intent rather than
  restating the code.
