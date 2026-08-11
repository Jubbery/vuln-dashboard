import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import type { ReactNode } from 'react';
import { Breadcrumbs } from './Breadcrumbs.tsx';
import { useDataset } from '../../data/useDataset.ts';
import { useAppDispatch, useAppSelector } from '../../store/index.ts';
import { themeModeToggled } from '../../store/uiSlice.ts';
import { ScanFilePicker } from '../primitives/ScanFilePicker.tsx';
import { formatBytes } from '../../utils/format.ts';

interface HeaderProps {
  showMenuButton: boolean;
  onMenuClick: () => void;
}

export function Header({ showMenuButton, onMenuClick }: HeaderProps): ReactNode {
  const { diagnostics } = useDataset();
  const dispatch = useAppDispatch();
  const mode = useAppSelector((s) => s.ui.themeMode);
  return (
    <AppBar position="sticky" color="transparent">
      <Toolbar variant="dense" sx={{ gap: 1.5, minHeight: 52 }}>
        {showMenuButton && (
          <IconButton edge="start" aria-label="open navigation" onClick={onMenuClick} size="small">
            <MenuIcon fontSize="small" />
          </IconButton>
        )}
        <Breadcrumbs />
        <Box sx={{ flex: 1 }} />
        <Tooltip title={mode === 'dark' ? 'Switch to light (enterprise) theme' : 'Switch to dark (console) theme'}>
          <IconButton
            size="small"
            aria-label={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            onClick={() => dispatch(themeModeToggled())}
          >
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <ScanFilePicker variant="icon" />
        {diagnostics.truncated && (
          <Tooltip title={`Source file is truncated: one partial record (${formatBytes(diagnostics.unparsedTailBytes)}, ${diagnostics.partialTailPath ?? 'unknown'}) was discarded during ingestion.`}>
            {/* tabIndex so keyboard users can reach the tooltip too */}
            <Box tabIndex={0} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'severity.medium' }}>
              <WarningAmberIcon sx={{ fontSize: 18 }} />
              <Typography variant="caption" sx={{ display: { xs: 'none', lg: 'inline' } }}>
                truncated source
              </Typography>
            </Box>
          </Tooltip>
        )}
      </Toolbar>
    </AppBar>
  );
}
