import { describe, expect, it } from 'vitest';
import { parseBlockDirectives } from '~/features/code-blocks/utils/parseBlockDirectives';
import { createMockCodeBlock } from './testUtils';

describe('editor-aware test blocks', () => {
	it('derives names and directives from source with leading comments', () => {
		const code = ['; @home left', '', 'module voice', 'moduleEnd'];
		const block = createMockCodeBlock({ code });
		expect(block.name).toBe('voice');
		expect(block.parsedDirectives).toEqual(parseBlockDirectives(code));
	});

	it('retains explicit names and already parsed directive records', () => {
		const code = ['module voice', '; @home left', 'moduleEnd'];
		const parsedDirectives = parseBlockDirectives(code);
		const block = createMockCodeBlock({ code, name: 'explicit', parsedDirectives });
		expect(block.name).toBe('explicit');
		expect(block.parsedDirectives).toBe(parsedDirectives);
	});
});
