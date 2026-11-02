import { resolvePalette } from '@8f4e/editor-palette';
import { describe, expect, it } from 'vitest';
import { resolveWireColors } from './wire-colors';

describe('resolveWireColors', () => {
	it('uses the prepared colors belonging to the installed atlas', () => {
		const palette = resolvePalette({ primary: '#abcdef', ink: '#fff', stroke: 'rgba(69,89,160,0.38)' });
		const colors = resolveWireColors(palette);
		expect(colors.wire).toBe(palette.rgba.strokeBase);
		expect(colors.wire[3]).toBe(0.38);
		expect(colors.wireHighlighted[3]).toBe(1);
		expect(colors.wireHighlighted).toBe(palette.rgba.strokeStrong);
	});
});
