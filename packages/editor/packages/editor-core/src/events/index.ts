import type { EventDispatcher, EventSubscriptionOptions } from '@8f4e/editor-state-types';

export type EventHandler<T> = (event: T) => void;

export interface EventObject {
	stopPropagation?: boolean;
}

export type { EventDispatcher } from '@8f4e/editor-state-types';

interface DisposableEventDispatcher extends EventDispatcher {
	dispatchAsync: <T>(type: string, eventObject?: T) => Promise<void>;
	dispose: () => void;
}

// Re-export event types from shared package
export type { InternalMouseEvent } from '@8f4e/editor-state-types';

export default function events(): DisposableEventDispatcher {
	const subscriptions: Record<string, { capture: EventHandler<unknown>[]; normal: EventHandler<unknown>[] }> = {};

	function on<T>(eventName: string, callback: EventHandler<T>, options: EventSubscriptionOptions = {}): void {
		if (!subscriptions[eventName]) {
			subscriptions[eventName] = { capture: [], normal: [] };
		}
		subscriptions[eventName][options.capture ? 'capture' : 'normal'].push(callback as EventHandler<unknown>);
	}

	function off<T>(eventName: string, callback: EventHandler<T>): void {
		const listeners = subscriptions[eventName];
		if (!listeners) return;
		for (const handlers of [listeners.capture, listeners.normal]) {
			const index = handlers.indexOf(callback as EventHandler<unknown>);
			if (index !== -1) handlers.splice(index, 1);
		}
	}

	function dispatch<T>(type: string, eventObject?: T, pending?: Array<void | Promise<void>>): void {
		if (!subscriptions[type]) {
			return;
		}
		for (const handlers of [subscriptions[type].capture, subscriptions[type].normal]) {
			for (const handler of [...handlers]) {
				if (eventObject && (eventObject as EventObject).stopPropagation) return;
				const result = handler(eventObject);
				pending?.push(result);
			}
		}
	}

	async function dispatchAsync<T>(type: string, eventObject?: T): Promise<void> {
		const pending: Array<void | Promise<void>> = [];
		dispatch(type, eventObject, pending);
		await Promise.all(pending);
	}

	function dispose(): void {
		for (const listeners of Object.values(subscriptions)) {
			listeners.capture.length = 0;
			listeners.normal.length = 0;
		}
	}

	return { on, off, dispatch, dispatchAsync, dispose };
}
