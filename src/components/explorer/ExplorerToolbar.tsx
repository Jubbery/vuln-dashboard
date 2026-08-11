import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';
import DownloadIcon from '@mui/icons-material/Download';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import DensitySmallIcon from '@mui/icons-material/DensitySmall';
import DensityMediumIcon from '@mui/icons-material/DensityMedium';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { alpha, useTheme } from '@mui/material/styles';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Occurrence } from '../../types/vulnerability.ts';
import type { TopRisk } from '../../data/selectors.ts';
import { useDataset } from '../../data/useDataset.ts';
import { useAppDispatch, useAppSelector } from '../../store/index.ts';
import {
  gridDensitySet, compareToggled, compareCleared,
  columnVisibilityToggled, columnMoved, columnsReset,
  type GridDensity,
} from '../../store/uiSlice.ts';
import { exportRows } from '../../utils/exportRows.ts';
import { formatNumber } from '../../utils/format.ts';

/**
 * Toolbar row between the action buttons and the grid:
 * - "Highest risks in view" — the email spec's post-filter critical
 *   highlighting. Recomputed per filter change; exploited CVEs burn.
 * - Compare tray (chips + go) once CVEs are staged from the grid.
 * - Export of the current view (CSV/JSON) and density preference.
 */
const COLUMN_LABELS: Record<string, string> = {
  severity: 'Severity',
  cve: 'CVE',
  cvss: 'CVSS',
  packageName: 'Package',
  packageVersion: 'Version',
  packageType: 'Type',
  image: 'Image',
  fixDate: 'Fix date',
  kaiStatus: 'Triage',
};

/** Show/hide + reorder for the customizable grid columns, persisted with the
 *  rest of the dashboard preferences. Community-tier DataGrid has no drag
 *  reorder, so ordering is explicit up/down controls in the same menu. */
function ColumnsMenu(): ReactNode {
  const dispatch = useAppDispatch();
  const columns = useAppSelector((s) => s.ui.columns);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const customized = columns.hidden.length > 0;

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<ViewColumnIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
      >
        Columns{customized ? ` (${columns.order.length - columns.hidden.length})` : ''}
      </Button>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        {columns.order.map((field, i) => {
          const visible = !columns.hidden.includes(field);
          return (
            <MenuItem key={field} dense sx={{ pr: 1 }} onClick={() => dispatch(columnVisibilityToggled(field))}>
              <Checkbox
                size="small"
                checked={visible}
                disableRipple
                sx={{ p: 0.5, mr: 1 }}
                inputProps={{ 'aria-label': `${visible ? 'Hide' : 'Show'} ${COLUMN_LABELS[field] ?? field} column` }}
              />
              <ListItemText primaryTypographyProps={{ variant: 'body2' }} sx={{ mr: 2 }}>
                {COLUMN_LABELS[field] ?? field}
              </ListItemText>
              <IconButton
                size="small"
                disabled={i === 0}
                aria-label={`Move ${COLUMN_LABELS[field] ?? field} column left`}
                onClick={(e) => { e.stopPropagation(); dispatch(columnMoved({ field, dir: -1 })); }}
              >
                <ArrowUpwardIcon sx={{ fontSize: 15 }} />
              </IconButton>
              <IconButton
                size="small"
                disabled={i === columns.order.length - 1}
                aria-label={`Move ${COLUMN_LABELS[field] ?? field} column right`}
                onClick={(e) => { e.stopPropagation(); dispatch(columnMoved({ field, dir: 1 })); }}
              >
                <ArrowDownwardIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </MenuItem>
          );
        })}
        <Divider />
        <MenuItem dense onClick={() => dispatch(columnsReset())}>
          <ListItemText primaryTypographyProps={{ variant: 'body2' }}>Reset to defaults</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

export function ExplorerToolbar({ topRisks, rows }: { topRisks: TopRisk[]; rows: Occurrence[] }): ReactNode {
  const theme = useTheme();
  const dataset = useDataset();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const density = useAppSelector((s) => s.ui.gridDensity);
  const compareCves = useAppSelector((s) => s.ui.compareCves);
  const [exportAnchor, setExportAnchor] = useState<HTMLElement | null>(null);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
      {topRisks.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Tooltip title="Most dangerous distinct CVEs matching the current filters: actively exploited first, then severity, then CVSS">
            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <WhatshotIcon sx={{ fontSize: 16, color: theme.palette.severity.critical }} />
              fix first:
            </Typography>
          </Tooltip>
          {topRisks.map((r) => (
            <Chip
              key={r.cve}
              size="small"
              onClick={() => { void navigate(`/cve/${r.cve}`); }}
              label={`${r.cve} · ${r.cvss.toFixed(1)}${r.exploited ? ' · exploited' : ''}`}
              sx={{
                fontWeight: 600,
                color: theme.palette.severity[r.severity],
                backgroundColor: alpha(theme.palette.severity[r.severity], 0.12),
                border: `1px solid ${alpha(theme.palette.severity[r.severity], r.exploited ? 0.9 : 0.4)}`,
                ...(r.exploited && {
                  animation: 'riskPulse 2s ease-in-out infinite',
                  '@keyframes riskPulse': {
                    '0%, 100%': { boxShadow: `0 0 0 0 ${alpha(theme.palette.severity.critical, 0)}` },
                    '50%': { boxShadow: `0 0 8px 1px ${alpha(theme.palette.severity.critical, 0.5)}` },
                  },
                }),
              }}
            />
          ))}
        </Box>
      )}

      <Box sx={{ flex: 1 }} />

      {/* Controls wrap as one unit so no single button strands on its own
          row (design audit: the Export button used to orphan-wrap). */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto', flexWrap: 'wrap' }}>
      {compareCves.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
          {compareCves.map((cve) => (
            <Chip
              key={cve}
              size="small"
              label={cve}
              onDelete={() => dispatch(compareToggled(cve))}
            />
          ))}
          <Button
            size="small"
            variant="outlined"
            startIcon={<CompareArrowsIcon />}
            disabled={compareCves.length < 2}
            onClick={() => { void navigate('/compare'); }}
          >
            Compare
          </Button>
          <Button size="small" onClick={() => dispatch(compareCleared())}>Clear</Button>
        </Box>
      )}

      <ColumnsMenu />

      <ToggleButtonGroup
        exclusive
        size="small"
        value={density}
        onChange={(_, v: GridDensity | null) => { if (v !== null) dispatch(gridDensitySet(v)); }}
        aria-label="Row density"
      >
        <ToggleButton value="compact" aria-label="Compact rows">
          <Tooltip title="Compact rows"><DensitySmallIcon fontSize="small" /></Tooltip>
        </ToggleButton>
        <ToggleButton value="standard" aria-label="Comfortable rows">
          <Tooltip title="Comfortable rows"><DensityMediumIcon fontSize="small" /></Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>

      <Button
        size="small"
        variant="outlined"
        startIcon={<DownloadIcon />}
        onClick={(e) => setExportAnchor(e.currentTarget)}
        aria-haspopup="menu"
      >
        Export {formatNumber(rows.length)}
      </Button>
      <Menu anchorEl={exportAnchor} open={exportAnchor !== null} onClose={() => setExportAnchor(null)}>
        <MenuItem onClick={() => { exportRows(rows, dataset, 'csv'); setExportAnchor(null); }}>
          CSV — current view
        </MenuItem>
        <MenuItem onClick={() => { exportRows(rows, dataset, 'json'); setExportAnchor(null); }}>
          JSON — current view
        </MenuItem>
      </Menu>
      </Box>
    </Box>
  );
}
