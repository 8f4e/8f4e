import { expect, test } from 'vitest';
import { Section } from '../section';
import createFunctionName from './createFunctionName';
import createNameSection from './createNameSection';

test('createNameSection wraps function names correctly', () => {
	const names = [createFunctionName(0, 'main')];
	const section = createNameSection(names);
	expect(section[0]).toBe(Section.CUSTOM);
});
