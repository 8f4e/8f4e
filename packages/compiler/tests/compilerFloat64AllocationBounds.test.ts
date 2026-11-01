import { describe, expect, it } from 'vitest';
import { compileFixtureProgramSource } from './testUtils';

describe('float64 allocation address metadata', () => {
	it.each(
		[
			{ declaration: 'float64 value 1.25f64', byteLength: 8 },
			{ declaration: 'float64[] value 2 1.25f64 1.25f64', byteLength: 16 },
		].flatMap(layout => [false, true].map(aligned => ({ ...layout, aligned })))
	)(
		'keeps local and intermodule ranges inside $declaration with aligned=$aligned',
		async ({ declaration, byteLength, aligned }) => {
			const { compileResult } = await compileFixtureProgramSource(
				`8f4e/v1
entry main
module aSource
${aligned ? 'int prefix 0' : ''}
${declaration}
int next 99
push &value
drop
push value&
drop
moduleEnd
module mReader
push &aSource:value
drop
push aSource:value&
drop
moduleEnd
module zTail
int sentinel 7
moduleEnd
entryEnd`,
				{ includeStackAnalysis: true }
			);
			const source = compileResult.memoryPlan.modules.aSource;
			expect(source.memory.value).toMatchObject({
				byteAddress: 8,
				allocatedByteLength: byteLength,
				endByteAddress: 8 + byteLength - 4,
				endAddressSafeByteLength: 4,
			});
			expect(source.memory.next.byteAddress).toBe(8 + byteLength);
			expect(source.allocationUnitCount).toBe((byteLength + 8) / 4);
			expect(source.allocatedByteLength).toBe(byteLength + 8);
			expect(compileResult.memoryPlan.modules.zTail.byteAddress).toBe(byteLength + 12);
			for (const moduleId of ['aSource', 'mReader']) {
				const items = compileResult.compiledModules[moduleId].stackAnalysis
					?.filter(line => line.instruction === 'push')
					.map(line => line.stackAnalysis.producedStackItems[0]);
				expect(items).toMatchObject([
					{
						kind: 'address',
						knownValue: 8,
						address: {
							safeRange: {
								source: 'memory-start',
								byteAddress: 8,
								safeByteLength: byteLength,
								memoryId: 'value',
							},
						},
					},
					{
						kind: 'address',
						knownValue: 8 + byteLength - 4,
						address: {
							safeRange: {
								source: 'memory-end',
								byteAddress: 8 + byteLength - 4,
								safeByteLength: 4,
								memoryId: 'value',
							},
						},
					},
				]);
			}
		}
	);
});
