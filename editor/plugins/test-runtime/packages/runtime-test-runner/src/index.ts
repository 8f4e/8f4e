import { executeTests } from './executeTests';
import type { TestRuntimeProgram } from './types';

self.onmessage = async ({ data }: MessageEvent<TestRuntimeProgram>) => {
	self.postMessage(await executeTests(data));
};
