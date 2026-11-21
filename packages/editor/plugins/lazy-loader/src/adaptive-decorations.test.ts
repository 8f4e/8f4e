import type { EditorPlugin } from '@8f4e/editor-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setup as setupEditor } from './__tests__/editor';
import { type AdaptiveDecoration, createAdaptiveDecorationsPlugin } from './adaptive-decorations';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

function decoration(id: string) {
	const cleanup = vi.fn();
	const plugin: EditorPlugin = { id, setup: vi.fn(() => cleanup) };
	const registration = { id, load: vi.fn(async () => plugin) } satisfies AdaptiveDecoration;
	return { registration, plugin, cleanup };
}

function setup(decorations: readonly AdaptiveDecoration[], session = {}) {
	const context = setupEditor([]);
	let visible = true;
	let onVisibilityChange: (() => void) | undefined;
	const stopWatching = vi.fn(() => {
		onVisibilityChange = undefined;
	});
	const stop = createAdaptiveDecorationsPlugin({
		decorations,
		session,
		isVisible: () => visible,
		watchVisibility: listener => {
			onVisibilityChange = listener;
			return stopWatching;
		},
	}).setup(context);
	const dispose = vi.fn(stop);
	cleanups.push(() => {
		if (!dispose.mock.calls.length) dispose();
	});
	return {
		dispose,
		stopWatching,
		loadProject: context.load,
		setVisible(value: boolean) {
			visible = value;
			onVisibilityChange?.();
		},
		async report(p90RenderTimeMs: number, count = 1, fps = 60) {
			for (let i = 0; i < count; i++) {
				context.store.set('info.graphics', { p90RenderTimeMs, fps });
				await Promise.resolve();
			}
		},
	};
}

describe('adaptive decorations', () => {
	it('starts every decoration, then disables one at a time in reverse priority order', async () => {
		const high = decoration('high');
		const low = decoration('low');
		let finishHigh!: (plugin: EditorPlugin) => void;
		high.registration.load.mockImplementationOnce(() => new Promise(resolve => (finishHigh = resolve)));
		const editor = setup([high.registration, low.registration]);
		expect(high.registration.load).toHaveBeenCalledOnce();
		expect(low.registration.load).toHaveBeenCalledOnce();
		await Promise.resolve();
		await editor.report(20, 5);
		expect(low.cleanup).not.toHaveBeenCalled();

		finishHigh(high.plugin);
		await Promise.resolve();
		await editor.report(20, 3); // One startup sample and two slow reports.
		expect(low.cleanup).not.toHaveBeenCalled();
		await editor.report(20);
		expect(low.cleanup).toHaveBeenCalledOnce();
		expect(high.cleanup).not.toHaveBeenCalled();

		await editor.report(20, 3); // Skip a mixed sample and measure the remaining decoration.
		expect(high.cleanup).not.toHaveBeenCalled();
		await editor.report(20);
		expect(high.cleanup).toHaveBeenCalledOnce();
	});

	it('keeps cheap decorations at 30 FPS and resets after a good report', async () => {
		const effect = decoration('effect');
		const editor = setup([effect.registration]);
		await Promise.resolve();
		await editor.report(2, 5, 30);
		await editor.report(20, 2, 60);
		await editor.report(12, 1, 30);
		await editor.report(20, 2, 60);
		expect(effect.cleanup).not.toHaveBeenCalled();
		await editor.report(20, 1, 60);
		expect(effect.cleanup).toHaveBeenCalledOnce();
	});

	it('ignores background samples and starts a fresh window when visible again', async () => {
		const effect = decoration('effect');
		const editor = setup([effect.registration]);
		await Promise.resolve();
		await editor.report(20, 3);
		editor.setVisible(false);
		await editor.report(20, 6);
		editor.setVisible(true);
		await editor.report(20, 3);
		expect(effect.cleanup).not.toHaveBeenCalled();
		await editor.report(20);
		expect(effect.cleanup).toHaveBeenCalledOnce();
	});

	it('remembers what was disabled across project changes and mounts, but not on a new page', async () => {
		const session = {};
		const effect = decoration('effect');
		const first = setup([effect.registration], session);
		const peer = setup([effect.registration], session);
		await Promise.resolve();
		await first.report(20, 4);
		expect(effect.cleanup).toHaveBeenCalledTimes(2);
		first.loadProject('8f4e/v1\nentry main\nentryEnd');
		await first.report(2, 6);
		expect(effect.registration.load).toHaveBeenCalledTimes(2);
		first.dispose();
		peer.dispose();

		setup([effect.registration], session);
		expect(effect.registration.load).toHaveBeenCalledTimes(2);
		setup([effect.registration]);
		expect(effect.registration.load).toHaveBeenCalledTimes(3);
	});

	it('does not install a pending decoration after the editor closes', async () => {
		const effect = decoration('effect');
		let finish!: (plugin: EditorPlugin) => void;
		effect.registration.load.mockImplementationOnce(() => new Promise(resolve => (finish = resolve)));
		const editor = setup([effect.registration]);
		editor.dispose();
		finish(effect.plugin);
		await Promise.resolve();
		expect(effect.plugin.setup).not.toHaveBeenCalled();
		expect(editor.stopWatching).toHaveBeenCalledOnce();
	});
});
