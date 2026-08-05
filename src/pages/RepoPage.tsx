import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useMemo, type ReactNode } from 'react';
import { useDataset } from '../data/useDataset.ts';
import { EmptyState } from '../components/primitives/EmptyState.tsx';
import { formatDate } from '../utils/format.ts';

/** Phase 4 adds per-image severity breakdowns. */
export default function RepoPage(): ReactNode {
  const { groupId: groupIdParam, repoId: repoIdParam } = useParams();
  const dataset = useDataset();
  const groupId = Number(groupIdParam);
  const repoId = Number(repoIdParam);
  const repoName = dataset.repoNames[repoId];

  const images = useMemo(
    () => dataset.imageMeta.filter((img) => img.groupId === groupId && img.repoId === repoId),
    [dataset, groupId, repoId],
  );

  if (repoName === undefined || dataset.groupNames[groupId] === undefined) {
    return <EmptyState title="Repo not found" description="This group/repo combination doesn't exist." />;
  }

  return (
    <Box>
      <Typography variant="h1" gutterBottom>{repoName}</Typography>
      <Paper>
        <List dense>
          {images.map((img) => (
            <ListItemButton key={img.id} component={RouterLink} to={`/images/${img.id}`}>
              <ListItemText primary={img.version} secondary={`built ${formatDate(img.createTime)} · ${img.buildType}`} />
            </ListItemButton>
          ))}
        </List>
      </Paper>
    </Box>
  );
}
