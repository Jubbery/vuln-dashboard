import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import ButtonBase from '@mui/material/ButtonBase';
import { useParams, useNavigate } from 'react-router-dom';
import { useMemo, type ReactNode } from 'react';
import { useDataset } from '../data/useDataset.ts';
import { rollupReposInGroup } from '../data/selectors.ts';
import { EmptyState } from '../components/primitives/EmptyState.tsx';
import { SeverityBadge } from '../components/primitives/SeverityBadge.tsx';
import { SeverityStackedBar } from '../components/primitives/SeverityStackedBar.tsx';
import { SEVERITY_ORDER } from '../theme/severity.ts';
import { formatNumber } from '../utils/format.ts';

export default function GroupPage(): ReactNode {
  const { groupId: groupIdParam } = useParams();
  const dataset = useDataset();
  const navigate = useNavigate();
  const groupId = Number(groupIdParam);
  const groupName = dataset.groupNames[groupId];

  const repos = useMemo(() => rollupReposInGroup(dataset, groupId), [dataset, groupId]);
  // Bars scale to the worst repo so length encodes magnitude and segments
  // encode composition — full-width bars would all look equally bad.
  const maxTotal = useMemo(() => Math.max(1, ...repos.map((r) => r.total)), [repos]);

  if (groupName === undefined) {
    return <EmptyState title="Group not found" description={`No group with id "${groupIdParam ?? ''}".`} />;
  }

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="baseline" sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <Typography variant="h1">{groupName}</Typography>
        <Typography variant="body2" color="text.secondary">
          {formatNumber(repos.length)} repos, ordered by weighted risk
        </Typography>
      </Stack>
      <Stack spacing={1.25}>
        {repos.map((r) => (
          <ButtonBase
            key={r.repoId}
            onClick={() => { void navigate(`/groups/${groupId}/repos/${r.repoId}`); }}
            sx={{ display: 'block', textAlign: 'inherit', borderRadius: 2.5 }}
          >
            <Paper sx={{ p: 2, '&:hover': { borderColor: 'primary.main' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h3" sx={{ flex: 1, minWidth: 200 }} noWrap>
                  {dataset.repoNames[r.repoId] ?? `repo ${r.repoId}`}
                </Typography>
                <Typography variant="caption">
                  {r.imageCount} image{r.imageCount === 1 ? '' : 's'} · {formatNumber(r.total)} findings
                </Typography>
                <Stack direction="row" spacing={0.75}>
                  {SEVERITY_ORDER.filter((s) => r.counts[s] > 0 && s !== 'unknown').map((s) => (
                    <SeverityBadge key={s} severity={s} count={r.counts[s]} />
                  ))}
                </Stack>
              </Box>
              <Box sx={{ mt: 1.5, width: `${(r.total / maxTotal) * 100}%`, minWidth: 40, transition: 'width 300ms ease' }}>
                <SeverityStackedBar counts={r.counts} />
              </Box>
            </Paper>
          </ButtonBase>
        ))}
      </Stack>
    </Box>
  );
}
