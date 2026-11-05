import type { EditorPlugin } from '@8f4e/editor-core';
import { addLoadingIndicator, logError } from '@8f4e/editor-state';

/** Core emits ready after project preparation, font-atlas loading, and rendering. */
export function createDeferredPluginLoaderPlugin({ load }: { load: () => Promise<EditorPlugin> }): EditorPlugin {
	return {
		id: 'deferred-loader',
		setup: context => {
			let disposed = false;
			let cleanup: (() => void) | undefined;
			let finishLoading: (() => void) | undefined;
			const activate = async () => {
				if (disposed) return;
				finishLoading = addLoadingIndicator(context.store, { name: 'editor plugins' });
				try {
					const plugin = await load();
					if (disposed) return;
					cleanup = plugin.setup(context);
				} catch (error) {
					if (!disposed) logError(context.store.getState(), `Failed to load deferred plugin: ${String(error)}`);
				} finally {
					finishLoading();
				}
			};
			const initialize = () => {
				context.events.off('ready', initialize);
				void activate();
			};
			context.events.on('ready', initialize);
			return () => {
				if (disposed) return;
				disposed = true;
				context.events.off('ready', initialize);
				finishLoading?.();
				cleanup?.();
			};
		},
	};
}
