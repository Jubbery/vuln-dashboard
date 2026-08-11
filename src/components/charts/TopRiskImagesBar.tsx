import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import * as d3 from 'd3';
import type { Aggregates, Dataset } from '../../types/vulnerability.ts';
import { SEVERITY_ORDER, SEVERITY_LABEL } from '../../theme/severity.ts';
import { SEVERITY_WEIGHT } from '../../types/vulnerability.ts';
import { EmptyState } from '../primitives/EmptyState.tsx';
import { ChartTooltip, useChartTooltip } from './ChartTooltip.tsx';
import { formatNumber } from '../../utils/format.ts';

export interface TopRiskImagesBarProps {
  topRiskImages: Aggregates['topRiskImages'];
  dataset: Dataset;
  width: number;
  height: number;
}

const MARGIN = { top: 4, right: 48, bottom: 4, left: 0 };
const LABEL_WIDTH = 190;

/** "repo-tail:version" — full registry path goes in the tooltip. */
function shortLabel(name: string, version: string): string {
  const tail = name.split('/').pop() ?? name;
  const label = `${tail}:${version}`;
  return label.length > 26 ? `${label.slice(0, 25)}…` : label;
}

/**
 * §8.2 — top 10 riskiest images. Bar length is the weighted severity score
 * (the ranking metric), segmented by each severity's contribution to it, so
 * order and length always agree. Raw counts live in the tooltip. Clicking a
 * bar opens the image's detail page.
 */
export function TopRiskImagesBar({ topRiskImages, dataset, width, height }: TopRiskImagesBarProps): ReactNode {
  const theme = useTheme();
  const navigate = useNavigate();
  const { tip, show, hide } = useChartTooltip();

  const rows = useMemo(() => topRiskImages.slice(0, 10), [topRiskImages]);

  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right - LABEL_WIDTH);
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const y = useMemo(
    () => d3.scaleBand<number>().domain(rows.map((r) => r.imageId)).range([0, innerH]).padding(0.5),
    [rows, innerH],
  );
  const x = useMemo(
    () => d3.scaleLinear().domain([0, d3.max(rows, (r) => r.weightedScore) ?? 1]).range([0, innerW]),
    [rows, innerW],
  );

  if (rows.length === 0) {
    return <EmptyState title="No images" description="No image risk data to rank." />;
  }

  return (
    <>
      <svg width={width} height={height} role="img" aria-label="Top 10 riskiest images by weighted severity score">
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {rows.map((r) => {
            const img = dataset.imageMeta[r.imageId];
            if (img === undefined) return null;
            const yPos = y(r.imageId) ?? 0;
            const repoName = dataset.repoNames[img.repoId] ?? '';
            const tooltip = (
              <span>
                <strong>{repoName}:{img.version}</strong>
                <br />score {formatNumber(Math.round(r.weightedScore))}
                {SEVERITY_ORDER.filter((s) => r.counts[s] > 0).map((s) => (
                  <span key={s}>
                    <br />{SEVERITY_LABEL[s]}: {formatNumber(r.counts[s])}
                  </span>
                ))}
              </span>
            );
            let xCursor = 0;
            return (
              <g
                key={r.imageId}
                transform={`translate(0,${yPos})`}
                cursor="pointer"
                role="button"
                tabIndex={0}
                onClick={() => { void navigate(`/images/${r.imageId}`); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void navigate(`/images/${r.imageId}`);
                  }
                }}
                onMouseMove={(e) => { show(e, tooltip); }}
                onMouseLeave={hide}
                aria-label={`${repoName} ${img.version}, weighted score ${Math.round(r.weightedScore)} — open image`}
              >
                {/* hit area spanning the full row */}
                <rect x={0} y={-2} width={width - MARGIN.right} height={y.bandwidth() + 4} fill="transparent" />
                <text
                  x={LABEL_WIDTH - 10}
                  y={y.bandwidth() / 2}
                  dy="0.35em"
                  textAnchor="end"
                  fill={theme.palette.text.primary}
                  fontSize={12}
                >
                  {shortLabel(repoName, img.version)}
                </text>
                {SEVERITY_ORDER.filter((s) => r.counts[s] > 0 && SEVERITY_WEIGHT[s] > 0).map((s) => {
                  const w = x(r.counts[s] * SEVERITY_WEIGHT[s]);
                  const seg = (
                    <rect
                      key={s}
                      x={LABEL_WIDTH + xCursor}
                      y={0}
                      width={Math.max(w, 1)}
                      height={y.bandwidth()}
                      rx={2}
                      fill={theme.palette.severity[s]}
                    />
                  );
                  xCursor += w;
                  return seg;
                })}
                <text
                  x={LABEL_WIDTH + x(r.weightedScore) + 8}
                  y={y.bandwidth() / 2}
                  dy="0.35em"
                  fill={theme.palette.text.secondary}
                  fontSize={11}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatNumber(Math.round(r.weightedScore))}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <ChartTooltip tip={tip} width={width} />
      {/* sx width must be '1px' — bare 1 means 100% in the sx spacing scale,
          which made this "hidden" span 884px wide and caused page-level
          horizontal overflow (caught in the Phase 6 browser pass). */}
      <Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        Bar length is the weighted severity score; hover for raw counts.
      </Box>
    </>
  );
}
