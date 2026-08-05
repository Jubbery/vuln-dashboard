import MuiBreadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useDataset } from '../../data/useDataset.ts';

interface Crumb {
  label: string;
  to?: string;
}

/** Builds crumbs from the pathname + interned name tables. */
export function Breadcrumbs(): ReactNode {
  const dataset = useDataset();
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);

  const crumbs: Crumb[] = [{ label: 'Overview', to: '/' }];

  if (parts[0] === 'explorer') {
    crumbs.push({ label: 'Explorer' });
  } else if (parts[0] === 'groups' && parts[1] !== undefined) {
    const groupId = Number(parts[1]);
    const groupName = dataset.groupNames[groupId] ?? `group ${parts[1]}`;
    if (parts[2] === 'repos' && parts[3] !== undefined) {
      const repoId = Number(parts[3]);
      crumbs.push({ label: groupName, to: `/groups/${groupId}` });
      crumbs.push({ label: dataset.repoNames[repoId] ?? `repo ${parts[3]}` });
    } else {
      crumbs.push({ label: groupName });
    }
  } else if (parts[0] === 'images' && parts[1] !== undefined) {
    const img = dataset.imageMeta[Number(parts[1])];
    if (img !== undefined) {
      const groupName = dataset.groupNames[img.groupId] ?? '';
      const repoName = dataset.repoNames[img.repoId] ?? '';
      crumbs.push({ label: groupName, to: `/groups/${img.groupId}` });
      crumbs.push({ label: repoName, to: `/groups/${img.groupId}/repos/${img.repoId}` });
      crumbs.push({ label: img.version });
    } else {
      crumbs.push({ label: 'Image' });
    }
  } else if (parts[0] === 'cve' && parts[1] !== undefined) {
    crumbs.push({ label: 'Explorer', to: '/explorer' });
    crumbs.push({ label: parts[1] });
  }

  return (
    <MuiBreadcrumbs aria-label="breadcrumb" sx={{ '& .MuiBreadcrumbs-separator': { mx: 0.75 } }}>
      {crumbs.map((c, i) =>
        c.to !== undefined && i < crumbs.length - 1 ? (
          <Link key={i} component={RouterLink} to={c.to} underline="hover" color="text.secondary" variant="body2">
            {c.label}
          </Link>
        ) : (
          <Typography key={i} variant="body2" color="text.primary" sx={{ maxWidth: 320 }} noWrap>
            {c.label}
          </Typography>
        ),
      )}
    </MuiBreadcrumbs>
  );
}
