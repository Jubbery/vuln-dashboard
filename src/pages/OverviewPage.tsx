import Grid from '@mui/material/Grid2';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { useDataset } from '../data/useDataset.ts';
import { StatCard } from '../components/primitives/StatCard.tsx';
import { SeverityBadge } from '../components/primitives/SeverityBadge.tsx';
import { SEVERITY_ORDER } from '../theme/severity.ts';
import { formatNumber } from '../utils/format.ts';

export default function OverviewPage(): ReactNode {
  const dataset = useDataset();
  const theme = useTheme();
  const { totals, bySeverity } = dataset.aggregates;

  return (
    <Box>
      <Typography variant="h1" gutterBottom>Overview</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 4, lg: 2.4 }}>
          <StatCard label="Occurrences" value={formatNumber(totals.occurrences)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: 2.4 }}>
          <StatCard
            label="Unique CVEs"
            value={formatNumber(totals.uniqueCves)}
            sublabel={`dedup ${(totals.occurrences / totals.uniqueCves).toFixed(0)}×`}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: 2.4 }}>
          <StatCard label="Images" value={formatNumber(totals.images)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: 2.4 }}>
          <StatCard label="Repos" value={formatNumber(totals.repos)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: 2.4 }}>
          <StatCard label="Groups" value={String(totals.groups)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: 2.4 }}>
          <StatCard
            label="Critical"
            value={formatNumber(bySeverity.critical)}
            accent={theme.palette.severity.critical}
          />
        </Grid>
        <Grid size={12}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h3" gutterBottom>Severity distribution</Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {SEVERITY_ORDER.filter((s) => bySeverity[s] > 0).map((s) => (
                <SeverityBadge key={s} severity={s} count={bySeverity[s]} size="medium" />
              ))}
            </Stack>
            <Typography variant="caption" component="p" sx={{ mt: 1.5 }}>
              Charts land in Phase 5 — severity donut, top-risk images, risk factors,
              and the severity-vs-CVSS divergence scatter.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
