import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

export interface UiState {
  /** Drawer state for the tablet breakpoint; ignored on desktop (permanent). */
  sidebarOpen: boolean;
  pageSize: number;
  sort: SortState;
  page: number;
  /** Explorer scroll offset, preserved across back-navigation. */
  explorerScrollTop: number;
}

const initialState: UiState = {
  sidebarOpen: false,
  pageSize: 100,
  sort: { field: 'severity', direction: 'asc' }, // severity rank asc = most severe first
  page: 0,
  explorerScrollTop: 0,
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
  },
});

export const {
  sidebarToggled, sidebarClosed, pageSizeSet, pageSet, sortSet, explorerScrollSaved,
} = uiSlice.actions;
export default uiSlice.reducer;
