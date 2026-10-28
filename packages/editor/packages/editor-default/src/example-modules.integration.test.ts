import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import sources from 'virtual:8f4e-sources/example-modules';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe('bundled example module sources', () => {
	it.each(['envelopes/adrEnvelope', 'lookup-tables/sineLookupTable'])(
		'discovers and loads exact source text for %s',
		async id => {
			const source = await readFile(require.resolve(`@8f4e/examples/modules/${id}.8f4em`), 'utf8');
			await expect(sources.get(id)!()).resolves.toBe(source);
		}
	);
});
