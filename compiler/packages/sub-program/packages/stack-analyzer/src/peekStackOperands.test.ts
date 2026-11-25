import type { StackItem } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { peekStackOperands } from './peekStackOperands';

describe('peekStackOperands', () => {
	it('returns the last N operands in stack order', () => {
		const stack: StackItem[] = [
			{ kind: 'value', valueType: 'int' },
			{ kind: 'value', valueType: 'float' },
			{ kind: 'value', valueType: 'int' },
		];
		expect(peekStackOperands(stack, 2)).toEqual([
			{ kind: 'value', valueType: 'float' },
			{ kind: 'value', valueType: 'int' },
		]);
	});

	it('returns an empty array when there are not enough operands', () => {
		const stack: StackItem[] = [{ kind: 'value', valueType: 'int' }];
		expect(peekStackOperands(stack, 2)).toEqual([]);
	});
});
