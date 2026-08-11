import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import CloseIcon from '@mui/icons-material/Close';
import { alpha, useTheme } from '@mui/material/styles';
import { useMemo, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useDataset } from '../data/useDataset.ts';
import { useAppDispatch, useAppSelector } from '../store/index.ts';
import { compareToggled } from '../store/uiSlice.ts';
import { EmptyState } from '../components/primitives/EmptyState.tsx';
import { SeverityBadge } from '../components/primitives/SeverityBadge.tsx';
import { CvssScoreBar } from '../components/primitives/CvssScoreBar.tsx';
import { RiskFactorChip } from '../components/primitives/RiskFactorChip.tsx';
import { formatDate, formatNumber } from '../utils/format.ts';

/**
 * Side-by-side CVE comparison (email spec). CVEs are staged from the
 * Explorer's compare column; each card pulls catalog metadata plus an
 * occurrence rollup. The union of risk factors across the set is shown per
 * card with presence/absence, so differences line up visually.
 */
export default function ComparePage(): ReactNode {
  const theme = useTheme();
  const dataset = useDataset();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const compareCves = useAppSelector((s) => s.ui.compareCves);

  const entries = useMemo(() => compareCves.flatMap((cve) => {
    const meta = dataset.cveCatalog.get(cve);
    if (meta === undefined) return [];
    let occurrences = 0;
    const images = new Set<number>();
    for (const o of dataset.occurrences) {
      if (o.cve === cve) { occurrences++; images.add(o.imageId); }
    }
    return [{ meta, occurrences, imageCount: images.size }];
  }), [dataset, compareCves]);

  const riskFactorUnion = useMemo(
    () => [...new Set(entries.flatMap((e) => e.meta.riskFactors))].sort(),
    [entries],
  );

  if (entries.length < 2) {
    return (
      <EmptyState
        title="Nothing to compare"
        description="Stage at least two CVEs from the Explorer's + column, then come back."
        actionLabel="Open Explorer"
        onAction={() => { void navigate('/explorer'); }}
      />
    );
  }

  const maxCvss = Math.max(...entries.map((e) => e.meta.cvss));

  return (
    <Box>
      <Typography variant="h1" gutterBottom>
        Comparing {entries.length} CVEs
      </Typography>
      <Grid container spacing={2}>
        {entries.map(({ meta, occurrences, imageCount }) => (
          <Grid key={meta.cve} size={{ xs: 12, sm: 6, lg: 12 / entries.length }}>
            <Paper sx={{
              p: 2.5,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              // the highest-scoring CVE in the set gets the accent border
              borderColor: meta.cvss === maxCvss ? alpha(theme.palette.severity.critical, 0.6) : undefined,
            }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Link component={RouterLink} to={`/cve/${meta.cve}`} underline="hover" variant="h3" sx={{ flex: 1 }} noWrap>
                  {meta.cve}
                </Link>
                <IconButton
                  size="small"
                  aria-label={`Remove ${meta.cve} from comparison`}
                  onClick={() => dispatch(compareToggled(meta.cve))}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <SeverityBadge severity={meta.severity} />
                <CvssScoreBar score={meta.cvss} />
              </Stack>
              <Typography variant="caption" component="div">
                {formatNumber(occurrences)} occurrences · {formatNumber(imageCount)} images
                <br />published {formatDate(meta.published)}
              </Typography>
              <Box>
                <Typography variant="caption" component="div" sx={{ mb: 0.5 }}>Risk factors</Typography>
                <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                  {riskFactorUnion.map((rf) => {
                    const has = meta.riskFactors.includes(rf);
                    return has ? (
                      <RiskFactorChip key={rf} label={rf} />
                    ) : (
                      <Typography
                        key={rf}
                        variant="caption"
                        sx={{
                          px: 1, py: 0.25, borderRadius: 4,
                          border: `1px dashed ${theme.palette.divider}`,
                          color: 'text.secondary', opacity: 0.45,
                          textDecoration: 'line-through',
                        }}
                      >
                        {rf}
                      </Typography>
                    );
                  })}
                </Stack>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{
                display: '-webkit-box',
                WebkitLineClamp: 5,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {meta.description}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
