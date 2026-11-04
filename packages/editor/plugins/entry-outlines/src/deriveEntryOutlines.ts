import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';

export interface EntryOutline {
	entryName: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

export default function deriveEntryOutlines(
	blocks: readonly CodeBlockGraphicData[],
	paddingX: number,
	paddingY: number
): EntryOutline[] {
	const outlines = new Map<string, EntryOutline>();
	for (const block of blocks) {
		if (block.blockType !== 'module' && !block.childProject) continue;
		const entryName = block.entry!;
		const x = block.x - paddingX;
		const y = block.y - paddingY;
		const right = block.x + block.width + paddingX;
		const bottom = block.y + block.height + paddingY;
		const outline = outlines.get(entryName);
		if (outline) {
			outline.width = Math.max(outline.x + outline.width, right) - Math.min(outline.x, x);
			outline.height = Math.max(outline.y + outline.height, bottom) - Math.min(outline.y, y);
			outline.x = Math.min(outline.x, x);
			outline.y = Math.min(outline.y, y);
		} else {
			outlines.set(entryName, { entryName, x, y, width: right - x, height: bottom - y });
		}
	}
	return [...outlines.values()];
}
