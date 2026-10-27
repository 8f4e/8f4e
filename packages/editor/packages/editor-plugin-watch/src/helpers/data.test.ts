import { parseEditorDirectives } from '@8f4e/editor-state';
import { describe, expect, it } from 'vitest';
import { createWatchDirective } from '../state/directive';
import { createWatchDirectiveData } from './data';

const watchDirective = createWatchDirective(new WeakMap());
function parseWatchDirectiveData(code: string[]) {
	return parseEditorDirectives(code, [watchDirective])
		.map(directive => createWatchDirectiveData(directive.args, directive.sourceLineIndex, directive.sourceLine))
		.filter(result => result !== undefined);
}

describe('watch directive data', () => {
	it.each([
		{ source: '; @watch value', memoryId: 'value', displayFormat: 'decimal', showEndAddress: false },
		{ source: '; @w value', memoryId: 'value', displayFormat: 'decimal', showEndAddress: false },
		{ source: '; @watch 0xvalue', memoryId: 'value', displayFormat: 'hex', showEndAddress: false },
		{ source: '; @watch 0bvalue', memoryId: 'value', displayFormat: 'binary', showEndAddress: false },
		{ source: '; @watch value&', memoryId: 'value', displayFormat: 'decimal', showEndAddress: true },
		{ source: '; @watch 0x*pointer', memoryId: '*pointer', displayFormat: 'hex', showEndAddress: false },
		{ source: '; @watch 0b*pointer&', memoryId: '*pointer', displayFormat: 'binary', showEndAddress: true },
		{ source: '; @watch &buffer[2]', memoryId: '&buffer[2]', displayFormat: 'decimal', showEndAddress: false },
		{ source: 'int value 7 ; @watch', memoryId: 'value', displayFormat: 'decimal', showEndAddress: false },
		{ source: 'int value 7 ; @w', memoryId: 'value', displayFormat: 'decimal', showEndAddress: false },
		{ source: 'int value 7 ; @watch other', memoryId: 'other', displayFormat: 'decimal', showEndAddress: false },
		{ source: 'int value 7 ; @watch 0xother', memoryId: 'other', displayFormat: 'hex', showEndAddress: false },
		{ source: 'int value 7 ; @watch 0x', memoryId: 'value', displayFormat: 'hex', showEndAddress: false },
		{ source: 'int value 7 ; @watch 0b', memoryId: 'value', displayFormat: 'binary', showEndAddress: false },
		{ source: 'int value 7 ; @watch &', memoryId: '&value', displayFormat: 'decimal', showEndAddress: false },
		{ source: 'int value 7 ; @watch *&', memoryId: '*value', displayFormat: 'decimal', showEndAddress: true },
		{ source: 'int value 7 ; @watch 0x[2]', memoryId: 'value[2]', displayFormat: 'hex', showEndAddress: false },
	])('owns presentation parsing for $source', ({ source, ...expected }) => {
		expect(parseWatchDirectiveData([source])).toEqual([{ ...expected, lineNumber: 0 }]);
	});
	it.each(['int 1', 'int 0', 'int', 'float', 'int*'])('infers anonymous storage for %s', declaration => {
		expect(parseWatchDirectiveData([`${declaration} ; @watch 0x`])).toEqual([
			{ memoryId: '__anonymous__0', lineNumber: 0, displayFormat: 'hex', showEndAddress: false },
		]);
	});
	it('preserves source line numbers across multiple directives', () => {
		expect(parseWatchDirectiveData(['push 1', '; @watch first', 'push 2', '; @watch 0xsecond&'])).toEqual([
			{ memoryId: 'first', lineNumber: 1, displayFormat: 'decimal', showEndAddress: false },
			{ memoryId: 'second', lineNumber: 3, displayFormat: 'hex', showEndAddress: true },
		]);
	});
	it.each([{ code: [] }, { code: ['push 1'] }, { code: ['; @watch'] }])(
		'omits absent or incomplete directives in $code',
		({ code }) => {
			expect(parseWatchDirectiveData(code)).toEqual([]);
		}
	);
});
