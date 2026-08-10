import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme, alpha } from '@mui/material/styles';
import * as d3 from 'd3';
import type { Aggregates, Severity } from '../../types/vulnerability.ts';
import { SEVERITY_ORDER, SEVERITY_LABEL } from '../../theme/severity.ts';
import { EmptyState } from '../primitives/EmptyState.tsx';
import { ChartTooltip, useChartTooltip } from './ChartTooltip.tsx';
import { formatNumber } from '../../utils/format.ts';

export interface SeverityVsCvssScatterProps {
  severityVsCvss: Aggregates['severityVsCvss'];
  width: number;
  height: number;
}

const MARGIN = { top: 12, right: 16, bottom: 28, left: 76 };
/** CVSS threshold NVD calls "high"; points at/above it in a low/medium band
 *  are the understatement this chart exists to show. */
const HIGH_CVSS = 7;

/** Deterministic per-CVE jitter in [-0.5, 0.5] so re-renders don't shimmer. */
function jitter(cve: string): number {
  let h = 0;
  for (let i = 0; i < cve.length; i++) h = ((h << 5) - h + cve.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000 - 0.5;
}

/**
 * §8.4 — severity vs. CVSS, one point per unique CVE (quirk 3.2C made
 * visible). Vendor severity is the y band, CVSS the x position; the shaded
 * region marks low/medium-labelled CVEs with CVSS ≥ 7 — scores the label
 * understates. Click any point to open that CVE.
 */
export function SeverityVsCvssScatter({ severityVsCvss, width, height }: SeverityVsCvssScatterProps): ReactNode {
  const theme = useTheme();
  const navigate = useNavigate();
  const { tip, show, hide } = useChartTooltip();

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const bands = useMemo(
    () => SEVERITY_ORDER.filter((s) => severityVsCvss.some((d) => d.severity === s)),
    [severityVsCvss],
  );

  const x = useMemo(() => d3.scaleLinear().domain([0, 10]).range([0, innerW]), [innerW]);
  const y = useMemo(
    () => d3.scaleBand<Severity>().domain(bands).range([0, innerH]).padding(0.18),
    [bands, innerH],
  );

  const understated = useMemo(
    () => severityVsCvss.filter((d) => (d.severity === 'medium' || d.severity === 'low') && d.cvss >= HIGH_CVSS),
    [severityVsCvss],
  );

  if (severityVsCvss.length === 0) {
    return <EmptyState title="No CVE data" description="Nothing to plot." />;
  }

  const understatedBands = bands.filter((s) => s === 'medium' || s === 'low');

  return (
    <>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Vendor severity versus CVSS score for ${formatNumber(severityVsCvss.length)} unique CVEs; ${formatNumber(understated.length)} low or medium labelled CVEs carry CVSS 7 or higher`}
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* disagreement region: low/medium bands, CVSS ≥ 7 */}
          {understatedBands.map((s) => (
            <rect
              key={`shade-${s}`}
              x={x(HIGH_CVSS)}
              y={y(s) ?? 0}
              width={x(10) - x(HIGH_CVSS)}
              height={y.bandwidth()}
              fill={alpha(theme.palette.severity.critical, 0.07)}
              stroke={alpha(theme.palette.severity.critical, 0.25)}
              strokeDasharray="3 3"
            />
          ))}

          {/* x grid + axis */}
          {x.ticks(5).map((t) => (
            <g key={t} transform={`translate(${x(t)},0)`}>
              <line y1={0} y2={innerH} stroke={theme.palette.divider} strokeWidth={1} />
              <text y={innerH + 18} textAnchor="middle" fontSize={11} fill={theme.palette.text.secondary}>
                {t}
              </text>
            </g>
          ))}
          <text
            x={innerW / 2}
            y={innerH + 28}
            textAnchor="middle"
            fontSize={11}
            fill={theme.palette.text.secondary}
          >
            CVSS score
          </text>

          {/* y band labels */}
          {bands.map((s) => (
            <text
              key={s}
              x={-10}
              y={(y(s) ?? 0) + y.bandwidth() / 2}
              dy="0.35em"
              textAnchor="end"
              fontSize={12}
              fill={theme.palette.severity[s]}
              fontWeight={600}
            >
              {SEVERITY_LABEL[s]}
            </text>
          ))}

          {/* points — deliberately NOT individual tab stops: ~1,200 of them
              would trap keyboard users. The svg aria-label summarizes the
              finding; every CVE is keyboard-reachable through the Explorer. */}
          {severityVsCvss.map((d) => {
            const bandY = y(d.severity);
            if (bandY === undefined) return null;
            const cy = bandY + y.bandwidth() / 2 + jitter(d.cve) * y.bandwidth() * 0.72;
            const isUnderstated = (d.severity === 'medium' || d.severity === 'low') && d.cvss >= HIGH_CVSS;
            return (
              <circle
                key={d.cve}
                cx={x(d.cvss)}
                cy={cy}
                r={isUnderstated ? 3.5 : 2.5}
                fill={theme.palette.severity[d.severity]}
                fillOpacity={isUnderstated ? 0.95 : 0.45}
                stroke={isUnderstated ? theme.palette.severity.critical : 'none'}
                strokeWidth={isUnderstated ? 1 : 0}
                cursor="pointer"
                onClick={() => { void navigate(`/cve/${d.cve}`); }}
                onMouseMove={(e) => {
                  show(e, (
                    <span>
                      <strong>{d.cve}</strong>
                      <br />{SEVERITY_LABEL[d.severity]} · CVSS {d.cvss.toFixed(1)}
                      {isUnderstated && <><br />label understates score</>}
                    </span>
                  ));
                }}
                onMouseLeave={hide}
              />
            );
          })}

          {/* annotation for the shaded region */}
          {understated.length > 0 && understatedBands.length > 0 && (
            <text
              x={x(HIGH_CVSS) + 6}
              y={(y(understatedBands[0]!) ?? 0) - 4}
              fontSize={11}
              fill={theme.palette.severity.critical}
            >
              {formatNumber(understated.length)} CVEs labelled below their CVSS
            </text>
          )}
        </g>
      </svg>
      <ChartTooltip tip={tip} width={width} />
    </>
  );
}
