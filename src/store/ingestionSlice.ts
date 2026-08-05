/**
 * Ingestion status/progress. Small and serializable — the dataset itself
 * NEVER enters Redux (brief §2.1): serializing a ~60MB object graph through
 * every devtools action would hang the tab. See data/DatasetProvider.tsx.
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { IngestDiagnostics } from '../types/vulnerability.ts';

export type IngestionStatus = 'idle' | 'parsing' | 'aggregating' | 'ready' | 'error';

export interface IngestionState {
  status: IngestionStatus;
  bytesRead: number;
  totalBytes: number;
  error: string | null;
  /** Small, serializable summary — safe for Redux. */
  diagnostics: IngestDiagnostics | null;
}

const initialState: IngestionState = {
  status: 'idle',
  bytesRead: 0,
  totalBytes: 0,
  error: null,
  diagnostics: null,
};

const ingestionSlice = createSlice({
  name: 'ingestion',
  initialState,
  reducers: {
    ingestStarted(state) {
      state.status = 'parsing';
      state.bytesRead = 0;
      state.error = null;
    },
    ingestProgress(
      state,
      action: PayloadAction<{ bytesRead: number; totalBytes: number; phase: 'parsing' | 'aggregating' }>,
    ) {
      state.status = action.payload.phase === 'parsing' ? 'parsing' : 'aggregating';
      state.bytesRead = action.payload.bytesRead;
      state.totalBytes = action.payload.totalBytes;
    },
    ingestReady(state, action: PayloadAction<IngestDiagnostics>) {
      state.status = 'ready';
      state.diagnostics = action.payload;
    },
    ingestFailed(state, action: PayloadAction<string>) {
      state.status = 'error';
      state.error = action.payload;
    },
  },
});

export const { ingestStarted, ingestProgress, ingestReady, ingestFailed } = ingestionSlice.actions;
export default ingestionSlice.reducer;
