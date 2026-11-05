import type { EventDispatcher, EventDispatchOptions, EventSubscriptionOptions } from '@8f4e/editor-state-types';

export type EventHandler<T> = (event: T) => void;

export interface EventObject {
	stopPropagation?: boolean;
}

export type { EventDispatcher } from '@8f4e/editor-state-types';

interface DisposableEventDispatcher extends EventDispatcher {
	dispatchAsync: <T>(type: string, eventObject?: T) => Promise<void>;
	dispose: () => void;
}

export default function events(): DisposableEventDispatcher {
	type Subscription = { handler: EventHandler<unknown>; layer?: number };
	const subscriptions: Record<string, { capture: Subscription[]; normal: Subscription[] }> = {};

	function on<T>(eventName: string, callback: EventHandler<T>, options: EventSubscriptionOptions = {}): void {
		if (!subscriptions[eventName]) {
			subscriptions[eventName] = { capture: [], normal: [] };
		}
		const listeners = subscriptions[eventName][options.capture ? 'capture' : 'normal'];
		listeners.push({ handler: callback as EventHandler<unknown>, layer: options.layer });
	}

	function off<T>(eventName: string, callback: EventHandler<T>): void {
		const listeners = subscriptions[eventName];
		if (!listeners) return;
		for (const handlers of [listeners.capture, listeners.normal]) {
			const index = handlers.findIndex(subscription => subscription.handler === callback);
			if (index !== -1) handlers.splice(index, 1);
		}
	}

	function dispatch<T>(
		type: string,
		eventObject?: T,
		options: EventDispatchOptions = {},
		pending?: Array<void | Promise<void>>
	): void {
		if (!subscriptions[type]) {
			return;
		}
		const listeners = subscriptions[type];
		const phaseNames = options.phase ? [options.phase] : (['capture', 'normal'] as const);
		// UI registrations are snapshotted together; ordinary listeners keep their existing phase-by-phase delivery.
		const phases = phaseNames.map(phase => [...listeners[phase]]);
		const layers = [...new Set(phases.flat().flatMap(({ layer }) => (layer === undefined ? [] : [layer])))].sort(
			(a, b) => b - a
		);
		const ordered = layers.flatMap(layer =>
			phases.flatMap(handlers => handlers.filter(subscription => subscription.layer === layer).reverse())
		);
		for (const { handler } of ordered) {
			if (eventObject && (eventObject as EventObject).stopPropagation) return;
			const result = handler(eventObject);
			pending?.push(result);
		}
		for (const phase of phaseNames) {
			for (const { handler, layer } of [...listeners[phase]]) {
				if (layer !== undefined) continue;
				if (eventObject && (eventObject as EventObject).stopPropagation) return;
				const result = handler(eventObject);
				pending?.push(result);
			}
		}
	}

	async function dispatchAsync<T>(type: string, eventObject?: T): Promise<void> {
		const pending: Array<void | Promise<void>> = [];
		dispatch(type, eventObject, {}, pending);
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
