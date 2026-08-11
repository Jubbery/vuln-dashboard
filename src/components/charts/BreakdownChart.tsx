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
  /** Cap for ranked dimensions; ordered axes ignore it. */
  limit?: number;
  width: number;
  height: number;
}

interface Slice { label: string; value: number; color?: string }

const MAX_DONUT_SLICES = 8;
const MAX_BARS = 12;

const KAI_LABEL: Record<string, string> = {
  none: 'active (untriaged)',
  'invalid - norisk': 'manual dismissed',
  'ai-invalid-norisk': 'AI dismissed',
};

/** Ordered dimensions keep their natural axis; the rest rank by count. */
export const ORDERED_DIMENSIONS: ReadonlySet<BreakdownDimension> = new Set(['year', 'cvssBand']);

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
    case 'group':
      return a.byGroup
        .map((value, id) => ({ label: dataset.groupNames[id] ?? `group ${id}`, value }))
        .filter((d) => d.value > 0)
        .sort((x, y) => y.value - x.value);
    case 'kaiStatus':
      return Object.entries(a.byKaiStatus)
        .map(([k, value]) => ({ label: KAI_LABEL[k] ?? k, value }))
        .sort((x, y) => y.value - x.value);
    case 'cvssBand':
      return a.cvssHistogram.map((b) => ({
        label: b.bin.toFixed(1),
        value: b.count,
        color: severityFill[b.bin >= 9 ? 'critical' : b.bin >= 7 ? 'high' : b.bin >= 4 ? 'medium' : 'low'],
      }));
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
export function BreakdownChart({ dataset, dimension, form, limit, width, height }: BreakdownChartProps): ReactNode {
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
    const cap = Math.min(limit ?? MAX_DONUT_SLICES, MAX_DONUT_SLICES);
    const head = all.slice(0, cap);
    const tail = all.slice(cap);
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

  if (form === 'column') {
    // Vertical columns — the right shape for ordered axes (years, CVSS bands).
    const cols = all.slice(0, 40);
    const m = { top: 8, right: 4, bottom: 20, left: 40 };
    const innerW = Math.max(0, width - m.left - m.right);
    const innerH = Math.max(0, height - m.top - m.bottom);
    const x = d3.scaleBand<string>().domain(cols.map((d) => d.label)).range([0, innerW]).padding(0.25);
    const y = d3.scaleLinear().domain([0, d3.max(cols, (d) => d.value) ?? 1]).nice().range([innerH, 0]);
    const labelEvery = Math.max(1, Math.ceil(cols.length / Math.max(1, Math.floor(innerW / 44))));
    return (
      <>
        <svg width={width} height={height} role="img"
          aria-label={`${dimension} breakdown across ${cols.length} buckets`}>
          <g transform={`translate(${m.left},${m.top})`}>
            {y.ticks(4).map((t) => (
              <g key={t} transform={`translate(0,${y(t)})`}>
                <line x1={0} x2={innerW} stroke={theme.palette.divider} strokeWidth={1} />
                <text x={-8} dy="0.35em" textAnchor="end" fontSize={10} fill={theme.palette.text.secondary}>
                  {formatCompact(t)}
                </text>
              </g>
            ))}
            {cols.map((d, i) => (
              <g key={d.label}
                onMouseMove={(e) => {
                  show(e, <span><strong>{d.label}</strong> {formatNumber(d.value)} · {formatPercent(d.value, total)}</span>);
                }}
                onMouseLeave={hide}>
                <rect x={x(d.label) ?? 0} y={0} width={x.bandwidth()} height={innerH} fill="transparent" />
                <rect
                  x={x(d.label) ?? 0}
                  y={y(d.value)}
                  width={x.bandwidth()}
                  height={innerH - y(d.value)}
                  rx={1.5}
                  fill={d.color ?? theme.palette.primary.main}
                  stroke={theme.palette.background.paper}
                  strokeWidth={1}
                />
                {i % labelEvery === 0 && (
                  <text x={(x(d.label) ?? 0) + x.bandwidth() / 2} y={innerH + 14} textAnchor="middle"
                    fontSize={9} fill={theme.palette.text.secondary}>
                    {d.label}
                  </text>
                )}
              </g>
            ))}
          </g>
        </svg>
        <ChartTooltip tip={tip} width={width} />
      </>
    );
  }

  // Ranked horizontal bars.
  const rows = all.slice(0, ORDERED_DIMENSIONS.has(dimension) ? all.length : (limit ?? MAX_BARS));
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
