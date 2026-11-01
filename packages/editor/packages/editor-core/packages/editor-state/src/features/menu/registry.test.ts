import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it } from 'vitest';
import createMenuRegistry from './registry';

describe('menu registry', () => {
	it('keeps main-menu and block-menu contributions separate', () => {
		const registry = createMenuRegistry();
		const state = createMockState();
		const codeBlock = createMockCodeBlock();
		const unregister = registry.registerItem('mainMenu', ({ state }) => ({ title: state.editorMode }));
		registry.registerItem('moduleMenu', ({ codeBlock }) => ({ title: codeBlock.name }));
		expect(registry.getItems('mainMenu', { state })).toEqual([{ title: 'edit' }]);
		expect(registry.getItems('moduleMenu', { state, codeBlock })).toEqual([{ title: codeBlock.name }]);
		state.editorMode = 'view';
		expect(registry.getItems('mainMenu', { state })).toEqual([{ title: 'view' }]);
		unregister();
		expect(registry.getItems('mainMenu', { state })).toEqual([]);
	});

	it('derives items from the current context in registration order and supports removal', () => {
		const registry = createMenuRegistry();
		const state = createMockState();
		const codeBlock = createMockCodeBlock({ name: 'first' });
		const unregister = registry.registerItem('moduleMenu', ({ codeBlock }) => ({ title: codeBlock.name }));
		registry.registerItem('moduleMenu', ({ state }) =>
			state.editorMode === 'edit' ? { title: 'Edit action' } : undefined
		);
		expect(registry.getItems('moduleMenu', { state, codeBlock }).map(item => item.title)).toEqual([
			'first',
			'Edit action',
		]);
		codeBlock.name = 'updated';
		state.editorMode = 'view';
		expect(registry.getItems('moduleMenu', { state, codeBlock })).toEqual([{ title: 'updated' }]);
		unregister();
		unregister();
		expect(registry.getItems('moduleMenu', { state, codeBlock })).toEqual([]);
	});
	it('generates sync and async menus with current state and typed payloads, and unregisters them', async () => {
		const registry = createMenuRegistry();
		const state = createMockState();
		registry.registerMenu('status', state => [{ title: state.editorMode }]);
		const unregister = registry.registerMenu('details', async (state, { name }: { name: string }) => [
			{ title: `${state.editorMode}: ${name}` },
		]);
		expect(registry.generateMenu({ menu: 'status' }, state)).toEqual([{ title: 'edit' }]);
		state.editorMode = 'view';
		await expect(registry.generateMenu({ menu: 'details', payload: { name: 'target' } }, state)).resolves.toEqual([
			{ title: 'view: target' },
		]);
		unregister();
		expect(() => registry.generateMenu({ menu: 'details' }, state)).toThrow();
		expect(registry.generateMenu({ menu: 'status' }, state)).toEqual([{ title: 'view' }]);
	});
});
