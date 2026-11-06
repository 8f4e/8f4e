import type { CodeBlockLayoutsChangedEvent, EventDispatcher } from '@8f4e/editor-state-types';
import { expectTypeOf, it } from 'vitest';
import type createEvents from './index';

it('requires lifecycle payloads and infers them from their event names', () => {
	// Compile this contract without executing its deliberately invalid examples.
	const check = (events: EventDispatcher) => {
		events.dispatch('ready');
		events.dispatch('codeBlockLayoutsChanged', { codeBlocks: [] });
		events.dispatch('codeBlockSourcesChanged', { codeBlocks: [] });
		events.on('codeBlockLayoutsChanged', event => {
			expectTypeOf(event).toEqualTypeOf<CodeBlockLayoutsChangedEvent>();
		});
		events.on('customPluginAction', (event: { value: number }) => event.value);
		// @ts-expect-error The completed-block list is required.
		events.dispatch('codeBlockLayoutsChanged');
		// @ts-expect-error A source update must identify its blocks.
		events.dispatch('codeBlockSourcesChanged', {});
		// @ts-expect-error Compiler completion supplies accepted memory.
		events.dispatch('compilationSucceeded', { memoryRef: 'memory' });
		// @ts-expect-error A lifecycle handler cannot replace its declared payload.
		events.on('codeBlockLayoutsChanged', (event: { unrelated: boolean }) => event.unrelated);
		// @ts-expect-error Void lifecycle notifications take no data object.
		events.dispatch('ready', { unexpected: true });
	};
	expectTypeOf(check).toBeFunction();
	const checkAsync = (events: ReturnType<typeof createEvents>) => {
		events.dispatchAsync('init');
		events.dispatchAsync('codeBlockLayoutsChanged', { codeBlocks: [] });
		// @ts-expect-error Async delivery enforces the same required payload.
		events.dispatchAsync('codeBlockLayoutsChanged');
	};
	expectTypeOf(checkAsync).toBeFunction();
});
