import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout.tsx';

// Route-level code splitting (email spec: lazy loading). The Overview stays
// eager — it's the landing route and would lazy-load immediately anyway; every
// other page ships as its own chunk fetched on first navigation. DataGrid
// (the heaviest dependency) leaves the initial bundle with the Explorer.
import OverviewPage from './pages/OverviewPage.tsx';
const ExplorerPage = lazy(() => import('./pages/ExplorerPage.tsx'));
const GroupPage = lazy(() => import('./pages/GroupPage.tsx'));
const RepoPage = lazy(() => import('./pages/RepoPage.tsx'));
const ImageDetailPage = lazy(() => import('./pages/ImageDetailPage.tsx'));
const CveDetailPage = lazy(() => import('./pages/CveDetailPage.tsx'));
const ComparePage = lazy(() => import('./pages/ComparePage.tsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.tsx'));

/** Data-router API (§ stack requirement). Mounted only after ingestion. */
export const router = createBrowserRouter([
  {
    element: <DashboardLayout />,
    children: [
      { path: '/', element: <OverviewPage /> },
      { path: '/explorer', element: <ExplorerPage /> },
      { path: '/groups/:groupId', element: <GroupPage /> },
      { path: '/groups/:groupId/repos/:repoId', element: <RepoPage /> },
      { path: '/images/:imageId', element: <ImageDetailPage /> },
      { path: '/cve/:cveId', element: <CveDetailPage /> },
      { path: '/compare', element: <ComparePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
], {
  // Opt in to v7 behaviors — silences upgrade warnings, keeps console clean.
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});
