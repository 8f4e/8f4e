import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { SpriteFont, SpriteId, SpriteIdLookups } from '@8f4e/sprite-generator';
import { type SpriteId as CellSpriteId, createSpriteCell } from '@8f4e/sprite-generator';
import { describe, expect, it } from 'vitest';
import deriveCodeBlockCodeCells, { type CodeBlockRenderSource } from './deriveCodeBlockCodeCells';

const cell = (id: number, color: number) => createSpriteCell(id as CellSpriteId, color);

function createFont(offset: number, fallback = offset + 63): SpriteFont {
	return new Proxy(
		{ 63: fallback },
		{
			get: (target, key) => {
				const characterCode = Number(key);
				return Number.isNaN(characterCode) ? Reflect.get(target, key) : ((offset + characterCode) as SpriteId);
			},
		}
	) as SpriteFont;
}

function createSpriteLookups(): SpriteIdLookups {
	return { font: createFont(0), fill: { 0: 128 as SpriteId }, background: { 0: 129 as SpriteId } };
}

function createSource(code: string[], overrides: Partial<CodeBlockRenderSource> = {}): CodeBlockRenderSource {
	return {
		creationIndex: 0,
		code,
		blockType: 'module',
		disabled: false,
		lineNumberColumnWidth: code.length.toString().length,
		displayModel: {
			lines: code.map((text, sourceLineIndex) => ({ text, sourceLineIndex })),
			displayRowToSourceLineIndex: code.map((_, sourceLineIndex) => sourceLineIndex),
			sourceLineIndexToDisplayRow: code.map((_, sourceLineIndex) => sourceLineIndex),
			isCollapsed: false,
		},
		gaps: new Map(),
		...overrides,
	};
}

describe('deriveCodeBlockCodeCells', () => {
	it('owns line-number and syntax sprite resolution', () => {
		const cells = deriveCodeBlockCodeCells(createSource(['module demo', 'push 1']), createSpriteLookups());

		expect(cells[0]?.slice(0, 3)).toEqual([
			cell(48, PALETTE_INDICES.mutedBase),
			null,
			cell(109, PALETTE_INDICES.primaryBase),
		]);
		expect(cells[1]?.at(-1)).toEqual(cell(49, PALETTE_INDICES.secondaryBase));
	});

	it('keeps zero bits faint and one bits strongly accented', () => {
		const cells = deriveCodeBlockCodeCells(createSource(['push 0b10']), createSpriteLookups());
		expect(cells[0]?.slice(-2)).toEqual([cell(49, PALETTE_INDICES.primaryStrong), cell(48, PALETTE_INDICES.inkFaint)]);
	});

	it('renders blank line-number gutters for pointer declarations', () => {
		const cells = deriveCodeBlockCodeCells(
			createSource(['module demo', 'int* ptr &buffer', 'float* out &buffer', 'push 1', 'moduleEnd']),
			createSpriteLookups()
		);

		expect(cells[0]?.slice(0, 2)).toEqual([cell(48, PALETTE_INDICES.mutedBase), null]);
		expect(cells[1]?.slice(0, 2)).toEqual([null, null]);
		expect(cells[2]?.slice(0, 2)).toEqual([null, null]);
		expect(cells[3]?.slice(0, 2)).toEqual([cell(51, PALETTE_INDICES.mutedBase), null]);
	});

	it('inserts editor-owned logical gaps into the graphics rows', () => {
		const cells = deriveCodeBlockCodeCells(
			createSource(['module demo', 'moduleEnd'], { gaps: new Map([[0, { size: 2 }]]) }),
			createSpriteLookups()
		);

		expect(cells).toHaveLength(4);
		expect(cells[1]).toEqual([]);
		expect(cells[2]).toEqual([]);
	});

	it('uses the validated font fallback for unsupported characters', () => {
		const lookups = createSpriteLookups();
		lookups.font = { 63: 999 as SpriteId } as SpriteFont;

		const cells = deriveCodeBlockCodeCells(createSource(['é'], { blockType: 'unknown' }), lookups);

		expect(cells[0]?.at(-1)).toEqual(cell(999, PALETTE_INDICES.inkBase));
	});
});
