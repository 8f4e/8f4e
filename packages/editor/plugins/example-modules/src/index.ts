import type { EditorPlugin } from '@8f4e/editor-core';
import { getBlockType, getCodeBlockGridWidth, getCodeBlockNameFromSource } from '@8f4e/editor-state';
import { createModuleCatalog } from './catalog';
import { ADD_EXAMPLE_MODULE, buildCategoryTree, EXAMPLE_MODULES_MENU, getCategoryMenuItems } from './categoryMenu';
import extractPublicBlockFromModuleSource from './extractPublicBlockFromModuleSource';

export function createExampleModulesPlugin({
	sources,
}: {
	/** Lazy source loaders keyed by module-relative paths without the .8f4em extension. */
	sources: ReadonlyMap<string, () => Promise<string>>;
}): EditorPlugin {
	return {
		id: 'example-modules',
		setup: ({ store, events, menus, loading }) => {
			const state = store.getState();
			const catalog = createModuleCatalog(sources);
			const categories = buildCategoryTree(catalog.modules);
			let disposed = false;
			const pendingLoads = new Set<() => void>();
			const loadSource = async (slug: string) => {
				const finishLoading = loading.add({ name: `module ${slug}` });
				pendingLoads.add(finishLoading);
				try {
					return await catalog.getModule(slug);
				} finally {
					pendingLoads.delete(finishLoading);
					finishLoading();
				}
			};
			const unregisterMenu = menus.registerMenu(EXAMPLE_MODULES_MENU, (_state, { path }: { path: string[] }) =>
				getCategoryMenuItems(categories, path)
			);
			const unregisterItem = menus.registerItem('mainMenu', ({ state }) =>
				state.editorMode === 'edit'
					? {
							title: 'Add Built-in Block',
							action: 'openSubMenu',
							payload: { menu: EXAMPLE_MODULES_MENU, payload: { path: [] } },
							close: false,
						}
					: undefined
			);

			const addModule = async ({ slug, x, y }: { slug: string; x: number; y: number }) => {
				if (disposed || state.editorMode !== 'edit') return;
				const source = await loadSource(slug);
				if (disposed || state.editorMode !== 'edit') return;
				const code = extractPublicBlockFromModuleSource(source);
				events.dispatch('insertCodeBlock', { code, x, y });
				const gap = 4;
				const vGrid = state.viewport.vGrid;
				let gridX = Math.round((state.viewport.x + x) / vGrid) + getCodeBlockGridWidth(code) + gap;
				for (const dependency of catalog.getDependenciesFromSource(slug, source)) {
					if (disposed || state.editorMode !== 'edit') return;
					let dependencySource: string;
					try {
						dependencySource = await loadSource(dependency);
					} catch (error) {
						console.warn(`Failed to load dependency: ${dependency}`, error);
						continue;
					}
					if (disposed || state.editorMode !== 'edit') return;
					const dependencyCode = extractPublicBlockFromModuleSource(dependencySource);
					const name = getCodeBlockNameFromSource(dependencyCode);
					const type = getBlockType(dependencyCode);
					if (
						state.codeBlockRendering.currentProject.blocks.some(
							block => block.name === name && block.blockType === type
						)
					)
						continue;
					events.dispatch('insertCodeBlock', {
						code: dependencyCode,
						x: gridX * vGrid - state.viewport.x,
						y,
					});
					gridX += getCodeBlockGridWidth(dependencyCode) + gap;
				}
			};
			events.on(ADD_EXAMPLE_MODULE, addModule);
			return () => {
				disposed = true;
				for (const finishLoading of pendingLoads) finishLoading();
				pendingLoads.clear();
				events.off(ADD_EXAMPLE_MODULE, addModule);
				unregisterItem();
				unregisterMenu();
			};
		},
	};
}
