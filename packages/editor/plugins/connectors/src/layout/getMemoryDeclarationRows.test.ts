import type { MemoryDefaults, PlannedMemoryModule } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { getMemoryDeclarationRows } from './getMemoryDeclarationRows';

describe('getMemoryDeclarationRows', () => {
	it('aligns multiple shape expansions and local overrides in source order', () => {
		const memory = {
			local: { id: 3, name: 'local', lineNumber: 8 },
			first: { id: 0, name: 'first', lineNumber: 1 },
			second: { id: 1, name: 'second', lineNumber: 1 },
			nextShape: { id: 2, name: 'nextShape', lineNumber: 5 },
		};
		const module = {
			memory,
			declarations: [memory.first, memory.second, memory.nextShape, memory.local],
		} as unknown as PlannedMemoryModule;
		const defaults: MemoryDefaults = {
			3: { value: 0, isInherited: false },
			0: { value: 0, isInherited: true },
			1: { value: 0, isInherited: true },
			2: { value: 0, isInherited: true },
		};
		const rows = getMemoryDeclarationRows(module, defaults);
		expect(rows.map(({ memory, rowOffset }) => [memory.name, memory.lineNumber, rowOffset])).toEqual([
			['first', 1, 1],
			['second', 1, 2],
			['nextShape', 5, 1],
			['local', 8, 0],
		]);
	});
});
