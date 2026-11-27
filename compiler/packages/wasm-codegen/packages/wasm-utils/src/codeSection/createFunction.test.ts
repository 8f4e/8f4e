import { expect, test } from 'vitest';
import { WASM_END } from '../wasmInstruction';
import createFunction from './createFunction';

test('createFunction wraps body with locals and end', () => {
	const func = createFunction([], [65, 42]);
	expect(func[func.length - 1]).toBe(WASM_END);
});
