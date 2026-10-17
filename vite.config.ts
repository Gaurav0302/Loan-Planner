import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** Stamps the offline worker with a build id, so each release replaces the previous cache. */
function stampServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'stamp-service-worker',
    apply: 'build',
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() {
      const file = resolve(outDir, 'sw.js');
      writeFileSync(file, readFileSync(file, 'utf8').replace(/__BUILD_ID__/g, Date.now().toString(36)));
    },
  };
}

// Relative base so the build works under GitHub Pages' /Loan-Planner/ path and locally.
export default defineConfig({
  base: './',
  plugins: [react(), stampServiceWorker()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
