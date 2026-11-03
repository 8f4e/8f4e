import type { CodeBlockEntryOutline, CodeBlockGraphicData } from '@8f4e/editor-state-types';

type EntryBounds = {
	entryName: string;
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
};

function getEntryName(codeBlock: CodeBlockGraphicData): string {
	if (!codeBlock.entry) {
		throw new Error(`Code block "${codeBlock.name}" is missing entry`);
	}
	return codeBlock.entry;
}

function createBounds(entryName: string): EntryBounds {
	return {
		entryName,
		minX: Number.POSITIVE_INFINITY,
		minY: Number.POSITIVE_INFINITY,
		maxX: Number.NEGATIVE_INFINITY,
		maxY: Number.NEGATIVE_INFINITY,
	};
}

function updateBounds(bounds: EntryBounds, codeBlock: CodeBlockGraphicData): void {
	bounds.minX = Math.min(bounds.minX, codeBlock.x);
	bounds.minY = Math.min(bounds.minY, codeBlock.y);
	bounds.maxX = Math.max(bounds.maxX, codeBlock.x + codeBlock.width);
	bounds.maxY = Math.max(bounds.maxY, codeBlock.y + codeBlock.height);
}

function createOutline(bounds: EntryBounds, paddingX: number, paddingY: number): CodeBlockEntryOutline {
	const left = bounds.minX - paddingX;
	const top = bounds.minY - paddingY;
	const right = bounds.maxX + paddingX;
	const bottom = bounds.maxY + paddingY;

	return {
		entryName: bounds.entryName,
		topLeft: { x: left, y: top },
		topRight: { x: right, y: top },
		bottomRight: { x: right, y: bottom },
		bottomLeft: { x: left, y: bottom },
	};
}

export default function deriveEntryOutlines(
	codeBlocks: CodeBlockGraphicData[],
	paddingX = 0,
	paddingY = 0
): CodeBlockEntryOutline[] {
	const boundsByEntry = new Map<string, EntryBounds>();

	for (const codeBlock of codeBlocks) {
		if (codeBlock.blockType !== 'module' && codeBlock.childProject === undefined) {
			continue;
		}

		const entryName = getEntryName(codeBlock);
		const bounds = boundsByEntry.get(entryName) ?? createBounds(entryName);
		updateBounds(bounds, codeBlock);
		boundsByEntry.set(entryName, bounds);
	}

	return [...boundsByEntry.values()].map(bounds => createOutline(bounds, paddingX, paddingY));
}
