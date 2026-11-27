import { expect, test } from 'vitest';
import { Section } from '../section';
import createFunctionType from './createFunctionType';
import createTypeSection from './createTypeSection';

test('createTypeSection wraps types correctly', () => {
	const types = [createFunctionType([], [])];
	const section = createTypeSection(types);
	expect(section[0]).toBe(Section.TYPE);
});
