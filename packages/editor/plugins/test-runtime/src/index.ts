import type { EditorPlugin, LoadingIndicatorHandle } from '@8f4e/editor-core';
import type { AssertionSite } from '@8f4e/language-spec';
import type { TestRunResult } from '@8f4e/runtime-test-runner/types';
import WorkerConstructor from '@8f4e/runtime-test-runner?worker';
import { formatTestFailures, type TestAssertionResult } from '@8f4e/test-runner';
import assertionErrors from './assertionErrors';

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
		setup: ({ store, events, loading }) => {
			const state = store.getState();
			let worker: Worker | undefined;
			let runLoading: LoadingIndicatorHandle | undefined;
			let assertions: TestAssertionResult[] = [];
			const publishErrors = () =>
				store.set('codeErrors.test-runtime', assertionErrors(assertions, state.codeBlockRendering.rootProject));

			function publish(result: TestRunResult | { status: 'idle' | 'running' }) {
				const completed = result.status === 'passed' || result.status === 'failed';
				assertions = completed ? result.assertions : [];
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
					assertions.map(({ site, passed }) => ({ site, passed }))
				);
				publishErrors();
			}

			function stopWorker() {
				runLoading?.cancel();
				runLoading = undefined;
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
				runLoading = loading.add({ id: 'test-runtime', message: 'Running tests...' });
				try {
					const currentWorker = new WorkerConstructor();
					worker = currentWorker;
					publish({ status: 'running' });

					const finish = (data: TestRunResult) => {
						if (worker !== currentWorker) return;
						if (data.status === 'passed') runLoading?.done();
						else runLoading?.fail();
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
				} catch (error) {
					runLoading?.fail();
					stopWorker();
					throw error;
				}
			}

			store.set('editorConfigSchemaContributions.testRuntime', {
				root: 'testRuntime',
				defaults: { enabled: false },
				schema: { type: 'object', properties: { enabled: { type: 'boolean' } }, additionalProperties: false },
			});
			store.subscribe('compiler.isCompiling', syncCompilation);
			store.subscribe('editorConfig.testRuntime', syncCompilation);
			events.on('compilationInputChanged', publishErrors);

			syncCompilation();

			return () => {
				store.unsubscribe('compiler.isCompiling', syncCompilation);
				store.unsubscribe('editorConfig.testRuntime', syncCompilation);
				events.off('compilationInputChanged', publishErrors);
				stopWorker();
				publish({ status: 'idle' });
				const errors = { ...state.codeErrors };
				delete errors['test-runtime'];
				store.set('codeErrors', errors);
				const schemas = { ...state.editorConfigSchemaContributions };
				delete schemas.testRuntime;
				store.set('editorConfigSchemaContributions', schemas);
			};
		},
	};
}
