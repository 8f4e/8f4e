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
		setup: ({ store, events, menus }) => {
			const state = store.getState();
			const catalog = createModuleCatalog(sources);
			const categories = buildCategoryTree(catalog.modules);
			let disposed = false;
			const unregisterMenu = menus.registerMenu(EXAMPLE_MODULES_MENU, (_state, { path }: { path: string[] }) =>
				getCategoryMenuItems(categories, path)
			);
			const unregisterItem = menus.registerItem('mainMenu', ({ state }) =>
				state.featureFlags.editing
					? {
							title: 'Add Built-in Module',
							action: 'openSubMenu',
							payload: { menu: EXAMPLE_MODULES_MENU, payload: { path: [] } },
							close: false,
						}
					: undefined
			);

			const addModule = async ({ slug, x, y }: { slug: string; x: number; y: number }) => {
				if (!state.featureFlags.editing) return;
				const source = await catalog.getModule(slug);
				if (disposed || !state.featureFlags.editing) return;
				const code = extractPublicBlockFromModuleSource(source);
				events.dispatch('addCodeBlock', { code, x, y, isNew: false });
				const gap = 4;
				const vGrid = state.viewport.vGrid;
				let gridX = Math.round((state.viewport.x + x) / vGrid) + getCodeBlockGridWidth(code) + gap;
				for (const dependency of catalog.getDependenciesFromSource(slug, source)) {
					let dependencySource: string;
					try {
						dependencySource = await catalog.getModule(dependency);
					} catch (error) {
						console.warn(`Failed to load dependency: ${dependency}`, error);
						continue;
					}
					if (disposed || !state.featureFlags.editing) return;
					const dependencyCode = extractPublicBlockFromModuleSource(dependencySource);
					const name = getCodeBlockNameFromSource(dependencyCode);
					const type = getBlockType(dependencyCode);
					if (
						state.codeBlockRendering.codeBlocks.some(block => block.name === name && getBlockType(block.code) === type)
					)
						continue;
					events.dispatch('addCodeBlock', {
						code: dependencyCode,
						x: gridX * vGrid - state.viewport.x,
						y,
						isNew: false,
					});
					gridX += getCodeBlockGridWidth(dependencyCode) + gap;
				}
			};
			events.on(ADD_EXAMPLE_MODULE, addModule);
			return () => {
				disposed = true;
				events.off(ADD_EXAMPLE_MODULE, addModule);
				unregisterItem();
				unregisterMenu();
			};
		},
	};
}
