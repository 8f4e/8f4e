import { describe, expect, it } from 'vitest';
import { resolveGlobalEditorDirectives } from './resolveGlobalEditorDirectives';

describe('global editor directive registry', () => {
	it('ignores unregistered directives', () => {
		const result = resolveGlobalEditorDirectives([
			{
				projectPath: '',
				creationIndex: 0,
				name: 'test',
				blockType: 'note',
				parsedDirectives: [
					{
						prefix: '@',
						name: 'unknown',
						args: ['x'],
						sourceLineIndex: 0,
						sourceLine: '; @unknown x',
						isTrailing: false,
					},
				],
			},
		]);

		expect(result.resolved).toEqual({});
		expect(result.errors).toEqual([]);
	});
});
