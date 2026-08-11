import Grid from '@mui/material/Grid2';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import { useDataset } from '../data/useDataset.ts';
import { StatCard } from '../components/primitives/StatCard.tsx';
import { ChartCard } from '../components/charts/ChartCard.tsx';
import { ResponsiveChart } from '../components/charts/ResponsiveChart.tsx';
import { SeverityDonut } from '../components/charts/SeverityDonut.tsx';
import { TopRiskImagesBar } from '../components/charts/TopRiskImagesBar.tsx';
import { RiskFactorBar } from '../components/charts/RiskFactorBar.tsx';
import { SeverityVsCvssScatter } from '../components/charts/SeverityVsCvssScatter.tsx';
import { PublishedTrendChart } from '../components/charts/PublishedTrendChart.tsx';
import { formatNumber, formatPercent } from '../utils/format.ts';

/**
 * §8 — every chart on this page reads exclusively from the precomputed
 * Aggregates; nothing here iterates the occurrence array (§6.3).
 */
export default function OverviewPage(): ReactNode {
  const dataset = useDataset();
  const theme = useTheme();
  const { totals, bySeverity, byRiskFactor, topRiskImages, severityVsCvss, fixAvailability, publishedTrend } = dataset.aggregates;

  return (
    <Box>
      <Typography variant="h1" gutterBottom>Overview</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 4, lg: 2 }}>
          <StatCard label="Occurrences" value={formatNumber(totals.occurrences)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: 2 }}>
          <StatCard
            label="Unique CVEs"
            value={formatNumber(totals.uniqueCves)}
            sublabel={`dedup ${(totals.occurrences / totals.uniqueCves).toFixed(0)}×`}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: 2 }}>
          <StatCard label="Images" value={formatNumber(totals.images)} sublabel={`${formatNumber(totals.repos)} repos · ${totals.groups} groups`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: 2 }}>
          <StatCard
            label="Critical"
            value={formatNumber(bySeverity.critical)}
            sublabel={formatPercent(bySeverity.critical, totals.occurrences)}
            accent={theme.palette.severity.critical}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: 2 }}>
          <StatCard
            label="High"
            value={formatNumber(bySeverity.high)}
            sublabel={formatPercent(bySeverity.high, totals.occurrences)}
            accent={theme.palette.severity.high}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, lg: 2 }}>
          <StatCard
            label="Fix available"
            value={formatPercent(fixAvailability.withFix, fixAvailability.withFix + fixAvailability.withoutFix)}
            sublabel={`${formatNumber(fixAvailability.withFix)} occurrences`}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 5, lg: 4 }}>
          <ChartCard title="Severity distribution" subtitle="click a slice to filter the Explorer">
            <ResponsiveChart height={240}>
              {({ width, height }) => <SeverityDonut bySeverity={bySeverity} width={width} height={height} />}
            </ResponsiveChart>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 7, lg: 8 }}>
          <ChartCard title="Top 10 riskiest images" subtitle="ranked and sized by weighted severity score — click to open">
            <ResponsiveChart height={240}>
              {({ width, height }) => (
                <TopRiskImagesBar topRiskImages={topRiskImages} dataset={dataset} width={width} height={height} />
              )}
            </ResponsiveChart>
          </ChartCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <ChartCard title="Risk factors" subtitle="frequency across occurrences — actionable factors highlighted">
            <ResponsiveChart height={300}>
              {({ width, height }) => (
                <RiskFactorBar byRiskFactor={byRiskFactor} totalOccurrences={totals.occurrences} width={width} height={height} />
              )}
            </ResponsiveChart>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <ChartCard
            title="Vendor severity vs. CVSS"
            subtitle="one point per unique CVE — the shaded region is where the label understates the score"
          >
            <ResponsiveChart height={300}>
              {({ width, height }) => (
                <SeverityVsCvssScatter severityVsCvss={severityVsCvss} width={width} height={height} />
              )}
            </ResponsiveChart>
          </ChartCard>
        </Grid>

        <Grid size={12}>
          <ChartCard
            title="Disclosures over time"
            subtitle="unique CVEs by publication year, stacked by severity"
          >
            <ResponsiveChart height={220}>
              {({ width, height }) => (
                <PublishedTrendChart publishedTrend={publishedTrend} width={width} height={height} />
              )}
            </ResponsiveChart>
          </ChartCard>
        </Grid>
      </Grid>
    </Box>
  );
}
