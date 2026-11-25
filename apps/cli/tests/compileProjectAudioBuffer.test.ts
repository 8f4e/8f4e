import { parseProjectSource } from '@8f4e/compiler';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const fixturePath = path.join(repoRoot, 'packages/examples/src/projects/audio/audioBuffer.8f4e');

async function loadAudioBufferProject() {
	const raw = await fs.readFile(fixturePath, 'utf8');
	return parseProjectSource(raw);
}

describe('compileProject (audioBuffer example)', () => {
	it('compiles build artifacts without config packaging', async () => {
		const project = await loadAudioBufferProject();
		const cliModule = await import(pathToFileURL(path.join(packageRoot, 'dist', 'index.js')).href);
		const { outputProject } = await cliModule.compileProject(project);

		expect(outputProject).toMatchSnapshot();
	});
});
