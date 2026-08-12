# Requirements coverage

Every line of the assignment, what was built for it, where the code lives, and
where the reasoning is written down. Ordered exactly as the assignment states
them.

## Technical requirements

### Data loading and processing

| Requirement | Implementation | Code | Docs |
|---|---|---|---|
| Efficient loading of a large JSON file (300MB+) | Web Worker streams the file through a string-aware brace-depth tokenizer that emits one complete image object at a time. Peak transient memory 1.3MB; 4.0s parse; **zero main-thread long tasks**, measured. `fetch().json()` would peak ~1GB and, on this file, never finish — it is truncated | `workers/ingest.worker.ts`, `workers/tokenizer.ts` | README → *Handling 270MB* |
| Data processing utilities transforming raw data into meaningful structures | Pure, unit-tested modules: sanitize text, parse non-ISO dates to epoch ms, flatten `riskFactors`, intern names, build composite keys, dedupe into a CVE catalog, count failures instead of throwing | `workers/normalize.ts`, `workers/aggregate.ts` | README → *Data model*; ARCHITECTURE → *Data flow* |
| Pagination or virtualization | **Both.** DataGrid virtualizes rows within a page; pagination caps the working set at 100. The DOM holds one viewport of rows whether 171,711 or 5 match | `components/explorer/OccurrenceGrid.tsx` | README → *Virtualization and pagination* |

### Component architecture

| Requirement | Implementation | Code | Docs |
|---|---|---|---|
| Scalable component hierarchy, modern React patterns | Function components and hooks only. Layered: workers → data → store → pages → components → primitives, with documented rules about what each layer may do. Primitives never touch the store, so they compose across seven routes | `src/**` | **ARCHITECTURE → *Component hierarchy*, *Layer responsibilities*** |
| Proper state management (Context / Redux / React Query) | Redux Toolkit for small serializable state; the ~60MB dataset deliberately outside Redux in a module singleton exposed via Context. Documented hybrid, not an accident | `store/*`, `data/DatasetProvider.tsx` | ARCHITECTURE → *State management*; README → *Redux for UI state* |
| React hooks for shared functionality | `useDataset` / `useDatasetOrNull`, `useDatasetControl`, `useChartTooltip` (shared by six charts), typed `useAppDispatch` / `useAppSelector`, and `ResponsiveChart`'s `ResizeObserver` render prop | `data/useDataset.ts`, `data/DatasetProvider.tsx`, `components/charts/ChartTooltip.tsx`, `store/index.ts` | ARCHITECTURE → *Shared behaviour via hooks* |

### Data visualization

| Requirement | Implementation | Code | Docs |
|---|---|---|---|
| Vulnerability severity distribution | Donut; center total; clicking a slice opens the Explorer pre-filtered to that severity | `charts/SeverityDonut.tsx` | DESIGN → *Interaction model* |
| Risk factors frequency | Ranked bars; the two factors a security team acts on first are emphasized in the critical accent; click filters the Explorer | `charts/RiskFactorBar.tsx` | DESIGN → *Insight-forward* |
| Trend analysis over time | Unique CVEs per publication year, stacked by severity, contiguous axis with gap years zero-filled | `charts/PublishedTrendChart.tsx` | README → *What it does* |
| *(beyond spec)* Severity vs. CVSS, manual-vs-AI overlap, top-risk images, user-composed charts | See *Advanced features* below | `charts/*` | DESIGN |
| Filtering and sorting on multiple dimensions | Severity, risk factor, package type, group, repo, fix availability, free-text, and the two triage verdicts — composable; sorting on seven columns with catalog-aware keys | `store/filtersSlice.ts`, `data/selectors.ts` | README → *Technical decisions* |

### Search and filter interface

| Requirement | Implementation | Code | Docs |
|---|---|---|---|
| Intuitive search interface | Single search field over CVE IDs and package names, debounced 250ms with local echo so typing never stalls | `components/explorer/FilterPanel.tsx` | ARCHITECTURE → *Performance techniques* |
| Advanced filtering, multiple criteria | Faceted panel with per-option counts, active-filter count, one-click clear; filter state in Redux, the row array never is | `FilterPanel.tsx`, `filtersSlice.ts` | README → *What it does* |
| **Real-time search suggestions and hints** | Grouped autocomplete (CVE / Package headings) over the 1,228-entry catalog plus the distinct package-name vocabulary collected at ingest; matches from 2 characters, capped at 8, `freeSolo` so plain substring search still works. Selecting commits immediately | `FilterPanel.tsx` → `SearchWithSuggestions`, `aggregates.packageNames` | README → *What it does* |

### Performance optimization

| Requirement | Implementation | Code | Docs |
|---|---|---|---|
| **Code splitting and lazy loading** | Every route except the landing Overview is a `React.lazy` chunk behind one `Suspense` boundary — the 664KB DataGrid bundle downloads only when the Explorer opens. `manualChunks` pins `react-vendor` / `mui` / `datagrid` / `d3` so app edits don't invalidate cached libraries | `router.tsx`, `components/layout/DashboardLayout.tsx`, `vite.config.ts` | ARCHITECTURE → *Performance techniques* |
| Memoization and virtualization | One memoized derivation per page keyed on `(dataset, filters, sort)`; decorate–sort–undecorate (CVSS sort 636ms → ~60ms); hoisted grid slots and memoized column definitions so filter changes don't remount subtrees; DataGrid virtualization | `pages/*`, `data/selectors.ts`, `OccurrenceGrid.tsx` | ARCHITECTURE → *Performance techniques* |
| Efficient handling of large data sets | 139.8× dedup, string interning, precomputed aggregates, single-pass scoped rollups. Measured end to end | `workers/*`, `data/selectors.ts` | README → *Measured* |

### Code review and documentation

| Requirement | Where |
|---|---|
| Document component architecture and data flow | **[ARCHITECTURE.md](ARCHITECTURE.md)** — flow diagram, component tree, layer rules, state ownership, hook inventory |
| Comments for complex logic | Inline throughout, and deliberately *reason*-first: why the tokenizer is hand-rolled, why sort keys are extracted once, why the scatter's points aren't tab stops, why `sx` `width: 1` was a bug, why light mode needed a second severity palette |
| README with setup instructions and architecture overview | [README.md](../README.md) — clone-to-running in three commands, plus the data story, measurements, and decisions |

## Assessment tasks

### Initial setup

| Requirement | Detail |
|---|---|
| React project with TypeScript | Vite + React 18 + TypeScript, `strict` **plus** `noUncheckedIndexedAccess`; zero `any` in `src/`; `tsc --noEmit` clean and gating the build |
| Essential dependencies configured | React Router v6 data router · Redux Toolkit · MUI v6 + MUI X DataGrid · D3 · react-grid-layout · Vitest |
| Basic application structure | Layered `src/` tree — see ARCHITECTURE |

### Data handling

| Requirement | Implementation |
|---|---|
| Utilities to load and process the JSON | `workers/tokenizer.ts` (stream → image objects), `normalize.ts` (records → model), `aggregate.ts` (model → chart-ready numbers). All pure and unit-tested except the worker shell |
| Efficient data structures for storing and querying | `Map<string, CveMeta>` catalog for O(1) CVE lookup; flat `Occurrence[]` for linear scans that stay cache-friendly; interned `groupNames`/`repoNames` arrays addressed by numeric index; precomputed `Aggregates` so no chart ever scans rows |
| Interfaces/types for the data model | `types/vulnerability.ts` — `CveMeta`, `Occurrence`, `ImageMeta`, `Aggregates`, `Dataset`, `IngestDiagnostics`, plus a `Severity` union confirmed against the real file in Phase 0 rather than assumed |
| **Filtering logic for `kaiStatus`** | Both verdicts are first-class: `KAI_MANUAL_INVALID` / `KAI_AI_INVALID` constants, independent toggles in `filtersSlice`, exclusion in `filterOccurrencesDetailed`, and unit tests covering each button alone, both together, and tallies under combined filters |
| **Be creative in how you structure and optimize the data** | See *Creative work* below — the catalog/occurrence split is the single highest-leverage decision in the project (139.8×, 74.5MB of duplicated description text removed) |

### Dashboard implementation

| Requirement | Implementation |
|---|---|
| Main dashboard with key metrics and visualizations | Overview: six stat cards, six visualizations — and it is **user-composable** (drag, resize, hide, add your own charts), persisted |
| Vulnerability listing with sorting and filtering | Explorer over all 171,711 occurrences |
| Detail views for individual vulnerabilities | `/cve/:cveId` (blast radius, CVSS percentile, remediation advisories, affected packages, every occurrence) plus a peek drawer that shows the same story without leaving the grid |
| **"Analysis" button** → filters out `invalid - norisk` | `AnalysisActions.tsx` |
| **"AI Analysis" button** → filters out `ai-invalid-norisk` | `AnalysisActions.tsx` |
| Engaging representation of filter states and transitions | See *Creative work* |
| Innovative display of filter impact | See *Creative work* |

### Advanced features

| Requirement | Implementation | Code |
|---|---|---|
| Comparison of multiple vulnerabilities | Stage up to 4 CVEs from a grid column or any detail view; `/compare` renders side-by-side cards with occurrence rollups and a **risk-factor union matrix** — factors absent from a CVE render struck through in place, so differences line up visually instead of requiring you to diff two chip clouds | `pages/ComparePage.tsx` |
| Export functionality for filtered data | CSV or JSON of the **exact current view**, built client-side from the same row array the grid renders — what you see is what you get, resolved names and all | `utils/exportRows.ts` |
| User preferences for dashboard customization | Theme, grid density, column visibility **and order**, dashboard layout, and user-composed charts — all persisted to `localStorage` behind a validating loader that can't be broken by a stale blob | `store/uiSlice.ts`, `pages/OverviewPage.tsx` |
| Creative visualization: AI vs. manual analysis relationship | See *Creative work* | `charts/AnalysisOverlapChart.tsx` |
| Original approach to highlighting critical vulnerabilities after filtering | See *Creative work* | `ExplorerToolbar`, `TopRisksStrip`, `OccurrenceGrid` |

## Creative work

The assignment asks for creativity in six places. Each one, and the thinking:

**1. Data structuring (“be creative”) — the catalog/occurrence split.**
Phase 0 measured that 75.0MB of the 270MB file is description text and 74.5MB
of that is duplicated. Splitting into a deduped `CveMeta` catalog plus
lightweight occurrence rows collapses 171,711 records into 1,228 unique CVEs —
**139.8×**. It's what makes the dataset fit in a tab, and it *enables a
feature*: `/cve/:cveId` answers "every image and package this CVE touches
across the estate," a cross-cutting query that would be unaffordable otherwise.
String interning and precomputed aggregates follow the same principle — pay
once at ingest so every later interaction is cheap.

**2. The two action buttons.**
Not checkboxes. Each is a stateful card carrying its own identity — Analysis in
amber with a fact-check mark, AI Analysis in blue with a robot — that lights up
and glows when engaged. Each shows **how many records it would remove within
the current filter context**, not globally, so the number stays honest when
other filters are active. That property is unit-tested, because a badge that
lies is worse than no badge.

**3. Filter states and transitions.**
Toggling animates: the icon scales, the border and glow shift over 250ms, and
the impact bar's segments slide to their new proportions over 400ms. The
transition is the feedback. The bar only exists while a toggle is engaged —
at rest it carried no information, and an element that says nothing shouldn't
occupy space.

**4. Filter impact on the dataset.**
A proportional bar splits the current context into *shown* / *removed by
Analysis* / *removed by AI Analysis*, colored to match the buttons that caused
each removal, with a live count beside it and the Explorer header restating the
survivors as a share of the whole dataset. Real proportions, not decoration —
the animation is honest because the widths are the data.

**5. AI vs. manual analysis relationship.**
Two reads in one card. Overlap tiles (manual only / both agree / AI only /
untriaged) with intensity keyed to share of catalog, above per-severity
mirrored bars — manual left, AI right. The finding is immediate and genuinely
interesting: the two tracks agree on only **18 of 1,228 CVEs**, and AI never
dismisses a critical. That's a story about the scanner, surfaced by the shape
of the chart rather than buried in a table.

**6. Highlighting the most critical vulnerabilities after filtering.**
A "fix first" strip above the grid recomputes the most dangerous distinct CVEs
**in the current view** on every filter change, ranked by an opinionated
order — actively exploited first, then severity, then CVSS — with exploited
chips pulsing, and matching rows given a critical accent rail so the opinion is
traceable back into the data. Unfiltered, it correctly surfaces Log4Shell. The
same component is reused scoped to a group or repo, where it produces a
*different* answer per scope.

## Technical stack

| Required | Used |
|---|---|
| React (hooks, function components) | React 18 — no class components |
| TypeScript | Strict + `noUncheckedIndexedAccess`, no `any` |
| State management | Redux Toolkit (+ Context for the dataset) |
| Data visualization library | D3 — as a *calculation* library; React renders every SVG node |
| UI component library | Material UI v6 + MUI X DataGrid |
| React Router | v6 data router (`createBrowserRouter`) |

## Deliverables

| Deliverable | Status |
|---|---|
| GitHub repository with complete source | <https://github.com/Jubbery/vuln-dashboard> |
| Deployed application | <https://vuln-dash.vercel.app> — serves a committed 44MB sample through the identical ingest path. **Reviewers can load the real `ui_demo.json` via the upload button in the app header** and exercise the full 171,711-record scan in the deployed build; parsing happens entirely in the browser and the file is never uploaded. The app surfaces this itself with an on-screen notice |
| Documentation of architecture decisions and component structure | [README.md](../README.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [DESIGN.md](DESIGN.md) · [PHASE0-FINDINGS.md](PHASE0-FINDINGS.md) |
| Brief presentation of approach and implementation | [PRESENTATION.md](PRESENTATION.md) |
