import { useMemo, type ReactNode } from 'react';
import { useTheme } from '@mui/material/styles';
import * as d3 from 'd3';
import type { Aggregates, Severity } from '../../types/vulnerability.ts';
import { SEVERITY_ORDER, SEVERITY_LABEL } from '../../theme/severity.ts';
import { EmptyState } from '../primitives/EmptyState.tsx';
import { ChartTooltip, useChartTooltip } from './ChartTooltip.tsx';
import { formatNumber } from '../../utils/format.ts';

export interface PublishedTrendChartProps {
  publishedTrend: Aggregates['publishedTrend'];
  width: number;
  height: number;
}

const MARGIN = { top: 8, right: 8, bottom: 24, left: 40 };

/** Stack order: low at the bottom, critical on top, so the most severe band
 *  sits at the silhouette edge where growth is easiest to read. */
const STACK_ORDER: readonly Severity[] = [...SEVERITY_ORDER].reverse();

/**
 * §email — trend analysis of vulnerabilities over time. One stacked bar per
 * publication year over unique CVEs (deduped, from the catalog), severity
 * bands stacked. D3 computes scales, React renders (§2.2).
 */
export function PublishedTrendChart({ publishedTrend, width, height }: PublishedTrendChartProps): ReactNode {
  const theme = useTheme();
  const { tip, show, hide } = useChartTooltip();

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  const x = useMemo(
    () => d3.scaleBand<number>().domain(publishedTrend.map((d) => d.year)).range([0, innerW]).padding(0.25),
    [publishedTrend, innerW],
  );
  const maxTotal = useMemo(
    () => d3.max(publishedTrend, (d) => SEVERITY_ORDER.reduce((s, sev) => s + d.counts[sev], 0)) ?? 0,
    [publishedTrend],
  );
  const y = useMemo(
    () => d3.scaleLinear().domain([0, maxTotal]).nice().range([innerH, 0]),
    [maxTotal, innerH],
  );

  // Thin the year labels so they never collide at narrow widths.
  const labelEvery = Math.max(1, Math.ceil(publishedTrend.length / Math.max(1, Math.floor(innerW / 46))));

  if (publishedTrend.length === 0 || maxTotal === 0) {
    return <EmptyState title="No publication dates" description="No CVE publication data to plot." />;
  }

  return (
    <>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`CVE disclosures per year from ${publishedTrend[0]?.year ?? ''} to ${publishedTrend[publishedTrend.length - 1]?.year ?? ''}, stacked by severity`}
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* y grid + axis */}
          {y.ticks(4).map((t) => (
            <g key={t} transform={`translate(0,${y(t)})`}>
              <line x1={0} x2={innerW} stroke={theme.palette.divider} strokeWidth={1} />
              <text x={-8} dy="0.35em" textAnchor="end" fontSize={11} fill={theme.palette.text.secondary}>
                {formatNumber(t)}
              </text>
            </g>
          ))}

          {publishedTrend.map((d, i) => {
            const total = SEVERITY_ORDER.reduce((s, sev) => s + d.counts[sev], 0);
            const xPos = x(d.year) ?? 0;
            let yCursor = innerH;
            const tooltip = (
              <span>
                <strong>{d.year}</strong> · {formatNumber(total)} CVEs
                {STACK_ORDER.filter((s) => d.counts[s] > 0).reverse().map((s) => (
                  <span key={s}><br />{SEVERITY_LABEL[s]}: {formatNumber(d.counts[s])}</span>
                ))}
              </span>
            );
            return (
              <g key={d.year} onMouseMove={(e) => { show(e, tooltip); }} onMouseLeave={hide}>
                {/* full-height hit area so sparse years are hoverable */}
                <rect x={xPos} y={0} width={x.bandwidth()} height={innerH} fill="transparent" />
                {STACK_ORDER.filter((s) => d.counts[s] > 0).map((s) => {
                  const h = innerH - y(d.counts[s]);
                  yCursor -= h;
                  return (
                    <rect
                      key={s}
                      x={xPos}
                      y={yCursor}
                      width={x.bandwidth()}
                      height={h}
                      fill={theme.palette.severity[s]}
                    />
                  );
                })}
                {i % labelEvery === 0 && (
                  <text
                    x={xPos + x.bandwidth() / 2}
                    y={innerH + 16}
                    textAnchor="middle"
                    fontSize={10}
                    fill={theme.palette.text.secondary}
                  >
                    {d.year}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <ChartTooltip tip={tip} width={width} />
    </>
  );
}
