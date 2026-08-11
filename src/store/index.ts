import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import ingestionReducer from './ingestionSlice.ts';
import filtersReducer from './filtersSlice.ts';
import uiReducer, { savePreferences, type UiPreferences } from './uiSlice.ts';

/**
 * Redux holds only small, serializable UI/status state (brief §2.1). The
 * dataset lives outside Redux in DatasetProvider's module singleton.
 *
 * serializableCheck/immutableCheck deep-walk state on EVERY action in dev.
 * With the dataset excluded our state is tiny, so the checks stay on — they
 * are exactly the guard that would catch someone accidentally dispatching
 * the dataset into a slice. Thresholds set so a slow CI machine doesn't warn.
 */
export const store = configureStore({
  reducer: {
    ingestion: ingestionReducer,
    filters: filtersReducer,
    ui: uiReducer,
  },
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: { warnAfter: 64 },
      immutableCheck: { warnAfter: 64 },
    }),
});

// Persist the preference subset (email spec: dashboard customization).
// Cheap change-detection by reference — these fields are replaced, not
// mutated, by their reducers.
let lastPrefs: Partial<UiPreferences> = {};
store.subscribe(() => {
  const { pageSize, sort, gridDensity } = store.getState().ui;
  if (pageSize !== lastPrefs.pageSize || sort !== lastPrefs.sort || gridDensity !== lastPrefs.gridDensity) {
    lastPrefs = { pageSize, sort, gridDensity };
    savePreferences({ pageSize, sort, gridDensity });
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
