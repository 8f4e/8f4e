import { readFile } from 'node:fs/promises';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { describe, expect, it } from 'vitest';
import { resolveStdlibInclude } from '../src/shared/stdlibResolver';

const sampleProjects = [
	{ file: 'projects/audio/amigaMods/aftertouch', last: 27, secondPack: 16 },
	{ file: 'projects/audio/amigaMods/chiller', last: 17, secondPack: 16 },
	{ file: 'projects/audio/amigaMods/chronodemon', last: 17, secondPack: 16 },
	{ file: 'projects/audio/amigaMods/escapeFromSuicide', last: 30, secondPack: 16, silent: [2] },
	{ file: 'projects/audio/amigaMods/hymn_to_aurora', last: 12, singlePack: true, zeroFallback: true },
	{ file: 'projects/audio/amigaMods/lowerIntentions', last: 17, secondPack: 10, missing: [0, 8], baseFallback: true },
	{ file: 'projects/audio/amigaMods/movinShadows', last: 21, secondPack: 16 },
	{ file: 'projects/audio/amigaMods/pneumatic', last: 31, secondPack: 16, silent: [9], zeroFallback: true },
	{ file: 'benchmarks/bytecode-size/hymnToAurora', last: 12, singlePack: true, zeroFallback: true },
];

async function instantiate(source: string) {
	const result = await compileProject(parseProjectSource(source), {
		resolveInclude: resolveStdlibInclude,
	});
	const pages = Math.max(1, Math.ceil(result.requiredMemoryBytes / 65536));
	const memory = new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true });
	const { instance } = await WebAssembly.instantiate(new Uint8Array(result.codeBuffer), { host: { memory } });
	(instance.exports.initDefaults as CallableFunction)();
	return { result, lookup: instance.exports.lookup as (...args: number[]) => number };
}

describe('example address dependencies', () => {
	it.each(sampleProjects)('preserves sample selection and fallbacks in $file', async project => {
		const source = await readFile(new URL(`../../examples/src/${project.file}.8f4e`, import.meta.url), 'utf8');
		const { result, lookup } = await instantiate(`${source}
function lookup
#export
#impure
param int sampleNumber
call sampleNumberToAddr sampleNumber
functionEnd int`);
		for (const sample of [-2147483648, -2, -1, ...Array.from({ length: 34 }, (_, i) => i), 1024, 2147483647]) {
			const fallback = sample < 0 || sample > project.last || project.missing?.includes(sample);
			const silent = project.silent?.includes(sample);
			let expected: number;
			if (fallback && project.zeroFallback) expected = 0;
			else if (fallback && project.baseFallback) expected = result.memoryPlan.modules.samplePack1.byteAddress;
			else {
				const selected = fallback || silent ? 0 : sample;
				const pack = project.singlePack ? 'samplePack' : `samplePack${selected >= project.secondPack! ? 2 : 1}`;
				expected = result.memoryPlan.modules[pack].memory[`sample${selected}`].byteAddress;
			}
			expect(lookup(sample), `sample ${sample}`).toBe(expected);
		}
	});

	it('selects every Grids map cell and retains the unmapped-cell fallback', async () => {
		const source = await readFile(
			new URL('../../examples/src/projects/audio/gridsPatterns.8f4e', import.meta.url),
			'utf8'
		);
		const grids = parseProjectSource(source).execution.find(block => block.type === 'group')!;
		const patternRow = grids.functions.find(block => block.code[0] === 'function patternRow')!;
		const data = grids.execution
			.filter(block => block.type === 'module')
			.filter(block => block.code[0].startsWith('module pattern'));
		// Exercise the shipped helper and data in a root scope so the host can call it.
		const { result, lookup } = await instantiate(`8f4e/v1
${patternRow.code.join('\n')}
entry main
${data.map(block => block.code.join('\n')).join('\n')}
entryEnd
function lookup
#export
#impure
param int x
param int y
param int step
call patternRow x y step
functionEnd int`);
		const patterns = [10, 8, 0, 9, 11, 15, 7, 13, 12, 6, 18, 14, 4, 5, 3, 23, 16, 21, 1, 2, 24, 19, 17, 20, 22];
		for (const [cell, pattern] of patterns.entries()) {
			const name = `pattern${String(pattern).padStart(2, '0')}`;
			const target = Object.values(result.memoryPlan.modules[name].memory)[0].byteAddress;
			for (const step of [0, 17, 31]) {
				expect(lookup(Math.floor(cell / 5), cell % 5, step)).toBe(target + step * 4);
			}
		}
		expect(lookup(-1, 0, 3)).toBe(12);
		expect(lookup(5, 0, 0)).toBe(0);
		expect(lookup(-2147483648, 0, 3)).toBe(12);
		expect(lookup(2147483647, 0, 3)).toBe(12);
	});
});
