import { expect, test } from 'vitest';
import { Section } from '../section';
import createExportSection from './createExportSection';
import createFunctionExport from './createFunctionExport';

test('createExportSection wraps exports correctly', () => {
	const exports = [createFunctionExport('main', 0)];
	const section = createExportSection(exports);
	expect(section[0]).toBe(Section.EXPORT);
});
