import { createMockCodeBlock } from '@8f4e/editor-state-testing';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import deriveEntryOutlines from './deriveEntryOutlines';

describe('deriveEntryOutlines', () => {
	it('derives corners around module blocks that share an entry', () => {
		const outlines = deriveEntryOutlines([
			{
				blockType: 'module',
				entry: 'main',
				x: 16,
				y: 32,
				width: 80,
				height: 40,
			} as CodeBlockGraphicData,
			{
				blockType: 'module',
				entry: 'main',
				x: 160,
				y: 96,
				width: 96,
				height: 48,
			} as CodeBlockGraphicData,
			{
				blockType: 'module',
				entry: 'test',
				x: 0,
				y: 0,
				width: 100,
				height: 100,
			} as CodeBlockGraphicData,
			{
				blockType: 'function',
				x: -100,
				y: -100,
				width: 400,
				height: 400,
			} as CodeBlockGraphicData,
		]);

		expect(outlines).toEqual([
			{
				entryName: 'main',
				topLeft: { x: 16, y: 32 },
				topRight: { x: 256, y: 32 },
				bottomRight: { x: 256, y: 144 },
				bottomLeft: { x: 16, y: 144 },
			},
			{
				entryName: 'test',
				topLeft: { x: 0, y: 0 },
				topRight: { x: 100, y: 0 },
				bottomRight: { x: 100, y: 100 },
				bottomLeft: { x: 0, y: 100 },
			},
		]);
	});

	it('derives corners around a single-module main entry', () => {
		const outlines = deriveEntryOutlines([
			{ blockType: 'module', entry: 'main', x: 0, y: 0, width: 10, height: 10 } as CodeBlockGraphicData,
		]);

		expect(outlines).toEqual([
			{
				entryName: 'main',
				topLeft: { x: 0, y: 0 },
				topRight: { x: 10, y: 0 },
				bottomRight: { x: 10, y: 10 },
				bottomLeft: { x: 0, y: 10 },
			},
		]);
	});

	it('derives corners around a single-module non-main entry', () => {
		const outlines = deriveEntryOutlines([
			{
				blockType: 'module',
				entry: 'entry',
				x: 20,
				y: 30,
				width: 40,
				height: 50,
			} as CodeBlockGraphicData,
		]);

		expect(outlines).toEqual([
			{
				entryName: 'entry',
				topLeft: { x: 20, y: 30 },
				topRight: { x: 60, y: 30 },
				bottomRight: { x: 60, y: 80 },
				bottomLeft: { x: 20, y: 80 },
			},
		]);
	});

	it('applies padding to the derived corners', () => {
		const outlines = deriveEntryOutlines(
			[
				{ blockType: 'module', entry: 'main', x: 10, y: 20, width: 30, height: 40 } as CodeBlockGraphicData,
				{ blockType: 'module', entry: 'main', x: 100, y: 120, width: 30, height: 40 } as CodeBlockGraphicData,
			],
			8,
			16
		);

		expect(outlines[0]).toEqual({
			entryName: 'main',
			topLeft: { x: 2, y: 4 },
			topRight: { x: 138, y: 4 },
			bottomRight: { x: 138, y: 176 },
			bottomLeft: { x: 2, y: 176 },
		});
	});

	it('groups modules that share the main entry', () => {
		const outlines = deriveEntryOutlines([
			{ blockType: 'module', entry: 'main', x: 0, y: 0, width: 10, height: 10 } as CodeBlockGraphicData,
			{ blockType: 'module', entry: 'main', x: 20, y: 20, width: 10, height: 10 } as CodeBlockGraphicData,
		]);

		expect(outlines[0].entryName).toBe('main');
	});

	it('includes modules and groups in their own entry bounds', () => {
		const outlines = deriveEntryOutlines([
			createMockCodeBlock({ blockType: 'module', entry: 'main', x: 16, y: 32, width: 80, height: 40 }),
			createMockCodeBlock({
				code: ['group audio', 'groupEnd'],
				entry: 'main',
				childProject: { entries: [], path: '', blocks: [] },
				x: 160,
				y: -16,
				width: 96,
				height: 48,
			}),
			createMockCodeBlock({
				code: ['group checks', 'groupEnd'],
				entry: 'test',
				childProject: { entries: [], path: '', blocks: [] },
				x: -80,
				y: 96,
				width: 64,
				height: 32,
			}),
		]);

		expect(outlines).toEqual([
			{
				entryName: 'main',
				topLeft: { x: 16, y: -16 },
				topRight: { x: 256, y: -16 },
				bottomRight: { x: 256, y: 72 },
				bottomLeft: { x: 16, y: 72 },
			},
			{
				entryName: 'test',
				topLeft: { x: -80, y: 96 },
				topRight: { x: -16, y: 96 },
				bottomRight: { x: -16, y: 128 },
				bottomLeft: { x: -80, y: 128 },
			},
		]);
	});

	it('pads an entry containing only a group without including its hidden child geometry', () => {
		const outlines = deriveEntryOutlines(
			[
				createMockCodeBlock({
					code: ['group audio', 'groupEnd'],
					entry: 'main',
					x: 10,
					y: 20,
					width: 30,
					height: 40,
					childProject: {
						entries: [],
						path: '',
						blocks: [
							createMockCodeBlock({ blockType: 'module', entry: 'main', x: 1000, y: 1000, width: 100, height: 100 }),
						],
					},
				}),
			],
			8,
			16
		);

		expect(outlines).toEqual([
			{
				entryName: 'main',
				topLeft: { x: 2, y: 4 },
				topRight: { x: 48, y: 4 },
				bottomRight: { x: 48, y: 76 },
				bottomLeft: { x: 2, y: 76 },
			},
		]);
	});

	it.each(['note', 'function', 'constants', 'prototype', 'includes', 'unknown'] as const)(
		'excludes ordinary %s blocks',
		blockType => {
			expect(deriveEntryOutlines([createMockCodeBlock({ blockType })])).toEqual([]);
		}
	);
});
