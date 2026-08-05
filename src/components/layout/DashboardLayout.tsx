import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar.tsx';
import { Header } from './Header.tsx';
import { useAppDispatch, useAppSelector } from '../../store/index.ts';
import { sidebarToggled, sidebarClosed } from '../../store/uiSlice.ts';

/**
 * Responsive frame. Sidebar is permanent ≥900px (covers the 1920/1440
 * targets) and a temporary drawer below (covers the 834px tablet target).
 */
export function DashboardLayout(): ReactNode {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);
  const dispatch = useAppDispatch();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        variant={isDesktop ? 'permanent' : 'temporary'}
        open={sidebarOpen}
        onClose={() => dispatch(sidebarClosed())}
      />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header showMenuButton={!isDesktop} onMenuClick={() => dispatch(sidebarToggled())} />
        <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 }, minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
