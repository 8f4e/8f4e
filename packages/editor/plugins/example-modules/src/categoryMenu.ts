import type { ContextMenuItem } from '@8f4e/editor-state-types';

export const EXAMPLE_MODULES_MENU = 'exampleModulesMenu';
export const ADD_EXAMPLE_MODULE = 'addExampleModule';

interface CategoryNode {
	children: Map<string, CategoryNode>;
	items: Array<{ title: string; slug: string }>;
}

export function buildCategoryTree(items: Array<{ title: string; slug: string; category: string }>): CategoryNode {
	const root: CategoryNode = { children: new Map(), items: [] };
	for (const item of items) {
		let node = root;
		for (const segment of item.category.split('/').filter(Boolean)) {
			if (!node.children.has(segment)) node.children.set(segment, { children: new Map(), items: [] });
			node = node.children.get(segment)!;
		}
		node.items.push(item);
	}
	return root;
}

export function getCategoryMenuItems(root: CategoryNode, path: string[]): ContextMenuItem[] {
	let node = root;
	for (const segment of path) node = node.children.get(segment)!;
	return [
		...[...node.children.keys()]
			.sort((a, b) => a.localeCompare(b))
			.map(name => ({
				title: name,
				action: 'openSubMenu',
				payload: { menu: EXAMPLE_MODULES_MENU, payload: { path: [...path, name] } },
				close: false,
			})),
		...[...node.items]
			.sort((a, b) => a.title.localeCompare(b.title))
			.map(item => ({
				title: item.title,
				action: ADD_EXAMPLE_MODULE,
				payload: { slug: item.slug },
				close: true,
			})),
	];
}
