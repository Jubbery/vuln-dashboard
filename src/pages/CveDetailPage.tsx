import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useMemo, type ReactNode } from 'react';
import type { Dataset, Occurrence } from '../types/vulnerability.ts';
import { SEVERITY_RANK } from '../types/vulnerability.ts';
import { useDataset } from '../data/useDataset.ts';
import { occurrencesForCve } from '../data/selectors.ts';
import { EmptyState } from '../components/primitives/EmptyState.tsx';
import { SeverityBadge } from '../components/primitives/SeverityBadge.tsx';
import { CvssScoreBar } from '../components/primitives/CvssScoreBar.tsx';
import { RiskFactorChip } from '../components/primitives/RiskFactorChip.tsx';
import { formatDate, formatNumber } from '../utils/format.ts';

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
  const meta = cveId !== undefined ? dataset.cveCatalog.get(cveId) : undefined;

  const rows = useMemo(
    () => (cveId === undefined ? [] : occurrencesForCve(dataset, cveId)),
    [dataset, cveId],
  );
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

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <Typography variant="h1">{meta.cve}</Typography>
        <SeverityBadge severity={meta.severity} />
        <CvssScoreBar score={meta.cvss} />
      </Stack>

      <Paper sx={{ p: 2.5, mb: 2.5 }}>
        <Typography variant="body2" sx={{ mb: 2, maxWidth: 760 }}>{meta.description}</Typography>
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
