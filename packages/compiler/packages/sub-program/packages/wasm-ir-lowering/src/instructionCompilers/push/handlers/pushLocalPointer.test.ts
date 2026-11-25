import { WASM_TYPE_F32, WASM_TYPE_I32 } from '@8f4e/compiler-wasm-utils';
import type { ResolvedLocalPointerPushLine } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import createInstructionCompilerTestContext, {
	expectGuardedDereference,
	pointerIdentifier,
} from '../../../../tests/testUtils';
import { f32load, i32load8u } from '../../../operations';
import pushLocalPointer from './pushLocalPointer';

describe('pushLocalPointer', () => {
	it('reuses a single address slot across a guarded pointer chain', () => {
		const local = { isInteger: true as const, pointeeBaseType: 'float' as const, pointerDepth: 2 };
		const context = createInstructionCompilerTestContext({ locals: [local] });

		pushLocalPointer(
			{
				diagnosticSource: { kind: 'document' },
				lineNumber: 1,
				instruction: 'push',
				arguments: [pointerIdentifier('lut', 2)],
				resolvedTarget: { kind: 'local-pointer', binding: { id: 0, name: 'lut', type: 'float**' } },
			} as ResolvedLocalPointerPushLine,
			context
		);

		expectGuardedDereference(context.instructions, {
			prefix: [{ kind: 'local.get', binding: 0 }],
			finalLoad: f32load(),
			guardCount: 2,
			resultType: WASM_TYPE_F32,
		});
		expect(context.locals).toEqual([local, { isInteger: true }]);
	});

	it('dereferences a local pointer via a guarded load', () => {
		const local = { isInteger: true as const, pointeeBaseType: 'float' as const, pointerDepth: 1 };
		const context = createInstructionCompilerTestContext({
			locals: [local],
		});

		pushLocalPointer(
			{
				diagnosticSource: { kind: 'document' },
				lineNumber: 1,
				instruction: 'push',
				arguments: [pointerIdentifier('lut', 1)],
				resolvedTarget: { kind: 'local-pointer', binding: { id: 0, name: 'lut', type: 'float*' } },
			} as ResolvedLocalPointerPushLine,
			context
		);

		expectGuardedDereference(context.instructions, {
			prefix: [{ kind: 'local.get', binding: 0 }],
			finalLoad: f32load(),
			guardCount: 1,
			resultType: WASM_TYPE_F32,
		});
	});

	it('dereferences an unsigned int8 local pointer via an unsigned guarded load', () => {
		const local = { isInteger: true as const, pointeeBaseType: 'int8u' as const, pointerDepth: 1 };
		const context = createInstructionCompilerTestContext({
			locals: [local],
		});

		pushLocalPointer(
			{
				diagnosticSource: { kind: 'document' },
				lineNumber: 1,
				instruction: 'push',
				arguments: [pointerIdentifier('bytes', 1)],
				resolvedTarget: { kind: 'local-pointer', binding: { id: 0, name: 'bytes', type: 'int8u*' } },
			} as ResolvedLocalPointerPushLine,
			context
		);

		expectGuardedDereference(context.instructions, {
			prefix: [{ kind: 'local.get', binding: 0 }],
			finalLoad: i32load8u(),
			guardCount: 1,
			resultType: WASM_TYPE_I32,
		});
	});
});
