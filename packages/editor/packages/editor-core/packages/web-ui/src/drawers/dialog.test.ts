import { PALETTE_INDICES } from '@8f4e/editor-palette';
import { createMockSpriteLookups, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, vi } from 'vitest';
import { createDrawContextMock } from '../__tests__/rendering';
import drawDialog from './dialog';

describe('drawDialog', () => {
	it('draws a white dialog button with black text and grid padding', () => {
		const engine = createDrawContextMock();
		const state = createMockState({
			dialogStack: [{ id: 'permission', title: 'Permission', text: 'Allow audio?', buttons: [] }],
			dialog: {
				id: 'permission',
				title: 'Permission',
				text: 'Allow audio?',
				wrappedText: ['Allow audio?'],
				buttons: [
					{
						title: 'Allow',
						action: 'grantAudioPermission',
						x: 400,
						y: 80,
						width: 104,
						height: 48,
					},
				],
				highlightedButton: Infinity,
				x: 64,
				y: 320,
				width: 512,
				height: 112,
			},
			viewport: {
				width: 640,
				height: 768,
				vGrid: 8,
				hGrid: 16,
			},
			spriteLookups: createMockSpriteLookups() as never,
		});

		drawDialog(engine, state);

		expect(vi.mocked(engine.drawFill)).toHaveBeenCalledWith(400, 80, PALETTE_INDICES.selectionSurface, 104, 48);
		expect((engine as unknown as { drawText: ReturnType<typeof vi.fn> }).drawText).toHaveBeenCalledWith(
			432,
			96,
			'Allow',
			PALETTE_INDICES.selectionInk
		);
	});
});
