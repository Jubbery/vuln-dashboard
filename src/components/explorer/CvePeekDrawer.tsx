import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { alpha, useTheme } from '@mui/material/styles';
import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDataset } from '../../data/useDataset.ts';
import { occurrencesForCve, cveImpact, cvssPercentile } from '../../data/selectors.ts';
import { useAppDispatch, useAppSelector } from '../../store/index.ts';
import { compareToggled, MAX_COMPARE } from '../../store/uiSlice.ts';
import { SeverityBadge } from '../primitives/SeverityBadge.tsx';
import { CvssScoreBar } from '../primitives/CvssScoreBar.tsx';
import { RiskFactorChip } from '../primitives/RiskFactorChip.tsx';
import { formatDate, formatNumber, formatPercent } from '../../utils/format.ts';

const WIDTH = 400;
const TOP_PACKAGES = 5;

export interface CvePeekDrawerProps {
  cve: string | null;
  onClose: () => void;
}

/**
 * Row-click peek: the CVE's story without leaving the grid — catalog
 * metadata, blast radius, remediation summary, and the two actions you'd
 * leave for (full page, compare). Filter state stays untouched underneath.
 */
export function CvePeekDrawer({ cve, onClose }: CvePeekDrawerProps): ReactNode {
  const theme = useTheme();
  const dataset = useDataset();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const compareCves = useAppSelector((s) => s.ui.compareCves);

  const meta = cve !== null ? dataset.cveCatalog.get(cve) : undefined;
  const impact = useMemo(
    () => (cve === null ? null : cveImpact(occurrencesForCve(dataset, cve))),
    [dataset, cve],
  );
  const percentile = meta === undefined ? 0 : cvssPercentile(dataset, meta.cvss);
  const staged = cve !== null && compareCves.includes(cve);

  return (
    <Drawer
      anchor="right"
      open={cve !== null}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: `min(${WIDTH}px, 92vw)`, p: 2.5, gap: 1.75, display: 'flex', flexDirection: 'column' } } }}
    >
      {meta !== undefined && impact !== null && (
        <>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="h2" component="h2" sx={{ flex: 1 }} noWrap>{meta.cve}</Typography>
            <IconButton size="small" aria-label="Close details" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <SeverityBadge severity={meta.severity} />
            <CvssScoreBar score={meta.cvss} />
          </Stack>
          <Typography variant="caption">
            scores higher than {percentile.toFixed(0)}% of CVEs in this scan
            {' · '}published {formatDate(meta.published)}
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{
            display: '-webkit-box',
            WebkitLineClamp: 6,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {meta.description}
          </Typography>

          <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
            {meta.riskFactors.map((rf) => <RiskFactorChip key={rf} label={rf} />)}
          </Stack>

          <Box sx={{
            p: 1.5,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          }}>
            <Typography variant="caption" component="div" sx={{ lineHeight: 1.9 }}>
              <strong>{formatNumber(impact.total)}</strong> occurrences across{' '}
              <strong>{formatNumber(impact.images)}</strong> images ·{' '}
              <strong>{formatNumber(impact.repos)}</strong> repos ·{' '}
              <strong>{impact.groups}</strong> groups
              <br />
              fix available for {formatPercent(impact.withFix, impact.total)}
              {impact.earliestFix !== null && <> — first fix {formatDate(impact.earliestFix)}</>}
              <br />
              triage: {formatNumber(impact.manualDismissed)} manual · {formatNumber(impact.aiDismissed)} AI dismissed
            </Typography>
          </Box>

          <Box>
            <Typography variant="caption" component="div" sx={{ mb: 0.75 }}>
              Most affected packages
            </Typography>
            <Stack spacing={0.5}>
              {impact.packages.slice(0, TOP_PACKAGES).map((p) => (
                <Stack key={`${p.name}@${p.version}`} direction="row" spacing={1} alignItems="baseline">
                  <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                    {p.name} <Typography component="span" variant="caption">{p.version}</Typography>
                  </Typography>
                  <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    ×{formatNumber(p.count)}
                  </Typography>
                </Stack>
              ))}
              {impact.packages.length > TOP_PACKAGES && (
                <Typography variant="caption">+{impact.packages.length - TOP_PACKAGES} more</Typography>
              )}
            </Stack>
          </Box>

          <Box sx={{ flex: 1 }} />

          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              size="small"
              startIcon={<OpenInFullIcon />}
              onClick={() => { void navigate(`/cve/${meta.cve}`); }}
              sx={{ flex: 1 }}
            >
              Full details
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={staged ? <CheckCircleIcon /> : <AddCircleOutlineIcon />}
              disabled={!staged && compareCves.length >= MAX_COMPARE}
              onClick={() => dispatch(compareToggled(meta.cve))}
            >
              {staged ? 'Staged' : 'Compare'}
            </Button>
          </Stack>
          <Typography variant="caption">
            <Link href={meta.link} target="_blank" rel="noreferrer">NVD entry ↗</Link>
          </Typography>
        </>
      )}
    </Drawer>
  );
}
