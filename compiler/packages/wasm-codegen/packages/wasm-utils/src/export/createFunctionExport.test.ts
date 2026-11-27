import { expect, test } from 'vitest';
import { ExportDesc } from '../section';
import createFunctionExport from './createFunctionExport';

test('createFunctionExport generates correct entry', () => {
	const exp = createFunctionExport('test', 0);
	expect(exp).toContain(ExportDesc.FUNC);
	expect(exp).toContain(0);
});

test.each([
	[127, [127]],
	[128, [128, 1]],
	[255, [255, 1]],
	[256, [128, 2]],
])('encodes function index %i as unsigned LEB128', (index, encoded) => {
	expect(createFunctionExport('f', index)).toStrictEqual([1, 102, ExportDesc.FUNC, ...encoded]);
});
