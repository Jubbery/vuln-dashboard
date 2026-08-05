/**
 * Explorer filter state — small and serializable. The occurrence array these
 * filters apply to lives outside Redux; selectors in data/selectors.ts join
 * the two (§2.1).
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Severity } from '../types/vulnerability.ts';

export type FixFilter = 'all' | 'with-fix' | 'without-fix';
/** Phase 0 discovery: kaiStatus triage verdicts. 'active' = not dismissed. */
export type TriageFilter = 'all' | 'active' | 'dismissed';

export interface FiltersState {
  severities: Severity[];        // empty = all
  riskFactors: string[];         // empty = all
  packageTypes: string[];        // empty = all
  groupId: number | null;
  repoId: number | null;
  search: string;                // matches CVE id and package name (debounced upstream)
  fix: FixFilter;
  triage: TriageFilter;
}

const initialState: FiltersState = {
  severities: [],
  riskFactors: [],
  packageTypes: [],
  groupId: null,
  repoId: null,
  search: '',
  fix: 'all',
  triage: 'all',
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
    triageSet(state, action: PayloadAction<TriageFilter>) {
      state.triage = action.payload;
    },
    filtersCleared() {
      return initialState;
    },
  },
});

export const {
  severitiesSet, riskFactorsSet, packageTypesSet, groupSet, repoSet,
  searchSet, fixSet, triageSet, filtersCleared,
} = filtersSlice.actions;
export default filtersSlice.reducer;
