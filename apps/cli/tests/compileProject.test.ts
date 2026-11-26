import { compileProject } from '@8f4e/cli';
import { parseProjectSource } from '@8f4e/compiler';
import { describe, expect, it } from 'vitest';

describe('compileProject', () => {
	it('passes compiler options through the programmatic CLI API', async () => {
		const project = parseProjectSource(`8f4e/v1
function value
push 7
functionEnd int
entry main
module example
call value
drop
moduleEnd
entryEnd`);
		const optimized = await compileProject(project);
		const baseline = await compileProject(project, {
			compilerOptions: { enableFunctionInlining: false, includeStackAnalysis: true },
		});
		expect(baseline.compilerOptions).toEqual({
			startingMemoryAllocationUnitAddress: 0,
			enableFunctionInlining: false,
			includeStackAnalysis: true,
		});
		expect(baseline.compiledModules.example.stackAnalysis).toEqual(
			expect.arrayContaining([expect.objectContaining({ instruction: 'call' })])
		);
		expect(baseline.compiledWasm).not.toEqual(optimized.compiledWasm);
	});
});
