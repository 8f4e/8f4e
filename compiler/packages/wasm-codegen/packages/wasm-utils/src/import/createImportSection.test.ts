import { expect, test } from 'vitest';
import { Section } from '../section';
import createImportSection from './createImportSection';
import createMemoryImport from './createMemoryImport';

test('createImportSection wraps imports correctly', () => {
	const imports = [createMemoryImport('host', 'memory')];
	const section = createImportSection(imports);
	expect(section[0]).toBe(Section.IMPORT);
});
