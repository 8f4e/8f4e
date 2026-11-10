#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createRuntimeArguments, shellCommand } from './create-command.mjs';

const usage = `Usage: node tools/runtime-command/src/cli.mjs <program.wasm> <memory.json> [options] [-- runtime-options]
  --runtime <path>        Runtime executable (default: 8f4e-runtime)
  --left <module:memory>  Left buffer (default: audioout:buffer)
  --right <module:memory> Right buffer (default: same as left)
Prints a POSIX shell command with numeric byte addresses. It does not execute the command.`;

async function main(args) {
	if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
		console.log(usage);
		return;
	}
	if (args.length < 2) throw new Error(usage);
	const [wasmPath, memoryPath] = args;
	const options = { wasmPath };
	let runtimeArgs = [];
	for (let i = 2; i < args.length; i += 2) {
		const flag = args[i];
		if (flag === '--') {
			runtimeArgs = args.slice(i + 1);
			break;
		}
		const value = args[i + 1];
		if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
		if (flag === '--runtime') options.runtimePath = value;
		else if (flag === '--left') options.left = value;
		else if (flag === '--right') options.right = value;
		else throw new Error(`Unknown option: ${flag}`);
	}
	const info = JSON.parse(await readFile(memoryPath, 'utf8'));
	console.log(shellCommand(createRuntimeArguments(info, options, runtimeArgs)));
}

main(process.argv.slice(2)).catch(error => {
	console.error(error.message);
	process.exitCode = 1;
});
