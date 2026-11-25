import type { AssertionSite } from '@8f4e/language-spec';
import type { TestAssertionResult, TestProgram } from '@8f4e/test-runner';

export interface TestRuntimeProgram extends TestProgram {
	assertionSites: AssertionSite[];
	memory: WebAssembly.Memory;
}

export type TestRunResult =
	| { status: 'passed' | 'failed'; assertions: TestAssertionResult[]; failures: TestAssertionResult[] }
	| { status: 'error'; error: string };
