/**
 * @8f4e/config/vitest - Shared Vitest configuration helpers
 *
 * This module provides factory functions for creating Vitest configurations
 * with shared defaults. Packages can customize only what differs from the shared
 * baseline (environment, include patterns, aliases, etc.).
 */

import type { ViteUserConfig } from 'vitest/config';
import type { InlineConfig } from 'vitest/node';

/**
 * Shared coverage configuration used by all packages.
 */
export const sharedCoverage = {
	provider: 'v8' as const,
	reporter: ['text', 'json', 'json-summary', 'html'],
	exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.{test,spec}.ts'],
};

/**
 * Base test configuration shared across all packages.
 */
export const sharedTestConfig = {
	globals: false,
	testTimeout: 30000,
	hookTimeout: 10000,
	coverage: sharedCoverage,
	exclude: ['**/node_modules/**', '**/dist/**'],
};

/**
 * CI-aware reporters configuration.
 * Returns appropriate reporters based on whether we're running in CI.
 */
export const getReporters = (): InlineConfig['reporters'] => {
	if (process.env.CI) {
		return [
			[
				'default',
				{
					summary: false,
				},
			],
		] as const;
	}
	return ['default'];
};

/**
 * Options for creating a Vitest preset
 */
export interface VitestPresetOptions {
	/** Test environment - 'node' or 'jsdom' */
	environment?: 'node' | 'jsdom';
	/** Override include patterns */
	include?: string[];
	/** Additional exclude patterns (merged with shared excludes) */
	additionalExclude?: string[];
	/** Path to tsconfig for type checking */
	typecheckTsconfig?: string;
	/** Whether to enable typechecking */
	typecheckEnabled?: boolean;
	/** Whether to pass with no tests */
	passWithNoTests?: boolean;
	/** Package root directory (for resolving paths) */
	root?: string;
	/** Vite resolve aliases */
	resolve?: {
		alias?: Record<string, string>;
	};
}

/**
 * Creates a Vitest configuration preset for Node environment.
 * Use this for packages that don't need DOM APIs.
 */
export function createNodePreset(options: Omit<VitestPresetOptions, 'environment'> = {}): ViteUserConfig {
	return createPreset({ ...options, environment: 'node' });
}

/**
 * Creates a Vitest configuration preset for jsdom environment.
 * Use this for packages that need DOM APIs in tests.
 */
export function createJsdomPreset(options: Omit<VitestPresetOptions, 'environment'> = {}): ViteUserConfig {
	return createPreset({ ...options, environment: 'jsdom' });
}

/**
 * Creates a Vitest configuration with shared defaults and customizations.
 */
export function createPreset(options: VitestPresetOptions = {}): ViteUserConfig {
	const {
		environment = 'node',
		include = ['**/*.{test,spec}.{ts,tsx}', '**/tests/**/*.{test,spec}.{ts,tsx}'],
		additionalExclude = [],
		typecheckTsconfig = './tsconfig.test.json',
		typecheckEnabled = true,
		passWithNoTests = false,
		root,
		resolve,
	} = options;

	const testConfig: InlineConfig = {
		...sharedTestConfig,
		environment,
		reporters: getReporters(),
		include,
		exclude: [...sharedTestConfig.exclude, ...additionalExclude],
	};

	// Only add typecheck config if enabled
	if (typecheckEnabled) {
		testConfig.typecheck = {
			enabled: true,
			tsconfig: typecheckTsconfig,
		};
	}

	if (passWithNoTests) {
		testConfig.passWithNoTests = true;
	}

	const config: ViteUserConfig = { test: testConfig };

	if (root) {
		config.root = root;
	}

	if (resolve) {
		config.resolve = resolve;
	}

	return config;
}
