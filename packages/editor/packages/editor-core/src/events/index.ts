import type {
	EditorEventArguments,
	EventDispatcher,
	EventDispatchOptions,
	EventSubscriptionOptions,
} from '@8f4e/editor-state-types';

export type EventHandler<T> = (event: T) => void;

export interface EventObject {
	stopPropagation?: boolean;
}

export type { EventDispatcher } from '@8f4e/editor-state-types';

interface DisposableEventDispatcher extends EventDispatcher {
	dispatchAsync: <Name extends string, Payload = unknown>(
		type: Name,
		...args: EditorEventArguments<Name, Payload>
	) => Promise<void>;
	dispose: () => void;
}

type Handler = EventHandler<unknown>;
type Subscription = { handler: Handler; layer?: number };
type Phase = 'capture' | 'normal';
type PhaseHandlers = Record<Phase, Handler[]>;
type LayerHandlers = PhaseHandlers & { layer: number };
type Subscriptions = Record<Phase, Subscription[]> & {
	layers: LayerHandlers[];
	ordinary: PhaseHandlers;
};
const PHASES = ['capture', 'normal'] as const;

/** Rebuild snapshots only when registrations change; event delivery just traverses these groups. */
function prepareHandlers(subscriptions: Subscriptions): void {
	const ordinary: PhaseHandlers = { capture: [], normal: [] };
	const layers = new Map<number, LayerHandlers>();
	for (const phase of PHASES) {
		for (const { handler, layer } of subscriptions[phase]) {
			if (layer === undefined) {
				ordinary[phase].push(handler);
				continue;
			}
			let group = layers.get(layer);
			if (!group) {
				group = { layer, capture: [], normal: [] };
				layers.set(layer, group);
			}
			group[phase].push(handler);
		}
	}
	subscriptions.layers = [...layers.values()].sort((a, b) => b.layer - a.layer);
	subscriptions.ordinary = ordinary;
}

export default function events(): DisposableEventDispatcher {
	const subscriptions: Record<string, Subscriptions> = {};

	function on<T>(eventName: string, callback: EventHandler<T>, options: EventSubscriptionOptions = {}): void {
		if (!subscriptions[eventName]) {
			subscriptions[eventName] = { capture: [], normal: [], layers: [], ordinary: { capture: [], normal: [] } };
		}
		const listeners = subscriptions[eventName][options.capture ? 'capture' : 'normal'];
		listeners.push({ handler: callback as Handler, layer: options.layer });
		prepareHandlers(subscriptions[eventName]);
	}

	function off<T>(eventName: string, callback: EventHandler<T>): void {
		const listeners = subscriptions[eventName];
		if (!listeners) return;
		let changed = false;
		for (const phase of PHASES) {
			const handlers = listeners[phase];
			const index = handlers.findIndex(subscription => subscription.handler === callback);
			if (index !== -1) {
				handlers.splice(index, 1);
				changed = true;
			}
		}
		if (changed) prepareHandlers(listeners);
	}

	function dispatch(
		type: string,
		eventObject?: unknown,
		options: EventDispatchOptions = {},
		pending?: Array<void | Promise<void>>
	): void {
		if (!subscriptions[type]) {
			return;
		}
		const listeners = subscriptions[type];
		// UI groups are immutable snapshots; registration changes take effect on the next event.
		for (const group of listeners.layers) {
			for (const phase of PHASES) {
				if (options.phase && options.phase !== phase) continue;
				const handlers = group[phase];
				for (let index = handlers.length - 1; index >= 0; index--) {
					if (eventObject && (eventObject as EventObject).stopPropagation) return;
					const result = handlers[index](eventObject);
					pending?.push(result);
				}
			}
		}
		// Read each ordinary phase when reached, preserving listeners added by the capture phase.
		for (const phase of PHASES) {
			if (options.phase && options.phase !== phase) continue;
			for (const handler of listeners.ordinary[phase]) {
				if (eventObject && (eventObject as EventObject).stopPropagation) return;
				const result = handler(eventObject);
				pending?.push(result);
			}
		}
	}

	const dispatchAsync: DisposableEventDispatcher['dispatchAsync'] = async (type, ...args) => {
		const pending: Array<void | Promise<void>> = [];
		dispatch(type, args[0], {}, pending);
		await Promise.all(pending);
	};

	function dispose(): void {
		for (const listeners of Object.values(subscriptions)) {
			listeners.capture.length = 0;
			listeners.normal.length = 0;
			prepareHandlers(listeners);
		}
	}

	return { on, off, dispatch, dispatchAsync, dispose };
}
