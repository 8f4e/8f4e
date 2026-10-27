import type { ContextMenu } from '@8f4e/editor-state-types';

export default function generateContextMenuMock(): ContextMenu {
	return {
		highlightedItem: Infinity,
		itemWidth: 248,
		items: [
			{
				title: '.................... New Module',
				action: 'addCodeBlock',
				payload: {
					isNew: true,
				},
				close: true,
			},
			{
				title: '.............. Paste Code Block',
				action: 'addCodeBlock',
				payload: {
					isPaste: true,
				},
				close: true,
			},
			{
				title: '......... Add Built-in Module >',
				action: 'openSubMenu',
				payload: {
					menu: 'moduleCategoriesMenu',
				},
				close: false,
				disabled: false,
			},
			{
				divider: true,
			},
			{
				title: '................... New Project',
				action: 'new',
				close: true,
			},
			{
				divider: true,
			},
			{
				title: '................ Open From Disk',
				action: 'open',
				close: true,
				disabled: false,
			},
		],
		open: true,
		x: 552,
		y: 256,
		menuStack: [],
	};
}
