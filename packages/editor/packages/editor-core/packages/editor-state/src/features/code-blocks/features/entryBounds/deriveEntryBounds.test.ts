import { expect, it } from 'vitest';
import { createMockCodeBlock } from '~/pureHelpers/testingUtils/testUtils';
import deriveEntryBounds from './deriveEntryBounds';

it('groups modules and project-group blocks by entry without including hidden children', () => {
	const blocks = [
		createMockCodeBlock({ blockType: 'module', entry: 'audio', x: 16, y: 32, width: 80, height: 40 }),
		createMockCodeBlock({
			code: ['group nested', 'groupEnd'],
			entry: 'audio',
			x: 160,
			y: -16,
			width: 96,
			height: 48,
			childProject: {
				entries: ['child'],
				path: 'nested',
				blocks: [createMockCodeBlock({ blockType: 'module', entry: 'child', x: 1000, y: 1000 })],
			},
		}),
		createMockCodeBlock({ blockType: 'module', entry: 'checks', x: -80, y: 96, width: 64, height: 32 }),
	];
	expect(deriveEntryBounds(blocks, 8, 16)).toEqual([
		{ entryName: 'audio', x: 8, y: -32, width: 256, height: 120 },
		{ entryName: 'checks', x: -88, y: 80, width: 80, height: 64 },
	]);
});

it('expands existing bounds in every direction', () => {
	const blocks = [
		createMockCodeBlock({ blockType: 'module', entry: 'main', x: 100, y: 120, width: 30, height: 40 }),
		createMockCodeBlock({ blockType: 'module', entry: 'main', x: 10, y: 20, width: 30, height: 40 }),
	];
	expect(deriveEntryBounds(blocks, 8, 16)).toEqual([{ entryName: 'main', x: 2, y: 4, width: 136, height: 172 }]);
});

it.each(['note', 'function', 'constants', 'prototype', 'includes', 'unknown'] as const)(
	'excludes ordinary %s blocks',
	blockType => {
		expect(deriveEntryBounds([createMockCodeBlock({ blockType })], 8, 16)).toEqual([]);
	}
);
