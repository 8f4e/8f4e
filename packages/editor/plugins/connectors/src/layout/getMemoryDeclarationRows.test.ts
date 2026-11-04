import type { MemoryDefaults, PlannedMemoryModule } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { getMemoryDeclarationRows } from './getMemoryDeclarationRows';

describe('getMemoryDeclarationRows', () => {
	it('aligns multiple shape expansions and local overrides in source order', () => {
		const module = {
			memory: {
				local: { id: 'local', lineNumber: 8 },
				first: { id: 'first', lineNumber: 1 },
				second: { id: 'second', lineNumber: 1 },
				nextShape: { id: 'nextShape', lineNumber: 5 },
			},
		} as unknown as PlannedMemoryModule;
		const defaults: MemoryDefaults = {
			local: { value: 0, isInherited: false },
			first: { value: 0, isInherited: true },
			second: { value: 0, isInherited: true },
			nextShape: { value: 0, isInherited: true },
		};
		const rows = getMemoryDeclarationRows(module, defaults);
		expect(rows.map(({ memory, rowOffset }) => [memory.id, memory.lineNumber, rowOffset])).toEqual([
			['first', 1, 1],
			['second', 1, 2],
			['nextShape', 5, 1],
			['local', 8, 0],
		]);
	});
});
