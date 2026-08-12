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
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import AddchartIcon from '@mui/icons-material/Addchart';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
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

/**
 * Widgets whose body is a D3 chart sized by `ResponsiveChart height="fill"`.
 * They only render once their container reports a non-zero height, so the
 * narrow layout has to hand them a resolved one (see the stack branch below).
 * 'overlap' is deliberately absent — it is plain DOM and sizes to content.
 */
const MEASURED_CHART_WIDGETS = new Set([
  'severity-donut', 'top-images', 'risk-factors', 'scatter', 'trend',
]);

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

/** "Add chart" builder with a live preview — what you see is the exact card
 *  that lands on the grid, rendered from the same aggregates. */
function AddChartDialog({ open, onClose }: { open: boolean; onClose: () => void }): ReactNode {
  const dispatch = useAppDispatch();
  const dataset = useDataset();
  const theme = useTheme();
  const [dimension, setDimension] = useState<BreakdownDimension>('packageType');
  const [form, setForm] = useState<BreakdownForm>('bar');
  const [title, setTitle] = useState('');
  const [limit, setLimit] = useState<number | 'all'>(10);
  const [stacked, setStacked] = useState(false);

  // Ordered axes (years, score bands) read as columns, never as donuts.
  const ordered = ORDERED_DIMENSIONS.has(dimension);
  const effectiveForm: BreakdownForm = ordered && form === 'donut' ? 'column' : form;
  const isYear = dimension === 'year';
  const stackedYear = isYear && stacked;

  const preview = stackedYear ? (
    <PublishedTrendChart publishedTrend={dataset.aggregates.publishedTrend} width={360} height={220} />
  ) : (
    <BreakdownChart
      dataset={dataset}
      dimension={dimension}
      form={effectiveForm}
      limit={limit === 'all' ? Number.MAX_SAFE_INTEGER : limit}
      width={360}
      height={220}
    />
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Add a chart</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
          <Stack spacing={2} sx={{ width: { xs: '100%', sm: 260 }, flexShrink: 0 }}>
            <FormControl size="small">
              <InputLabel id="dim-label">Data</InputLabel>
              <Select labelId="dim-label" label="Data" value={dimension}
                onChange={(e) => setDimension(e.target.value as BreakdownDimension)}>
                {(Object.keys(DIMENSION_LABEL) as BreakdownDimension[]).map((d) => (
                  <MenuItem key={d} value={d}>{DIMENSION_LABEL[d]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" disabled={stackedYear}>
              <InputLabel id="form-label">Chart</InputLabel>
              <Select labelId="form-label" label="Chart" value={effectiveForm}
                onChange={(e) => setForm(e.target.value as BreakdownForm)}>
                <MenuItem value="bar">Ranked bars</MenuItem>
                <MenuItem value="column">Columns</MenuItem>
                <MenuItem value="donut" disabled={ordered}>Donut{ordered ? ' — not for ordered axes' : ''}</MenuItem>
              </Select>
            </FormControl>
            {!ordered && (
              <FormControl size="small">
                <InputLabel id="limit-label">Show top</InputLabel>
                <Select labelId="limit-label" label="Show top" value={limit}
                  onChange={(e) => setLimit(e.target.value as number | 'all')}>
                  {[5, 8, 10, 15].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                  <MenuItem value="all">All</MenuItem>
                </Select>
              </FormControl>
            )}
            {isYear && (
              <FormControlLabel
                control={<Checkbox size="small" checked={stacked} onChange={(_, v) => setStacked(v)} />}
                label={<Typography variant="body2">Stack by severity</Typography>}
              />
            )}
            <TextField size="small" label="Title (optional)" value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={DIMENSION_LABEL[dimension]} />
          </Stack>
          <Box sx={{
            flex: 1,
            minWidth: 0,
            border: `1px dashed ${theme.palette.divider}`,
            borderRadius: 2,
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            minHeight: 250,
          }}>
            <Typography variant="caption" sx={{ position: 'absolute', top: 6, left: 10 }}>
              live preview
            </Typography>
            {preview}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={() => {
          dispatch(customWidgetAdded({
            title: title.trim() === '' ? DIMENSION_LABEL[dimension] : title.trim(),
            dimension,
            form: effectiveForm,
            limit: limit === 'all' ? undefined : limit,
            stacked: stackedYear ? true : undefined,
          }));
          onClose();
        }}>
          Add to dashboard
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

  /** User-composed widgets are charts too, so they need the same treatment. */
  const isMeasuredChart = (id: string): boolean =>
    MEASURED_CHART_WIDGETS.has(id) || customById.has(id);

  const renderCard = (id: string): ReactNode => {
    const custom = customById.get(id);
    const body = custom !== undefined ? (
      <ChartCard title={custom.title} subtitle={`${DIMENSION_LABEL[custom.dimension]} · from precomputed aggregates`}>
        <ResponsiveChart height="fill">
          {({ width, height }) => (
            custom.dimension === 'year' && custom.stacked === true
              ? <PublishedTrendChart publishedTrend={dataset.aggregates.publishedTrend} width={width} height={height} />
              : <BreakdownChart dataset={dataset} dimension={custom.dimension} form={custom.form}
                  limit={custom.limit} width={width} height={height} />
          )}
        </ResponsiveChart>
      </ChartCard>
    ) : renderWidget(id, dataset, accent);

    return (
      <Box sx={{
        position: 'relative',
        height: '100%',
        ...(editing && {
          outline: (t) => `2px dashed ${alpha(t.palette.primary.main, 0.4)}`,
          outlineOffset: '-2px',
          borderRadius: 2.5,
          cursor: 'grab',
          '&:active': { cursor: 'grabbing' },
          '&:hover': { outline: (t) => `2px dashed ${alpha(t.palette.primary.main, 0.8)}` },
        }),
      }}>
        {/* Charts go inert while editing so drags never fight tooltips/links. */}
        <Box sx={{ height: '100%', ...(editing && { pointerEvents: 'none', userSelect: 'none' }) }}>
          {body}
        </Box>
        {editing && (
          <DragIndicatorIcon sx={{
            position: 'absolute', top: 6, left: 4, fontSize: 16,
            color: 'text.secondary', opacity: 0.8, pointerEvents: 'none',
          }} />
        )}
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
          background: `${alpha(theme.palette.primary.main, 0.18)} !important`,
          border: `2px dashed ${alpha(theme.palette.primary.main, 0.7)}`,
          borderRadius: 10,
          opacity: '1 !important',
        },
        '.react-grid-item.react-draggable-dragging': { zIndex: 3 },
        // Make RGL's resize affordances actually visible: themed corner ticks.
        '.react-grid-item > .react-resizable-handle': { zIndex: 2 },
        '.react-grid-item > .react-resizable-handle::after': {
          borderColor: alpha(theme.palette.primary.main, 0.9),
          width: 7,
          height: 7,
        },
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
        // Below md the drag-and-drop grid is replaced by a flow layout:
        // customization is a desktop affordance, and twelve columns of ~35px
        // are meaningless on a phone. Stat cards pair two-across so a
        // half-screen window isn't six full-width rows holding one number each.
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {[...visibleLayout].sort((a, b) => a.y - b.y || a.x - b.x).map((l) => (
            <Box
              key={l.i}
              sx={{
                gridColumn: l.i.startsWith('stat-') ? 'span 1' : '1 / -1',
                // Explicit height, not minHeight. ChartCard is height:100%, and
                // height:100% against a min-height-only parent resolves to auto
                // — which collapsed the chart body to zero, so ResponsiveChart
                // measured 0 and rendered null. Every D3 card below 900px was
                // an empty box with a title on it.
                height: isMeasuredChart(l.i) ? { xs: 320, sm: 380 } : 'auto',
              }}
            >
              {renderCard(l.i)}
            </Box>
          ))}
        </Box>
      )}

      <AddChartDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </Box>
  );
}
