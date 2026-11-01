import { describe, expect, it } from 'vitest';
import { createMockCodeBlock } from '~/pureHelpers/testingUtils/testUtils';
import {
	bringCodeBlockToFrontWithinPartition,
	insertCodeBlockRespectingAlwaysOnTop,
	partitionCodeBlocksByAlwaysOnTop,
} from './partitionCodeBlocksByAlwaysOnTop';

describe('partitionCodeBlocksByAlwaysOnTop', () => {
	it('partitions normal blocks before always-on-top blocks while preserving relative order', () => {
		const top1 = createMockCodeBlock({ name: 'top1', alwaysOnTop: true });
		const normal1 = createMockCodeBlock({ name: 'normal1', alwaysOnTop: false });
		const top2 = createMockCodeBlock({ name: 'top2', alwaysOnTop: true });
		const normal2 = createMockCodeBlock({ name: 'normal2', alwaysOnTop: false });

		expect(partitionCodeBlocksByAlwaysOnTop([top1, normal1, top2, normal2])).toEqual([normal1, normal2, top1, top2]);
	});

	it('inserts a normal block before existing always-on-top blocks', () => {
		const normal1 = createMockCodeBlock({ name: 'normal1', alwaysOnTop: false });
		const top1 = createMockCodeBlock({ name: 'top1', alwaysOnTop: true });
		const newNormal = createMockCodeBlock({ name: 'newNormal', alwaysOnTop: false });

		expect(insertCodeBlockRespectingAlwaysOnTop([normal1, top1], newNormal)).toEqual([normal1, newNormal, top1]);
	});

	it('inserts an always-on-top block at the end of the always-on-top partition', () => {
		const normal1 = createMockCodeBlock({ name: 'normal1', alwaysOnTop: false });
		const top1 = createMockCodeBlock({ name: 'top1', alwaysOnTop: true });
		const newTop = createMockCodeBlock({ name: 'newTop', alwaysOnTop: true });

		expect(insertCodeBlockRespectingAlwaysOnTop([normal1, top1], newTop)).toEqual([normal1, top1, newTop]);
	});

	it('brings a normal block forward to the end of the normal partition without crossing into always-on-top blocks', () => {
		const normal1 = createMockCodeBlock({ name: 'normal1', alwaysOnTop: false });
		const normal2 = createMockCodeBlock({ name: 'normal2', alwaysOnTop: false });
		const top1 = createMockCodeBlock({ name: 'top1', alwaysOnTop: true });

		expect(bringCodeBlockToFrontWithinPartition([normal1, normal2, top1], normal1)).toEqual([normal2, normal1, top1]);
	});

	it('brings an always-on-top block forward to the end of the always-on-top partition', () => {
		const normal1 = createMockCodeBlock({ name: 'normal1', alwaysOnTop: false });
		const top1 = createMockCodeBlock({ name: 'top1', alwaysOnTop: true });
		const top2 = createMockCodeBlock({ name: 'top2', alwaysOnTop: true });

		expect(bringCodeBlockToFrontWithinPartition([normal1, top1, top2], top1)).toEqual([normal1, top2, top1]);
	});
});
