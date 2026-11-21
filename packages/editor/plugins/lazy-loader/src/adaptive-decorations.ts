import type { EditorPlugin, LoadingIndicatorHandle } from '@8f4e/editor-core';
import { logError } from '@8f4e/editor-state';

export interface AdaptiveDecoration {
	id: string;
	load: () => Promise<EditorPlugin>;
}

export interface AdaptiveDecorationsOptions {
	/** Independent, render-only plugins in priority order (most important first). IDs must be unique. */
	decorations: readonly AdaptiveDecoration[];
	/** Share disabled decorations across mounts with the same key. Use the page's document to reset on reload. */
	session: object;
	isVisible: () => boolean;
	watchVisibility: (listener: () => void) => () => void;
	/** Main-thread draw-time budget in milliseconds, independent of display refresh rate. Default: 12. */
	renderBudgetMs?: number;
}

interface DecorationSession {
	disabled: Set<string>;
	onDisable: Set<(id: string) => void>;
}

const sessions = new WeakMap<object, DecorationSession>();
const SLOW_SAMPLE_LIMIT = 3;

/** Start with every decoration enabled. Shed the lowest priority decoration on sustained slow rendering. */
export function createAdaptiveDecorationsPlugin({
	decorations,
	session: sessionKey,
	isVisible,
	watchVisibility,
	renderBudgetMs = 12,
}: AdaptiveDecorationsOptions): EditorPlugin {
	return {
		id: 'adaptive-decorations',
		setup: context => {
			const { store, loading } = context;
			let session = sessions.get(sessionKey);
			if (!session) {
				session = { disabled: new Set(), onDisable: new Set() };
				sessions.set(sessionKey, session);
			}
			const { disabled, onDisable } = session;
			const installed = new Map<string, () => void>();
			const pending = new Map<string, LoadingIndicatorHandle>();
			let disposed = false;
			let checkQueued = false;
			let slowSamples = 0;
			let skipSample = true;
			const resetSamples = () => {
				slowSamples = 0;
				// The next report may span startup, a visibility change, or the previous decoration set.
				skipSample = true;
			};
			const remove = (id: string) => {
				pending.get(id)?.cancel();
				pending.delete(id);
				const cleanup = installed.get(id);
				if (!cleanup) return;
				installed.delete(id);
				resetSamples();
				try {
					cleanup();
				} catch (error) {
					logError(store.getState(), `Failed to dispose decoration ${id}: ${String(error)}`);
				}
			};
			const load = async ({ id, load }: AdaptiveDecoration) => {
				if (disabled.has(id)) return;
				const indicator = loading.add({ id: `plugin:${id}`, message: `Loading ${id}...` });
				pending.set(id, indicator);
				try {
					const plugin = await load();
					if (disposed || disabled.has(id)) return;
					installed.set(id, plugin.setup(context));
					indicator.done();
				} catch (error) {
					if (disposed || disabled.has(id)) return;
					indicator.fail();
					logError(store.getState(), `Failed to load decoration ${id}: ${String(error)}`);
				} finally {
					pending.delete(id);
					indicator.cancel();
				}
			};
			const check = () => {
				checkQueued = false;
				if (disposed || !isVisible() || slowSamples < SLOW_SAMPLE_LIMIT) return;
				const decoration = decorations.findLast(({ id }) => installed.has(id));
				if (!decoration) return;
				disabled.add(decoration.id);
				for (const remove of onDisable) remove(decoration.id);
			};
			const onGraphics = (graphics: ReturnType<typeof store.getState>['info']['graphics']) => {
				if (!isVisible() || pending.size || !installed.size) return;
				const renderTime = graphics?.p90RenderTimeMs;
				if (typeof renderTime !== 'number' || !Number.isFinite(renderTime) || renderTime < 0) return;
				if (skipSample) {
					skipSample = false;
					return;
				}
				slowSamples = renderTime > renderBudgetMs ? slowSamples + 1 : 0;
				if (slowSamples < SLOW_SAMPLE_LIMIT || checkQueued) return;
				checkQueued = true;
				// Reports arrive inside the render loop; unregister drawers after it has finished.
				queueMicrotask(check);
			};
			const unwatchVisibility = watchVisibility(resetSamples);
			onDisable.add(remove);
			store.subscribe('info.graphics', onGraphics);
			for (const decoration of decorations) void load(decoration);
			return () => {
				disposed = true;
				store.unsubscribe('info.graphics', onGraphics);
				unwatchVisibility();
				onDisable.delete(remove);
				for (const indicator of pending.values()) indicator.cancel();
				pending.clear();
				for (const id of [...installed.keys()].reverse()) remove(id);
			};
		},
	};
}
