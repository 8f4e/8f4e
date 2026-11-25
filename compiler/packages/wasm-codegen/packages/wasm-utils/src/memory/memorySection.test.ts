import { expect, test } from 'vitest';
import { Section } from '../section';
import createMemorySection from './memorySection';

test('createMemorySection generates correct section without max', () => {
	const section = createMemorySection(1);
	expect(section[0]).toBe(Section.MEMORY);
	expect(section).toContain(1);
	expect(section).toContain(0x00);
});

test('createMemorySection generates correct section with max', () => {
	const section = createMemorySection(1, 10);
	expect(section[0]).toBe(Section.MEMORY);
	expect(section).toContain(0x01);
	expect(section).toContain(10);
});

test('createMemorySection handles larger page sizes', () => {
	const section = createMemorySection(16);
	expect(section[0]).toBe(Section.MEMORY);
});
