import type { EventDispatcher, RuntimeRegistry, RuntimeRegistryEntry, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { error, log } from '../logger/logger';
import {
	collectRuntimeEditorConfigSchemaContributions,
	registerRuntimeSelectionEditorConfigValidator,
	resolveSelectedRuntimeId,
} from './editorConfig';

/** Owns runtime implementations and loading; state receives metadata and derived source only. */
export default function runtime(
	store: StateManager<State>,
	events: EventDispatcher,
	registry: RuntimeRegistry
): () => void {
	const state = store.getState();
	const loaded = new Map<string, RuntimeRegistryEntry>();
	const loading = new Map<string, Promise<RuntimeRegistryEntry>>();
	let destroyRuntime: (() => void) | undefined;
	let onlineRuntime: string | undefined;
	let initializingRuntime: string | undefined;
	let generation = 0;
	let disposed = false;

	store.set(
		'runtimeRegistry',
		Object.fromEntries(
			Object.entries(registry).map(([id, entry]) => [
				id,
				{ id: entry.id, editorConfigSchema: entry.editorConfigSchema },
			])
		)
	);
	registerRuntimeSelectionEditorConfigValidator(store);

	function syncSchemas() {
		const retained = Object.fromEntries(
			Object.entries(state.editorConfigSchemaContributions).filter(([id]) => !id.startsWith('runtime:'))
		);
		store.set('editorConfigSchemaContributions', {
			...retained,
			...collectRuntimeEditorConfigSchemaContributions(state.editorConfig.runtime, state.runtimeRegistry),
		});
	}

	function syncEnvConstants() {
		const id = resolveSelectedRuntimeId(state.editorConfig.runtime, state.runtimeRegistry);
		const entry = id ? (loaded.get(id) ?? registry[id]) : undefined;
		const lines = entry && 'factory' in entry ? (entry.getEnvConstants?.(state.editorConfig) ?? []) : [];
		const previous = state.envConstantContributions.runtime ?? [];
		if (lines.length !== previous.length || lines.some((line, index) => line !== previous[index])) {
			store.set('envConstantContributions.runtime', lines);
		}
	}

	function syncRuntime() {
		if (disposed) return;
		const id = resolveSelectedRuntimeId(state.editorConfig.runtime, state.runtimeRegistry);
		if (state.compiler.isCompiling) return;
		if (id && (onlineRuntime === id || initializingRuntime === id)) return;

		const request = ++generation;
		initializingRuntime = undefined;
		destroyRuntime?.();
		destroyRuntime = undefined;
		onlineRuntime = undefined;
		if (!id) return;

		function start(entry: RuntimeRegistryEntry) {
			if (disposed || request !== generation) return;
			initializingRuntime = undefined;
			if (state.compiler.isCompiling || state.editorConfig.runtime !== id) return;
			destroyRuntime = entry.factory(store, events);
			onlineRuntime = id;
			log(state, `Successfully initialized runtime: ${id}`, 'Runtime');
		}

		function failed(reason: unknown) {
			if (disposed || request !== generation) return;
			initializingRuntime = undefined;
			error(state, `Failed to initialize runtime ${id}: ${reason instanceof Error ? reason.message : String(reason)}`);
		}

		try {
			const entry = loaded.get(id) ?? registry[id];
			if ('factory' in entry) {
				start(entry);
				return;
			}
			initializingRuntime = id;
			let promise = loading.get(id);
			if (!promise) {
				promise = entry.load();
				loading.set(id, promise);
			}
			void promise
				.then(implementation => {
					if (disposed) return;
					loaded.set(id, implementation);
					store.set('runtimeRegistry', {
						...state.runtimeRegistry,
						[id]: { id: implementation.id, editorConfigSchema: implementation.editorConfigSchema },
					});
					syncSchemas();
					syncEnvConstants();
					start(implementation);
				})
				.catch(reason => {
					loading.delete(id);
					failed(reason);
				});
		} catch (reason) {
			failed(reason);
		}
	}

	function onSelectionChanged() {
		syncSchemas();
		syncEnvConstants();
		syncRuntime();
	}

	syncSchemas();
	syncEnvConstants();
	store.subscribe('compiler.isCompiling', syncRuntime);
	store.subscribe('editorConfig.runtime', onSelectionChanged);
	store.subscribe('editorConfig', syncEnvConstants);

	return () => {
		if (disposed) return;
		disposed = true;
		++generation;
		store.unsubscribe('compiler.isCompiling', syncRuntime);
		store.unsubscribe('editorConfig.runtime', onSelectionChanged);
		store.unsubscribe('editorConfig', syncEnvConstants);
		destroyRuntime?.();
	};
}
