/**
 * Explorer filter state — small and serializable. The occurrence array these
 * filters apply to lives outside Redux; selectors in data/selectors.ts join
 * the two (§2.1).
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Severity } from '../types/vulnerability.ts';

export type FixFilter = 'all' | 'with-fix' | 'without-fix';

/** The two kaiStatus triage verdicts present in the data (Phase 0 + email
 *  spec): manual analysis dismissals and AI analysis dismissals. */
export const KAI_MANUAL_INVALID = 'invalid - norisk';
export const KAI_AI_INVALID = 'ai-invalid-norisk';

export interface FiltersState {
  severities: Severity[];        // empty = all
  riskFactors: string[];         // empty = all
  packageTypes: string[];        // empty = all
  groupId: number | null;
  repoId: number | null;
  search: string;                // matches CVE id and package name (debounced upstream)
  fix: FixFilter;
  /** "Analysis" action button: hide records dismissed by manual analysis. */
  analysisOn: boolean;
  /** "AI Analysis" action button: hide records dismissed by AI analysis. */
  aiAnalysisOn: boolean;
}

const initialState: FiltersState = {
  severities: [],
  riskFactors: [],
  packageTypes: [],
  groupId: null,
  repoId: null,
  search: '',
  fix: 'all',
  analysisOn: false,
  aiAnalysisOn: false,
};

const filtersSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    severitiesSet(state, action: PayloadAction<Severity[]>) {
      state.severities = action.payload;
    },
    riskFactorsSet(state, action: PayloadAction<string[]>) {
      state.riskFactors = action.payload;
    },
    packageTypesSet(state, action: PayloadAction<string[]>) {
      state.packageTypes = action.payload;
    },
    groupSet(state, action: PayloadAction<number | null>) {
      state.groupId = action.payload;
      state.repoId = null; // repo filter is meaningless across groups
    },
    repoSet(state, action: PayloadAction<number | null>) {
      state.repoId = action.payload;
    },
    searchSet(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
    fixSet(state, action: PayloadAction<FixFilter>) {
      state.fix = action.payload;
    },
    analysisToggled(state) {
      state.analysisOn = !state.analysisOn;
    },
    aiAnalysisToggled(state) {
      state.aiAnalysisOn = !state.aiAnalysisOn;
    },
    filtersCleared() {
      return initialState;
    },
  },
});

export const {
  severitiesSet, riskFactorsSet, packageTypesSet, groupSet, repoSet,
  searchSet, fixSet, analysisToggled, aiAnalysisToggled, filtersCleared,
} = filtersSlice.actions;
export default filtersSlice.reducer;
