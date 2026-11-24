import type { EditorPlugin } from '@8f4e/editor-core';
import initState from '@8f4e/editor-state';
import { parseProjectSource } from '@8f4e/project-preparser';
import { createEditorRenderRegistry } from '@8f4e/web-ui';
import { afterEach, vi } from 'vitest';
import { createProjectFilesPlugin } from '../index';
import { createEvents } from './events';

export const source = '8f4e/v1\nentry main\nmodule test\nint value 1\nmoduleEnd\nentryEnd';
const cleanups: Array<() => void> = [];

export function createHandle() {
	const writable = {
		write: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined),
		abort: vi.fn().mockResolvedValue(undefined),
	};
	return {
		getFile: vi.fn().mockResolvedValue(new File([source], 'test.8f4e')),
		requestPermission: vi.fn().mockResolvedValue('granted'),
		createWritable: vi.fn().mockResolvedValue(writable),
		writable,
	};
}

export function setup({
	mode = 'edit',
	createPlugin = inputTarget => createProjectFilesPlugin({ inputTarget }),
}: {
	mode?: 'edit' | 'view';
	createPlugin?: (inputTarget: HTMLElement) => EditorPlugin;
} = {}) {
	const events = createEvents();
	const store = initState(events, { callbacks: {} });
	const state = store.getState();
	const handle = createHandle();
	const browserWindow = {
		showOpenFilePicker: vi.fn().mockResolvedValue([handle]),
		showSaveFilePicker: vi.fn().mockResolvedValue(handle),
		URL: { createObjectURL: vi.fn().mockReturnValue('blob:project'), revokeObjectURL: vi.fn() },
	};
	const input = Object.assign(new EventTarget(), { files: [new File([source], 'uploaded.8f4e')], click: vi.fn() });
	const link = { style: {}, href: '', download: '', click: vi.fn(), remove: vi.fn() };
	const document = {
		defaultView: browserWindow,
		createElement: vi.fn((tag: string) => (tag === 'input' ? input : link)),
		body: { appendChild: vi.fn() },
	};
	const inputTarget = Object.assign(new EventTarget(), { ownerDocument: document }) as unknown as HTMLElement;
	let pluginCleanup: (() => void) | undefined = createPlugin(inputTarget).setup({
		store,
		events,
		menus: store.menus,
		directives: store.directives,
		layout: store.layout,
		loading: store.loading,
		renderRegistry: createEditorRenderRegistry(),
	});
	const disposePlugin = () => {
		pluginCleanup?.();
		pluginCleanup = undefined;
	};
	cleanups.push(() => {
		disposePlugin();
		store.dispose();
	});
	events.dispatch('loadProject', { project: parseProjectSource(source) });
	events.dispatch(mode === 'edit' ? 'enterEditMode' : 'exitToViewMode');
	const setCode = (comment: string) => {
		state.project.rootLevel.blocks.find(block => block.name === 'test')!.code = [
			'module test',
			`; ${comment}`,
			'moduleEnd',
		];
	};
	const keydown = (key: string, modifiers: { ctrlKey?: boolean; metaKey?: boolean } = {}) => {
		const event = Object.assign(new Event('keydown', { cancelable: true }), {
			key,
			ctrlKey: false,
			metaKey: false,
			...modifiers,
		});
		inputTarget.dispatchEvent(event);
		return event;
	};
	const openMenu = () => events.dispatchAsync('contextmenu', { x: 800, y: 400 });
	return {
		events,
		store,
		state,
		handle,
		browserWindow,
		document,
		input,
		link,
		setCode,
		keydown,
		openMenu,
		disposePlugin,
	};
}

afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
	vi.restoreAllMocks();
});
