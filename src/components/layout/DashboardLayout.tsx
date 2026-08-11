import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { Outlet } from 'react-router-dom';
import { Suspense, type ReactNode } from 'react';
import { Sidebar } from './Sidebar.tsx';
import { Header } from './Header.tsx';
import { LoadingState } from '../primitives/LoadingState.tsx';
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
      {/* Keyboard users skip the sidebar's group list (Phase 6 a11y). */}
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          left: -9999,
          zIndex: (t) => t.zIndex.tooltip,
          '&:focus-visible': {
            left: 12,
            top: 10,
            px: 2,
            py: 0.75,
            bgcolor: 'primary.main',
            color: '#0e1218',
            borderRadius: 1,
            fontWeight: 600,
            textDecoration: 'none',
          },
        }}
      >
        Skip to content
      </Box>
      <Sidebar
        variant={isDesktop ? 'permanent' : 'temporary'}
        open={sidebarOpen}
        onClose={() => dispatch(sidebarClosed())}
      />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Header showMenuButton={!isDesktop} onMenuClick={() => dispatch(sidebarToggled())} />
        <Box component="main" id="main-content" tabIndex={-1} sx={{ flex: 1, p: { xs: 2, md: 3 }, minWidth: 0, outline: 'none' }}>
          {/* Route chunks are lazy (router.tsx); one boundary covers them all. */}
          <Suspense fallback={<LoadingState label="Loading view…" />}>
            <Outlet />
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
}
