import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { useMemo, type ReactNode } from 'react';
import { useDataset } from '../data/useDataset.ts';
import { packagesForImage } from '../data/selectors.ts';
import { EmptyState } from '../components/primitives/EmptyState.tsx';
import { SeverityBadge } from '../components/primitives/SeverityBadge.tsx';
import { CvssScoreBar } from '../components/primitives/CvssScoreBar.tsx';
import { SeverityStackedBar } from '../components/primitives/SeverityStackedBar.tsx';
import { formatDate, formatNumber } from '../utils/format.ts';

export default function ImageDetailPage(): ReactNode {
  const { imageId: imageIdParam } = useParams();
  const dataset = useDataset();
  const imageId = Number(imageIdParam);
  const img = dataset.imageMeta[imageId];

  const packages = useMemo(() => packagesForImage(dataset, imageId), [dataset, imageId]);
  const totalFindings = useMemo(() => packages.reduce((s, p) => s + p.rows.length, 0), [packages]);

  if (img === undefined) {
    return <EmptyState title="Image not found" description={`No image with id "${imageIdParam ?? ''}".`} />;
  }

  return (
    <Box>
      <Typography variant="h1" gutterBottom sx={{ wordBreak: 'break-all' }}>{img.name}</Typography>

      <Paper sx={{ p: 2.5, mb: 2.5 }}>
        <Typography variant="body2" color="text.secondary" component="div" sx={{ lineHeight: 2 }}>
          version <strong>{img.version}</strong> · {img.buildType} · built {formatDate(img.createTime)}
          <br />base: {img.baseImage}
          <br />maintainer: {img.maintainer}
          <br />{formatNumber(totalFindings)} findings across {formatNumber(packages.length)} packages
        </Typography>
      </Paper>

      {packages.length === 0 ? (
        <EmptyState title="No vulnerabilities" description="This image has no recorded findings." />
      ) : (
        <Box>
          {packages.map((pkg) => (
            <Accordion key={pkg.key} disableGutters slotProps={{ transition: { unmountOnExit: true } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', pr: 2, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
                    {pkg.packageName}
                    <Typography component="span" variant="caption" sx={{ ml: 1 }}>
                      {pkg.packageVersion} · {pkg.packageType}
                    </Typography>
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Typography variant="caption">{pkg.rows.length}</Typography>
                  <Box sx={{ width: 140, flexShrink: 0 }}>
                    <SeverityStackedBar counts={pkg.rollup.counts} height={6} />
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <Table size="small" aria-label={`Vulnerabilities in ${pkg.packageName}`}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 110 }}>Severity</TableCell>
                      <TableCell sx={{ width: 170 }}>CVE</TableCell>
                      <TableCell sx={{ width: 140 }}>CVSS</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell sx={{ width: 110 }}>Fix date</TableCell>
                      <TableCell sx={{ width: 100 }}>Triage</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pkg.rows.map((o) => (
                      <TableRow key={o.id} hover>
                        <TableCell><SeverityBadge severity={o.severity} /></TableCell>
                        <TableCell>
                          <Link component={RouterLink} to={`/cve/${o.cve}`} underline="hover">
                            {o.cve}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <CvssScoreBar score={dataset.cveCatalog.get(o.cve)?.cvss ?? 0} width={48} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{o.status || '—'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{formatDate(o.fixDate)}</Typography>
                        </TableCell>
                        <TableCell>
                          {o.kaiStatus !== null && (
                            <Chip size="small" variant="outlined" label="dismissed" title={o.kaiStatus} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </Box>
  );
}
