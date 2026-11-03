import { describe, expect, it } from 'vitest';

import eventCodeToUsbHidUsageId from './eventCodeToUsbHidUsageId';

describe('eventCodeToUsbHidUsageId', () => {
	it('maps letter keys', () => {
		expect(eventCodeToUsbHidUsageId('KeyA')).toBe(0x04);
		expect(eventCodeToUsbHidUsageId('KeyZ')).toBe(0x1d);
	});

	it('maps number row keys', () => {
		expect(eventCodeToUsbHidUsageId('Digit1')).toBe(0x1e);
		expect(eventCodeToUsbHidUsageId('Digit0')).toBe(0x27);
	});

	it('maps navigation and function keys', () => {
		expect(eventCodeToUsbHidUsageId('ArrowLeft')).toBe(0x50);
		expect(eventCodeToUsbHidUsageId('Enter')).toBe(0x28);
		expect(eventCodeToUsbHidUsageId('F12')).toBe(0x45);
	});

	it('maps numpad keys', () => {
		expect(eventCodeToUsbHidUsageId('NumpadEnter')).toBe(0x58);
		expect(eventCodeToUsbHidUsageId('Numpad0')).toBe(0x62);
		expect(eventCodeToUsbHidUsageId('NumpadDecimal')).toBe(0x63);
	});

	it('maps modifiers', () => {
		expect(eventCodeToUsbHidUsageId('ControlLeft')).toBe(0xe0);
		expect(eventCodeToUsbHidUsageId('MetaRight')).toBe(0xe7);
	});

	it('returns undefined for unsupported codes', () => {
		expect(eventCodeToUsbHidUsageId('')).toBeUndefined();
		expect(eventCodeToUsbHidUsageId('Unidentified')).toBeUndefined();
		expect(eventCodeToUsbHidUsageId('MediaPlayPause')).toBeUndefined();
	});
});
