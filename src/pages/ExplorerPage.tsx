import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import Button from '@mui/material/Button';
import FilterListIcon from '@mui/icons-material/FilterList';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { useMemo, useState, type ReactNode } from 'react';
import { useDataset } from '../data/useDataset.ts';
import { useAppSelector } from '../store/index.ts';
import { computeExplorerResult } from '../data/selectors.ts';
import { FilterPanel } from '../components/explorer/FilterPanel.tsx';
import { AnalysisActions } from '../components/explorer/AnalysisActions.tsx';
import { OccurrenceGrid } from '../components/explorer/OccurrenceGrid.tsx';
import { formatNumber } from '../utils/format.ts';

const PANEL_WIDTH = 272;

export default function ExplorerPage(): ReactNode {
  const dataset = useDataset();
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('lg'));
  const filters = useAppSelector((s) => s.filters);
  const sort = useAppSelector((s) => s.ui.sort);
  const [panelOpen, setPanelOpen] = useState(false);

  // The one expensive computation on this page — memoized on exactly the
  // inputs that can change it. Runs in ~10–40ms over 171k rows.
  const { rows, manualDismissed, aiDismissed } = useMemo(
    () => computeExplorerResult(dataset, filters, sort),
    [dataset, filters, sort],
  );

  const header = (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
      <Typography variant="h1">Explorer</Typography>
      <Typography variant="body2" color="text.secondary">
        {formatNumber(rows.length)} of {formatNumber(dataset.occurrences.length)} occurrences
      </Typography>
      {!wide && (
        <Button
          size="small"
          startIcon={<FilterListIcon />}
          onClick={() => setPanelOpen((o) => !o)}
          aria-expanded={panelOpen}
        >
          Filters
        </Button>
      )}
    </Box>
  );

  const actions = (
    <AnalysisActions manualDismissed={manualDismissed} aiDismissed={aiDismissed} visible={rows.length} />
  );

  if (!wide) {
    return (
      <Box>
        {header}
        {actions}
        <Collapse in={panelOpen}>
          <Box sx={{ mb: 2 }}><FilterPanel /></Box>
        </Collapse>
        <OccurrenceGrid rows={rows} />
      </Box>
    );
  }

  return (
    <Box>
      {header}
      <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'flex-start' }}>
        <Box sx={{ width: PANEL_WIDTH, flexShrink: 0, position: 'sticky', top: 68 }}>
          <FilterPanel />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {actions}
          <OccurrenceGrid rows={rows} />
        </Box>
      </Box>
    </Box>
  );
}
