import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid2';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useMemo, type ReactNode } from 'react';
import type { Dataset, Occurrence } from '../types/vulnerability.ts';
import { SEVERITY_RANK } from '../types/vulnerability.ts';
import { useDataset } from '../data/useDataset.ts';
import { occurrencesForCve, cveImpact, cvssPercentile } from '../data/selectors.ts';
import { useAppDispatch, useAppSelector } from '../store/index.ts';
import { compareToggled, MAX_COMPARE } from '../store/uiSlice.ts';
import { EmptyState } from '../components/primitives/EmptyState.tsx';
import { StatCard } from '../components/primitives/StatCard.tsx';
import { SeverityBadge } from '../components/primitives/SeverityBadge.tsx';
import { CvssScoreBar } from '../components/primitives/CvssScoreBar.tsx';
import { RiskFactorChip } from '../components/primitives/RiskFactorChip.tsx';
import { formatDate, formatNumber, formatPercent } from '../utils/format.ts';

function buildColumns(dataset: Dataset): GridColDef<Occurrence>[] {
  return [
    {
      field: 'severity',
      headerName: 'Severity',
      width: 112,
      // Client-side sorting here: sort on rank, not the alphabetical string.
      valueGetter: (_, row) => SEVERITY_RANK[row.severity],
      renderCell: (p) => <SeverityBadge severity={p.row.severity} />,
    },
    {
      field: 'group',
      headerName: 'Group',
      width: 130,
      valueGetter: (_, row) => dataset.groupNames[row.groupId] ?? '',
    },
    {
      field: 'repo',
      headerName: 'Repo',
      flex: 1,
      minWidth: 140,
      valueGetter: (_, row) => dataset.repoNames[row.repoId] ?? '',
    },
    {
      field: 'image',
      headerName: 'Image',
      width: 120,
      valueGetter: (_, row) => dataset.imageMeta[row.imageId]?.version ?? '',
      renderCell: (p) => (
        <Link component={RouterLink} to={`/images/${p.row.imageId}`} underline="hover">
          {p.value as string}
        </Link>
      ),
    },
    { field: 'packageName', headerName: 'Package', flex: 1, minWidth: 140 },
    { field: 'packageVersion', headerName: 'Version', width: 120, sortable: false },
    {
      field: 'fixDate',
      headerName: 'Fix date',
      width: 110,
      valueFormatter: (value: number | null) => formatDate(value),
    },
    {
      field: 'kaiStatus',
      headerName: 'Triage',
      width: 104,
      sortable: false,
      renderCell: (p) =>
        p.row.kaiStatus === null ? (
          <Typography variant="caption" color="text.secondary">—</Typography>
        ) : (
          <Chip size="small" variant="outlined"
            label={p.row.kaiStatus.startsWith('ai-') ? 'AI dismissed' : 'dismissed'}
            title={p.row.kaiStatus} />
        ),
    },
  ];
}

/**
 * The architecture-enabled view: catalog metadata is one Map lookup, and the
 * occurrence scan below is the query that would be unaffordable without the
 * catalog/occurrence split (§5 of the brief).
 */
export default function CveDetailPage(): ReactNode {
  const { cveId } = useParams();
  const dataset = useDataset();
  const dispatch = useAppDispatch();
  const compareCves = useAppSelector((s) => s.ui.compareCves);
  const meta = cveId !== undefined ? dataset.cveCatalog.get(cveId) : undefined;

  const rows = useMemo(
    () => (cveId === undefined ? [] : occurrencesForCve(dataset, cveId)),
    [dataset, cveId],
  );
  const impact = useMemo(() => cveImpact(rows), [rows]);
  const columns = useMemo(() => buildColumns(dataset), [dataset]);

  // Per-occurrence severity can differ from the catalog's worst-observed
  // (83 CVEs measured in Phase 0) — surface when this CVE is one of them.
  const severityVaries = useMemo(
    () => new Set(rows.map((o) => o.severity)).size > 1,
    [rows],
  );

  if (meta === undefined) {
    return <EmptyState title="CVE not found" description={`"${cveId ?? ''}" is not in the catalog.`} />;
  }

  const percentile = cvssPercentile(dataset, meta.cvss);
  const staged = compareCves.includes(meta.cve);

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <Typography variant="h1">{meta.cve}</Typography>
        <SeverityBadge severity={meta.severity} />
        <CvssScoreBar score={meta.cvss} />
        <Typography variant="caption">
          higher than {percentile.toFixed(0)}% of CVEs in this scan
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="outlined"
          startIcon={staged ? <CheckCircleIcon /> : <AddCircleOutlineIcon />}
          disabled={!staged && compareCves.length >= MAX_COMPARE}
          onClick={() => dispatch(compareToggled(meta.cve))}
        >
          {staged ? 'Staged to compare' : 'Add to compare'}
        </Button>
      </Stack>

      {/* Blast radius at a glance */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Occurrences" value={formatNumber(impact.total)} sublabel={`across ${impact.groups} groups`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Images affected" value={formatNumber(impact.images)} sublabel={`${formatNumber(impact.repos)} repos`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            label="Fix available"
            value={formatPercent(impact.withFix, impact.total)}
            sublabel={impact.earliestFix !== null ? `first fix ${formatDate(impact.earliestFix)}` : 'no fix dates recorded'}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard
            label="Triage dismissed"
            value={formatNumber(impact.manualDismissed + impact.aiDismissed)}
            sublabel={`${formatNumber(impact.manualDismissed)} manual · ${formatNumber(impact.aiDismissed)} AI`}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="body2" sx={{ mb: 2 }}>{meta.description}</Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
              {meta.riskFactors.map((rf) => <RiskFactorChip key={rf} label={rf} />)}
            </Stack>
            <Typography variant="caption" component="div">
              published {formatDate(meta.published)}
              {' · '}
              <Link href={meta.link} target="_blank" rel="noreferrer">NVD entry</Link>
              {severityVaries && ' · scanner assigns this CVE different severities per occurrence'}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="h3" gutterBottom>Remediation</Typography>
            {impact.statuses.length > 0 ? (
              <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                {impact.statuses.slice(0, 4).map((s) => (
                  <Stack key={s.status} direction="row" spacing={1} alignItems="baseline">
                    <Typography variant="body2" sx={{ flex: 1 }} noWrap>{s.status}</Typography>
                    <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      ×{formatNumber(s.count)}
                    </Typography>
                  </Stack>
                ))}
                {impact.statuses.length > 4 && (
                  <Typography variant="caption">+{impact.statuses.length - 4} more advisories</Typography>
                )}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                No scanner remediation advisories recorded.
              </Typography>
            )}
            <Typography variant="caption" component="div" sx={{ mb: 1 }}>
              Affected packages ({formatNumber(impact.packages.length)})
            </Typography>
            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
              {impact.packages.slice(0, 8).map((p) => (
                <Chip
                  key={`${p.name}@${p.version}`}
                  size="small"
                  variant="outlined"
                  label={`${p.name} ${p.version} ×${formatNumber(p.count)}`}
                />
              ))}
              {impact.packages.length > 8 && (
                <Chip size="small" variant="outlined" label={`+${impact.packages.length - 8} more`} />
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Typography variant="h2" gutterBottom>
        Affected occurrences ({formatNumber(rows.length)})
      </Typography>
      <Box sx={{ height: 'min(560px, 60vh)' }}>
        <DataGrid<Occurrence>
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          density="compact"
          disableRowSelectionOnClick
          disableColumnMenu
          initialState={{
            sorting: { sortModel: [{ field: 'severity', sort: 'asc' }] },
            pagination: { paginationModel: { pageSize: 100 } },
          }}
          pageSizeOptions={[25, 50, 100]}
          sx={{ border: 1, borderColor: 'divider', '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' } }}
          aria-label={`Occurrences of ${meta.cve}`}
        />
      </Box>
    </Box>
  );
}
