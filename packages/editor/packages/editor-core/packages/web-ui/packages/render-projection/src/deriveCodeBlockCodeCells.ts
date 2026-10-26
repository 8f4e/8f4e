import type { CodeBlockDisplayModel, CodeBlockType } from '@8f4e/editor-state-types';
import type { SpriteFont, SpriteId, SpriteIdLookups } from '@8f4e/sprite-generator';
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
): Array<Array<SpriteId | null>> {
	const tabStopsByLine = getTabStopsByLine(block.code);
	const characters = block.displayModel.lines.map(({ text, sourceLineIndex, isPlaceholder }, displayRow) => {
		const prefix = getLineNumberPrefix(displayRow, block.lineNumberColumnWidth, text, isPlaceholder ?? false);
		return [...prefix]
			.map(character => character.charCodeAt(0) as number | string)
			.concat(expandLineToCells(text, tabStopsByLine[sourceLineIndex] ?? []));
	});
	const rawColors = highlightSyntax(block.code, block.blockType, {
		fontInstruction: spriteLookups.fontPrimaryBase,
		fontCode: spriteLookups.fontInkBase,
		fontCodeComment: spriteLookups.fontTertiaryBase,
		fontNumbers: spriteLookups.fontSecondaryBase,
		fontBinaryZero: spriteLookups.fontInkFaint,
		fontBinaryOne: spriteLookups.fontPrimaryStrong,
		fontBasePrefix: spriteLookups.fontSecondaryBase,
	});
	const prefixLength = block.lineNumberColumnWidth + 1;
	const colors: Array<Array<SpriteFont | undefined>> = characters.map((line, displayRow) => {
		const lineColors = new Array<SpriteFont | undefined>(line.length).fill(undefined);
		const displayLine = block.displayModel.lines[displayRow];
		const sourceLineIndex = block.displayModel.displayRowToSourceLineIndex[displayRow] ?? 0;
		lineColors[0] = spriteLookups.fontInkMuted;
		lineColors[block.lineNumberColumnWidth] = displayLine?.isPlaceholder
			? spriteLookups.fontInkMuted
			: spriteLookups.fontInkBase;
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
		spriteLookups.fontInkBase,
		block.disabled ? spriteLookups.fontInkFaint : undefined
	);
	for (const [row, gap] of [...block.gaps].sort(([left], [right]) => right - left)) {
		codeCells.splice(row + 1, 0, ...Array.from({ length: gap.size }, () => []));
	}
	return codeCells;
}
