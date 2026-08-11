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
import { ExplorerToolbar } from '../components/explorer/ExplorerToolbar.tsx';
import { OccurrenceGrid } from '../components/explorer/OccurrenceGrid.tsx';
import { CvePeekDrawer } from '../components/explorer/CvePeekDrawer.tsx';
import { formatNumber } from '../utils/format.ts';

const PANEL_WIDTH = 272;

export default function ExplorerPage(): ReactNode {
  const dataset = useDataset();
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('lg'));
  const filters = useAppSelector((s) => s.filters);
  const sort = useAppSelector((s) => s.ui.sort);
  const [panelOpen, setPanelOpen] = useState(false);
  // Row click peeks instead of navigating — filter/scroll state stays live.
  const [peekCve, setPeekCve] = useState<string | null>(null);

  // The one expensive computation on this page — memoized on exactly the
  // inputs that can change it. Runs in ~10–40ms over 171k rows.
  const { rows, manualDismissed, aiDismissed, topRisks } = useMemo(
    () => computeExplorerResult(dataset, filters, sort),
    [dataset, filters, sort],
  );

  const total = dataset.occurrences.length;
  const filtered = rows.length < total;
  const header = (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
      <Typography variant="h1">Explorer</Typography>
      {/* When filters bite, the reduction IS the insight — lead with the
          shown count and say what share of the dataset survived. */}
      <Typography variant="body2" color="text.secondary">
        {filtered ? (
          <>
            <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>
              {formatNumber(rows.length)}
            </Box>
            {' of '}{formatNumber(total)} occurrences
            {' · '}{((rows.length / total) * 100).toFixed(rows.length / total < 0.1 ? 1 : 0)}% of the dataset
          </>
        ) : (
          <>{formatNumber(total)} occurrences</>
        )}
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
  const toolbar = <ExplorerToolbar topRisks={topRisks} rows={rows} />;

  if (!wide) {
    return (
      <Box>
        {header}
        {actions}
        <Collapse in={panelOpen}>
          <Box sx={{ mb: 2 }}><FilterPanel /></Box>
        </Collapse>
        {toolbar}
        <OccurrenceGrid rows={rows} topRisks={topRisks} onRowActivate={setPeekCve} />
        <CvePeekDrawer cve={peekCve} onClose={() => setPeekCve(null)} />
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
          {toolbar}
          <OccurrenceGrid rows={rows} topRisks={topRisks} onRowActivate={setPeekCve} />
        </Box>
      </Box>
      <CvePeekDrawer cve={peekCve} onClose={() => setPeekCve(null)} />
    </Box>
  );
}
