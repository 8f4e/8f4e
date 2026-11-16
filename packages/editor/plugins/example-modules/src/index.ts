import type { EditorPlugin, LoadingIndicatorHandle } from '@8f4e/editor-core';
import { getBlockType, getCodeBlockNameFromSource, insertCodeBlock } from '@8f4e/editor-state';
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
			const pendingLoads = new Set<LoadingIndicatorHandle>();
			const loadSource = async (slug: string) => {
				const indicator = loading.add({ id: `module:${slug}`, message: `Loading module ${slug}...` });
				pendingLoads.add(indicator);
				try {
					const source = await catalog.getModule(slug);
					indicator.done();
					return source;
				} catch (error) {
					indicator.fail();
					throw error;
				} finally {
					pendingLoads.delete(indicator);
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
				const block = insertCodeBlock(store, { code, x, y })!;
				const gap = 4;
				let gridX = block.gridX + block.width / state.viewport.vGrid + gap;
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
					const insertedDependency = insertCodeBlock(store, {
						code: dependencyCode,
						x: gridX * state.viewport.vGrid - state.viewport.x,
						y,
					})!;
					gridX = insertedDependency.gridX + insertedDependency.width / state.viewport.vGrid + gap;
				}
			};
			events.on(ADD_EXAMPLE_MODULE, addModule);
			return () => {
				disposed = true;
				for (const indicator of pendingLoads) indicator.cancel();
				pendingLoads.clear();
				events.off(ADD_EXAMPLE_MODULE, addModule);
				unregisterItem();
				unregisterMenu();
			};
		},
	};
}
