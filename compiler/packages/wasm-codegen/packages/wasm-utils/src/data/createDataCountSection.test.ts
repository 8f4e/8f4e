import { expect, test } from 'vitest';
import { Section } from '../section';
import createDataCountSection from './createDataCountSection';

test('createDataCountSection wraps the segment count', () => {
	expect(createDataCountSection(1)).toStrictEqual([Section.DATA_COUNT, 0x01, 0x01]);
});
