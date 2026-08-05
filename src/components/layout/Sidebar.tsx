import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import DashboardIcon from '@mui/icons-material/Dashboard';
import TableRowsIcon from '@mui/icons-material/TableRows';
import FolderIcon from '@mui/icons-material/Folder';
import GppMaybeIcon from '@mui/icons-material/GppMaybe';
import { NavLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useDataset } from '../../data/useDataset.ts';
import { formatNumber } from '../../utils/format.ts';

export const SIDEBAR_WIDTH = 248;

interface SidebarProps {
  /** Permanent on desktop; temporary drawer on tablet. */
  variant: 'permanent' | 'temporary';
  open: boolean;
  onClose: () => void;
}

function NavItem({ to, icon, label, end }: { to: string; icon: ReactNode; label: string; end?: boolean }): ReactNode {
  const { pathname } = useLocation();
  const selected = end === true ? pathname === to : pathname.startsWith(to);
  return (
    <ListItemButton component={NavLink} to={to} selected={selected} sx={{ borderRadius: 2, mx: 1 }}>
      <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
      <ListItemText primary={label} primaryTypographyProps={{ variant: 'body2', noWrap: true }} />
    </ListItemButton>
  );
}

export function Sidebar({ variant, open, onClose }: SidebarProps): ReactNode {
  const dataset = useDataset();
  const { totals } = dataset.aggregates;

  const content = (
    <Box sx={{ width: SIDEBAR_WIDTH, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <GppMaybeIcon color="primary" />
        <Typography variant="h3" component="span">Vuln Dashboard</Typography>
      </Box>
      <Divider />
      <List sx={{ flex: 1, overflowY: 'auto' }} onClick={variant === 'temporary' ? onClose : undefined}>
        <NavItem to="/" icon={<DashboardIcon fontSize="small" />} label="Overview" end />
        <NavItem to="/explorer" icon={<TableRowsIcon fontSize="small" />} label="Explorer" />
        <ListSubheader sx={{ background: 'transparent', lineHeight: 2.5, mt: 1 }}>Groups</ListSubheader>
        {dataset.groupNames.map((name, id) => (
          <NavItem key={name} to={`/groups/${id}`} icon={<FolderIcon fontSize="small" />} label={name} />
        ))}
      </List>
      <Divider />
      <Box sx={{ px: 2.5, py: 1.5 }}>
        <Typography variant="caption" component="div">
          {formatNumber(totals.occurrences)} occurrences · {formatNumber(totals.uniqueCves)} CVEs
        </Typography>
        {dataset.diagnostics.truncated && (
          <Typography variant="caption" component="div" sx={{ color: 'severity.medium' }}>
            source file truncated — 1 record discarded
          </Typography>
        )}
      </Box>
    </Box>
  );

  if (variant === 'permanent') {
    return (
      <Drawer variant="permanent" sx={{
        width: SIDEBAR_WIDTH, flexShrink: 0,
        '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH, boxSizing: 'border-box', borderRight: 1, borderColor: 'divider' },
      }}>
        {content}
      </Drawer>
    );
  }
  return (
    <Drawer variant="temporary" open={open} onClose={onClose} ModalProps={{ keepMounted: true }}>
      {content}
    </Drawer>
  );
}
