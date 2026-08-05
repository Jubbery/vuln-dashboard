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

/** Phase 4 adds rolled-up severity counts per repo. */
export default function GroupPage(): ReactNode {
  const { groupId: groupIdParam } = useParams();
  const dataset = useDataset();
  const groupId = Number(groupIdParam);
  const groupName = dataset.groupNames[groupId];

  const repoIds = useMemo(() => {
    const ids = new Set<number>();
    for (const img of dataset.imageMeta) {
      if (img.groupId === groupId) ids.add(img.repoId);
    }
    return [...ids].sort((a, b) =>
      (dataset.repoNames[a] ?? '').localeCompare(dataset.repoNames[b] ?? ''));
  }, [dataset, groupId]);

  if (groupName === undefined) {
    return <EmptyState title="Group not found" description={`No group with id "${groupIdParam ?? ''}".`} />;
  }

  return (
    <Box>
      <Typography variant="h1" gutterBottom>{groupName}</Typography>
      <Paper>
        <List dense>
          {repoIds.map((id) => (
            <ListItemButton key={id} component={RouterLink} to={`/groups/${groupId}/repos/${id}`}>
              <ListItemText primary={dataset.repoNames[id] ?? `repo ${id}`} />
            </ListItemButton>
          ))}
        </List>
      </Paper>
    </Box>
  );
}
