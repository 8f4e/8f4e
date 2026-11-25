import { expect, test } from 'vitest';
import { Section } from '../section';
import createDataSection from './createDataSection';

test('createDataSection wraps data segments correctly', () => {
	expect(createDataSection([[0x01, 0x01, 42]])).toStrictEqual([Section.DATA, 0x04, 0x01, 0x01, 0x01, 42]);
});
