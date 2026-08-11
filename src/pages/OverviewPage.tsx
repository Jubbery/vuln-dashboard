import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import GlobalStyles from '@mui/material/GlobalStyles';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import AddchartIcon from '@mui/icons-material/Addchart';
import CloseIcon from '@mui/icons-material/Close';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DoneIcon from '@mui/icons-material/Done';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { alpha, useTheme } from '@mui/material/styles';
import { useMemo, useState, type ReactNode } from 'react';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout';
import { ORDERED_DIMENSIONS } from '../components/charts/BreakdownChart.tsx';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { Dataset } from '../types/vulnerability.ts';
import { useDataset } from '../data/useDataset.ts';
import { useAppDispatch, useAppSelector } from '../store/index.ts';
import {
  overviewLayoutChanged, widgetHiddenToggled, customWidgetAdded, customWidgetRemoved,
  overviewReset, type BreakdownDimension, type BreakdownForm, type CustomWidget,
} from '../store/uiSlice.ts';
import { StatCard } from '../components/primitives/StatCard.tsx';
import { ChartCard } from '../components/charts/ChartCard.tsx';
import { ResponsiveChart } from '../components/charts/ResponsiveChart.tsx';
import { SeverityDonut } from '../components/charts/SeverityDonut.tsx';
import { TopRiskImagesBar } from '../components/charts/TopRiskImagesBar.tsx';
import { RiskFactorBar } from '../components/charts/RiskFactorBar.tsx';
import { SeverityVsCvssScatter } from '../components/charts/SeverityVsCvssScatter.tsx';
import { PublishedTrendChart } from '../components/charts/PublishedTrendChart.tsx';
import { AnalysisOverlapChart } from '../components/charts/AnalysisOverlapChart.tsx';
import { BreakdownChart } from '../components/charts/BreakdownChart.tsx';
import { formatNumber, formatPercent } from '../utils/format.ts';

const Grid = WidthProvider(GridLayout);

const DIMENSION_LABEL: Record<BreakdownDimension, string> = {
  severity: 'Severity',
  riskFactor: 'Risk factors',
  packageType: 'Package types',
  year: 'Disclosure year',
  group: 'Groups',
  kaiStatus: 'Triage status',
  cvssBand: 'CVSS score bands',
};

/** Minimum grid sizes so a widget can't be collapsed into uselessness. */
function minSizeOf(id: string): { minW: number; minH: number } {
  return id.startsWith('stat-') ? { minW: 2, minH: 2 } : { minW: 3, minH: 4 };
}

/**
 * Built-in widget registry. Every widget is a pure view over the dataset —
 * layout, visibility, and user-composed additions are preferences (§2.1:
 * small and serializable; the dataset itself never enters Redux).
 */
function renderWidget(id: string, dataset: Dataset, accent: (k: 'critical' | 'high') => string): ReactNode {
  const { totals, bySeverity, byRiskFactor, topRiskImages, severityVsCvss, fixAvailability, publishedTrend, analysisOverlap } = dataset.aggregates;
  switch (id) {
    case 'stat-occurrences':
      return <StatCard label="Occurrences" value={formatNumber(totals.occurrences)} />;
    case 'stat-cves':
      return <StatCard label="Unique CVEs" value={formatNumber(totals.uniqueCves)}
        sublabel={`dedup ${(totals.occurrences / Math.max(1, totals.uniqueCves)).toFixed(0)}×`} />;
    case 'stat-images':
      return <StatCard label="Images" value={formatNumber(totals.images)}
        sublabel={`${formatNumber(totals.repos)} repos · ${totals.groups} groups`} />;
    case 'stat-critical':
      return <StatCard label="Critical" value={formatNumber(bySeverity.critical)}
        sublabel={formatPercent(bySeverity.critical, totals.occurrences)} accent={accent('critical')} />;
    case 'stat-high':
      return <StatCard label="High" value={formatNumber(bySeverity.high)}
        sublabel={formatPercent(bySeverity.high, totals.occurrences)} accent={accent('high')} />;
    case 'stat-fix':
      return <StatCard label="Fix available"
        value={formatPercent(fixAvailability.withFix, fixAvailability.withFix + fixAvailability.withoutFix)}
        sublabel={`${formatNumber(fixAvailability.withFix)} occurrences`} />;
    case 'severity-donut':
      return (
        <ChartCard title="Severity distribution" subtitle="click a slice to filter the Explorer">
          <ResponsiveChart height="fill">
            {({ width, height }) => <SeverityDonut bySeverity={bySeverity} width={width} height={height} />}
          </ResponsiveChart>
        </ChartCard>
      );
    case 'top-images':
      return (
        <ChartCard title="Top 10 riskiest images" subtitle="ranked and sized by weighted severity score — click to open">
          <ResponsiveChart height="fill">
            {({ width, height }) => <TopRiskImagesBar topRiskImages={topRiskImages} dataset={dataset} width={width} height={height} />}
          </ResponsiveChart>
        </ChartCard>
      );
    case 'risk-factors':
      return (
        <ChartCard title="Risk factors" subtitle="frequency across occurrences — actionable factors highlighted">
          <ResponsiveChart height="fill">
            {({ width, height }) => <RiskFactorBar byRiskFactor={byRiskFactor} totalOccurrences={totals.occurrences} width={width} height={height} />}
          </ResponsiveChart>
        </ChartCard>
      );
    case 'scatter':
      return (
        <ChartCard title="Vendor severity vs. CVSS" subtitle="one point per unique CVE — the shaded region is where the label understates the score">
          <ResponsiveChart height="fill">
            {({ width, height }) => <SeverityVsCvssScatter severityVsCvss={severityVsCvss} width={width} height={height} />}
          </ResponsiveChart>
        </ChartCard>
      );
    case 'trend':
      return (
        <ChartCard title="Disclosures over time" subtitle="unique CVEs by publication year, stacked by severity">
          <ResponsiveChart height="fill">
            {({ width, height }) => <PublishedTrendChart publishedTrend={publishedTrend} width={width} height={height} />}
          </ResponsiveChart>
        </ChartCard>
      );
    case 'overlap':
      return (
        <ChartCard title="Manual vs. AI triage" subtitle="where the two analysis tracks agree — and which severities they dismiss">
          <AnalysisOverlapChart analysisOverlap={analysisOverlap} />
        </ChartCard>
      );
    default:
      return null;
  }
}

const WIDGET_TITLE: Record<string, string> = {
  'stat-occurrences': 'Occurrences stat',
  'stat-cves': 'Unique CVEs stat',
  'stat-images': 'Images stat',
  'stat-critical': 'Critical stat',
  'stat-high': 'High stat',
  'stat-fix': 'Fix available stat',
  'severity-donut': 'Severity distribution',
  'top-images': 'Top 10 riskiest images',
  'risk-factors': 'Risk factors',
  'scatter': 'Severity vs. CVSS',
  'trend': 'Disclosures over time',
  'overlap': 'Manual vs. AI triage',
};

/** "Add chart" builder — composes a BreakdownChart card from aggregates. */
function AddChartDialog({ open, onClose }: { open: boolean; onClose: () => void }): ReactNode {
  const dispatch = useAppDispatch();
  const [dimension, setDimension] = useState<BreakdownDimension>('packageType');
  const [form, setForm] = useState<BreakdownForm>('bar');
  const [title, setTitle] = useState('');

  // Ordered axes (years, score bands) read as columns, never as donuts.
  const ordered = ORDERED_DIMENSIONS.has(dimension);
  const effectiveForm: BreakdownForm = ordered && form === 'donut' ? 'column' : form;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add a chart</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <FormControl size="small">
          <InputLabel id="dim-label">Data</InputLabel>
          <Select labelId="dim-label" label="Data" value={dimension}
            onChange={(e) => setDimension(e.target.value as BreakdownDimension)}>
            {(Object.keys(DIMENSION_LABEL) as BreakdownDimension[]).map((d) => (
              <MenuItem key={d} value={d}>{DIMENSION_LABEL[d]}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel id="form-label">Chart</InputLabel>
          <Select labelId="form-label" label="Chart" value={effectiveForm}
            onChange={(e) => setForm(e.target.value as BreakdownForm)}>
            <MenuItem value="bar">Ranked bars</MenuItem>
            <MenuItem value="column">Columns</MenuItem>
            <MenuItem value="donut" disabled={ordered}>Donut{ordered ? ' — not for ordered axes' : ''}</MenuItem>
          </Select>
        </FormControl>
        <TextField size="small" label="Title (optional)" value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={DIMENSION_LABEL[dimension]} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => {
          dispatch(customWidgetAdded({
            title: title.trim() === '' ? DIMENSION_LABEL[dimension] : title.trim(),
            dimension,
            form: effectiveForm,
          }));
          onClose();
        }}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function OverviewPage(): ReactNode {
  const dataset = useDataset();
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'));
  const dispatch = useAppDispatch();
  const overview = useAppSelector((s) => s.ui.overview);
  const [editing, setEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [restoreAnchor, setRestoreAnchor] = useState<HTMLElement | null>(null);

  const customById = useMemo(
    () => new Map(overview.custom.map((c) => [c.id, c])),
    [overview.custom],
  );
  const titleOf = (id: string): string => customById.get(id)?.title ?? WIDGET_TITLE[id] ?? id;

  const visibleLayout = useMemo(
    () => overview.layout.filter((l) =>
      !overview.hidden.includes(l.i) && (WIDGET_TITLE[l.i] !== undefined || customById.has(l.i))),
    [overview, customById],
  );

  const accent = (k: 'critical' | 'high'): string => theme.palette.severity[k];

  const renderCard = (id: string): ReactNode => {
    const custom = customById.get(id);
    const body = custom !== undefined ? (
      <ChartCard title={custom.title} subtitle={`${DIMENSION_LABEL[custom.dimension]} · from precomputed aggregates`}>
        <ResponsiveChart height="fill">
          {({ width, height }) => (
            <BreakdownChart dataset={dataset} dimension={custom.dimension} form={custom.form} width={width} height={height} />
          )}
        </ResponsiveChart>
      </ChartCard>
    ) : renderWidget(id, dataset, accent);

    return (
      <Box sx={{ position: 'relative', height: '100%' }}>
        {body}
        {editing && (
          <Box className="rgl-nodrag" sx={{
            position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.25,
            bgcolor: 'background.paper', borderRadius: 1.5, border: 1, borderColor: 'divider', px: 0.25,
          }}>
            <Tooltip title="Hide widget">
              <IconButton size="small" aria-label={`Hide ${titleOf(id)}`}
                onClick={() => dispatch(widgetHiddenToggled(id))}>
                <CloseIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
            {customById.has(id) && (
              <Tooltip title="Delete custom chart">
                <IconButton size="small" aria-label={`Delete ${titleOf(id)}`}
                  onClick={() => dispatch(customWidgetRemoved(id))}>
                  <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}
      </Box>
    );
  };

  const toolbar = (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }} useFlexGap>
      {editing ? (
        <>
          <Button size="small" variant="outlined" startIcon={<AddchartIcon />} onClick={() => setAddOpen(true)}>
            Add chart
          </Button>
          {overview.hidden.length > 0 && (
            <>
              <Button size="small" startIcon={<VisibilityIcon />} onClick={(e) => setRestoreAnchor(e.currentTarget)}>
                Hidden ({overview.hidden.length})
              </Button>
              <Menu anchorEl={restoreAnchor} open={restoreAnchor !== null} onClose={() => setRestoreAnchor(null)}>
                {overview.hidden.map((id) => (
                  <MenuItem key={id} dense onClick={() => dispatch(widgetHiddenToggled(id))}>
                    {titleOf(id)}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}
          <Button size="small" startIcon={<RestartAltIcon />} onClick={() => dispatch(overviewReset())}>
            Reset
          </Button>
          <Button size="small" variant="contained" startIcon={<DoneIcon />} onClick={() => setEditing(false)}>
            Done
          </Button>
        </>
      ) : (
        <Tooltip title="Rearrange, resize, hide, or add widgets — saved to your preferences">
          <Button size="small" variant="outlined" startIcon={<DashboardCustomizeIcon />} onClick={() => setEditing(true)}>
            Customize
          </Button>
        </Tooltip>
      )}
    </Stack>
  );

  return (
    <Box>
      <GlobalStyles styles={{
        '.react-grid-placeholder': {
          background: `${alpha(theme.palette.primary.main, 0.2)} !important`,
          borderRadius: 10,
        },
        '.react-grid-item.react-draggable-dragging': { zIndex: 3 },
      }} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
        <Typography variant="h1">Overview</Typography>
        <Box sx={{ flex: 1 }} />
        {wide && toolbar}
      </Box>
      {editing && (
        <Typography variant="caption" component="p" sx={{ mb: 1 }}>
          drag to move · drag edges to resize · changes save automatically
        </Typography>
      )}

      {wide ? (
        <Grid
          layout={visibleLayout.map((l) => ({ ...l, ...minSizeOf(l.i) }))}
          cols={12}
          rowHeight={44}
          margin={[12, 12]}
          compactType="vertical"
          isDraggable={editing}
          isResizable={editing}
          resizeHandles={['s', 'e', 'se', 'w', 'sw']}
          draggableCancel=".rgl-nodrag"
          onLayoutChange={(next: Layout[]) => {
            if (!editing) return;
            dispatch(overviewLayoutChanged(next.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }))));
          }}
        >
          {visibleLayout.map((l) => (
            <div key={l.i}>{renderCard(l.i)}</div>
          ))}
        </Grid>
      ) : (
        // Tablet: customization is a desktop affordance; render the saved
        // order as a simple stack.
        <Stack spacing={2}>
          {[...visibleLayout].sort((a, b) => a.y - b.y || a.x - b.x).map((l) => (
            <Box key={l.i} sx={{ minHeight: l.h > 2 ? 320 : undefined }}>{renderCard(l.i)}</Box>
          ))}
        </Stack>
      )}

      <AddChartDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </Box>
  );
}
