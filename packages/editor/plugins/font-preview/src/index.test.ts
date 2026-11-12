import { applyCodeBlockSourceEdits, EMPTY_DEFAULT_PROJECT, serializeToProject } from '@8f4e/editor-state';
import { DEFAULT_FONT, FONT_NAMES } from '@8f4e/sprite-generator';
import { describe, expect, it } from 'vitest';
import { project, setup } from './__tests__/setup';

describe('font preview', () => {
	it.each(['view', 'edit'] as const)('cycles forwards and backwards with wrapping in %s mode', mode => {
		const test = setup();
		test.store.set('editorMode', mode);
		expect(test.key('F19').defaultPrevented).toBe(true);
		expect(test.state.editorConfig.font).toBe(FONT_NAMES[1]);
		expect(test.key('F18').defaultPrevented).toBe(true);
		expect(test.state.editorConfig.font).toBe(FONT_NAMES[0]);
		test.key('F18');
		expect(test.state.editorConfig.font).toBe(FONT_NAMES.at(-1));
		test.key('F19');
		expect(test.state.editorConfig.font).toBe(FONT_NAMES[0]);
	});

	it('previews every available font without changing source, project revision, or compiler inputs', () => {
		const test = setup();
		const source = serializeToProject(test.state);
		const revision = test.state.projectChange.revision;
		const compilerRevision = test.state.compilerInputRevision;
		const seen = new Set();
		for (const _font of FONT_NAMES) {
			test.key('F19');
			seen.add(test.state.editorConfig.font);
		}
		expect(seen).toEqual(new Set(FONT_NAMES));
		expect(serializeToProject(test.state)).toEqual(source);
		expect(test.state.projectChange.revision).toBe(revision);
		expect(test.state.compilerInputRevision).toBe(compilerRevision);
	});

	it('retains the preview across source edits and restores the current source setting when disposed', () => {
		const test = setup();
		test.key('F19');
		const previewFont = test.state.editorConfig.font;
		const codeBlock = test.state.codeBlockRendering.rootProject.blocks.find(block => block.name === 'settings')!;
		applyCodeBlockSourceEdits(test, [
			{ codeBlock, code: ['note settings', '; @config font terminus10x18', 'noteEnd'] },
		]);
		expect(test.state.editorConfig.font).toBe(previewFont);
		const revision = test.state.projectChange.revision;
		test.disposePlugin();
		expect(test.state.editorConfig.font).toBe('terminus10x18');
		expect(test.state.projectChange.revision).toBe(revision);
		expect(test.key('F19').defaultPrevented).toBe(false);
	});

	it('clears the preview before resolving a replacement project', () => {
		const test = setup();
		test.key('F19');
		test.events.dispatch('loadProject', { project: project(FONT_NAMES.at(-1)) });
		expect(test.state.editorConfig.font).toBe(FONT_NAMES.at(-1));
		test.key('F19');
		expect(test.state.editorConfig.font).toBe(FONT_NAMES[0]);
	});

	it.each([DEFAULT_FONT, 'pixelcode6x12'] as const)(
		'starts from the renderer default %s when source has no font setting and restores its absence',
		defaultFont => {
			const test = setup(defaultFont);
			test.events.dispatch('loadProject', { project: EMPTY_DEFAULT_PROJECT });
			test.key('F19');
			test.key('F18');
			expect(test.state.editorConfig.font).toBe(defaultFont);
			test.disposePlugin();
			expect(test.state.editorConfig.font).toBeUndefined();
		}
	);

	it.each(['altKey', 'ctrlKey', 'metaKey', 'shiftKey'])('leaves modified function keys alone (%s)', modifier => {
		const test = setup();
		for (const key of ['F18', 'F19']) expect(test.key(key, { [modifier]: true }).defaultPrevented).toBe(false);
		expect(test.state.editorConfig.font).toBe(FONT_NAMES[0]);
	});

	it('ignores other keys and already handled events', () => {
		const test = setup();
		expect(test.key('F7').defaultPrevented).toBe(false);
		test.key('F19', {}, true);
		expect(test.state.editorConfig.font).toBe(FONT_NAMES[0]);
	});

	it('isolates previews between editor instances', () => {
		const first = setup();
		const second = setup();
		first.key('F19');
		expect(second.state.editorConfig.font).toBe(FONT_NAMES[0]);
		first.disposePlugin();
		expect(second.key('F19').defaultPrevented).toBe(true);
		expect(second.state.editorConfig.font).toBe(FONT_NAMES[1]);
	});
});
