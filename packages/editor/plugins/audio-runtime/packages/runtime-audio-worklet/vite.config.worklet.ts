import path from 'node:path';
import { createWorkerLibConfig } from '@8f4e/config/vite';
import { defineConfig } from 'vite';

// Build worklet bundle into a dedicated subfolder so tsc doesn't overwrite it.
export default defineConfig(createWorkerLibConfig(path.resolve(__dirname, 'src/index.ts'), 'dist/worklet'));
