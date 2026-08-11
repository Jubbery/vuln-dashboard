import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export type GridDensity = 'compact' | 'standard';

/** The slice of UI state worth remembering across sessions (email spec:
 *  user preferences for dashboard customization). */
export interface UiPreferences {
  pageSize: number;
  sort: SortState;
  gridDensity: GridDensity;
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
};

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
} = uiSlice.actions;
export default uiSlice.reducer;
