import type { StackItem } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { resolveMapKind } from './mapValueKind';

describe('map value kind helpers', () => {
	it.each([
		[{ valueType: 'int' }, 'int32'],
		[{ valueType: 'float' }, 'float32'],
		[{ valueType: 'float64' }, 'float64'],
	])('resolves %j to %s', (valueKind, expected) => {
		expect(resolveMapKind(valueKind as StackItem)).toBe(expected);
	});
});
