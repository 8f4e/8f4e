import { describe, expect, it } from 'vitest';
import { ADD_EXAMPLE_MODULE, buildCategoryTree, EXAMPLE_MODULES_MENU, getCategoryMenuItems } from './categoryMenu';

describe('example module categories', () => {
	it('sorts categories before modules and preserves nested paths', () => {
		const tree = buildCategoryTree([
			{ title: 'Gain', slug: 'gain', category: 'Audio' },
			{ title: 'Delay', slug: 'delay', category: 'Audio/Effects' },
			{ title: 'Compressor', slug: 'compressor', category: 'Audio/Effects' },
			{ title: 'Sine', slug: 'sine', category: 'Functions/Math' },
		]);
		expect(getCategoryMenuItems(tree, []).map(item => item.title)).toEqual(['Audio', 'Functions']);
		expect(getCategoryMenuItems(tree, ['Audio'])).toEqual([
			{
				title: 'Effects',
				action: 'openSubMenu',
				payload: { menu: EXAMPLE_MODULES_MENU, payload: { path: ['Audio', 'Effects'] } },
				close: false,
			},
			{ title: 'Gain', action: ADD_EXAMPLE_MODULE, payload: { slug: 'gain' }, close: true },
		]);
		expect(getCategoryMenuItems(tree, ['Audio', 'Effects']).map(item => item.title)).toEqual(['Compressor', 'Delay']);
	});

	it('includes sources at the catalog root', () => {
		const tree = buildCategoryTree([{ title: 'Root', slug: 'root', category: '' }]);
		expect(getCategoryMenuItems(tree, [])).toEqual([
			{ title: 'Root', action: ADD_EXAMPLE_MODULE, payload: { slug: 'root' }, close: true },
		]);
	});
});
