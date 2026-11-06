import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createRuntimeArguments, shellCommand } from '../src/create-command.mjs';

const info = {
	memoryPlan: {
		modules: {
			audioout: { memory: { buffer: { byteAddress: 0, type: 'float', pointerDepth: 0, numberOfElements: 128 } } },
			'synth/voice/output': {
				memory: {
					left: { byteAddress: 64, type: 'float', pointerDepth: 0, numberOfElements: 4 },
					right: { byteAddress: 80, type: 'float', pointerDepth: 0, numberOfElements: 4 },
					integer: { byteAddress: 96, type: 'int', pointerDepth: 0, numberOfElements: 4 },
					pointer: { byteAddress: 100, type: 'float*', pointerDepth: 1, numberOfElements: 1 },
				},
			},
		},
	},
};

test('resolves address zero and defaults to dual mono', () => {
	assert.deepEqual(createRuntimeArguments(info, { wasmPath: 'program.wasm' }), [
		'8f4e-runtime',
		'program.wasm',
		'--left',
		'0',
		'--right',
		'0',
		'--buffer-size',
		'128',
	]);
});

test('resolves nested symbols to byte addresses, including the declared buffer size', () => {
	assert.deepEqual(
		createRuntimeArguments(
			info,
			{
				wasmPath: 'program.wasm',
				runtimePath: '/opt/8f4e-runtime',
				left: 'synth/voice/output:left',
				right: 'synth/voice/output:right',
			},
			['--connect-left', 'system:playback_1']
		),
		[
			'/opt/8f4e-runtime',
			'program.wasm',
			'--left',
			'64',
			'--right',
			'80',
			'--buffer-size',
			'4',
			'--connect-left',
			'system:playback_1',
		]
	);
});

test('rejects unknown buffers, non-float storage, pointers and unequal lengths', () => {
	for (const left of ['missing:buffer', 'synth/voice/output:integer', 'synth/voice/output:pointer']) {
		assert.throws(() => createRuntimeArguments(info, { wasmPath: 'a.wasm', left }));
	}
	assert.throws(
		() =>
			createRuntimeArguments(info, {
				wasmPath: 'a.wasm',
				right: 'synth/voice/output:right',
			}),
		/same nonzero sample count/
	);
});

test('shell quoting preserves arbitrary paths without executing substitutions', () => {
	const values = ['a b', "it's a path", '$(exit 42)', '`exit 42`', '; exit 42', ''];
	const command = shellCommand([
		process.execPath,
		'-e',
		'console.log(JSON.stringify(process.argv.slice(1)))',
		...values,
	]);
	assert.deepEqual(JSON.parse(execFileSync('sh', ['-c', command], { encoding: 'utf8' })), values);
});

test('CLI prints a launch command and forwards JACK options', async () => {
	const directory = await mkdtemp(path.join(tmpdir(), '8f4e-command-'));
	try {
		const metadata = path.join(directory, 'memory.json');
		await writeFile(metadata, JSON.stringify(info));
		const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
		const output = execFileSync(
			process.execPath,
			[cli, 'a b.wasm', metadata, '--', '--midi-source', 'pisound:midi/capture_1'],
			{
				encoding: 'utf8',
			}
		);
		assert.equal(
			output.trim(),
			shellCommand([
				'8f4e-runtime',
				'a b.wasm',
				'--left',
				'0',
				'--right',
				'0',
				'--buffer-size',
				'128',
				'--midi-source',
				'pisound:midi/capture_1',
			])
		);
		assert.throws(() => execFileSync(process.execPath, [cli, 'a.wasm', metadata, '--left'], { stdio: 'pipe' }));
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
