import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

const [runtime, ...args] = JSON.parse(await readFile('dist/tests/runtime-arguments.json', 'utf8'));
for (const period of [64, 256]) {
	const name = `8f4e-test-${process.pid}-${period}`;
	const env = { ...process.env, JACK_DEFAULT_SERVER: name, JACK_NO_AUDIO_RESERVATION: '1' };
	const server = spawn(
		'jackd',
		['--no-realtime', '--name', name, '-d', 'dummy', '-C', '0', '-P', '0', '-r', '48000', '-p', String(period)],
		{
			env,
			stdio: ['ignore', 'pipe', 'pipe'],
		}
	);
	let log = '';
	server.stdout.on('data', data => {
		log += data;
	});
	server.stderr.on('data', data => {
		log += data;
	});
	try {
		let ready = false;
		for (let attempt = 0; attempt < 100; ++attempt) {
			if (server.exitCode !== null || server.signalCode !== null) throw new Error(`JACK exited: ${log}`);
			if (spawnSync('jack_lsp', [], { env, stdio: 'ignore' }).status === 0) {
				ready = true;
				break;
			}
			await setTimeout(50);
		}
		assert.ok(ready, `JACK did not start: ${log}`);
		const probe = spawnSync('dist/jack-tests', ['dist/tests/run-instrument.sh'], {
			env,
			encoding: 'utf8',
			timeout: 20000,
		});
		assert.equal(probe.status, 0, `${probe.stdout}\n${probe.stderr}\n${log}`);
		process.stdout.write(probe.stdout);
		const bounded = spawnSync(runtime, [...args, '--no-midi', '--blocks', '4'], {
			env,
			encoding: 'utf8',
			timeout: 5000,
		});
		assert.equal(bounded.status, 0, bounded.stderr);
		const wrongRate = spawnSync(runtime, [...args, '--sample-rate', '44100'], { env, encoding: 'utf8', timeout: 5000 });
		assert.equal(wrongRate.status, 1, wrongRate.stderr);
		assert.match(wrongRate.stderr, /JACK sample rate does not match/);
		const shutdown = spawn(runtime, [...args, '--no-midi'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
		const shutdownExit = once(shutdown, 'exit', { signal: AbortSignal.timeout(10000) });
		let shutdownLog = '';
		shutdown.stderr.on('data', data => {
			shutdownLog += data;
		});
		try {
			for (let attempt = 0; attempt < 100 && !shutdownLog.includes('Running JACK client'); ++attempt) {
				await setTimeout(50);
			}
			assert.match(shutdownLog, /Running JACK client/);
			server.kill('SIGTERM');
			const [code] = await shutdownExit;
			assert.equal(code, 1, shutdownLog);
			assert.match(shutdownLog, /JACK server shut down/);
		} finally {
			if (shutdown.exitCode === null && shutdown.signalCode === null) shutdown.kill('SIGKILL');
		}
		console.log(`JACK ${period}-sample cycles passed against 128-sample WASM blocks`);
	} finally {
		if (server.exitCode === null && server.signalCode === null) {
			const exited = once(server, 'exit');
			server.kill('SIGTERM');
			await exited;
		}
	}
}
