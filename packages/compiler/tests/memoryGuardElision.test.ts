import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '../src';
import { disassembleWasm } from './wasmTestUtils';

async function compileBody(body: string, declarations = '') {
	const result = await compileProject(
		parseProjectSource(`8f4e/v1\nentry main\nmodule storage\n${declarations}\n${body}\nmoduleEnd\nentryEnd`)
	);
	return disassembleWasm(result.codeBuffer);
}

describe('memory guard elision', () => {
	it.each([
		['constant load', 'push 100\nload\ndrop'],
		['byte load', 'push 65535\nload8u\ndrop'],
		['half-word load', 'push 65534\nload16u\ndrop'],
		['float load', 'push 65532\nloadFloat\ndrop'],
		['constant store', 'push 100\npush 7\nstore'],
		['float64 store', 'push 65528\npush 1.0f64\nstore'],
		['copy across declarations', 'push &first\npush &second\nmemoryCopy 8'],
		['constant copy', 'push 100\npush 200\nmemoryCopy 8'],
		['byte stores', 'push 1\npush 2\npush 3\npush 4\npush 100\nstoreBytes 4'],
	])('omits runtime bounds checks for %s', async (_name, body) => {
		const wat = await compileBody(body, 'int first\nint second');
		expect(wat).not.toMatch(/^\s+if\b/m);
		expect(wat).not.toContain('memory.size');
	});

	it('proves a float64 load beyond its declaration', async () => {
		const wat = await compileBody('push &first\npush 8\nadd\nloadFloat\ndrop', 'float64 first');
		expect(wat).toContain('f64.load');
		expect(wat).not.toMatch(/^\s+if\b/m);
	});

	it('checks only the unproven copy range against a constant bound', async () => {
		const result = await compileProject(
			parseProjectSource(`8f4e/v1
function copy
#export
#impure
param int source
push 100
push source
memoryCopy 8
functionEnd`)
		);
		const wat = await disassembleWasm(result.codeBuffer);
		expect(wat.match(/i32\.le_u/g)).toHaveLength(1);
		expect(wat).not.toContain('memory.size');
	});

	it.each(['7', '2.5', '2.5f64'])('omits ensureNonZero for known %s', async value => {
		const wat = await compileBody(`push ${value}\nensureNonZero\ndrop`);
		expect(wat).not.toMatch(/^\s+if\b/m);
	});

	it('preserves a clamp proof through a local pointer', async () => {
		const result = await compileProject(
			parseProjectSource(`8f4e/v1
function read
#export
#impure
param int* pointer
local int* safe
push pointer
clampGlobalAddress 4
localSet safe
push *safe
functionEnd int`)
		);
		const wat = await disassembleWasm(result.codeBuffer);
		expect(wat).not.toMatch(/^\s+if\b/m);
		expect(wat).not.toContain('memory.size');
	});

	it('guards the target loaded through a clamped double pointer', async () => {
		const result = await compileProject(
			parseProjectSource(`8f4e/v1
function read
#export
#impure
param int** pointer
local int** safe
push pointer
clampGlobalAddress 4
localSet safe
push **safe
functionEnd int`)
		);
		const wat = await disassembleWasm(result.codeBuffer);
		expect(wat.match(/^\s+if\b/gm)).toHaveLength(1);
	});
});
