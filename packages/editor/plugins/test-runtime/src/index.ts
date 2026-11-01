import type { EditorPlugin } from '@8f4e/editor-core';
import type { AssertionSite } from '@8f4e/language-spec';
import type { TestRunResult } from '@8f4e/runtime-test-runner/types';
import WorkerConstructor from '@8f4e/runtime-test-runner?worker';
import { formatAssertionExpectation, formatTestFailures } from '@8f4e/test-runner';

export function createTestRuntimePlugin({
	getCodeBuffer,
	getMemory,
	getAssertionSites,
}: {
	getCodeBuffer: () => Uint8Array;
	getMemory: () => WebAssembly.Memory | null;
	getAssertionSites: () => AssertionSite[] | undefined;
}): EditorPlugin {
	return {
		id: 'test-runtime',
		setup: ({ store, events }) => {
			const state = store.getState();
			let worker: Worker | undefined;

			function publish(result: TestRunResult | { status: 'idle' | 'running' }) {
				const completed = result.status === 'passed' || result.status === 'failed';
				store.set(
					'info.testRuntime',
					completed
						? {
								status: result.status,
								assertionCount: result.assertions.length,
								failureCount: result.failures.length,
							}
						: result
				);
				store.set(
					'assertionResults',
					completed
						? result.assertions.map(assertion => ({
								site: assertion.site,
								passed: assertion.passed,
								...(!assertion.passed ? { message: `Assertion failed: ${formatAssertionExpectation(assertion)}` } : {}),
							}))
						: []
				);
			}

			function stopWorker() {
				worker?.terminate();
				worker = undefined;
			}

			function syncCompilation() {
				if (
					!(state.editorConfig.testRuntime as { enabled?: boolean } | undefined)?.enabled ||
					state.compiler.isCompiling
				) {
					stopWorker();
					publish({ status: 'idle' });
					return;
				}

				const memory = getMemory();
				const assertionSites = getAssertionSites();
				if (!memory || !assertionSites) {
					publish({ status: 'idle' });
					return;
				}
				stopWorker();
				const currentWorker = new WorkerConstructor();
				worker = currentWorker;
				publish({ status: 'running' });

				const finish = (data: TestRunResult) => {
					if (worker !== currentWorker) return;
					stopWorker();
					publish(data);
					if (data.status === 'error') console.error('[TestRuntime]', data.error);
					else if (data.status === 'failed') console.error('[TestRuntime]', formatTestFailures(data.failures));
					else console.info(`[TestRuntime] ${data.assertions.length} assertions passed`);
					events.dispatch('memoryValuesChanged');
				};
				currentWorker.onmessage = ({ data }: MessageEvent<TestRunResult>) => finish(data);
				currentWorker.onerror = event => finish({ status: 'error', error: event.message });
				currentWorker.postMessage({ codeBuffer: getCodeBuffer(), memory, assertionSites });
			}

			store.set('editorConfigSchemaContributions.testRuntime', {
				root: 'testRuntime',
				defaults: { enabled: false },
				schema: { type: 'object', properties: { enabled: { type: 'boolean' } }, additionalProperties: false },
			});
			store.subscribe('compiler.isCompiling', syncCompilation);
			store.subscribe('editorConfig.testRuntime', syncCompilation);

			syncCompilation();

			return () => {
				store.unsubscribe('compiler.isCompiling', syncCompilation);
				store.unsubscribe('editorConfig.testRuntime', syncCompilation);
				stopWorker();
				publish({ status: 'idle' });
				const schemas = { ...state.editorConfigSchemaContributions };
				delete schemas.testRuntime;
				store.set('editorConfigSchemaContributions', schemas);
			};
		},
	};
}
