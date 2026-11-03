import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const testDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDir, '..');
const fixturePath = path.join(testDir, 'fixtures', 'minimal.8f4e');
const runtimeFixturePath = path.join(testDir, 'fixtures', 'runtimeInspect.8f4e');
const testPassingFixturePath = path.join(testDir, 'fixtures', 'testPassing.8f4e');
const testFailingFixturePath = path.join(testDir, 'fixtures', 'testFailing.8f4e');
const wrapPointerFixturePath = path.resolve(
	packageRoot,
	'..',
	'compiler',
	'tests',
	'stdlib',
	'wrap-pointer-float.test.8f4e'
);
const runtimeBytesPath = path.join(testDir, 'fixtures', 'runtimeBytes.bin');
const tmpDir = path.join(testDir, '.tmp');
const wasmPath = path.join(tmpDir, 'audioBuffer.wasm');
const runOutPath = path.join(tmpDir, 'runtimeInspect.output.json');
const captureOutPath = path.join(tmpDir, 'runtimeInspect.capture.bin');
const formatOutPath = path.join(tmpDir, 'formatted.8f4em');

function execCli(args: string[]) {
	return execFileAsync(process.execPath, [path.join(packageRoot, 'bin', 'cli.js'), ...args], {
		cwd: packageRoot,
	});
}

describe('cli', () => {
	it('writes wasm bytes when compile --wasm-output is provided', async () => {
		await fs.mkdir(tmpDir, { recursive: true });
		await execCli(['compile', fixturePath, '--wasm-output', wasmPath]);

		const wasmBytes = await fs.readFile(wasmPath);

		expect(wasmBytes.length).toBeGreaterThan(8);
		expect(wasmBytes.subarray(0, 4)).toEqual(Buffer.from([0x00, 0x61, 0x73, 0x6d]));
	});

	it('fails when compile is called without any output flag', async () => {
		await fs.mkdir(tmpDir, { recursive: true });

		await expect(execCli(['compile', fixturePath])).rejects.toThrow('Command failed');
	});

	it('rejects non-.8f4e input files for compile', async () => {
		await fs.mkdir(tmpDir, { recursive: true });
		const invalidProjectPath = path.join(tmpDir, 'invalid-project.txt');
		await fs.writeFile(invalidProjectPath, 'module main\nmoduleEnd\n');

		await expect(execCli(['compile', invalidProjectPath, '--wasm-output', wasmPath])).rejects.toThrow('Command failed');
	});

	it('formats long semicolon comments to stdout', async () => {
		await fs.mkdir(tmpDir, { recursive: true });
		const formatInputPath = path.join(tmpDir, 'format-stdout.8f4em');
		await fs.writeFile(
			formatInputPath,
			[
				'module formatFixture',
				'; This comment should wrap into multiple lines when width is set low enough',
				'load ; This trailing comment should also wrap after the instruction prefix',
				'push "; this is a string literal, not a comment delimiter"',
				'; @custom this directive-shaped comment should stay on one long line',
				'moduleEnd',
			].join('\n') + '\n'
		);

		const { stdout } = await execCli(['format', formatInputPath, '--comment-width', '36']);

		expect(stdout).toBe(
			[
				'module formatFixture',
				'; This comment should wrap into',
				'; multiple lines when width is set',
				'; low enough',
				'load ; This trailing comment should',
				'     ; also wrap after the',
				'     ; instruction prefix',
				'push "; this is a string literal, not a comment delimiter"',
				'; @custom this directive-shaped comment should stay on one long line',
				'moduleEnd',
			].join('\n') + '\n'
		);
	});

	it('uses a 32 character default format comment width', async () => {
		await fs.mkdir(tmpDir, { recursive: true });
		const formatInputPath = path.join(tmpDir, 'format-default-width.8f4em');
		await fs.writeFile(
			formatInputPath,
			'; This comment should wrap using the default formatter width of thirty two characters\n'
		);

		const { stdout } = await execCli(['format', formatInputPath]);

		expect(stdout).toBe(
			['; This comment should wrap using', '; the default formatter width of', '; thirty two characters'].join('\n') +
				'\n'
		);
	});

	it('writes formatted code to an output file', async () => {
		await fs.mkdir(tmpDir, { recursive: true });
		const formatInputPath = path.join(tmpDir, 'format-out.8f4em');
		await fs.writeFile(formatInputPath, '; This comment should wrap into a small output file\n');

		await execCli(['format', formatInputPath, '--comment-width', '24', '--out', formatOutPath]);

		expect(await fs.readFile(formatOutPath, 'utf8')).toBe(
			['; This comment should', '; wrap into a small', '; output file'].join('\n') + '\n'
		);
	});

	it('formats code in place with --write', async () => {
		await fs.mkdir(tmpDir, { recursive: true });
		const formatInputPath = path.join(tmpDir, 'format-write.8f4em');
		await fs.writeFile(formatInputPath, '; This comment should wrap when the file is written in place\n');

		await execCli(['format', formatInputPath, '--comment-width', '28', '--write']);

		expect(await fs.readFile(formatInputPath, 'utf8')).toBe(
			['; This comment should wrap', '; when the file is written', '; in place'].join('\n') + '\n'
		);
	});

	it('runs cycles, applies sets, and dumps requested ids as JSON', async () => {
		const { stdout } = await execCli([
			'run',
			runtimeFixturePath,
			'--cycles',
			'3',
			'--set',
			'gain=1.25',
			'--set-json',
			'buffer=[1,2,3,4]',
			'--dump',
			'counter',
			'--dump',
			'gain',
			'--dump',
			'buffer',
		]);

		expect(JSON.parse(stdout)).toEqual({
			counter: 3,
			gain: 1.25,
			buffer: [1, 2, 3, 4],
		});
	});

	it('writes run output to a file when --out is provided', async () => {
		await fs.mkdir(tmpDir, { recursive: true });
		await execCli(['run', runtimeFixturePath, '--cycles', '2', '--dump', 'counter', '--out', runOutPath]);

		const raw = await fs.readFile(runOutPath, 'utf8');
		expect(JSON.parse(raw)).toEqual({
			counter: 2,
		});
	});

	it('loads raw file bytes directly into a target buffer', async () => {
		const { stdout } = await execCli([
			'run',
			runtimeFixturePath,
			'--load-file',
			'buffer=' + runtimeBytesPath,
			'--dump',
			'buffer',
		]);

		expect(JSON.parse(stdout)).toEqual({
			buffer: [1, 2, 3, -1],
		});
	});

	it('dumps unsigned narrow integer arrays without signed sign-extension', async () => {
		const { stdout } = await execCli([
			'run',
			runtimeFixturePath,
			'--dump',
			'unsignedBytes',
			'--dump',
			'unsignedShorts',
		]);

		expect(JSON.parse(stdout)).toEqual({
			unsignedBytes: [0, 255],
			unsignedShorts: [0, 65535],
		});
	});

	it('fails when run is called without any --dump', async () => {
		await expect(execCli(['run', runtimeFixturePath, '--cycles', '2'])).rejects.toThrow('Command failed');
	});

	it('runs tests declared in a project file', async () => {
		const { stdout } = await execCli(['test', testPassingFixturePath]);

		expect(stdout).toBe('Ran 1 assertion.\n');
	});

	it('reports assertion failures from project tests', async () => {
		await expect(execCli(['test', testFailingFixturePath])).rejects.toMatchObject({
			stderr: expect.stringContaining(
				'assertEqual #0 expected 4, received 3 at module addFails, block line 5 (site 0)'
			),
		});
	});

	it('reports the original helper assertion site on repeated loop failures', async () => {
		await fs.mkdir(tmpDir, { recursive: true });
		const helperTestPath = path.join(tmpDir, 'helperTest.8f4e');
		await fs.writeFile(
			helperTestPath,
			`8f4e/v1
entry test
module driver
push 0
if
push 99
assertEqual 99
ifEnd
loop 2
call helper
loopEnd
moduleEnd
entryEnd
function helper
push
- 7 ; continued argument
assertEqual 8
functionEnd`
		);
		await expect(execCli(['test', helperTestPath])).rejects.toMatchObject({
			stderr: expect.stringContaining(
				[
					'2 assertions failed:',
					'  assertEqual #0 expected 8, received 7 at function helper, block line 4 (site 1)',
					'  assertEqual #1 expected 8, received 7 at function helper, block line 4 (site 1)',
				].join('\n')
			),
		});
	});

	it('runs a project with only an exported test function', async () => {
		await fs.mkdir(tmpDir, { recursive: true });
		const functionTestPath = path.join(tmpDir, 'functionTest.8f4e');
		await fs.writeFile(
			functionTestPath,
			`8f4e/v1
function test
#export
push 3
assertEqual 3
functionEnd`
		);
		const { stdout } = await execCli(['test', functionTestPath]);
		expect(stdout).toBe('Ran 1 assertion.\n');
	});

	it('runs tests from an explicit test entry', async () => {
		await fs.mkdir(tmpDir, { recursive: true });
		const groupedTestPath = path.join(tmpDir, 'groupedTest.8f4e');
		await fs.writeFile(
			groupedTestPath,
			['8f4e/v1', '', 'entry test', 'module groupedTest', 'push 1', 'assertEqual 1', 'moduleEnd', 'entryEnd'].join('\n')
		);

		const { stdout } = await execCli(['test', groupedTestPath]);

		expect(stdout).toBe('Ran 1 assertion.\n');
	});

	it('runs embedded tests declared in a stdlib fixture file', async () => {
		const { stdout } = await execCli(['test', wrapPointerFixturePath]);

		expect(stdout).toBe('Ran 3 assertions.\n');
	});

	it('runs tests with ordinary dependency blocks', async () => {
		await fs.mkdir(tmpDir, { recursive: true });
		const dependencyTestPath = path.join(tmpDir, 'dependencyTest.8f4e');
		await fs.writeFile(
			dependencyTestPath,
			[
				'8f4e/v1',
				'',
				'entry test',
				'module target',
				'int* ptr &dependency:value',
				'push *ptr',
				'assertEqual 42',
				'moduleEnd',
				'',
				'module dependency',
				'int value 42',
				'moduleEnd',
				'entryEnd',
			].join('\n')
		);

		const { stdout } = await execCli(['test', dependencyTestPath]);

		expect(stdout).toBe('Ran 1 assertion.\n');
	});

	it('runs test files matched by a glob and skips files without test entries', async () => {
		const { stdout } = await execCli(['test', '../examples/src/modules/functions/math/*.8f4em']);

		expect(stdout).toBe('No tests found.\n');
	});

	it('captures raw buffer bytes across repeated main windows', async () => {
		await fs.mkdir(tmpDir, { recursive: true });
		await execCli([
			'capture',
			runtimeFixturePath,
			'--buffer',
			'buffer',
			'--cycles',
			'2',
			'--repeat',
			'3',
			'--set-json',
			'buffer=[1,2,3,-1]',
			'--out',
			captureOutPath,
		]);

		const bytes = await fs.readFile(captureOutPath);
		expect([...bytes]).toEqual([1, 2, 3, 255, 1, 2, 3, 255, 1, 2, 3, 255]);
	});
});
