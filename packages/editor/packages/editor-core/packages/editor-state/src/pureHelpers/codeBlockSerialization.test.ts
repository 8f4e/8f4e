import { describe, expect, it } from 'vitest';
import { createMockCodeBlock } from '~/pureHelpers/testingUtils/testUtils';

import { serializeCodeBlocks } from './codeBlockSerialization';

describe('serializeCodeBlocks', () => {
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

		const result = serializeCodeBlocks([anchor, block2], anchor);
		const parsed = result;

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

		const result = serializeCodeBlocks([anchor], anchor);
		const parsed = result;

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

		const result = serializeCodeBlocks([anchor], anchor);
		const parsed = result;

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

		const result = serializeCodeBlocks([anchor, block2], anchor);
		const parsed = result;

		expect(parsed[1].gridCoordinates).toEqual({ x: -5, y: -2 });
	});

	it('should preserve exact code lines including empty lines', () => {
		const anchor = createMockCodeBlock({
			code: ['module test', '', '; comment', '', 'moduleEnd'],
			gridX: 0,
			gridY: 0,
		});

		const result = serializeCodeBlocks([anchor], anchor);
		const parsed = result;

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
			childProject: { entries: ['main'], path: '', blocks: [nestedModule] },
		});
		const group = createMockCodeBlock({
			code: ['group audio', '; keep me', 'groupEnd'],
			gridX: 10,
			gridY: 20,
			entry: 'main',
			childProject: { entries: ['main', 'foo', 'bar'], path: '', blocks: [nestedGroup] },
		});

		group.childProject!.viewport = { x: 256, y: -128 };
		const parsed = serializeCodeBlocks([group], group);

		expect(parsed).toEqual([
			{
				code: ['group audio', '; keep me', 'groupEnd'],
				gridCoordinates: { x: 0, y: 0 },
				entry: 'main',
				childProject: {
					entries: ['main', 'foo', 'bar'],
					blocks: [
						{
							code: ['group modulation', 'groupEnd'],
							gridCoordinates: { x: -3, y: 8 },
							entry: 'main',
							childProject: {
								entries: ['main'],
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
