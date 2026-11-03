import { createMockViewport } from '@8f4e/editor-state-testing';
import type { DialogContent } from '@8f4e/editor-state-types';
import { describe, expect, it } from 'vitest';
import layoutDialog from './layoutDialog';

const content: DialogContent = { id: 'test', title: 'Test Dialog', text: 'Short text', buttons: [] };

describe('dialog layout', () => {
	it.each([
		{ viewportWidth: 640, width: 512, height: 96, x: 64, y: 336, text: 'Short text' },
		{ viewportWidth: 1280, width: 640, height: 96, x: 320, y: 336, text: 'Short text' },
		{ viewportWidth: 5200, width: 768, height: 144, x: 2216, y: 320, text: 'a'.repeat(300) },
	])('sizes and centers a dialog in a $viewportWidth px viewport', ({ viewportWidth, text, ...expected }) => {
		const layout = layoutDialog({ ...content, text }, createMockViewport(0, 0, viewportWidth, 768));
		expect(layout).toMatchObject(expected);
		if (viewportWidth === 5200) expect(layout.wrappedText[0]).toHaveLength(94);
	});

	it.each([320, 375, 390])('fits wrapped text and button rows inside a %i px portrait viewport', width => {
		const dialog = {
			...content,
			title: 'Audio playback permission and device settings',
			text: 'Audio playback requires permission. Tap Allow to start sound on this device.',
			buttons: [{ title: 'Cancel' }, { title: 'More information' }, { title: 'Allow audio', action: 'allowAudio' }],
		};
		const original = structuredClone(dialog);
		const layout = layoutDialog(dialog, createMockViewport(0, 0, width, 768));
		expect(layout.x).toBeGreaterThanOrEqual(8);
		expect(layout.x + layout.width).toBeLessThanOrEqual(width - 8);
		const textWidth = layout.width / 8 - 2;
		expect(layout.title.length).toBeLessThanOrEqual(textWidth);
		for (const line of layout.wrappedText) expect(line.length).toBeLessThanOrEqual(textWidth);
		expect(new Set(layout.buttons.map(button => button.y)).size).toBeGreaterThan(1);
		for (const button of layout.buttons) {
			expect(button.x).toBeGreaterThanOrEqual(8);
			expect(button.x + button.width).toBeLessThanOrEqual(layout.width - 8);
			expect(button.y + button.height).toBeLessThanOrEqual(layout.height - 16);
		}
		expect(dialog).toEqual(original);
	});

	it('preserves button actions and close behavior while measuring and truncating titles', () => {
		const layout = layoutDialog(
			{
				...content,
				buttons: [{ title: 'An extremely long button title '.repeat(4), action: 'retry', payload: 42, close: false }],
			},
			createMockViewport(0, 0, 320, 768)
		);
		expect(layout.buttons[0]).toMatchObject({ action: 'retry', payload: 42, close: false });
		expect(layout.buttons[0].title.length).toBeLessThanOrEqual(28);
		expect(layout.buttons[0].width).toBeLessThanOrEqual(layout.width - 16);
	});
});
