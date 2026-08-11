import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useRef, type ReactNode } from 'react';
import { useDatasetControl } from '../../data/DatasetProvider.tsx';

export interface ScanFilePickerProps {
  /** 'button' for gate screens, 'icon' for the header. */
  variant?: 'button' | 'icon';
  label?: string;
}

/**
 * Load a scan JSON straight from disk. The File's stream feeds the exact
 * same worker pipeline as the fetched copy, so the deployed sample build can
 * ingest the full 270MB scan entirely client-side — nothing is uploaded
 * anywhere; the browser reads the file locally.
 */
export function ScanFilePicker({ variant = 'button', label = 'Load scan file…' }: ScanFilePickerProps): ReactNode {
  const { loadFile } = useDatasetControl();
  const inputRef = useRef<HTMLInputElement>(null);

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".json,application/json"
      hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file !== undefined) loadFile(file);
        e.target.value = ''; // allow re-selecting the same file
      }}
    />
  );

  if (variant === 'icon') {
    return (
      <>
        <Tooltip title="Load a different scan file (processed locally — nothing is uploaded)">
          <IconButton size="small" aria-label="Load scan file" onClick={() => inputRef.current?.click()}>
            <UploadFileIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {input}
      </>
    );
  }

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<UploadFileIcon />}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </Button>
      {input}
    </>
  );
}
