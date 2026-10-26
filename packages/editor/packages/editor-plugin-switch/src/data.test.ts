import { parseEditorDirectives } from '@8f4e/editor-state';
import { describe, expect, it } from 'vitest';
import { createSwitchDirectiveData } from './data';

const switchDirective = { name: 'switch' };

function parseSwitchDirectiveData(code: string[]) {
	return parseEditorDirectives(code, [switchDirective])
		.map(directive => createSwitchDirectiveData(directive.args, directive.rawRow))
		.filter(result => result !== undefined);
}

describe('switch directive data', () => {
	it('should parse switch instruction with all arguments', () => {
		const code = ['; @switch &mySwitch 0 1'];
		const result = parseSwitchDirectiveData(code);

		expect(result).toEqual([
			{
				id: '&mySwitch',
				lineNumber: 0,
				offValue: 0,
				onValue: 1,
			},
		]);
	});

	it('should parse switch instruction with default off/on values', () => {
		const code = ['; @switch &mySwitch'];
		const result = parseSwitchDirectiveData(code);

		expect(result).toEqual([
			{
				id: '&mySwitch',
				lineNumber: 0,
				offValue: 0,
				onValue: 1,
			},
		]);
	});

	it('should parse switch instruction with custom values', () => {
		const code = ['; @switch &mySwitch 10 100'];
		const result = parseSwitchDirectiveData(code);

		expect(result).toEqual([
			{
				id: '&mySwitch',
				lineNumber: 0,
				offValue: 10,
				onValue: 100,
			},
		]);
	});

	it('should handle multiple switch instructions', () => {
		const code = ['; @switch &sw1 0 1', 'mov a b', '; @switch &sw2 5 15'];
		const result = parseSwitchDirectiveData(code);

		expect(result).toEqual([
			{
				id: '&sw1',
				lineNumber: 0,
				offValue: 0,
				onValue: 1,
			},
			{
				id: '&sw2',
				lineNumber: 2,
				offValue: 5,
				onValue: 15,
			},
		]);
	});

	it('should return empty array when no switch instructions found', () => {
		const code = ['mov a b', 'add c d', 'sub e f'];
		const result = parseSwitchDirectiveData(code);

		expect(result).toEqual([]);
	});

	it('should handle empty code array', () => {
		const code: string[] = [];
		const result = parseSwitchDirectiveData(code);

		expect(result).toEqual([]);
	});

	it('rejects a plain memory target', () => {
		expect(parseSwitchDirectiveData(['; @switch mySwitch'])).toEqual([]);
	});

	it('rejects invalid off/on values', () => {
		const code = ['; @switch &mySwitch invalid invalid'];
		const result = parseSwitchDirectiveData(code);

		expect(result).toEqual([]);
	});

	it('preserves explicit zero and fractional values', () => {
		expect(parseSwitchDirectiveData(['; @switch &mySwitch 0.5 0'])).toEqual([
			{ id: '&mySwitch', lineNumber: 0, offValue: 0.5, onValue: 0 },
		]);
	});

	it('should preserve correct line numbers', () => {
		const code = ['nop', 'nop', '; @switch &sw1 0 1', 'nop', 'nop', '; @switch &sw2 5 10'];
		const result = parseSwitchDirectiveData(code);

		expect(result).toEqual([
			{
				id: '&sw1',
				lineNumber: 2,
				offValue: 0,
				onValue: 1,
			},
			{
				id: '&sw2',
				lineNumber: 5,
				offValue: 5,
				onValue: 10,
			},
		]);
	});
});
