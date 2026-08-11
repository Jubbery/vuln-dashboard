import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid2';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import ButtonBase from '@mui/material/ButtonBase';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import { useTheme } from '@mui/material/styles';
import { useParams, useNavigate } from 'react-router-dom';
import { useMemo, type ReactNode } from 'react';
import { useDataset } from '../data/useDataset.ts';
import { useAppDispatch } from '../store/index.ts';
import { groupSet, repoSet, filtersCleared } from '../store/filtersSlice.ts';
import { rollupImagesInRepo, scopeStats } from '../data/selectors.ts';
import { EmptyState } from '../components/primitives/EmptyState.tsx';
import { StatCard } from '../components/primitives/StatCard.tsx';
import { SeverityBadge } from '../components/primitives/SeverityBadge.tsx';
import { SeverityStackedBar } from '../components/primitives/SeverityStackedBar.tsx';
import { TopRisksStrip } from '../components/primitives/TopRisksStrip.tsx';
import { SEVERITY_ORDER } from '../theme/severity.ts';
import { formatDate, formatNumber, formatPercent } from '../utils/format.ts';

export default function RepoPage(): ReactNode {
  const { groupId: groupIdParam, repoId: repoIdParam } = useParams();
  const dataset = useDataset();
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const groupId = Number(groupIdParam);
  const repoId = Number(repoIdParam);
  const repoName = dataset.repoNames[repoId];
  const stats = useMemo(() => scopeStats(dataset, groupId, repoId), [dataset, groupId, repoId]);

  const images = useMemo(
    () => rollupImagesInRepo(dataset, groupId, repoId),
    [dataset, groupId, repoId],
  );
  // Length = magnitude vs the worst image; segments = composition.
  const maxTotal = useMemo(() => Math.max(1, ...images.map((r) => r.total)), [images]);

  if (repoName === undefined || dataset.groupNames[groupId] === undefined) {
    return <EmptyState title="Repo not found" description="This group/repo combination doesn't exist." />;
  }

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <Typography variant="h1">{repoName}</Typography>
        <Typography variant="body2" color="text.secondary">
          {images.length} image version{images.length === 1 ? '' : 's'}, riskiest first
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="outlined"
          startIcon={<TravelExploreIcon />}
          onClick={() => {
            dispatch(filtersCleared());
            dispatch(groupSet(groupId));
            dispatch(repoSet(repoId));
            void navigate('/explorer');
          }}
        >
          Open in Explorer
        </Button>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Findings" value={formatNumber(stats.total)}
            sublabel={`across ${formatNumber(stats.imageCount)} images`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Critical" value={formatNumber(stats.bySeverity.critical)}
            sublabel={formatPercent(stats.bySeverity.critical, stats.total)}
            accent={theme.palette.severity.critical} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="High" value={formatNumber(stats.bySeverity.high)}
            sublabel={formatPercent(stats.bySeverity.high, stats.total)}
            accent={theme.palette.severity.high} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Fix available" value={formatPercent(stats.withFix, stats.total)}
            sublabel={`${formatNumber(stats.withFix)} findings`} />
        </Grid>
      </Grid>

      <Box sx={{ mb: 2 }}>
        <TopRisksStrip topRisks={stats.topRisks} scopeLabel={`in ${repoName}`} />
      </Box>

      <Stack spacing={1.25}>
        {images.map((r) => {
          const img = dataset.imageMeta[r.imageId];
          if (img === undefined) return null;
          return (
            <ButtonBase
              key={r.imageId}
              onClick={() => { void navigate(`/images/${r.imageId}`); }}
              sx={{ display: 'block', textAlign: 'inherit', borderRadius: 2.5 }}
            >
              <Paper sx={{ p: 2, '&:hover': { borderColor: 'primary.main' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Typography variant="h3" sx={{ minWidth: 90 }}>{img.version}</Typography>
                  <Typography variant="caption" sx={{ flex: 1, minWidth: 160 }}>
                    {img.buildType} · built {formatDate(img.createTime)} · {formatNumber(r.total)} findings
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
          );
        })}
      </Stack>
    </Box>
  );
}
