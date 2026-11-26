import { strict as assert } from 'node:assert';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { createCoverageComponentMatcher } from './coverage-components.mjs';

test('matches exported package build directories and chunks, independent of workspace layout', () => {
	const components = [
		{ id: 'compiler', packageName: '@example/compiler' },
		{ id: 'tokenizer', packageName: '@example/tokenizer' },
	];
	const compiler = path.join(os.tmpdir(), 'relocated compiler', 'build');
	const tokenizer = path.join(os.tmpdir(), 'elsewhere', 'output');
	const roots = new Map([
		['@example/compiler', compiler],
		['@example/tokenizer', tokenizer],
	]);
	const resolve = name => pathToFileURL(path.join(roots.get(name), 'index.js')).href;
	const match = createCoverageComponentMatcher(components, resolve);
	const url = (...parts) => pathToFileURL(path.join(...parts)).href;

	assert.equal(match(url(compiler, 'index.js')), components[0]);
	assert.equal(match(url(compiler, 'chunks', 'chunk.js')), components[0]);
	assert.equal(match(url(tokenizer, 'index.js')), components[1]);
	assert.equal(match(url(`${compiler}-old`, 'index.js')), null);
	assert.equal(match('node:internal/fs/promises'), null);
	assert.equal(match(''), null);
});
