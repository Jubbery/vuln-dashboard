import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid2';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import ButtonBase from '@mui/material/ButtonBase';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import { useParams, useNavigate } from 'react-router-dom';
import { useMemo, type ReactNode } from 'react';
import type { Severity } from '../types/vulnerability.ts';
import { useDataset } from '../data/useDataset.ts';
import { useAppDispatch } from '../store/index.ts';
import { groupSet, severitiesSet, filtersCleared } from '../store/filtersSlice.ts';
import { rollupReposInGroup, scopeStats } from '../data/selectors.ts';
import { EmptyState } from '../components/primitives/EmptyState.tsx';
import { StatCard } from '../components/primitives/StatCard.tsx';
import { SeverityBadge } from '../components/primitives/SeverityBadge.tsx';
import { SeverityStackedBar } from '../components/primitives/SeverityStackedBar.tsx';
import { TopRisksStrip } from '../components/primitives/TopRisksStrip.tsx';
import { ChartCard } from '../components/charts/ChartCard.tsx';
import { ResponsiveChart } from '../components/charts/ResponsiveChart.tsx';
import { SeverityDonut } from '../components/charts/SeverityDonut.tsx';
import { TopRiskImagesBar } from '../components/charts/TopRiskImagesBar.tsx';
import { SEVERITY_ORDER } from '../theme/severity.ts';
import { useTheme } from '@mui/material/styles';
import { formatNumber, formatPercent } from '../utils/format.ts';

/**
 * Group drill-down: the Overview's questions answered within one group —
 * how bad, what to fix first, which images drive it — then the repo list
 * for descending further. Charts click through to the Explorer with the
 * group filter already applied.
 */
export default function GroupPage(): ReactNode {
  const { groupId: groupIdParam } = useParams();
  const dataset = useDataset();
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const groupId = Number(groupIdParam);
  const groupName = dataset.groupNames[groupId];

  const repos = useMemo(() => rollupReposInGroup(dataset, groupId), [dataset, groupId]);
  const stats = useMemo(() => scopeStats(dataset, groupId), [dataset, groupId]);
  // Bars scale to the worst repo so length encodes magnitude and segments
  // encode composition — full-width bars would all look equally bad.
  const maxTotal = useMemo(() => Math.max(1, ...repos.map((r) => r.total)), [repos]);

  if (groupName === undefined) {
    return <EmptyState title="Group not found" description={`No group with id "${groupIdParam ?? ''}".`} />;
  }

  const openInExplorer = (severity?: Severity): void => {
    dispatch(filtersCleared());
    dispatch(groupSet(groupId));
    if (severity !== undefined) dispatch(severitiesSet([severity]));
    void navigate('/explorer');
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <Typography variant="h1">{groupName}</Typography>
        <Typography variant="body2" color="text.secondary">
          {formatNumber(repos.length)} repos · {formatNumber(stats.imageCount)} images
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="outlined"
          startIcon={<TravelExploreIcon />}
          onClick={() => { openInExplorer(); }}
        >
          Open in Explorer
        </Button>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 3, lg: 2.4 }}>
          <StatCard label="Findings" value={formatNumber(stats.total)}
            sublabel={formatPercent(stats.total, dataset.aggregates.totals.occurrences) + ' of the scan'} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3, lg: 2.4 }}>
          <StatCard label="Critical" value={formatNumber(stats.bySeverity.critical)}
            sublabel={formatPercent(stats.bySeverity.critical, stats.total)}
            accent={theme.palette.severity.critical} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3, lg: 2.4 }}>
          <StatCard label="High" value={formatNumber(stats.bySeverity.high)}
            sublabel={formatPercent(stats.bySeverity.high, stats.total)}
            accent={theme.palette.severity.high} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3, lg: 2.4 }}>
          <StatCard label="Fix available" value={formatPercent(stats.withFix, stats.total)}
            sublabel={`${formatNumber(stats.withFix)} findings`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3, lg: 2.4 }}>
          <StatCard label="Triage dismissed"
            value={formatNumber(stats.manualDismissed + stats.aiDismissed)}
            sublabel={`${formatNumber(stats.manualDismissed)} manual · ${formatNumber(stats.aiDismissed)} AI`} />
        </Grid>
      </Grid>

      <Box sx={{ mb: 2 }}>
        <TopRisksStrip topRisks={stats.topRisks} scopeLabel={`in ${groupName}`} />
      </Box>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <ChartCard title="Severity in this group" subtitle="click a slice to open it in the Explorer">
            <ResponsiveChart height={210}>
              {({ width, height }) => (
                <SeverityDonut
                  bySeverity={stats.bySeverity}
                  width={width}
                  height={height}
                  onSelect={(s) => { openInExplorer(s); }}
                />
              )}
            </ResponsiveChart>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 8 }}>
          <ChartCard title="Riskiest images in this group" subtitle="weighted severity score — click to open">
            <ResponsiveChart height={210}>
              {({ width, height }) => (
                <TopRiskImagesBar topRiskImages={stats.topImages} dataset={dataset} width={width} height={height} />
              )}
            </ResponsiveChart>
          </ChartCard>
        </Grid>
      </Grid>

      <Typography variant="h2" gutterBottom>
        Repos, riskiest first
      </Typography>
      <Stack spacing={1.25}>
        {repos.map((r) => (
          <ButtonBase
            key={r.repoId}
            onClick={() => { void navigate(`/groups/${groupId}/repos/${r.repoId}`); }}
            sx={{ display: 'block', textAlign: 'inherit', borderRadius: 2.5 }}
          >
            <Paper sx={{ p: 2, '&:hover': { borderColor: 'primary.main' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h3" sx={{ flex: 1, minWidth: 200 }} noWrap>
                  {dataset.repoNames[r.repoId] ?? `repo ${r.repoId}`}
                </Typography>
                <Typography variant="caption">
                  {r.imageCount} image{r.imageCount === 1 ? '' : 's'} · {formatNumber(r.total)} findings
                </Typography>
                <Stack direction="row" spacing={0.75}>
                  {SEVERITY_ORDER.filter((s) => r.counts[s] > 0 && s !== 'unknown').map((s) => (
                    <SeverityBadge key={s} severity={s} count={r.counts[s]} />
                  ))}
                </Stack>
              </Box>
              <Box sx={{ mt: 1.5, width: `${(r.total / maxTotal) * 100}%`, minWidth: 40, transition: 'width 300ms ease' }}>
                <SeverityStackedBar counts={r.counts} />
              </Box>
            </Paper>
          </ButtonBase>
        ))}
      </Stack>
    </Box>
  );
}
