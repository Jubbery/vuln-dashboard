import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useDataset } from '../data/useDataset.ts';
import { EmptyState } from '../components/primitives/EmptyState.tsx';
import { formatDate } from '../utils/format.ts';

/** Phase 4 adds the vulnerabilities-grouped-by-package view. */
export default function ImageDetailPage(): ReactNode {
  const { imageId } = useParams();
  const dataset = useDataset();
  const img = dataset.imageMeta[Number(imageId)];

  if (img === undefined) {
    return <EmptyState title="Image not found" description={`No image with id "${imageId ?? ''}".`} />;
  }

  return (
    <Box>
      <Typography variant="h1" gutterBottom sx={{ wordBreak: 'break-all' }}>{img.name}</Typography>
      <Paper sx={{ p: 2.5 }}>
        <Typography variant="body2" color="text.secondary" component="div" sx={{ lineHeight: 2 }}>
          version {img.version} · {img.buildType} · built {formatDate(img.createTime)}
          <br />base: {img.baseImage}
          <br />maintainer: {img.maintainer}
        </Typography>
      </Paper>
    </Box>
  );
}
