import { parseEditorDirectives } from '@8f4e/editor-state';
import { describe, expect, it } from 'vitest';
import { createCrossfadeDirectiveData } from './data';

function parseCrossfadeDirectiveData(code: string[]) {
	return parseEditorDirectives(code, [{ name: 'crossfade' }]).map(directive =>
		createCrossfadeDirectiveData(directive.args, directive.sourceLineIndex)
	);
}

describe('crossfade directive data', () => {
	it('parses a crossfade instruction with two memory addresses', () => {
		expect(parseCrossfadeDirectiveData(['; @crossfade &dry &wet'])).toEqual([
			{
				leftMemoryId: '&dry',
				rightMemoryId: '&wet',
				lineNumber: 0,
			},
		]);
	});

	it('rejects crossfade instructions without two memory addresses', () => {
		expect(parseCrossfadeDirectiveData(['; @crossfade &dry'])).toEqual([undefined]);
		expect(parseCrossfadeDirectiveData(['; @crossfade dry wet'])).toEqual([undefined]);
	});
});
