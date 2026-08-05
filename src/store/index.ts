import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import ingestionReducer from './ingestionSlice.ts';

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
    // filters: filtersReducer,  (Phase 2)
    // ui: uiReducer,            (Phase 2)
  },
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: { warnAfter: 64 },
      immutableCheck: { warnAfter: 64 },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
