/**
 * @8f4e/config - Centralized tooling configuration for the 8f4e workspace
 *
 * This package provides shared configuration helpers for:
 * - TypeScript (@8f4e/config/ts)
 * - Vitest (@8f4e/config/vitest)
 * - Vite (@8f4e/config/vite)
 *
 * Packages should import from the specific subpath they need:
 * ```ts
 * import { baseCompilerOptions, libBuildOptions, libs } from '@8f4e/config/ts';
 * import { createNodePreset, createJsdomPreset } from '@8f4e/config/vitest';
 * import { createLibConfig, createEsLibConfig } from '@8f4e/config/vite';
 * ```
 */

export * from './ts/index.js';
export * from './vite/index.js';
export * from './vitest/index.js';
