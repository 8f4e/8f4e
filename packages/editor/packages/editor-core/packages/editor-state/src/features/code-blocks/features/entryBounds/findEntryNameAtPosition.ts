import type { EntryBounds } from '@8f4e/editor-state-types';

export default function findEntryNameAtPosition(
	bounds: readonly EntryBounds[],
	x: number,
	y: number
): string | undefined {
	return bounds.find(bound => x >= bound.x && x <= bound.x + bound.width && y >= bound.y && y <= bound.y + bound.height)
		?.entryName;
}
