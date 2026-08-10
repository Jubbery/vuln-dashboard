import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Autocomplete from '@mui/material/Autocomplete';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import SearchIcon from '@mui/icons-material/Search';
import { alpha, useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Severity } from '../../types/vulnerability.ts';
import { SEVERITY_ORDER, SEVERITY_LABEL, ACTIONABLE_RISK_FACTORS } from '../../theme/severity.ts';
import { useDataset } from '../../data/useDataset.ts';
import { useAppDispatch, useAppSelector } from '../../store/index.ts';
import {
  severitiesSet, riskFactorsSet, packageTypesSet, groupSet, searchSet,
  fixSet, triageSet, filtersCleared, type FixFilter, type TriageFilter,
} from '../../store/filtersSlice.ts';
import { formatNumber } from '../../utils/format.ts';

const SEARCH_DEBOUNCE_MS = 250;

/** Severity toggle rendered as theme-colored chips. */
function SeverityFilter(): ReactNode {
  const theme = useTheme();
  const selected = useAppSelector((s) => s.filters.severities);
  const dispatch = useAppDispatch();
  const toggle = (sev: Severity): void => {
    const next = selected.includes(sev) ? selected.filter((s) => s !== sev) : [...selected, sev];
    dispatch(severitiesSet(next));
  };
  return (
    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
      {SEVERITY_ORDER.filter((s) => s !== 'unknown').map((sev) => {
        const color = theme.palette.severity[sev];
        const active = selected.includes(sev);
        return (
          <Chip
            key={sev}
            size="small"
            label={SEVERITY_LABEL[sev]}
            onClick={() => toggle(sev)}
            aria-pressed={active}
            sx={{
              color: active ? '#0e1218' : color,
              backgroundColor: active ? color : alpha(color, 0.12),
              border: `1px solid ${alpha(color, 0.5)}`,
              fontWeight: 600,
              '&:hover': { backgroundColor: active ? color : alpha(color, 0.25) },
            }}
          />
        );
      })}
    </Box>
  );
}

export function FilterPanel(): ReactNode {
  const dataset = useDataset();
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.filters);

  // Debounced search: local echo state, dispatch after quiet period.
  const [searchDraft, setSearchDraft] = useState(filters.search);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchDraft !== filters.search) dispatch(searchSet(searchDraft));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchDraft, filters.search, dispatch]);
  // Keep draft in sync when filters are cleared externally.
  useEffect(() => {
    if (filters.search === '' && searchDraft !== '') setSearchDraft('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  // Memoized: this component re-renders on every search keystroke, and
  // re-sorting the option lists each time is pointless work (Phase 6 profiling).
  const riskFactorOptions = useMemo(
    () => Object.keys(dataset.aggregates.byRiskFactor).sort((a, b) => {
      const aAct = ACTIONABLE_RISK_FACTORS.has(a) ? 0 : 1;
      const bAct = ACTIONABLE_RISK_FACTORS.has(b) ? 0 : 1;
      return aAct - bAct || a.localeCompare(b);
    }),
    [dataset],
  );
  const packageTypeOptions = useMemo(
    () => Object.keys(dataset.aggregates.byPackageType).sort(),
    [dataset],
  );

  const activeCount =
    filters.severities.length + filters.riskFactors.length + filters.packageTypes.length +
    (filters.groupId !== null ? 1 : 0) + (filters.search !== '' ? 1 : 0) +
    (filters.fix !== 'all' ? 1 : 0) + (filters.triage !== 'all' ? 1 : 0);

  return (
    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h3">Filters</Typography>
        {activeCount > 0 && (
          <Button size="small" onClick={() => dispatch(filtersCleared())}>
            Clear {activeCount}
          </Button>
        )}
      </Box>

      <TextField
        size="small"
        placeholder="CVE or package…"
        value={searchDraft}
        onChange={(e) => setSearchDraft(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            ),
          },
        }}
        aria-label="Search CVE or package name"
      />

      <Box>
        <Typography variant="caption" component="div" sx={{ mb: 0.75 }}>Severity</Typography>
        <SeverityFilter />
      </Box>

      <Autocomplete
        multiple
        size="small"
        options={riskFactorOptions}
        value={filters.riskFactors}
        onChange={(_, v) => dispatch(riskFactorsSet(v))}
        renderInput={(params) => <TextField {...params} label="Risk factors" />}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              {...getTagProps({ index })}
              key={option}
              size="small"
              label={option}
              color={ACTIONABLE_RISK_FACTORS.has(option) ? 'error' : 'default'}
            />
          ))
        }
      />

      <FormControl size="small">
        <InputLabel id="group-filter-label">Group</InputLabel>
        <Select
          labelId="group-filter-label"
          label="Group"
          value={filters.groupId ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            dispatch(groupSet(v === '' ? null : Number(v)));
          }}
        >
          <MenuItem value="">All groups</MenuItem>
          {dataset.groupNames.map((name, id) => (
            <MenuItem key={name} value={id}>{name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box>
        <Typography variant="caption" component="div" sx={{ mb: 0.5 }}>Package type</Typography>
        <FormGroup>
          {packageTypeOptions.map((pt) => (
            <FormControlLabel
              key={pt}
              control={
                <Checkbox
                  size="small"
                  checked={filters.packageTypes.includes(pt)}
                  onChange={(_, checked) =>
                    dispatch(packageTypesSet(
                      checked
                        ? [...filters.packageTypes, pt]
                        : filters.packageTypes.filter((x) => x !== pt),
                    ))}
                />
              }
              label={
                <Typography variant="body2">
                  {pt} <Typography component="span" variant="caption">
                    ({formatNumber(dataset.aggregates.byPackageType[pt] ?? 0)})
                  </Typography>
                </Typography>
              }
            />
          ))}
        </FormGroup>
      </Box>

      <Box>
        <Typography variant="caption" component="div" sx={{ mb: 0.75 }}>Fix available</Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          fullWidth
          value={filters.fix}
          onChange={(_, v: FixFilter | null) => { if (v !== null) dispatch(fixSet(v)); }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="with-fix">Fixable</ToggleButton>
          <ToggleButton value="without-fix">No fix</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box>
        <Typography variant="caption" component="div" sx={{ mb: 0.75 }}>
          Kai triage
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          fullWidth
          value={filters.triage}
          onChange={(_, v: TriageFilter | null) => { if (v !== null) dispatch(triageSet(v)); }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="active">Active</ToggleButton>
          <ToggleButton value="dismissed">Dismissed</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" sx={{ mt: 0.5, display: 'block', opacity: 0.7 }}>
          ~12% of records are dismissed by scanner triage (kaiStatus)
        </Typography>
      </Box>
    </Paper>
  );
}
