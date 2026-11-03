import type { EditorPlugin } from '@8f4e/editor-core';
import { logError } from '@8f4e/editor-state';

/** Core emits ready after project preparation, font-atlas loading, and rendering. */
export function createDeferredPluginLoaderPlugin({
	load,
}: {
	load: () => Promise<readonly EditorPlugin[]>;
}): EditorPlugin {
	return {
		id: 'deferred-loader',
		setup: context => {
			let disposed = false;
			const cleanups: Array<() => void> = [];
			const release = () => {
				const errors: unknown[] = [];
				for (const cleanup of cleanups.splice(0).reverse()) {
					try {
						cleanup();
					} catch (error) {
						errors.push(error);
					}
				}
				if (errors.length) throw new AggregateError(errors, 'Deferred plugin cleanup failed');
			};
			const activate = async () => {
				if (disposed) return;
				try {
					const plugins = await load();
					if (disposed) return;
					for (const plugin of plugins) cleanups.push(plugin.setup(context));
				} catch (error) {
					const errors = [error];
					try {
						release();
					} catch (cleanupError) {
						errors.push(cleanupError);
					}
					if (!disposed)
						logError(context.store.getState(), `Failed to load deferred plugins: ${errors.map(String).join('; ')}`);
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
				release();
			};
		},
	};
}
