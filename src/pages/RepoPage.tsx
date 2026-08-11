import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import ButtonBase from '@mui/material/ButtonBase';
import { useParams, useNavigate } from 'react-router-dom';
import { useMemo, type ReactNode } from 'react';
import { useDataset } from '../data/useDataset.ts';
import { rollupImagesInRepo } from '../data/selectors.ts';
import { EmptyState } from '../components/primitives/EmptyState.tsx';
import { SeverityBadge } from '../components/primitives/SeverityBadge.tsx';
import { SeverityStackedBar } from '../components/primitives/SeverityStackedBar.tsx';
import { SEVERITY_ORDER } from '../theme/severity.ts';
import { formatDate, formatNumber } from '../utils/format.ts';

export default function RepoPage(): ReactNode {
  const { groupId: groupIdParam, repoId: repoIdParam } = useParams();
  const dataset = useDataset();
  const navigate = useNavigate();
  const groupId = Number(groupIdParam);
  const repoId = Number(repoIdParam);
  const repoName = dataset.repoNames[repoId];

  const images = useMemo(
    () => rollupImagesInRepo(dataset, groupId, repoId),
    [dataset, groupId, repoId],
  );
  // Length = magnitude vs the worst image; segments = composition.
  const maxTotal = useMemo(() => Math.max(1, ...images.map((r) => r.total)), [images]);

  if (repoName === undefined || dataset.groupNames[groupId] === undefined) {
    return <EmptyState title="Repo not found" description="This group/repo combination doesn't exist." />;
  }

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="baseline" sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <Typography variant="h1">{repoName}</Typography>
        <Typography variant="body2" color="text.secondary">
          {images.length} image version{images.length === 1 ? '' : 's'}, riskiest first
        </Typography>
      </Stack>
      <Stack spacing={1.25}>
        {images.map((r) => {
          const img = dataset.imageMeta[r.imageId];
          if (img === undefined) return null;
          return (
            <ButtonBase
              key={r.imageId}
              onClick={() => { void navigate(`/images/${r.imageId}`); }}
              sx={{ display: 'block', textAlign: 'inherit', borderRadius: 2.5 }}
            >
              <Paper sx={{ p: 2, '&:hover': { borderColor: 'primary.main' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Typography variant="h3" sx={{ minWidth: 90 }}>{img.version}</Typography>
                  <Typography variant="caption" sx={{ flex: 1, minWidth: 160 }}>
                    {img.buildType} · built {formatDate(img.createTime)} · {formatNumber(r.total)} findings
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
          );
        })}
      </Stack>
    </Box>
  );
}
