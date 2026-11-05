import type { EntryBounds } from '@8f4e/editor-state-types';
import { expect, it } from 'vitest';
import findEntryNameAtPosition from './findEntryNameAtPosition';

it('uses the first containing entry, includes its edges, and leaves positions outside all entries unassigned', () => {
	const bounds: EntryBounds[] = [
		{ entryName: 'first', x: 16, y: 64, width: 224, height: 192 },
		{ entryName: 'second', x: 16, y: 64, width: 224, height: 192 },
	];
	for (const [x, y] of [
		[16, 64],
		[240, 256],
		[100, 150],
	]) {
		expect(findEntryNameAtPosition(bounds, x, y)).toBe('first');
	}
	expect(findEntryNameAtPosition(bounds, 15, 100)).toBeUndefined();
	expect(findEntryNameAtPosition(bounds, 100, 257)).toBeUndefined();
});
