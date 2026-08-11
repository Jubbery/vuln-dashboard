/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunks: app-code changes don't invalidate the cached
        // MUI/D3/React bundles (email spec: code splitting).
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom', 'react-redux', '@reduxjs/toolkit'],
          mui: ['@mui/material', '@mui/icons-material'],
          datagrid: ['@mui/x-data-grid'],
          d3: ['d3'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: [],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
