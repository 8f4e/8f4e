import type { AssertionSite } from '@8f4e/language-spec';
import type { TestRunResult } from '@8f4e/runtime-test-runner/types';

export type TestRuntimeState =
	| { status: 'idle' }
	| { status: 'running'; assertionSites: AssertionSite[] }
	| (TestRunResult & { assertionSites: AssertionSite[] });
