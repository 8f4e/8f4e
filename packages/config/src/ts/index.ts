/**
 * @8f4e/config/ts - Shared TypeScript configuration helpers
 *
 * This module provides base TypeScript compiler options that can be used by packages
 * in the 8f4e workspace. Packages keep thin local tsconfig.json files that extend
 * these shared configurations.
 */

/**
 * Base compiler options shared across all packages.
 * These are the strictness, module, and compatibility settings that should be
 * consistent everywhere.
 */
export const baseCompilerOptions = {
	target: 'es2022',
	module: 'ESNext',
	moduleResolution: 'bundler',
	allowSyntheticDefaultImports: true,
	esModuleInterop: true,
	resolveJsonModule: true,
	isolatedModules: true,
	strict: true,
	downlevelIteration: true,
	skipLibCheck: true,
	forceConsistentCasingInFileNames: true,
} as const;

/**
 * Library build options for packages that emit compiled output.
 * These settings enable declaration files, source maps, and set up the output structure.
 */
export const libBuildOptions = {
	noEmit: false,
	declaration: true,
	declarationMap: true,
	sourceMap: true,
	outDir: 'dist',
	rootDir: 'src',
} as const;

/**
 * Library definitions for different package environments.
 * Use these when specifying the `lib` compiler option.
 */
export const libs = {
	/** ES2023 only - for pure library packages without DOM or web worker APIs */
	node: ['es2023'],
	/** ES2023 with DOM - for browser/editor packages */
	dom: ['es2023', 'DOM'],
	/** ES2023 with DOM and DOM.Iterable - for full browser support */
	domFull: ['es2023', 'DOM', 'dom.iterable'],
	/** ES2023 with WebWorker - for web worker packages */
	webworker: ['es2023', 'webworker'],
} as const;
