import { describe, expect, test } from 'vitest';
import { ImportDesc } from '../section';
import createFunctionImport from './createFunctionImport';

describe('createFunctionImport', () => {
	test('generates a function import entry', () => {
		expect(createFunctionImport('host', 'assert', 3)).toStrictEqual([
			4,
			104,
			111,
			115,
			116,
			6,
			97,
			115,
			115,
			101,
			114,
			116,
			ImportDesc.FUNC,
			3,
		]);
	});
});
