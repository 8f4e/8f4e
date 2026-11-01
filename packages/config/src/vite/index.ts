/**
 * @8f4e/config/vite - Shared Vite configuration helpers
 *
 * This module provides factory functions for creating Vite configurations
 * for library builds and other common use cases in the 8f4e workspace.
 */

import type { BuildOptions, LibraryOptions, UserConfig } from 'vite';

/**
 * Shared build options for library packages.
 */
export const sharedLibBuildOptions: Partial<BuildOptions> = {
	sourcemap: true,
	minify: true,
	manifest: true,
};

/**
 * Options for creating a library build configuration
 */
export interface LibBuildOptions {
	/** Entry point for the library */
	entry: string;
	/** Library name for UMD builds */
	name?: string;
	/** Output formats (defaults to ['es']) */
	formats?: LibraryOptions['formats'];
	/** Output directory (defaults to 'dist') */
	outDir?: string;
	/** Custom filename function or string */
	fileName?: LibraryOptions['fileName'];
	/** Target ES version (defaults to 'es2020') */
	target?: string;
	/** Whether to empty outDir before build (defaults to true) */
	emptyOutDir?: boolean;
	/** External dependencies to exclude from bundle */
	external?: string[];
	/** Rollup output options */
	rollupOutput?: {
		inlineDynamicImports?: boolean;
		manualChunks?: undefined | Record<string, string[]>;
		globals?: Record<string, string>;
	};
}

/**
 * Creates a Vite configuration for building a library package.
 * This is the common pattern used across 8f4e packages.
 */
export function createLibConfig(options: LibBuildOptions): UserConfig {
	const {
		entry,
		name,
		formats = ['es'],
		outDir = 'dist',
		fileName,
		target = 'es2020',
		emptyOutDir = true,
		external = [],
		rollupOutput = {},
	} = options;

	const libOptions: LibraryOptions = {
		entry,
		formats,
	};

	if (name) {
		libOptions.name = name;
	}

	if (fileName) {
		libOptions.fileName = fileName;
	}

	return {
		build: {
			...sharedLibBuildOptions,
			outDir,
			emptyOutDir,
			target,
			lib: libOptions,
			rollupOptions: {
				external,
				output: rollupOutput,
			},
		},
	};
}

/**
 * Creates a Vite configuration for an ES module library.
 * Simplified version of createLibConfig for the common case.
 */
export function createEsLibConfig(entry: string, outDir = 'dist'): UserConfig {
	return createLibConfig({
		entry,
		outDir,
		formats: ['es'],
		fileName: () => 'index.js',
	});
}

/**
 * Creates a Vite configuration for a web worker library.
 * Ensures proper bundling for worker context.
 */
export function createWorkerLibConfig(entry: string, outDir = 'dist'): UserConfig {
	return createLibConfig({
		entry,
		outDir,
		formats: ['es'],
		fileName: () => 'index.js',
		rollupOutput: {
			inlineDynamicImports: true,
			manualChunks: undefined,
		},
	});
}
