import { compileProject } from '@8f4e/cli';
import { parseProjectSource } from '@8f4e/compiler';

import { describe, expect, it } from 'vitest';
import { readExampleProject } from './programSources';

describe('compileProject (audioBuffer example)', () => {
	it('compiles build artifacts without config packaging', async () => {
		const project = parseProjectSource(await readExampleProject('audio/audioBuffer.8f4e'));
		const { outputProject } = await compileProject(project);

		expect(outputProject).toMatchSnapshot();
	});
});
