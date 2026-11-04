/**
 * Types for menu feature - context menus and menu generation.
 */

import type { State } from '../../index';
import type { Position } from '../../shared/types';

interface ContextMenuButton {
	action?: string;
	selector?: string;
	value?: unknown;
	close?: boolean;
	payload?: Record<string, unknown>;
	disabled?: boolean;
	divider?: boolean;
	title?: string;
	isSectionTitle?: boolean;
}

interface MenuItemDivider extends ContextMenuButton {
	divider: true;
	title: never;
}

export type ContextMenuItem = ContextMenuButton | MenuItemDivider;

/** Generates a complete menu from current state and its caller-owned payload. */
export type MenuGenerator<Payload = unknown> = (
	state: State,
	payload: Payload
) => ContextMenuItem[] | Promise<ContextMenuItem[]>;

export interface MenuStackEntry {
	menu: string;
	payload?: unknown;
}

/**
 * Context menu position is stored in editor/world coordinates so it tracks viewport movement.
 */
export interface ContextMenu extends Position {
	items: ContextMenuItem[];
	open: boolean;
	menuStack: MenuStackEntry[];
}

/** Activate a raw item using an index resolved by a menu presentation. Coordinates are viewport-relative. */
export interface ActivateContextMenuItemEvent extends Position {
	index: number;
}
