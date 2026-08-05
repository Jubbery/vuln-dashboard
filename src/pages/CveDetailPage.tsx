import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Link from '@mui/material/Link';
import { useParams } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useDataset } from '../data/useDataset.ts';
import { EmptyState } from '../components/primitives/EmptyState.tsx';
import { SeverityBadge } from '../components/primitives/SeverityBadge.tsx';
import { CvssScoreBar } from '../components/primitives/CvssScoreBar.tsx';
import { RiskFactorChip } from '../components/primitives/RiskFactorChip.tsx';
import { formatDate, formatNumber } from '../utils/format.ts';

/**
 * The cross-cutting view the deduped catalog makes cheap: one Map lookup for
 * metadata. Phase 4 adds the every-occurrence table.
 */
export default function CveDetailPage(): ReactNode {
  const { cveId } = useParams();
  const dataset = useDataset();
  const meta = cveId !== undefined ? dataset.cveCatalog.get(cveId) : undefined;

  if (meta === undefined) {
    return <EmptyState title="CVE not found" description={`"${cveId ?? ''}" is not in the catalog.`} />;
  }

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <Typography variant="h1">{meta.cve}</Typography>
        <SeverityBadge severity={meta.severity} />
        <CvssScoreBar score={meta.cvss} />
      </Stack>
      <Paper sx={{ p: 2.5 }}>
        <Typography variant="body2" sx={{ mb: 2, maxWidth: 760 }}>{meta.description}</Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
          {meta.riskFactors.map((rf) => <RiskFactorChip key={rf} label={rf} />)}
        </Stack>
        <Typography variant="caption" component="div">
          published {formatDate(meta.published)} · {formatNumber(meta.occurrenceCount)} occurrences
          {' · '}
          <Link href={meta.link} target="_blank" rel="noreferrer">NVD entry</Link>
        </Typography>
      </Paper>
    </Box>
  );
}
