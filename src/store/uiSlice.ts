import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export type GridDensity = 'compact' | 'standard';

/** Explorer grid column customization. `order` lists field ids in display
 *  order; any field not listed renders after these in default order. */
export interface ColumnPrefs {
  hidden: string[];
  order: string[];
}

/** Customizable Explorer columns in their default order. The compare column
 *  is deliberately pinned and not listed. */
export const EXPLORER_COLUMN_FIELDS = [
  'severity', 'cve', 'cvss', 'packageName', 'packageVersion',
  'packageType', 'image', 'fixDate', 'kaiStatus',
] as const;

/** The slice of UI state worth remembering across sessions (email spec:
 *  user preferences for dashboard customization). */
export type ThemeMode = 'dark' | 'light';

// ------------------------------------------------- Overview customization --

export interface WidgetLayout {
  i: string;   // widget id
  x: number;   // grid units (12-column grid)
  y: number;
  w: number;
  h: number;
}

export type BreakdownDimension = 'severity' | 'riskFactor' | 'packageType' | 'year';
export type BreakdownForm = 'bar' | 'donut';

/** A user-composed chart card (the "add your own chart" builder). */
export interface CustomWidget {
  id: string;          // "custom-<n>"
  title: string;
  dimension: BreakdownDimension;
  form: BreakdownForm;
}

export interface OverviewPrefs {
  layout: WidgetLayout[];
  hidden: string[];
  custom: CustomWidget[];
}

/** The default arrangement — mirrors the original fixed Overview. */
export const DEFAULT_OVERVIEW_LAYOUT: WidgetLayout[] = [
  { i: 'stat-occurrences', x: 0, y: 0, w: 2, h: 2 },
  { i: 'stat-cves', x: 2, y: 0, w: 2, h: 2 },
  { i: 'stat-images', x: 4, y: 0, w: 2, h: 2 },
  { i: 'stat-critical', x: 6, y: 0, w: 2, h: 2 },
  { i: 'stat-high', x: 8, y: 0, w: 2, h: 2 },
  { i: 'stat-fix', x: 10, y: 0, w: 2, h: 2 },
  { i: 'severity-donut', x: 0, y: 2, w: 4, h: 6 },
  { i: 'top-images', x: 4, y: 2, w: 8, h: 6 },
  { i: 'risk-factors', x: 0, y: 8, w: 5, h: 7 },
  { i: 'scatter', x: 5, y: 8, w: 7, h: 7 },
  { i: 'trend', x: 0, y: 15, w: 7, h: 6 },
  { i: 'overlap', x: 7, y: 15, w: 5, h: 7 },
];

const defaultOverview = (): OverviewPrefs => ({
  layout: DEFAULT_OVERVIEW_LAYOUT.map((l) => ({ ...l })),
  hidden: [],
  custom: [],
});

export interface UiPreferences {
  pageSize: number;
  sort: SortState;
  gridDensity: GridDensity;
  columns: ColumnPrefs;
  themeMode: ThemeMode;
  overview: OverviewPrefs;
}

export interface UiState extends UiPreferences {
  /** Drawer state for the tablet breakpoint; ignored on desktop (permanent). */
  sidebarOpen: boolean;
  page: number;
  /** Explorer scroll offset, preserved across back-navigation. */
  explorerScrollTop: number;
  /** CVEs staged for side-by-side comparison (max 4). */
  compareCves: string[];
}

export const MAX_COMPARE = 4;
const PREFS_KEY = 'vuln-dashboard:prefs';

const defaultPrefs: UiPreferences = {
  pageSize: 100,
  sort: { field: 'severity', direction: 'asc' }, // severity rank asc = most severe first
  gridDensity: 'compact',
  columns: { hidden: [], order: [...EXPLORER_COLUMN_FIELDS] },
  themeMode: 'dark',
  overview: defaultOverview(),
};

const DIMENSIONS: readonly string[] = ['severity', 'riskFactor', 'packageType', 'year'];

function validOverview(o: unknown): OverviewPrefs | null {
  if (typeof o !== 'object' || o === null) return null;
  const p = o as Partial<OverviewPrefs>;
  if (!Array.isArray(p.layout) || !Array.isArray(p.hidden) || !Array.isArray(p.custom)) return null;
  const layoutOk = p.layout.every((l) =>
    typeof l === 'object' && l !== null && typeof (l as WidgetLayout).i === 'string' &&
    [(l as WidgetLayout).x, (l as WidgetLayout).y, (l as WidgetLayout).w, (l as WidgetLayout).h]
      .every((n) => typeof n === 'number' && Number.isFinite(n)));
  const customOk = p.custom.every((c) =>
    typeof c === 'object' && c !== null &&
    typeof (c as CustomWidget).id === 'string' && typeof (c as CustomWidget).title === 'string' &&
    DIMENSIONS.includes((c as CustomWidget).dimension) &&
    ((c as CustomWidget).form === 'bar' || (c as CustomWidget).form === 'donut'));
  if (!layoutOk || !customOk || !p.hidden.every((h) => typeof h === 'string')) return null;
  return { layout: p.layout, hidden: p.hidden, custom: p.custom };
}

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Defensive localStorage read — malformed/absent prefs fall back silently. */
export function loadPreferences(): UiPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw === null) return defaultPrefs;
    const p: unknown = JSON.parse(raw);
    if (typeof p !== 'object' || p === null) return defaultPrefs;
    const o = p as Partial<UiPreferences>;
    return {
      pageSize: typeof o.pageSize === 'number' && [25, 50, 100].includes(o.pageSize) ? o.pageSize : defaultPrefs.pageSize,
      sort: typeof o.sort?.field === 'string' && (o.sort.direction === 'asc' || o.sort.direction === 'desc')
        ? { field: o.sort.field, direction: o.sort.direction }
        : defaultPrefs.sort,
      gridDensity: o.gridDensity === 'standard' || o.gridDensity === 'compact' ? o.gridDensity : defaultPrefs.gridDensity,
      columns: isStringArray(o.columns?.hidden) && isStringArray(o.columns?.order)
        // Intersect with the known field set so a stale saved order from an
        // older build can't hide or duplicate columns.
        ? {
            hidden: o.columns.hidden.filter((f) => (EXPLORER_COLUMN_FIELDS as readonly string[]).includes(f)),
            order: [
              ...o.columns.order.filter((f) => (EXPLORER_COLUMN_FIELDS as readonly string[]).includes(f)),
              ...EXPLORER_COLUMN_FIELDS.filter((f) => !o.columns?.order.includes(f)),
            ],
          }
        : defaultPrefs.columns,
      themeMode: o.themeMode === 'light' || o.themeMode === 'dark' ? o.themeMode : defaultPrefs.themeMode,
      overview: validOverview(o.overview) ?? defaultOverview(),
    };
  } catch {
    return defaultPrefs;
  }
}

export function savePreferences(p: UiPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage full/blocked — preferences just don't persist */
  }
}

const initialState: UiState = {
  ...loadPreferences(),
  sidebarOpen: false,
  page: 0,
  explorerScrollTop: 0,
  compareCves: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    sidebarToggled(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    sidebarClosed(state) {
      state.sidebarOpen = false;
    },
    pageSizeSet(state, action: PayloadAction<number>) {
      state.pageSize = action.payload;
      state.page = 0;
    },
    pageSet(state, action: PayloadAction<number>) {
      state.page = action.payload;
    },
    sortSet(state, action: PayloadAction<SortState>) {
      state.sort = action.payload;
    },
    explorerScrollSaved(state, action: PayloadAction<number>) {
      state.explorerScrollTop = action.payload;
    },
    gridDensitySet(state, action: PayloadAction<GridDensity>) {
      state.gridDensity = action.payload;
    },
    columnVisibilityToggled(state, action: PayloadAction<string>) {
      const f = action.payload;
      state.columns = state.columns.hidden.includes(f)
        ? { ...state.columns, hidden: state.columns.hidden.filter((x) => x !== f) }
        : { ...state.columns, hidden: [...state.columns.hidden, f] };
    },
    columnMoved(state, action: PayloadAction<{ field: string; dir: -1 | 1 }>) {
      const { field, dir } = action.payload;
      const order = [...state.columns.order];
      const i = order.indexOf(field);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j] as string, order[i] as string];
      state.columns = { ...state.columns, order };
    },
    columnsReset(state) {
      state.columns = { hidden: [], order: [...EXPLORER_COLUMN_FIELDS] };
    },
    themeModeToggled(state) {
      state.themeMode = state.themeMode === 'dark' ? 'light' : 'dark';
    },
    overviewLayoutChanged(state, action: PayloadAction<WidgetLayout[]>) {
      // Merge: RGL only reports visible widgets; keep hidden widgets' slots.
      const byId = new Map(action.payload.map((l) => [l.i, l]));
      state.overview = {
        ...state.overview,
        layout: state.overview.layout.map((l) => byId.get(l.i) ?? l),
      };
    },
    widgetHiddenToggled(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.overview = {
        ...state.overview,
        hidden: state.overview.hidden.includes(id)
          ? state.overview.hidden.filter((h) => h !== id)
          : [...state.overview.hidden, id],
      };
    },
    customWidgetAdded(state, action: PayloadAction<Omit<CustomWidget, 'id'>>) {
      const id = `custom-${Date.now().toString(36)}`;
      const maxY = Math.max(0, ...state.overview.layout.map((l) => l.y + l.h));
      state.overview = {
        ...state.overview,
        custom: [...state.overview.custom, { ...action.payload, id }],
        layout: [...state.overview.layout, { i: id, x: 0, y: maxY, w: 4, h: 6 }],
      };
    },
    customWidgetRemoved(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.overview = {
        custom: state.overview.custom.filter((c) => c.id !== id),
        layout: state.overview.layout.filter((l) => l.i !== id),
        hidden: state.overview.hidden.filter((h) => h !== id),
      };
    },
    overviewReset(state) {
      state.overview = defaultOverview();
    },
    compareToggled(state, action: PayloadAction<string>) {
      const cve = action.payload;
      if (state.compareCves.includes(cve)) {
        state.compareCves = state.compareCves.filter((c) => c !== cve);
      } else if (state.compareCves.length < MAX_COMPARE) {
        state.compareCves.push(cve);
      }
    },
    compareCleared(state) {
      state.compareCves = [];
    },
  },
  extraReducers: (builder) => {
    // Any filter change invalidates the current page and scroll position.
    // Matcher (not per-action cases) so new filter reducers inherit this.
    builder.addMatcher(
      (action) => action.type.startsWith('filters/'),
      (state) => {
        state.page = 0;
        state.explorerScrollTop = 0;
      },
    );
  },
});

export const {
  sidebarToggled, sidebarClosed, pageSizeSet, pageSet, sortSet, explorerScrollSaved,
  gridDensitySet, compareToggled, compareCleared,
  columnVisibilityToggled, columnMoved, columnsReset, themeModeToggled,
  overviewLayoutChanged, widgetHiddenToggled, customWidgetAdded, customWidgetRemoved, overviewReset,
} = uiSlice.actions;
export default uiSlice.reducer;
