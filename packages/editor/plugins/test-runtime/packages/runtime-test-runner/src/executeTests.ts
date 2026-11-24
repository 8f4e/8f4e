import { runTests } from '@8f4e/test-runner';
import type { TestRunResult, TestRuntimeProgram } from './types';

/** Uses editor-owned, already initialized memory and returns only serializable results. */
export async function executeTests(program: TestRuntimeProgram): Promise<TestRunResult> {
	const { codeBuffer, assertionSites, memory } = program;
	try {
		const { assertions, failures } = await runTests({ codeBuffer, assertionSites, memory });
		return {
			status: failures.length ? 'failed' : 'passed',
			assertions,
			failures,
		};
	} catch (error) {
		return {
			status: 'error',
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
