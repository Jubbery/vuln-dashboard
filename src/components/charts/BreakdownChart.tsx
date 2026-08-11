import { useMemo, type ReactNode } from 'react';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import * as d3 from 'd3';
import type { Dataset, Severity } from '../../types/vulnerability.ts';
import type { BreakdownDimension, BreakdownForm } from '../../store/uiSlice.ts';
import { SEVERITY_ORDER, SEVERITY_LABEL } from '../../theme/severity.ts';
import { EmptyState } from '../primitives/EmptyState.tsx';
import { ChartTooltip, useChartTooltip } from './ChartTooltip.tsx';
import { formatCompact, formatNumber, formatPercent } from '../../utils/format.ts';

export interface BreakdownChartProps {
  dataset: Dataset;
  dimension: BreakdownDimension;
  form: BreakdownForm;
  width: number;
  height: number;
}

interface Slice { label: string; value: number; color?: string }

const MAX_DONUT_SLICES = 8;
const MAX_BARS = 12;

/** Data for every dimension comes straight from the precomputed aggregates —
 *  the builder can't create a card the worker didn't already pay for. */
function slicesFor(dataset: Dataset, dimension: BreakdownDimension, severityFill: Record<Severity, string>): Slice[] {
  const a = dataset.aggregates;
  switch (dimension) {
    case 'severity':
      return SEVERITY_ORDER.filter((s) => a.bySeverity[s] > 0)
        .map((s) => ({ label: SEVERITY_LABEL[s], value: a.bySeverity[s], color: severityFill[s] }));
    case 'riskFactor':
      return Object.entries(a.byRiskFactor).map(([label, value]) => ({ label, value }))
        .sort((x, y) => y.value - x.value);
    case 'packageType':
      return Object.entries(a.byPackageType).map(([label, value]) => ({ label, value }))
        .sort((x, y) => y.value - x.value);
    case 'year':
      return a.publishedTrend.map((t) => ({
        label: String(t.year),
        value: SEVERITY_ORDER.reduce((s, sev) => s + t.counts[sev], 0),
      }));
  }
}

/**
 * The engine behind user-composed Overview cards: one dimension from the
 * aggregates, rendered as ranked bars or a donut. D3 computes, React renders
 * (§2.2), theme supplies every color.
 */
export function BreakdownChart({ dataset, dimension, form, width, height }: BreakdownChartProps): ReactNode {
  const theme = useTheme();
  const { tip, show, hide } = useChartTooltip();

  const all = useMemo(
    () => slicesFor(dataset, dimension, theme.palette.severityFill),
    [dataset, dimension, theme],
  );
  const total = useMemo(() => all.reduce((s, d) => s + d.value, 0), [all]);

  // Fixed categorical palette for dimensions without intrinsic colors.
  const categorical = d3.schemeTableau10;

  if (all.length === 0 || total === 0) {
    return <EmptyState title="No data" description="This dimension has nothing to plot." />;
  }

  if (form === 'donut') {
    // Cap slices; fold the tail into "other" so the donut stays legible.
    const head = all.slice(0, MAX_DONUT_SLICES);
    const tail = all.slice(MAX_DONUT_SLICES);
    const data: Slice[] = tail.length > 0
      ? [...head, { label: `other (${tail.length})`, value: tail.reduce((s, d) => s + d.value, 0), color: theme.palette.text.secondary }]
      : head;
    const r = Math.min(width * 0.45, height) / 2 - 4;
    const arcs = d3.pie<Slice>().value((d) => d.value).sort(null)(data);
    const arcPath = d3.arc<d3.PieArcDatum<Slice>>().innerRadius(r * 0.65).outerRadius(r).cornerRadius(2).padAngle(0.012);
    const side = Math.min(width * 0.45, height);
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
        <Box sx={{ position: 'relative', flexShrink: 0 }}>
          <svg width={side} height={side} role="img"
            aria-label={`${dimension} breakdown: ${data.map((d) => `${d.label} ${formatNumber(d.value)}`).join(', ')}`}>
            <g transform={`translate(${side / 2},${side / 2})`}>
              {arcs.map((a, i) => (
                <path
                  key={a.data.label}
                  d={arcPath(a) ?? ''}
                  fill={a.data.color ?? categorical[i % categorical.length]}
                  onMouseMove={(e) => {
                    show(e, <span><strong>{a.data.label}</strong> {formatNumber(a.data.value)} · {formatPercent(a.data.value, total)}</span>);
                  }}
                  onMouseLeave={hide}
                />
              ))}
              <text textAnchor="middle" dy="0.35em" fill={theme.palette.text.primary} fontSize={18} fontWeight={600}>
                {formatCompact(total)}
              </text>
            </g>
          </svg>
          <ChartTooltip tip={tip} width={side} />
        </Box>
        <Stack spacing={0.5} sx={{ minWidth: 0, overflow: 'hidden' }}>
          {data.map((d, i) => (
            <Stack key={d.label} direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 9, height: 9, borderRadius: '2px', bgcolor: d.color ?? categorical[i % categorical.length], flexShrink: 0 }} />
              <Typography variant="caption" noWrap sx={{ color: 'text.primary' }}>{d.label}</Typography>
              <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatCompact(d.value)}</Typography>
            </Stack>
          ))}
        </Stack>
      </Box>
    );
  }

  // Ranked horizontal bars.
  const rows = all.slice(0, MAX_BARS);
  const labelW = Math.min(170, width * 0.35);
  const innerW = Math.max(0, width - labelW - 56);
  const rowH = Math.min(26, height / Math.max(1, rows.length));
  const x = d3.scaleLinear().domain([0, rows[0]?.value ?? 1]).range([0, innerW]);
  return (
    <>
      <svg width={width} height={height} role="img"
        aria-label={`${dimension} breakdown, top ${rows.length} by count`}>
        {rows.map((d, i) => (
          <g key={d.label} transform={`translate(0,${i * rowH})`}
            onMouseMove={(e) => {
              show(e, <span><strong>{d.label}</strong> {formatNumber(d.value)} · {formatPercent(d.value, total)}</span>);
            }}
            onMouseLeave={hide}>
            <rect x={0} y={0} width={width} height={rowH} fill="transparent" />
            <text x={labelW - 8} y={rowH / 2} dy="0.35em" textAnchor="end"
              fontSize={11} fill={theme.palette.text.primary}>
              {d.label.length > 24 ? `${d.label.slice(0, 23)}…` : d.label}
            </text>
            <rect x={labelW} y={rowH * 0.2} width={Math.max(x(d.value), 1)} height={rowH * 0.6} rx={2}
              fill={d.color ?? theme.palette.primary.main} />
            <text x={labelW + x(d.value) + 6} y={rowH / 2} dy="0.35em"
              fontSize={10} fill={theme.palette.text.secondary} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatCompact(d.value)}
            </text>
          </g>
        ))}
      </svg>
      <ChartTooltip tip={tip} width={width} />
    </>
  );
}
