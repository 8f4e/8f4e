import { applyCodeBlockSourceEdits, EMPTY_DEFAULT_PROJECT, serializeToProject } from '@8f4e/editor-state';
import { DEFAULT_FONT, FONT_NAMES } from '@8f4e/sprite-generator';
import { describe, expect, it, vi } from 'vitest';
import { project, setup } from './__tests__/setup';

describe('font preview', () => {
	it.each(['view', 'edit'] as const)('steps through fonts and stops at both ends in %s mode', mode => {
		const test = setup();
		test.store.set('editorMode', mode);
		expect(test.key('-', { metaKey: true }).defaultPrevented).toBe(true);
		expect(test.font()).toBe(FONT_NAMES[0]);
		expect(test.state.appearance.fontOverride).toBeUndefined();
		for (const font of FONT_NAMES.slice(1)) {
			expect(test.key('+', { metaKey: true, shiftKey: true }).defaultPrevented).toBe(true);
			expect(test.font()).toBe(font);
		}
		expect(test.key('=', { metaKey: true }).defaultPrevented).toBe(true);
		expect(test.font()).toBe(FONT_NAMES.at(-1));
		for (const font of FONT_NAMES.slice(0, -1).reverse()) {
			expect(test.key('-', { ctrlKey: true }).defaultPrevented).toBe(true);
			expect(test.font()).toBe(font);
		}
		expect(test.key('-', { ctrlKey: true }).defaultPrevented).toBe(true);
		expect(test.font()).toBe(FONT_NAMES[0]);
	});

	it.each(['ctrlKey', 'metaKey'] as const)('supports the browser zoom keys with %s', modifier => {
		const test = setup();
		const options = { [modifier]: true };
		expect(test.key('=', options).defaultPrevented).toBe(true);
		expect(test.font()).toBe(FONT_NAMES[1]);
		expect(test.key('+', { ...options, shiftKey: true }).defaultPrevented).toBe(true);
		expect(test.font()).toBe(FONT_NAMES[2]);
		expect(test.key('-', { ...options, code: 'NumpadSubtract' }).defaultPrevented).toBe(true);
		expect(test.font()).toBe(FONT_NAMES[1]);
		expect(test.key('+', { ...options, code: 'NumpadAdd' }).defaultPrevented).toBe(true);
		expect(test.font()).toBe(FONT_NAMES[2]);
	});

	it('previews every available font without changing source, project revision, or compiler inputs', () => {
		const test = setup();
		const source = serializeToProject(test.state);
		const revision = test.state.projectChange.revision;
		const compilerRevision = test.state.compilerInputRevision;
		const seen = new Set([test.font()]);
		const authored = test.state.editorConfig;
		const configsChanged = vi.fn();
		test.store.subscribe('editorConfig', configsChanged);
		for (const _font of FONT_NAMES.slice(1)) {
			test.key('+', { ctrlKey: true });
			seen.add(test.font());
		}
		test.disposePlugin();
		expect(seen).toEqual(new Set(FONT_NAMES));
		expect(test.state.editorConfig).toBe(authored);
		expect(configsChanged).not.toHaveBeenCalled();
		expect(serializeToProject(test.state)).toEqual(source);
		expect(test.state.projectChange.revision).toBe(revision);
		expect(test.state.compilerInputRevision).toBe(compilerRevision);
	});

	it('retains the preview across source edits and restores the current source setting when disposed', () => {
		const test = setup();
		test.key('+', { ctrlKey: true });
		const previewFont = test.font();
		const codeBlock = test.state.project.rootLevel.blocks.find(block => block.name === 'settings')!;
		applyCodeBlockSourceEdits(test.store, [
			{ codeBlock, code: ['note settings', '; @config font terminus10x18', 'noteEnd'] },
		]);
		expect(test.font()).toBe(previewFont);
		expect(test.state.editorConfig.font).toBe('terminus10x18');
		const revision = test.state.projectChange.revision;
		const authored = test.state.editorConfig;
		test.disposePlugin();
		expect(test.font()).toBe('terminus10x18');
		expect(test.state.editorConfig).toBe(authored);
		expect(test.state.appearance.fontOverride).toBeUndefined();
		expect(test.state.projectChange.revision).toBe(revision);
		expect(test.key('+', { ctrlKey: true }).defaultPrevented).toBe(false);
	});

	it('clears the preview when a replacement project settles', () => {
		const test = setup();
		test.key('+', { ctrlKey: true });
		test.events.dispatch('loadProject', { project: project(FONT_NAMES.at(-1)) });
		expect(test.state.appearance.fontOverride).toBeUndefined();
		expect(test.font()).toBe(FONT_NAMES.at(-1));
		expect(test.key('+', { ctrlKey: true }).defaultPrevented).toBe(true);
		expect(test.state.appearance.fontOverride).toBeUndefined();
		expect(test.font()).toBe(FONT_NAMES.at(-1));
		test.key('-', { ctrlKey: true });
		expect(test.font()).toBe(FONT_NAMES.at(-2));
	});

	it.each([DEFAULT_FONT, 'pixelcode6x12'] as const)(
		'starts from the renderer default %s when source has no font setting and restores its absence',
		defaultFont => {
			const test = setup(defaultFont);
			test.events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
			test.key('+', { ctrlKey: true });
			test.key('-', { ctrlKey: true });
			expect(test.font()).toBe(defaultFont);
			expect(test.state.editorConfig.font).toBeUndefined();
			test.disposePlugin();
			expect(test.state.editorConfig.font).toBeUndefined();
			expect(test.state.appearance.fontOverride).toBeUndefined();
			expect(test.font()).toBe(defaultFont);
		}
	);

	it('leaves plain typing, other shortcuts and the old function keys alone', () => {
		const test = setup();
		for (const key of ['+', '=', '-']) {
			expect(test.key(key).defaultPrevented).toBe(false);
			expect(test.key(key, { shiftKey: true }).defaultPrevented).toBe(false);
			expect(test.key(key, { altKey: true, ctrlKey: true }).defaultPrevented).toBe(false);
			expect(test.key(key, { altKey: true, metaKey: true }).defaultPrevented).toBe(false);
		}
		for (const key of ['F8', 'F9', '0', 'z']) {
			expect(test.key(key).defaultPrevented).toBe(false);
			expect(test.key(key, { ctrlKey: true }).defaultPrevented).toBe(false);
		}
		expect(test.font()).toBe(FONT_NAMES[0]);
	});

	it('ignores other keys and already handled events', () => {
		const test = setup();
		expect(test.key('F7').defaultPrevented).toBe(false);
		test.key('+', { ctrlKey: true }, true);
		expect(test.font()).toBe(FONT_NAMES[0]);
	});

	it('isolates previews between editor instances', () => {
		const first = setup();
		const second = setup();
		first.key('+', { ctrlKey: true });
		expect(second.font()).toBe(FONT_NAMES[0]);
		first.disposePlugin();
		expect(second.key('+', { ctrlKey: true }).defaultPrevented).toBe(true);
		expect(second.font()).toBe(FONT_NAMES[1]);
	});
});
