import { createBrowserRouter } from 'react-router-dom';
import { DashboardLayout } from './components/layout/DashboardLayout.tsx';
import OverviewPage from './pages/OverviewPage.tsx';
import ExplorerPage from './pages/ExplorerPage.tsx';
import GroupPage from './pages/GroupPage.tsx';
import RepoPage from './pages/RepoPage.tsx';
import ImageDetailPage from './pages/ImageDetailPage.tsx';
import CveDetailPage from './pages/CveDetailPage.tsx';
import ComparePage from './pages/ComparePage.tsx';
import NotFoundPage from './pages/NotFoundPage.tsx';

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
