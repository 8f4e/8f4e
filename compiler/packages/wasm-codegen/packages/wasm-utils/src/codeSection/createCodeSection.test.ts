import { expect, test } from 'vitest';
import { Section } from '../section';
import createCodeSection from './createCodeSection';
import createFunction from './createFunction';

test('createCodeSection wraps function bodies correctly', () => {
	const bodies = [createFunction([], [65, 1])];
	const section = createCodeSection(bodies);
	expect(section[0]).toBe(Section.CODE);
});
