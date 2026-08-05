import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import {
  DataGrid,
  type GridColDef,
  type GridSortModel,
  type GridPaginationModel,
} from '@mui/x-data-grid';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import type { Dataset, Occurrence } from '../../types/vulnerability.ts';
import { useDataset } from '../../data/useDataset.ts';
import { useAppDispatch, useAppSelector } from '../../store/index.ts';
import { sortSet, pageSet, pageSizeSet, explorerScrollSaved } from '../../store/uiSlice.ts';
import { SeverityBadge } from '../primitives/SeverityBadge.tsx';
import { CvssScoreBar } from '../primitives/CvssScoreBar.tsx';
import { EmptyState } from '../primitives/EmptyState.tsx';
import { formatDate } from '../../utils/format.ts';

function buildColumns(dataset: Dataset): GridColDef<Occurrence>[] {
  return [
    {
      field: 'severity',
      headerName: 'Severity',
      width: 112,
      renderCell: (p) => <SeverityBadge severity={p.row.severity} />,
    },
    { field: 'cve', headerName: 'CVE', width: 168 },
    {
      field: 'cvss',
      headerName: 'CVSS',
      width: 132,
      // Occurrence rows deliberately don't store cvss — catalog lookup (max
      // observed across occurrences; per-CVE conflicts documented in Phase 0).
      renderCell: (p) => <CvssScoreBar score={dataset.cveCatalog.get(p.row.cve)?.cvss ?? 0} />,
    },
    { field: 'packageName', headerName: 'Package', flex: 1, minWidth: 150 },
    { field: 'packageVersion', headerName: 'Version', width: 130, sortable: false },
    { field: 'packageType', headerName: 'Type', width: 92 },
    {
      field: 'image',
      headerName: 'Image',
      flex: 1,
      minWidth: 160,
      valueGetter: (_, row) => {
        const img = dataset.imageMeta[row.imageId];
        return img === undefined ? '' : `${dataset.repoNames[img.repoId] ?? ''}:${img.version}`;
      },
      renderCell: (p) => (
        <Link
          component={RouterLink}
          to={`/images/${p.row.imageId}`}
          underline="hover"
          color="text.secondary"
          onClick={(e) => e.stopPropagation()}
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {p.value as string}
        </Link>
      ),
    },
    {
      field: 'fixDate',
      headerName: 'Fix date',
      width: 112,
      valueFormatter: (value: number | null) => formatDate(value),
    },
    {
      field: 'kaiStatus',
      headerName: 'Triage',
      width: 108,
      sortable: false,
      renderCell: (p) =>
        p.row.kaiStatus === null ? (
          <Typography variant="caption" color="text.secondary">—</Typography>
        ) : (
          <Chip size="small" variant="outlined" label="dismissed"
            title={p.row.kaiStatus} sx={{ color: 'text.secondary' }} />
        ),
    },
  ];
}

/** Fields the selector layer knows how to sort (data/selectors.ts). */
const SORTABLE = new Set(['severity', 'cvss', 'cve', 'packageName', 'packageType', 'fixDate', 'image']);

export function OccurrenceGrid({ rows }: { rows: Occurrence[] }): ReactNode {
  const dataset = useDataset();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const sort = useAppSelector((s) => s.ui.sort);
  const page = useAppSelector((s) => s.ui.page);
  const pageSize = useAppSelector((s) => s.ui.pageSize);
  const savedScrollTop = useAppSelector((s) => s.ui.explorerScrollTop);

  const columns = useMemo(() => buildColumns(dataset), [dataset]);

  const sortModel: GridSortModel = useMemo(
    () => [{ field: sort.field, sort: sort.direction }],
    [sort],
  );

  // Scroll preservation across back-navigation: the virtual scroller's
  // position is captured on unmount and restored after first paint.
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = containerRef.current?.querySelector('.MuiDataGrid-virtualScroller');
    if (node instanceof HTMLElement) {
      const t = setTimeout(() => { node.scrollTop = savedScrollTop; }, 0);
      return () => {
        clearTimeout(t);
        dispatch(explorerScrollSaved(node.scrollTop));
      };
    }
    return undefined;
    // Restore once on mount; savedScrollTop is intentionally not reactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  return (
    <Box ref={containerRef} sx={{ height: 'calc(100vh - 180px)', minHeight: 480 }}>
      <DataGrid<Occurrence>
        rows={rows}
        columns={columns}
        getRowId={(r) => r.id}
        density="compact"
        disableRowSelectionOnClick
        disableColumnMenu
        // Sorting is owned by data/selectors.ts (memoized, catalog-aware) —
        // the grid just reports intent.
        sortingMode="server"
        sortModel={sortModel}
        onSortModelChange={(m) => {
          const first = m[0];
          if (first !== undefined && first.sort != null && SORTABLE.has(first.field)) {
            dispatch(sortSet({ field: first.field, direction: first.sort }));
          }
        }}
        pagination
        paginationModel={{ page, pageSize }}
        onPaginationModelChange={(m: GridPaginationModel) => {
          if (m.pageSize !== pageSize) dispatch(pageSizeSet(m.pageSize));
          else if (m.page !== page) dispatch(pageSet(m.page));
        }}
        pageSizeOptions={[25, 50, 100]}
        onRowClick={(p) => { void navigate(`/cve/${(p.row as Occurrence).cve}`); }}
        slots={{
          noRowsOverlay: () => (
            <EmptyState title="No matching occurrences" description="Try removing a filter." />
          ),
        }}
        sx={{
          border: 1,
          borderColor: 'divider',
          '& .MuiDataGrid-row': { cursor: 'pointer' },
          '& .MuiDataGrid-cell': { display: 'flex', alignItems: 'center' },
        }}
        aria-label="Vulnerability occurrences"
      />
    </Box>
  );
}
