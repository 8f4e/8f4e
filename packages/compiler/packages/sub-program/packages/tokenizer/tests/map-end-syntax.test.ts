import { CompilerError } from '@8f4e/compiler-diagnostics';
import { describe, expect, it } from 'vitest';
import { compileToAST } from '../src';

describe('mapEnd syntax', () => {
	it('rejects an omitted output type during syntax validation', () => {
		expect(() =>
			compileToAST(['module test', 'mapBegin int', 'push 1', 'mapEnd', 'moduleEnd'], { kind: 'document' })
		).toThrow(CompilerError);
	});
});
