import type { CodeBlockGraphicData, EntryBounds } from '@8f4e/editor-state-types';

export default function deriveEntryBounds(
	blocks: readonly CodeBlockGraphicData[],
	paddingX: number,
	paddingY: number
): EntryBounds[] {
	const boundsByEntry = new Map<string, EntryBounds>();
	for (const block of blocks) {
		if (block.blockType !== 'module' && !block.childProject) continue;
		const entryName = block.entry!;
		const x = block.x - paddingX;
		const y = block.y - paddingY;
		const right = block.x + block.width + paddingX;
		const bottom = block.y + block.height + paddingY;
		const bounds = boundsByEntry.get(entryName);
		if (bounds) {
			bounds.width = Math.max(bounds.x + bounds.width, right) - Math.min(bounds.x, x);
			bounds.height = Math.max(bounds.y + bounds.height, bottom) - Math.min(bounds.y, y);
			bounds.x = Math.min(bounds.x, x);
			bounds.y = Math.min(bounds.y, y);
		} else {
			boundsByEntry.set(entryName, { entryName, x, y, width: right - x, height: bottom - y });
		}
	}
	return [...boundsByEntry.values()];
}
