import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initState from '@8f4e/editor-state';
import { createMockEventDispatcher } from '@8f4e/editor-state-testing';
import { createEditorDrawerRegistry } from '@8f4e/web-ui';
import { describe, expect, it, vi } from 'vitest';
import { createKeyboardMemoryPlugin } from './index';

async function setup(exposed = false) {
	const project = parseProjectSource(
		exposed
			? `8f4e/v1
entry main
group keyboard
expose code &keys:code
expose pressed &keys:pressed
entry main
module keys
int code
int pressed
moduleEnd
entryEnd
groupEnd
entryEnd`
			: `8f4e/v1
entry main
module keys
int code
int pressed
moduleEnd
entryEnd`
	);
	const compiled = await compileProject(project, { disableSharedMemory: true });
	const memory = new Int32Array(65536 / 4);
	const events = createMockEventDispatcher();
	const writeMemory = vi.fn((address: number, value: number) => {
		memory[address] = value;
	});
	const store = initState(events, {
		callbacks: {},
	});
	store.set('compiler.result.compiledModules', compiled.compiledModules);
	store.set('compiler.result.memoryDefaultsByModuleId', compiled.memoryDefaultsByModuleId);
	store.set('compiler.result.memoryPlan', compiled.memoryPlan);
	store.set('compiler.result.projectMemoryExposuresByGroupPath', compiled.projectMemoryExposuresByGroupPath);
	const inputTarget = new EventTarget();
	const dispose = createKeyboardMemoryPlugin({
		inputTarget: inputTarget as HTMLElement,
		writeMemory,
	}).setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		drawers: createEditorDrawerRegistry(),
	});
	const prefix = exposed ? 'keyboard' : 'keys';
	store.set('editorConfig.keyboard', { keyCodeMemory: `${prefix}:code`, keyPressedMemory: `${prefix}:pressed` });
	const moduleId = Object.keys(compiled.memoryPlan.modules)[0];
	const declarations = compiled.memoryPlan.modules[moduleId].memory;
	const emit = (type: string, code = '') => {
		const event = new Event(type);
		Object.defineProperty(event, 'code', { value: code });
		inputTarget.dispatchEvent(event);
	};
	return {
		store,
		inputTarget,
		emit,
		writeMemory,
		code: () => memory[declarations.code.allocationUnitAddress],
		pressed: () => memory[declarations.pressed.allocationUnitAddress],
		dispose: () => {
			dispose();
			store.dispose();
		},
	};
}

describe('keyboard-to-memory input', () => {
	it.each([false, true])('writes HID usages and tracks held keys through exposed targets=%s', async exposed => {
		const editor = await setup(exposed);
		editor.emit('keydown', 'KeyA');
		expect(editor.code()).toBe(4);
		expect(editor.pressed()).toBe(1);
		editor.emit('keydown', 'KeyB');
		expect(editor.code()).toBe(5);
		editor.emit('keydown', 'KeyB');
		editor.emit('keyup', 'KeyB');
		expect(editor.code()).toBe(4);
		expect(editor.pressed()).toBe(1);
		editor.emit('keyup', 'KeyA');
		expect(editor.code()).toBe(4);
		expect(editor.pressed()).toBe(0);
		editor.dispose();
	});

	it('clears held keys on blur, and removes its listeners and schema on disposal', async () => {
		const editor = await setup();
		editor.emit('keydown', 'KeyA');
		editor.emit('blur');
		expect(editor.pressed()).toBe(0);
		editor.emit('keydown', 'KeyB');
		editor.dispose();
		expect(editor.pressed()).toBe(0);
		expect(editor.store.getState().editorConfigSchemaContributions.keyboard).toBeUndefined();
		editor.writeMemory.mockClear();
		editor.emit('keydown', 'KeyC');
		editor.emit('keyup', 'KeyC');
		editor.emit('blur');
		expect(editor.writeMemory).not.toHaveBeenCalled();
	});

	it('keeps held keys when unrelated editor configuration changes', async () => {
		const editor = await setup();
		editor.emit('keydown', 'KeyA');
		editor.store.set('editorConfig', { ...editor.store.getState().editorConfig, font: 'ibmvga8x16' });
		expect(editor.code()).toBe(4);
		expect(editor.pressed()).toBe(1);
		editor.dispose();
	});

	it('resets held keys when a target changes through a nested config update', async () => {
		const editor = await setup();
		editor.emit('keydown', 'KeyA');
		editor.store.set('editorConfig.keyboard.keyPressedMemory', 'keys:code');
		expect(editor.code()).toBe(0);
		editor.dispose();
	});

	it('uses current targets and ignores absent configuration or unresolved memory', async () => {
		const editor = await setup();
		editor.store.set('editorConfig.keyboard', { keyPressedMemory: 'missing:pressed' });
		editor.writeMemory.mockClear();
		editor.emit('keydown', 'KeyA');
		expect(editor.writeMemory).not.toHaveBeenCalled();
		editor.store.set('editorConfig.keyboard', undefined);
		editor.emit('keydown', 'KeyB');
		expect(editor.writeMemory).not.toHaveBeenCalled();
		editor.dispose();
	});

	it('owns schema validation for keyboard config directives', async () => {
		const editor = await setup();
		editor.store.set('editorConfig.keyboard', undefined);
		const project = parseProjectSource(`8f4e/v1
note config
; @config keyboard.keyCodeMemory keys:code
; @config keyboard.keyPressedMemory keys:pressed
noteEnd
entry main
module keys
int code
int pressed
moduleEnd
entryEnd`);
		editor.store.set('initialProjectState', project);
		expect(editor.store.getState().editorConfig.keyboard).toEqual({
			keyCodeMemory: 'keys:code',
			keyPressedMemory: 'keys:pressed',
		});
		expect(editor.store.getState().codeErrors.editorDirectiveErrors).toEqual([]);
		editor.dispose();
	});
});
