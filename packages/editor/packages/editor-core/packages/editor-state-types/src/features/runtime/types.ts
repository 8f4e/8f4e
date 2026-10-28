/**
 * Types for runtime feature - runtime factories and execution stats.
 */

import type { StateManager } from '@8f4e/state-manager';
import type { EventDispatcher } from '../../shared/types';
import type { EditorConfig, EditorConfigSchemaContribution } from '../editor-config/types';

/**
 * Type for runtime factory function.
 * Note: Uses generic S to allow proper typing while avoiding circular dependency with State.
 * The actual State type is provided when the factory is called.
 */
export type RuntimeFactory<S = any> = (store: StateManager<S>, events: EventDispatcher) => () => void;
export type RuntimeEnvConstantsContributor = (editorConfig: EditorConfig) => string[];

export type RuntimeValueMap = Record<string, unknown>;
export type RuntimeValuesByRuntimeId = Record<string, RuntimeValueMap>;

/** Observable runtime metadata, without executable dependencies. */
export interface RuntimeMetadata {
	/** Unique identifier for this runtime (e.g., 'WebWorkerRuntime') */
	id: string;
	/** Optional editor-config schema contribution advertised by this runtime. */
	editorConfigSchema?: EditorConfigSchemaContribution;
}

/** Executable dependencies supplied directly to the runtime coordinator. */
export interface RuntimeRegistryEntry extends RuntimeMetadata {
	/** Runtime-owned contribution to the auto-generated `constants env` block */
	getEnvConstants?: RuntimeEnvConstantsContributor;
	/** Factory function that creates the runtime instance */
	factory: RuntimeFactory;
}

/** Lazy implementations advertise their configuration before their code is loaded. */
export interface LazyRuntimeRegistryEntry extends RuntimeMetadata {
	load: () => Promise<RuntimeRegistryEntry>;
}

/** Runtime implementations supplied at initialization, outside observable state. */
export type RuntimeRegistry = Record<string, RuntimeRegistryEntry | LazyRuntimeRegistryEntry>;
export type RuntimeMetadataRegistry = Record<string, RuntimeMetadata>;
