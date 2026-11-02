import { readFile } from 'node:fs/promises';
import { compileProject, parseProjectSource } from '@8f4e/compiler';
import { describe, expect, it } from 'vitest';
import { createRuntimeRunner } from '../src/run/runtimeRunner';
import { resolveStdlibInclude } from '../src/shared/stdlibResolver';

describe('Grids clock scheduling', () => {
	it('calculates gates on rising edges and clears pulses between edges', async () => {
		const source = await readFile(
			new URL('../../examples/src/projects/audio/gridsPatterns.8f4e', import.meta.url),
			'utf8'
		);
		const project = parseProjectSource(source);
		// Drive the clock output from the host so held levels and idle cycles are deterministic.
		const clock = project.execution.find(block => block.type === 'module' && block.code[0] === 'module clock')!;
		clock.entry = 'control';
		project.entries.push('control');
		const result = await compileProject(project, { disableSharedMemory: true, resolveInclude: resolveStdlibInclude });
		const runner = await createRuntimeRunner({
			compiledWasmBase64: Buffer.from(result.codeBuffer).toString('base64'),
			memoryPlan: result.memoryPlan,
			requiredMemoryBytes: result.requiredMemoryBytes,
		});
		runner.initialize();
		const levels = () => ['BD', 'SD', 'HH'].map(channel => runner.read(`grids/mapReader:level${channel}`));
		const rows = () => ['A', 'B', 'C', 'D'].map(corner => runner.read(`grids/mapReader:row${corner}`));
		const outputs = () =>
			['bd', 'sd', 'hh', 'accentBD', 'accentSD', 'accentHH'].map(name => runner.read(`grids/outputs:${name}`));
		const cycle = (clock: number) => {
			runner.write('clock:out', clock);
			runner.runCycles(1);
		};
		for (const channel of ['BD', 'SD', 'HH']) runner.write(`grids/outputs:density${channel}`, 255);
		cycle(0);
		expect(outputs()).toEqual([0, 0, 0, 0, 0, 0]);
		cycle(1);
		expect(runner.read('grids/sequencer:step')).toBe(0);
		expect(runner.read('grids/sequencer:nextStep')).toBe(1);
		expect(outputs()).toContain(1);
		const firstLevels = levels();
		const firstRows = rows();
		runner.write('grids/mapReader:x', 255);
		runner.write('grids/mapReader:y', 0);
		for (const clock of [1, 1, 0, 0, 0]) {
			cycle(clock);
			expect(runner.read('grids/sequencer:nextStep')).toBe(1);
			expect(levels()).toEqual(firstLevels);
			expect(rows()).toEqual(firstRows);
			expect(outputs()).toEqual([0, 0, 0, 0, 0, 0]);
		}
		cycle(1);
		expect(runner.read('grids/sequencer:step')).toBe(1);
		expect(runner.read('grids/sequencer:nextStep')).toBe(2);
		expect(rows()).not.toEqual(firstRows);
		expect(levels()).not.toEqual(firstLevels);
	});
});
