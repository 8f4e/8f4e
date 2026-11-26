import type { EditorPlugin, LoadingIndicatorHandle } from '@8f4e/editor-core';
import { logError } from '@8f4e/editor-state';

/** Core emits ready after project preparation, font-atlas loading, and rendering. */
export function createDeferredPluginLoaderPlugin({ load }: { load: () => Promise<EditorPlugin> }): EditorPlugin {
	return {
		id: 'deferred-loader',
		setup: context => {
			let disposed = false;
			let cleanup: (() => void) | undefined;
			let indicator: LoadingIndicatorHandle | undefined;
			const activate = async () => {
				if (disposed) return;
				indicator = context.loading.add({ id: 'editor-plugins', message: 'Loading editor plugins...' });
				try {
					const plugin = await load();
					if (disposed) return;
					cleanup = plugin.setup(context);
					indicator.done();
				} catch (error) {
					indicator.fail();
					if (!disposed) logError(context.store.getState(), `Failed to load deferred plugin: ${String(error)}`);
				} finally {
					indicator.cancel();
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
				indicator?.cancel();
				cleanup?.();
			};
		},
	};
}
