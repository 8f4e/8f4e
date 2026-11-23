import { describe, expect, it } from 'vitest';

const { deriveDirectiveFacts } = await import('../registry');
const { parseBlockDirectives } = await import('../../../utils/parseBlockDirectives');
const alwaysOnTopPlugin = (await import('./plugin')).default;

function runDerive(code: string[]) {
	const parsedDirectives = parseBlockDirectives(code);
	return deriveDirectiveFacts(code, parsedDirectives, [alwaysOnTopPlugin]);
}

describe('@alwaysOnTop directive plugin', () => {
	it('sets alwaysOnTop to true when directive is present', () => {
		const state = runDerive(['module test', '; @alwaysOnTop', 'moduleEnd']);
		expect(state.blockState.alwaysOnTop).toBe(true);
	});

	it('leaves alwaysOnTop false when directive is absent', () => {
		const state = runDerive(['module test', 'moduleEnd']);
		expect(state.blockState.alwaysOnTop).toBe(false);
	});

	it('ignores extra arguments', () => {
		const state = runDerive(['module test', '; @alwaysOnTop ignored', 'moduleEnd']);
		expect(state.blockState.alwaysOnTop).toBe(true);
	});

	it('uses first @alwaysOnTop directive and ignores duplicates', () => {
		const state = runDerive(['module test', '; @alwaysOnTop', '; @alwaysOnTop', 'moduleEnd']);
		expect(state.blockState.alwaysOnTop).toBe(true);
	});
});
