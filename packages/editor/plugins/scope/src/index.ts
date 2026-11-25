import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockLayoutsChangedEvent, EditorCodeBlock } from '@8f4e/editor-state-types';
import drawScopes from './drawer/draw';
import { createScopeDirectiveReader } from './helpers/data';
import { registerScopeErrors } from './state/errors';
import { registerScopePreparation } from './state/layout';
import { createScopeSampler } from './state/sampling';
import type { Scope } from './types';

/** Samples typed values from live memory into editor-owned histories at the configured rates. */
export function createScopePlugin({ getMemory }: { getMemory: () => WebAssembly.Memory | null }): EditorPlugin {
	return {
		id: 'scope',
		setup: ({ store, events, layout, renderRegistry }) => {
			const state = store.getState();
			const scopesByBlock = new WeakMap<EditorCodeBlock, Scope[]>();
			const readScopeDirectives = createScopeDirectiveReader();
			const sampler = createScopeSampler(getMemory);
			const unregisterErrors = registerScopeErrors(store, readScopeDirectives);
			const preparation = registerScopePreparation(layout, scopesByBlock, readScopeDirectives);
			const unregisterDrawer = renderRegistry.registerCodeBlockDrawer(({ draw, codeBlock }) => {
				const scopes = scopesByBlock.get(codeBlock);
				if (scopes) drawScopes(draw, scopes);
			});

			const syncSampling = () => {
				const ready =
					!state.compiler.isCompiling && state.compiler.result.inputRevision === state.compilerInputRevision;
				const active: Scope[] = [];
				if (ready) {
					for (const block of state.project.activeLevel.blocks) {
						const scopes = scopesByBlock.get(block);
						if (scopes) active.push(...scopes);
					}
				}
				sampler.sync(active);
			};
			const onLayoutsChanged = ({ level }: CodeBlockLayoutsChangedEvent) => {
				if (level === state.project.activeLevel) syncSampling();
			};
			const onCompilerResult = () => {
				preparation.refresh(state);
				syncSampling();
			};
			events.on('codeBlockLayoutsChanged', onLayoutsChanged);
			store.subscribe('project.activeLevel.blocks', syncSampling);
			store.subscribe('compilerInputRevision', syncSampling);
			store.subscribe('compiler.result', onCompilerResult);
			store.subscribe('compiler.isCompiling', syncSampling);
			syncSampling();

			return () => {
				events.off('codeBlockLayoutsChanged', onLayoutsChanged);
				store.unsubscribe('project.activeLevel.blocks', syncSampling);
				store.unsubscribe('compilerInputRevision', syncSampling);
				store.unsubscribe('compiler.result', onCompilerResult);
				store.unsubscribe('compiler.isCompiling', syncSampling);
				sampler.dispose();
				unregisterDrawer();
				preparation.dispose();
				unregisterErrors();
			};
		},
	};
}
