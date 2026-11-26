import { sourceUrls } from '@8f4e/vite-plugin-sources';

/** Register the same external source collections for the website and its browser tests. */
export function projectSourcePlugins() {
	return [
		sourceUrls({ name: 'examples', root: new URL(import.meta.resolve('@8f4e/examples/projects')) }),
		sourceUrls({
			name: 'compiler-fixtures',
			root: new URL(import.meta.resolve('@8f4e/compiler/test-fixtures')),
			include: ['**/*.test.8f4e'],
		}),
	];
}
