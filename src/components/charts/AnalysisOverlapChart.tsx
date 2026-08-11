import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { alpha, useTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import type { Aggregates } from '../../types/vulnerability.ts';
import { SEVERITY_ORDER, SEVERITY_LABEL } from '../../theme/severity.ts';
import { formatNumber, formatPercent } from '../../utils/format.ts';

export interface AnalysisOverlapChartProps {
  analysisOverlap: Aggregates['analysisOverlap'];
}

/**
 * The relationship between manual and AI analysis (email spec), in two reads:
 * 1. CVE overlap tiles — which CVEs each track dismissed, and where they
 *    agree. Tile area intensity encodes share of the catalog.
 * 2. Per-severity mirrored bars — manual (amber, left) vs AI (blue, right)
 *    dismissal rates over occurrences, showing WHERE each track is active:
 *    triage concentrates in the low/medium bands, not in criticals.
 */
export function AnalysisOverlapChart({ analysisOverlap }: AnalysisOverlapChartProps): ReactNode {
  const theme = useTheme();
  const { cveQuadrants: q, bySeverity } = analysisOverlap;
  const totalCves = q.manualOnly + q.aiOnly + q.both + q.neither;

  const manualAccent = theme.palette.severity.medium;
  const aiAccent = theme.palette.primary.main;

  const maxRate = Math.max(
    ...SEVERITY_ORDER.map((s) => {
      const r = bySeverity[s];
      return r.total > 0 ? Math.max(r.manual / r.total, r.ai / r.total) : 0;
    }),
    0.01,
  );

  const tile = (label: string, count: number, color: string, icons: ReactNode): ReactNode => (
    <Tooltip title={`${label}: ${formatNumber(count)} CVEs (${formatPercent(count, totalCves)} of catalog)`}>
      <Box sx={{
        flex: 1,
        minWidth: 96,
        p: 1.25,
        borderRadius: 2,
        border: `1px solid ${alpha(color, 0.4)}`,
        backgroundColor: alpha(color, 0.06 + 0.3 * (totalCves > 0 ? count / totalCves : 0)),
      }}>
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color, mb: 0.25 }}>
          {icons}
          <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</Typography>
        </Stack>
        <Typography variant="h3" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatNumber(count)}
        </Typography>
        <Typography variant="caption">{formatPercent(count, totalCves)} of CVEs</Typography>
      </Box>
    </Tooltip>
  );

  return (
    <Box
      role="img"
      aria-label={`Manual and AI analysis overlap: ${formatNumber(q.manualOnly)} CVEs dismissed only by manual analysis, ${formatNumber(q.aiOnly)} only by AI, ${formatNumber(q.both)} by both, ${formatNumber(q.neither)} by neither`}
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {tile('manual only', q.manualOnly, manualAccent, <FactCheckIcon sx={{ fontSize: 15 }} />)}
        {tile('both agree', q.both, theme.palette.severity.low,
          <><FactCheckIcon sx={{ fontSize: 15 }} /><SmartToyIcon sx={{ fontSize: 15 }} /></>)}
        {tile('AI only', q.aiOnly, aiAccent, <SmartToyIcon sx={{ fontSize: 15 }} />)}
        {tile('untriaged', q.neither, theme.palette.text.secondary, null)}
      </Box>

      <Box>
        <Typography variant="caption" component="div" sx={{ mb: 0.75 }}>
          dismissal rate by severity — <Box component="span" sx={{ color: manualAccent }}>manual</Box>
          {' vs '}
          <Box component="span" sx={{ color: aiAccent }}>AI</Box>
        </Typography>
        <Stack spacing={0.75}>
          {SEVERITY_ORDER.filter((s) => bySeverity[s].total > 0).map((s) => {
            const r = bySeverity[s];
            const mPct = r.manual / r.total;
            const aPct = r.ai / r.total;
            return (
              <Tooltip
                key={s}
                title={`${SEVERITY_LABEL[s]}: manual dismissed ${formatNumber(r.manual)} (${formatPercent(r.manual, r.total)}), AI dismissed ${formatNumber(r.ai)} (${formatPercent(r.ai, r.total)}) of ${formatNumber(r.total)} occurrences`}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                    <Box sx={{
                      width: `${(mPct / maxRate) * 100}%`,
                      height: 10,
                      borderRadius: '5px 0 0 5px',
                      backgroundColor: alpha(manualAccent, 0.8),
                      minWidth: mPct > 0 ? 2 : 0,
                    }} />
                  </Box>
                  <Typography variant="caption" sx={{ width: 64, textAlign: 'center', color: theme.palette.severity[s], fontWeight: 600 }}>
                    {SEVERITY_LABEL[s]}
                  </Typography>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{
                      width: `${(aPct / maxRate) * 100}%`,
                      height: 10,
                      borderRadius: '0 5px 5px 0',
                      backgroundColor: alpha(aiAccent, 0.8),
                      minWidth: aPct > 0 ? 2 : 0,
                    }} />
                  </Box>
                </Box>
              </Tooltip>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
}
