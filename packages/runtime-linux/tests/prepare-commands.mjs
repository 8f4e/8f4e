import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRuntimeArguments, shellCommand } from '../../../tools/runtime-command/src/create-command.mjs';

const info = JSON.parse(await readFile('dist/tests/instrument.json', 'utf8'));
const wasm = path.resolve('dist/tests/instrument.wasm');
const { left, right } = info.memoryPlan.modules.output.memory;
const contract = [path.resolve('dist/runtime-tests'), wasm, left.byteAddress, right.byteAddress, left.numberOfElements];
const runtime = createRuntimeArguments(info, {
	wasmPath: wasm,
	runtimePath: path.resolve('dist/8f4e-runtime'),
	left: 'output:left',
	right: 'output:right',
});
const routed = [
	...runtime,
	'--client-name',
	'8f4e-test',
	'--gain',
	'1',
	'--connect-left',
	'8f4e-probe:left',
	'--connect-right',
	'8f4e-probe:right',
	'--midi-source',
	'8f4e-probe:midi',
];

await writeFile('dist/tests/run-contract.sh', `exec ${shellCommand(contract)}\n`);
await writeFile('dist/tests/run-instrument.sh', `exec ${shellCommand(routed)}\n`);
await writeFile('dist/tests/runtime-arguments.json', JSON.stringify(runtime));
