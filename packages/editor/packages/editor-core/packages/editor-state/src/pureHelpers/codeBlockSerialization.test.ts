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

		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({
			code: ['module foo', 'moduleEnd'],
			gridCoordinates: { x: 0, y: 0 },
		});
		expect(result[1]).toEqual({
			code: ['module bar', 'moduleEnd'],
			gridCoordinates: { x: 12, y: 4 },
		});
	});

	it('handles negative relative coordinates', () => {
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

		expect(result[1].gridCoordinates).toEqual({ x: -5, y: -2 });
	});

	it('preserves directives and empty lines in source without copying derived disabled state', () => {
		const anchor = createMockCodeBlock({
			code: ['module test', '', '; @disabled', '; comment', '', 'moduleEnd'],
			gridX: 0,
			gridY: 0,
			disabled: true,
		});

		const result = serializeCodeBlocks([anchor], anchor);

		expect(result[0].code).toEqual(anchor.code);
		expect(result[0]).not.toHaveProperty('disabled');
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
		const result = serializeCodeBlocks([group], group);

		expect(result).toEqual([
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
