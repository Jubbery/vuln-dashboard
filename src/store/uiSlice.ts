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
export interface UiPreferences {
  pageSize: number;
  sort: SortState;
  gridDensity: GridDensity;
  columns: ColumnPrefs;
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
};

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
  columnVisibilityToggled, columnMoved, columnsReset,
} = uiSlice.actions;
export default uiSlice.reducer;
