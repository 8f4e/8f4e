import type { State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { describe, expect, it } from 'vitest';
import {
	collectRuntimeEditorConfigSchemaContributions,
	createRuntimeSelectionEditorConfigValidator,
	getSelectedRuntimeEntry,
	RUNTIME_SELECTION_CONFIG_PATH,
	resolveSelectedRuntimeId,
} from './editorConfig';

const runtimeRegistry = {
	WebWorkerRuntime: {
		id: 'WebWorkerRuntime',
		editorConfigSchema: {
			root: 'workerRuntime',
			defaults: { sampleRate: 60 },
			schema: { type: 'object', properties: { sampleRate: { type: 'number', minimum: 1 } } },
		},
		factory: () => () => {},
	},
	AudioWorkletRuntime: {
		id: 'AudioWorkletRuntime',
		editorConfigSchema: {
			root: 'audioRuntime',
			defaults: { sampleRate: 44100 },
			schema: { type: 'object', properties: { sampleRate: { type: 'number', minimum: 1 } } },
		},
		factory: () => () => {},
	},
};

describe('runtime editor config', () => {
	it('resolves only registered runtime ids', () => {
		expect(resolveSelectedRuntimeId('AudioWorkletRuntime', runtimeRegistry)).toBe('AudioWorkletRuntime');
		expect(resolveSelectedRuntimeId('UnknownRuntime', runtimeRegistry)).toBeUndefined();
		expect(resolveSelectedRuntimeId('toString', runtimeRegistry)).toBeUndefined();
		expect(resolveSelectedRuntimeId(undefined, runtimeRegistry)).toBeUndefined();
	});

	it('resolves the selected runtime registry entry', () => {
		expect(getSelectedRuntimeEntry('AudioWorkletRuntime', runtimeRegistry)?.id).toBe('AudioWorkletRuntime');
		expect(getSelectedRuntimeEntry(undefined, runtimeRegistry)).toBeUndefined();
	});

	it('collects runtime editor config schema contributions with the selected runtime first', () => {
		expect(Object.keys(collectRuntimeEditorConfigSchemaContributions('AudioWorkletRuntime', runtimeRegistry))).toEqual([
			'runtime:AudioWorkletRuntime',
			'runtime:WebWorkerRuntime',
		]);
	});

	it('collects runtime editor config schema contributions without selecting a runtime', () => {
		expect(Object.keys(collectRuntimeEditorConfigSchemaContributions(undefined, runtimeRegistry))).toEqual([
			'runtime:WebWorkerRuntime',
			'runtime:AudioWorkletRuntime',
		]);
	});

	it('validates runtime selection values', () => {
		const store = {
			getState: () => ({ editorConfig: {}, runtimeRegistry }),
		} as StateManager<State>;
		const validator = createRuntimeSelectionEditorConfigValidator(store);

		expect(
			validator.validate({
				path: RUNTIME_SELECTION_CONFIG_PATH,
				value: 'AudioWorkletRuntime',
				sourceLineIndex: 1,
				codeBlockId: 0,
			})
		).toBeUndefined();

		expect(
			validator.validate({
				path: RUNTIME_SELECTION_CONFIG_PATH,
				value: 'AudioWorkletRuntim',
				sourceLineIndex: 1,
				codeBlockId: 0,
			})
		).toContain("Did you mean 'AudioWorkletRuntime'?");

		expect(
			validator.validate({
				path: RUNTIME_SELECTION_CONFIG_PATH,
				value: 'toString',
				sourceLineIndex: 1,
				codeBlockId: 0,
			})
		).toBe("@config runtime: unknown runtime 'toString'");
	});
});
