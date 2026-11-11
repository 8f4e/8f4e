import { CompilerError } from '@8f4e/compiler-diagnostics';
import type { ResolveIncludeRequestMessage, ResolveIncludeResultMessage } from './messages';

export interface IncludeSourceRequestBroker {
	request: (includeId: string) => Promise<string | undefined>;
	finish: (message: ResolveIncludeResultMessage) => void;
}

/** Correlates asynchronous include requests sent across the worker boundary. */
export function createIncludeSourceRequestBroker(
	postMessage: (message: ResolveIncludeRequestMessage) => void
): IncludeSourceRequestBroker {
	let nextRequestId = 0;
	const pendingRequests = new Map<
		number,
		{ resolve: (source: string | undefined) => void; reject: (error: unknown) => void }
	>();

	return {
		request(includeId) {
			const requestId = nextRequestId++;
			return new Promise((resolve, reject) => {
				pendingRequests.set(requestId, { resolve, reject });
				postMessage({
					type: 'resolveInclude',
					payload: { requestId, includeId },
				});
			});
		},
		finish(message) {
			const pending = pendingRequests.get(message.payload.requestId);
			if (!pending) return;
			pendingRequests.delete(message.payload.requestId);
			if ('error' in message.payload) {
				pending.reject(new CompilerError(message.payload.error));
			} else {
				pending.resolve(message.payload.source);
			}
		},
	};
}
