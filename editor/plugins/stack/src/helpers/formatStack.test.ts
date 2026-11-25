import type { Stack } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { formatStack } from './formatStack';

describe('stack directive formatting', () => {
	it('shows known scalar values without their types', () => {
		const stack: Stack = [
			{ kind: 'value', valueType: 'int', knownValue: 2 },
			{ kind: 'value', valueType: 'float', knownValue: Math.fround(3.2) },
			{ kind: 'value', valueType: 'float64', knownValue: Math.PI },
		];

		expect(formatStack(stack)).toBe(`2, 3.2, ${Math.PI}`);
	});

	it('falls back to types for values without a known number', () => {
		const stack: Stack = [
			{ kind: 'value', valueType: 'int' },
			{ kind: 'value', valueType: 'int', knownValue: 3 },
			{ kind: 'value', valueType: 'float' },
			{ kind: 'value', valueType: 'float64' },
			{ kind: 'address', valueType: 'int', address: {} as never },
		];

		expect(formatStack(stack)).toBe('int, 3, float, float64, ptr');
	});

	it('formats an empty stack', () => {
		expect(formatStack([])).toBe('');
	});
});
