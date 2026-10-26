import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import type { CodeBlockDisplayModel, CodeBlockType } from '@8f4e/editor-state-types';
import type { SpriteCell, SpriteIdLookups } from '@8f4e/sprite-generator';
import getLineNumberPrefix from './getLineNumberPrefix';
import resolveCodeCells from './resolveCodeCells';
import highlightSyntax from './syntax-highlighting/highlightSyntax';
import { expandLineColorsToCells, expandLineToCells, getTabStopsByLine } from './tabExpansion';

export interface CodeBlockRenderSource {
	creationIndex: number;
	code: string[];
	blockType: CodeBlockType;
	disabled: boolean;
	lineNumberColumnWidth: number;
	displayModel: CodeBlockDisplayModel;
	gaps: ReadonlyMap<number, { size: number }>;
}

export default function deriveCodeBlockCodeCells(
	block: CodeBlockRenderSource,
	spriteLookups: SpriteIdLookups
): Array<Array<SpriteCell | null>> {
	const tabStopsByLine = getTabStopsByLine(block.code);
	const characters = block.displayModel.lines.map(({ text, sourceLineIndex, isPlaceholder }, displayRow) => {
		const prefix = getLineNumberPrefix(displayRow, block.lineNumberColumnWidth, text, isPlaceholder ?? false);
		return [...prefix]
			.map(character => character.charCodeAt(0))
			.concat(expandLineToCells(text, tabStopsByLine[sourceLineIndex] ?? []));
	});
	const rawColors = highlightSyntax(block.code, block.blockType, {
		fontInstruction: PALETTE_INDICES.primaryBase,
		fontCode: PALETTE_INDICES.inkBase,
		fontCodeComment: PALETTE_INDICES.tertiaryBase,
		fontNumbers: PALETTE_INDICES.secondaryBase,
		fontBinaryZero: PALETTE_INDICES.mutedSoft,
		fontBinaryOne: PALETTE_INDICES.primaryStrong,
		fontBasePrefix: PALETTE_INDICES.secondarySoft,
	});
	const prefixLength = block.lineNumberColumnWidth + 1;
	const colors: Array<Array<PaletteIndex | undefined>> = characters.map((line, displayRow) => {
		const lineColors = new Array<PaletteIndex | undefined>(line.length).fill(undefined);
		const displayLine = block.displayModel.lines[displayRow];
		const sourceLineIndex = block.displayModel.displayRowToSourceLineIndex[displayRow] ?? 0;
		lineColors[0] = PALETTE_INDICES.mutedBase;
		lineColors[block.lineNumberColumnWidth] = displayLine?.isPlaceholder
			? PALETTE_INDICES.mutedBase
			: PALETTE_INDICES.inkBase;
		if (!displayLine?.isPlaceholder) {
			expandLineColorsToCells(
				block.code[sourceLineIndex] ?? '',
				rawColors[sourceLineIndex] ?? [],
				tabStopsByLine[sourceLineIndex] ?? []
			).forEach((color, index) => {
				if (color !== undefined) lineColors[index + prefixLength] = color;
			});
		}
		return lineColors;
	});
	const codeCells = resolveCodeCells(
		characters,
		colors,
		PALETTE_INDICES.inkBase,
		block.disabled ? PALETTE_INDICES.inkFaint : undefined,
		spriteLookups.font
	);
	for (const [row, gap] of [...block.gaps].sort(([left], [right]) => right - left)) {
		codeCells.splice(row + 1, 0, ...Array.from({ length: gap.size }, () => []));
	}
	return codeCells;
}
