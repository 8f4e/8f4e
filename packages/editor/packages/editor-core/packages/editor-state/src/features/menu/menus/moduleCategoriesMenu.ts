import type { ContextMenuItem, State } from '@8f4e/editor-state-types';
import type { CategoryItem } from '../categoryTree';
import { buildCategoryTree, getNodeAtPath, nodeToMenuItems } from '../categoryTree';

export const moduleCategoriesMenu = async (state: State, path: string[]): Promise<ContextMenuItem[]> => {
	if (!state.callbacks.getListOfModules) {
		return [];
	}
	const modules = await state.callbacks.getListOfModules();

	const categoryItems: CategoryItem[] = modules.map(module => ({
		title: module.title,
		slug: module.slug,
		category: module.category,
	}));

	const tree = buildCategoryTree(categoryItems);
	const node = path.length === 0 ? tree : getNodeAtPath(tree, path);

	if (!node) {
		return [];
	}

	return nodeToMenuItems(node, path, 'moduleCategoriesMenu', 'addCodeBlockBySlug', 'codeBlockSlug');
};
