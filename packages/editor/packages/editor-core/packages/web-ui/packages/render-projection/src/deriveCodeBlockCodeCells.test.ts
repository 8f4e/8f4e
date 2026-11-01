import { PALETTE_INDICES } from '@8f4e/editor-palette';
import type { SpriteId } from 'glugglugglug';
import { describe, expect, it } from 'vitest';
import deriveCodeBlockCodeCells, { type CodeBlockRenderSource } from './deriveCodeBlockCodeCells';
import { createSpriteCell } from './spriteCell';

const cell = (id: number, color: number) => createSpriteCell(id as SpriteId, color);

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
		const cells = deriveCodeBlockCodeCells(createSource(['module demo', 'push 1']));

		expect(cells[0]?.slice(0, 3)).toEqual([
			cell(48, PALETTE_INDICES.mutedBase),
			null,
			cell(109, PALETTE_INDICES.primaryBase),
		]);
		expect(cells[1]?.at(-1)).toEqual(cell(49, PALETTE_INDICES.secondaryBase));
	});

	it('distinguishes softened prefixes and zero bits from accented one bits', () => {
		const cells = deriveCodeBlockCodeCells(createSource(['push 0b10']));
		expect(cells[0]?.slice(-4)).toEqual([
			cell(48, PALETTE_INDICES.secondarySoft),
			cell(98, PALETTE_INDICES.secondarySoft),
			cell(49, PALETTE_INDICES.primaryStrong),
			cell(48, PALETTE_INDICES.mutedSoft),
		]);
	});

	it('renders blank line-number gutters for pointer declarations', () => {
		const cells = deriveCodeBlockCodeCells(
			createSource(['module demo', 'int* ptr &buffer', 'float* out &buffer', 'push 1', 'moduleEnd'])
		);

		expect(cells[0]?.slice(0, 2)).toEqual([cell(48, PALETTE_INDICES.mutedBase), null]);
		expect(cells[1]?.slice(0, 2)).toEqual([null, null]);
		expect(cells[2]?.slice(0, 2)).toEqual([null, null]);
		expect(cells[3]?.slice(0, 2)).toEqual([cell(51, PALETTE_INDICES.mutedBase), null]);
	});

	it('inserts editor-owned logical gaps into the graphics rows', () => {
		const cells = deriveCodeBlockCodeCells(
			createSource(['module demo', 'moduleEnd'], { gaps: new Map([[0, { size: 2 }]]) })
		);

		expect(cells).toHaveLength(4);
		expect(cells[1]).toEqual([]);
		expect(cells[2]).toEqual([]);
	});

	it('uses the validated font fallback for unsupported characters', () => {
		const cells = deriveCodeBlockCodeCells(createSource(['é'], { blockType: 'unknown' }));

		expect(cells[0]?.at(-1)).toEqual(cell(63, PALETTE_INDICES.inkBase));
	});
});
