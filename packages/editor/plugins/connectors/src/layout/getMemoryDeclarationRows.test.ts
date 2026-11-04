import { createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import { getMemoryDeclarationRows } from './getMemoryDeclarationRows';

describe('getMemoryDeclarationRows', () => {
	it('aligns multiple shape expansions and local overrides in source order', () => {
		const state = createMockState({
			compiler: {
				result: {
					memoryPlan: {
						modules: {
							voice: {
								memory: {
									local: { id: 'local', lineNumber: 8 },
									first: { id: 'first', lineNumber: 1 },
									second: { id: 'second', lineNumber: 1 },
									nextShape: { id: 'nextShape', lineNumber: 5 },
								},
							},
						},
					},
					memoryDefaultsByModuleId: {
						voice: {
							local: { value: 0, isInherited: false },
							first: { value: 0, isInherited: true },
							second: { value: 0, isInherited: true },
							nextShape: { value: 0, isInherited: true },
						},
					},
				},
			},
		});
		const rows = getMemoryDeclarationRows(
			state.compiler.result.memoryPlan.modules.voice,
			state.compiler.result.memoryDefaultsByModuleId.voice
		);
		expect(rows.map(({ memory, rowOffset }) => [memory.id, memory.lineNumber, rowOffset])).toEqual([
			['first', 1, 1],
			['second', 1, 2],
			['nextShape', 5, 1],
			['local', 8, 0],
		]);
	});
});
