import type { EditorPlugin } from '@8f4e/editor-core';
import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import drawScopes from './drawer/draw';
import { registerScopeErrors } from './state/errors';
import { registerScopeLayout } from './state/layout';
import { createScopeSampler } from './state/sampling';
import type { Scope } from './types';

/** Samples typed values from live memory into editor-owned histories at the configured rates. */
export function createScopePlugin({ getMemory }: { getMemory: () => WebAssembly.Memory | null }): EditorPlugin {
	return {
		id: 'scope',
		setup: ({ store, events, layout, drawers }) => {
			const state = store.getState();
			const scopesByBlock = new WeakMap<CodeBlockGraphicData, Scope[]>();
			const sampler = createScopeSampler(getMemory);
			const unregisterErrors = registerScopeErrors(store);
			const unregisterLayout = registerScopeLayout(layout, scopesByBlock);
			const unregisterDrawer = drawers.registerCodeBlockDrawer(({ draw, codeBlock }) => {
				drawScopes(draw, scopesByBlock.get(codeBlock) ?? []);
			});

			const syncSampling = () => {
				const ready =
					!state.compiler.isCompiling && state.compiler.result.inputRevision === state.compilerInputRevision;
				sampler.sync(
					ready ? state.codeBlockRendering.currentProject.blocks.flatMap(block => scopesByBlock.get(block) ?? []) : []
				);
			};
			events.on('codeBlockLayoutsChanged', syncSampling);
			store.subscribe('codeBlockRendering.currentProject.blocks', syncSampling);
			store.subscribe('compilerInputRevision', syncSampling);
			store.subscribe('compiler.isCompiling', syncSampling);
			syncSampling();

			return () => {
				events.off('codeBlockLayoutsChanged', syncSampling);
				store.unsubscribe('codeBlockRendering.currentProject.blocks', syncSampling);
				store.unsubscribe('compilerInputRevision', syncSampling);
				store.unsubscribe('compiler.isCompiling', syncSampling);
				sampler.dispose();
				unregisterDrawer();
				unregisterLayout();
				unregisterErrors();
			};
		},
	};
}
