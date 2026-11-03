import { describe, expect, it } from 'vitest';

import { compileProject, parseProjectSource } from '../src';

const compileSource = (source: string) => compileProject(parseProjectSource(source));

describe('pointee address prefix source compilation', () => {
	it('compiles &*ptr through the public compiler API', async () => {
		const source = `8f4e/v1
entry main
module check
int value 123
int* ptr &value
push &*ptr
drop
moduleEnd
entryEnd`;

		await expect(compileSource(source)).resolves.toBeDefined();
	});

	it('reports the dedicated error when &* targets a non-pointer identifier', async () => {
		const source = `8f4e/v1
entry main
module check
int value 123
push &*value
drop
moduleEnd
entryEnd`;

		await expect(compileSource(source)).rejects.toThrow(
			'The pointee address prefix requires a pointer-typed identifier: value'
		);
	});
});
