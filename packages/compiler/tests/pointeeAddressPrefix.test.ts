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

	it('allows reading a local pointer parameter address in a pure function', async () => {
		const source = `8f4e/v1
function address
param int* ptr
push &*ptr
functionEnd int*
entry main
module check
int value 123
int result 0
push &result
push &value
call address
store
moduleEnd
entryEnd`;

		await expect(compileSource(source)).resolves.toBeDefined();
	});

	it('still requires impure functions for local pointer dereferences', async () => {
		const source = `8f4e/v1
function readValue
param int* ptr
push *ptr
functionEnd int
entry main
module check
int value 123
push &value
call readValue
drop
moduleEnd
entryEnd`;

		await expect(compileSource(source)).rejects.toThrow('Memory IO in functions requires #impure');
	});

	it('rejects &* on a fixed reference slot', async () => {
		const source = `8f4e/v1
entry main
module check
int value 123
int& slot &value
int result 0
push &result
push &*slot
store
moduleEnd
entryEnd`;

		await expect(compileSource(source)).rejects.toThrow(
			'The pointee address prefix requires a pointer-typed identifier: slot'
		);
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
