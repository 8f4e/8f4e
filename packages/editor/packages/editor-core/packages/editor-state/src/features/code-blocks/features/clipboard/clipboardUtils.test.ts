import { describe, expect, it } from 'vitest';
import { createMockCodeBlock } from '~/pureHelpers/testingUtils/testUtils';

import { parseClipboardData, serializeCodeBlocksToClipboard } from './clipboardUtils';

describe('serializeCodeBlocksToClipboard', () => {
	it('serializes a block batch with relative coordinates', () => {
		const anchor = createMockCodeBlock({
			code: ['module foo', 'moduleEnd'],
			gridX: 10,
			gridY: 20,
		});

		const block2 = createMockCodeBlock({
			code: ['module bar', 'moduleEnd'],
			gridX: 22,
			gridY: 24,
		});

		const result = serializeCodeBlocksToClipboard([anchor, block2], anchor);
		const parsed = JSON.parse(result);

		expect(parsed).toHaveLength(2);
		expect(parsed[0]).toEqual({
			code: ['module foo', 'moduleEnd'],
			gridCoordinates: { x: 0, y: 0 },
		});
		expect(parsed[1]).toEqual({
			code: ['module bar', 'moduleEnd'],
			gridCoordinates: { x: 12, y: 4 },
		});
	});

	it('should preserve disabled state in code via @disabled directive', () => {
		const anchor = createMockCodeBlock({
			code: ['module foo', '; @disabled', 'moduleEnd'],
			gridX: 0,
			gridY: 0,
			disabled: true,
		});

		const result = serializeCodeBlocksToClipboard([anchor], anchor);
		const parsed = JSON.parse(result);

		expect(parsed[0].code).toContain('; @disabled');
		expect(parsed[0]).not.toHaveProperty('disabled');
	});

	it('should not have disabled field when block is not disabled', () => {
		const anchor = createMockCodeBlock({
			code: ['module foo', 'moduleEnd'],
			gridX: 0,
			gridY: 0,
			disabled: false,
		});

		const result = serializeCodeBlocksToClipboard([anchor], anchor);
		const parsed = JSON.parse(result);

		expect(parsed[0].code).not.toContain('; @disabled');
		expect(parsed[0]).not.toHaveProperty('disabled');
	});

	it('should handle negative relative coordinates', () => {
		const anchor = createMockCodeBlock({
			code: ['module anchor', 'moduleEnd'],
			gridX: 10,
			gridY: 10,
		});

		const block2 = createMockCodeBlock({
			code: ['module left', 'moduleEnd'],
			gridX: 5,
			gridY: 8,
		});

		const result = serializeCodeBlocksToClipboard([anchor, block2], anchor);
		const parsed = JSON.parse(result);

		expect(parsed[1].gridCoordinates).toEqual({ x: -5, y: -2 });
	});

	it('should preserve exact code lines including empty lines', () => {
		const anchor = createMockCodeBlock({
			code: ['module test', '', '; comment', '', 'moduleEnd'],
			gridX: 0,
			gridY: 0,
		});

		const result = serializeCodeBlocksToClipboard([anchor], anchor);
		const parsed = JSON.parse(result);

		expect(parsed[0].code).toEqual(['module test', '', '; comment', '', 'moduleEnd']);
	});

	it('serializes project-group contents recursively', () => {
		const nestedModule = createMockCodeBlock({
			code: ['module voice', 'moduleEnd'],
			gridX: 4,
			gridY: 6,
			entry: 'main',
		});
		const nestedGroup = createMockCodeBlock({
			code: ['group modulation', 'groupEnd'],
			gridX: -3,
			gridY: 8,
			entry: 'main',
			childProject: { path: '', blocks: [nestedModule] },
		});
		const group = createMockCodeBlock({
			code: ['group audio', '; keep me', 'groupEnd'],
			gridX: 10,
			gridY: 20,
			entry: 'main',
			childProject: { path: '', blocks: [nestedGroup] },
		});

		group.childProject!.viewport = { x: 256, y: -128 };
		const parsed = JSON.parse(serializeCodeBlocksToClipboard([group], group));

		expect(parsed).toEqual([
			{
				code: ['group audio', '; keep me', 'groupEnd'],
				gridCoordinates: { x: 0, y: 0 },
				entry: 'main',
				childProject: {
					blocks: [
						{
							code: ['group modulation', 'groupEnd'],
							gridCoordinates: { x: -3, y: 8 },
							entry: 'main',
							childProject: {
								blocks: [
									{
										code: ['module voice', 'moduleEnd'],
										gridCoordinates: { x: 4, y: 6 },
										entry: 'main',
									},
								],
							},
						},
					],
				},
			},
		]);
	});
});

describe('parseClipboardData', () => {
	describe('multi-block detection', () => {
		it('parses a single project group with recursively owned blocks', () => {
			const clipboardText = JSON.stringify([
				{
					code: ['group audio', 'groupEnd'],
					gridCoordinates: { x: 0, y: 0 },
					childProject: {
						path: '',
						blocks: [{ code: ['module voice', 'moduleEnd'], gridCoordinates: { x: 4, y: 6 } }],
					},
				},
			]);

			const result = parseClipboardData(clipboardText);

			expect(result.type).toBe('multi');
			if (result.type === 'multi') {
				expect(result.blocks[0].childProject?.blocks?.[0].code).toEqual(['module voice', 'moduleEnd']);
			}
		});

		it('should parse valid multi-block JSON array', () => {
			const clipboardText = JSON.stringify([
				{ code: ['module foo', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } },
				{ code: ['module bar', 'moduleEnd'], gridCoordinates: { x: 12, y: 4 } },
			]);

			const result = parseClipboardData(clipboardText);

			expect(result.type).toBe('multi');
			if (result.type === 'multi') {
				expect(result.blocks).toHaveLength(2);
				expect(result.blocks[0].code).toEqual(['module foo', 'moduleEnd']);
				expect(result.blocks[1].gridCoordinates).toEqual({ x: 12, y: 4 });
			}
		});

		it('should parse multi-block with @disabled directive in code', () => {
			const clipboardText = JSON.stringify([
				{ code: ['module foo', '; @disabled', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } },
				{ code: ['module bar', 'moduleEnd'], gridCoordinates: { x: 12, y: 4 } },
			]);

			const result = parseClipboardData(clipboardText);

			expect(result.type).toBe('multi');
			if (result.type === 'multi') {
				expect(result.blocks[0].code).toContain('; @disabled');
				expect(result.blocks[1].code).not.toContain('; @disabled');
			}
		});
	});

	describe('single-block fallback', () => {
		it('should fallback to single-block for plain text', () => {
			const clipboardText = 'module test\n\nmoduleEnd';

			const result = parseClipboardData(clipboardText);

			expect(result.type).toBe('single');
			if (result.type === 'single') {
				expect(result.text).toBe(clipboardText);
			}
		});

		it('should fallback to single-block for invalid JSON', () => {
			const clipboardText = '{invalid json';

			const result = parseClipboardData(clipboardText);

			expect(result.type).toBe('single');
		});

		it('should fallback to single-block for JSON array with only 1 item', () => {
			const clipboardText = JSON.stringify([{ code: ['module foo', 'moduleEnd'], gridCoordinates: { x: 0, y: 0 } }]);

			const result = parseClipboardData(clipboardText);

			expect(result.type).toBe('single');
		});

		it('should fallback to single-block for JSON array with 0 items', () => {
			const clipboardText = JSON.stringify([]);

			const result = parseClipboardData(clipboardText);

			expect(result.type).toBe('single');
		});

		it('should fallback to single-block for JSON non-array', () => {
			const clipboardText = JSON.stringify({ code: ['module foo', 'moduleEnd'] });

			const result = parseClipboardData(clipboardText);

			expect(result.type).toBe('single');
		});

		it('should fallback to single-block when array items missing required fields', () => {
			const clipboardText = JSON.stringify([
				{ code: ['module foo', 'moduleEnd'] }, // Missing gridCoordinates
				{ code: ['module bar', 'moduleEnd'], gridCoordinates: { x: 12, y: 4 } },
			]);

			const result = parseClipboardData(clipboardText);

			expect(result.type).toBe('single');
		});

		it('should fallback to single-block when code is not an array', () => {
			const clipboardText = JSON.stringify([
				{ code: 'not an array', gridCoordinates: { x: 0, y: 0 } },
				{ code: ['module bar', 'moduleEnd'], gridCoordinates: { x: 12, y: 4 } },
			]);

			const result = parseClipboardData(clipboardText);

			expect(result.type).toBe('single');
		});

		it('should fallback to single-block when code contains non-strings', () => {
			const clipboardText = JSON.stringify([
				{ code: ['module foo', 123], gridCoordinates: { x: 0, y: 0 } },
				{ code: ['module bar', 'moduleEnd'], gridCoordinates: { x: 12, y: 4 } },
			]);

			const result = parseClipboardData(clipboardText);

			expect(result.type).toBe('single');
		});

		it('should fallback to single-block when gridCoordinates is missing x or y', () => {
			const clipboardText = JSON.stringify([
				{ code: ['module foo', 'moduleEnd'], gridCoordinates: { x: 0 } },
				{ code: ['module bar', 'moduleEnd'], gridCoordinates: { x: 12, y: 4 } },
			]);

			const result = parseClipboardData(clipboardText);

			expect(result.type).toBe('single');
		});
	});
});
