import { createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import { resolveWebUiOverlayConfig, webUiEditorConfigSchemaContribution } from './webUiConfig';

describe('web-ui editor config', () => {
	it('contributes overlay texture config schema paths', () => {
		expect(webUiEditorConfigSchemaContribution.root).toBe('webUI');
		expect(webUiEditorConfigSchemaContribution.schema).toEqual({
			type: 'object',
			properties: {
				overlay: {
					type: 'object',
					properties: {
						entry: { type: 'string' },
						target: { type: 'string' },
						width: { type: 'integer', minimum: 1 },
						height: { type: 'integer', minimum: 1 },
						magnification: { type: 'number', minimum: 1 },
						position: { type: 'string', enum: ['left', 'center', 'right'] },
					},
					additionalProperties: false,
				},
			},
			additionalProperties: false,
		});
	});

	it('resolves structured overlay texture config', () => {
		const state = createMockState({
			editorConfig: {
				webUI: {
					overlay: {
						entry: 'renderFrame',
						target: 'screen:rgba',
						width: 64,
						height: 32,
						magnification: 3,
						position: 'right',
					},
				},
			},
		});

		expect(resolveWebUiOverlayConfig(state)).toEqual({
			entry: 'renderFrame',
			target: 'screen:rgba',
			width: 64,
			height: 32,
			magnification: 3,
			position: 'right',
		});
	});

	it('ignores incomplete overlay texture config', () => {
		const state = createMockState({
			editorConfig: {
				webUI: {
					overlay: {
						entry: 'renderFrame',
						target: 'screen',
						width: 64,
						height: 32,
					},
				},
			},
		});

		expect(resolveWebUiOverlayConfig(state)).toBeUndefined();
	});
});
