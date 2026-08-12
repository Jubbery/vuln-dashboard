# Architecture and data flow

How the app is put together, why the layers are drawn where they are, and what
each one is allowed to do. For *visual* reasoning see [DESIGN.md](DESIGN.md);
for the data reconnaissance that shaped all of it see
[PHASE0-FINDINGS.md](PHASE0-FINDINGS.md).

## The one rule

> **Raw records exist only inside the worker. The main thread receives a
> finished dataset and never computes an aggregate.**

Every other decision here follows from that. It's what keeps 171,711
occurrences interactive in a browser tab.

## Data flow, end to end

```
 ui_demo.json (270MB)            File picked from disk
 or VITE_DATA_URL                (ScanFilePicker)
        │                               │
        └───────────┬───────────────────┘
                    ▼            both paths are a ReadableStream
        ┌───────────────────────────────────────────────┐
        │  ingest.worker.ts            (Web Worker)     │
        │                                               │
        │  tokenizer.ts   brace-depth scan → emits one  │
        │                 complete image object at a    │
        │                 time (peak 1.3MB resident)    │
        │        ▼                                      │
        │  normalize.ts   sanitize · parse dates ·      │
        │                 flatten riskFactors · intern  │
        │                 names · dedupe into catalog · │
        │                 composite keys · count        │
        │                 failures instead of throwing  │
        │        ▼                                      │
        │  aggregate.ts   every number the charts need, │
        │                 computed once                 │
        └───────────────────────────────────────────────┘
              │ PROGRESS (bytesRead/total)   │ DONE (SerializedDataset)
              ▼                              ▼
    ┌──────────────────┐        ┌────────────────────────────────┐
    │ ingestionSlice   │        │ DatasetProvider                │
    │ (Redux: status,  │        │ module-level singleton +       │
    │  progress, error)│        │ React Context — NOT in Redux   │
    └──────────────────┘        └────────────────────────────────┘
              │                              │
              ▼                              ▼
        ┌───────────────────────────────────────────────┐
        │  App.tsx — ingestion gate                     │
        │  loading / error / zero-record → GateFrame    │
        │  ready → RouterProvider mounts                │
        └───────────────────────────────────────────────┘
                             │
                             ▼
        ┌───────────────────────────────────────────────┐
        │  data/selectors.ts   (pure, memoized by page) │
        │  filter → sort → derive; joins Redux filter   │
        │  state with the out-of-Redux dataset          │
        └───────────────────────────────────────────────┘
                             │
                             ▼
                    pages → components → primitives
```

The gate matters: routes mount only once the dataset exists, so every page can
call `useDataset()` and get a non-null `Dataset` without null checks. The
null-handling lives in exactly one place instead of every consumer.

## Component hierarchy

```
main.tsx
└─ Provider (Redux)
   └─ ThemedRoot            theme follows persisted preference
      └─ DatasetProvider    owns worker lifecycle + dataset singleton
         └─ App             ingestion gate
            └─ RouterProvider
               └─ DashboardLayout        skip link · sidebar · header · <Outlet>
                  ├─ OverviewPage        ← eager (landing route)
                  │  └─ react-grid-layout
                  │     └─ widget registry → StatCard | ChartCard
                  │        └─ ResponsiveChart → SeverityDonut, TopRiskImagesBar,
                  │           RiskFactorBar, SeverityVsCvssScatter,
                  │           PublishedTrendChart, AnalysisOverlapChart,
                  │           BreakdownChart (user-composed)
                  ├─ ExplorerPage        ← lazy
                  │  ├─ AnalysisActions      triage buttons + impact bar
                  │  ├─ FilterPanel          search w/ suggestions, facets
                  │  ├─ ExplorerToolbar      fix-first · columns · density · export
                  │  ├─ OccurrenceGrid       MUI DataGrid (virtualized)
                  │  └─ CvePeekDrawer        row detail without losing state
                  ├─ GroupPage / RepoPage / ImageDetailPage   ← lazy
                  ├─ CveDetailPage / ComparePage              ← lazy
                  └─ NotFoundPage                             ← lazy
```

### Layer responsibilities

| Layer | Owns | Never does |
|---|---|---|
| `workers/` | Parsing, normalization, aggregation | Touch React or the DOM |
| `data/` | Dataset custody, pure filter/sort/derive selectors | Hold UI state |
| `store/` | Small serializable UI state + persistence | Hold the dataset |
| `pages/` | Composition, memoized selector calls, routing params | Compute aggregates |
| `components/charts/` | D3 *calculation*, SVG rendering | Fetch or filter data |
| `components/primitives/` | Presentational, prop-driven building blocks | Access the store |
| `theme/` | Design tokens (severity text + fill palettes) | — |

`primitives/` never reaches into the store — that's what makes `SeverityBadge`,
`CvssScoreBar`, `StatCard`, `EmptyState`, `TopRisksStrip` and friends reusable
across seven routes and inside two different drawers.

## State management: a deliberate three-way split

| State | Lives in | Why |
|---|---|---|
| Ingestion status, progress, error | Redux (`ingestionSlice`) | Small, serializable, drives the gate |
| Filters, sort, page, comparison set | Redux (`filtersSlice`, `uiSlice`) | Shared across routes; belongs in one place |
| Preferences (theme, density, columns, dashboard layout, custom charts) | Redux + `localStorage` | Same, plus survives reload |
| **The dataset** | **Module singleton via Context** | ~60MB, immutable after ingest, needs no reducer |

Putting a 60MB object graph in a slice would hang Redux DevTools, which
serializes every action payload. Excluding it keeps state small enough that
RTK's `serializableCheck` and `immutableCheck` stay **enabled** in dev — the
exact guard that would catch someone dispatching the dataset into a slice.

Persistence is a single `store.subscribe` that compares preference references
and writes through to `localStorage`; the loader validates every field and
falls back to defaults, so a stale or hand-edited blob can't break boot.

## Shared behaviour via hooks

| Hook | Shares |
|---|---|
| `useDataset()` / `useDatasetOrNull()` | Dataset access; the strict form throws outside the gate so misuse is loud |
| `useDatasetControl()` | `loadFile()` — re-ingest from a user-picked file (separate context so data consumers don't re-render when the control object is created) |
| `useChartTooltip()` | Tooltip position/content state shared by all six SVG charts |
| `useAppDispatch()` / `useAppSelector()` | Typed Redux bindings — no `any` at the store boundary |
| `ResponsiveChart` (render prop + `ResizeObserver`) | Measured `width`/`height` for every chart, plus a `fill` mode for resizable dashboard cells |

## Performance techniques, and where each lives

| Technique | Where |
|---|---|
| **Streaming ingest** off the main thread | `workers/ingest.worker.ts` + `tokenizer.ts` |
| **Deduplication** (139.8×) and string interning | `workers/normalize.ts` |
| **Precomputed aggregates** — charts never scan rows | `workers/aggregate.ts` |
| **Code splitting / lazy loading** — every route but the landing page is its own chunk behind one `Suspense`; DataGrid (664KB) ships only when the Explorer opens | `router.tsx`, `DashboardLayout.tsx` |
| **Stable vendor chunks** (`react-vendor`, `mui`, `datagrid`, `d3`) so app changes don't invalidate cached libraries | `vite.config.ts` |
| **Virtualization + pagination together** — DOM holds one viewport of rows regardless of match count | `OccurrenceGrid.tsx` |
| **Memoized derivation** — one `useMemo` per page keyed on `(dataset, filters, sort)`; 10–40ms over 171,711 rows | `pages/*`, `data/selectors.ts` |
| **Decorate–sort–undecorate** — sort keys extracted once per row, not per comparison (CVSS sort 636ms → ~60ms) | `data/selectors.ts` |
| **Stable component identity** — grid slots and column definitions hoisted/memoized so filter changes don't remount subtrees | `OccurrenceGrid.tsx` |
| **Debounced search** with local echo state | `FilterPanel.tsx` |
| **Single-pass scoped analytics** for drill-down pages | `selectors.scopeStats()` |

## Extending it

The system is designed so new work lands in exactly one layer:

- **New chart** → add an aggregate in `aggregate.ts`, a component in
  `components/charts/`, register it in the Overview widget registry.
- **New filter** → a field in `filtersSlice`, a predicate in
  `filterOccurrences`, a control in `FilterPanel`. The `uiSlice` matcher
  already resets page and scroll on any `filters/*` action.
- **New route** → a lazy entry in `router.tsx`; the layout, breadcrumbs and
  gate need no changes.

This was tested in practice: triage buttons, comparison, export, search
suggestions, the trend chart, dashboard customization, the peek drawer, and
client-side file upload were all added *after* the core was built, and none
required restructuring state or rewriting a component.
