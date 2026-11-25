#!/usr/bin/env node
import { getCaptureUsage, runCaptureCommand } from './capture/command';
import { getCompileUsage, runCompileCommand } from './compile/command';
import { getFormatUsage, runFormatCommand } from './format/command';
import { getRunUsage, runRunCommand } from './run/command';
import { getTestUsage, runTestCommand } from './test/command';

function getUsage(): string {
	return [
		'Usage:',
		`  ${getCompileUsage().replace('Usage: ', '')}`,
		`  ${getRunUsage().replace('Usage: ', '')}`,
		`  ${getCaptureUsage().replace('Usage: ', '')}`,
		`  ${getTestUsage().replace('Usage: ', '')}`,
		`  ${getFormatUsage().replace('Usage: ', '')}`,
	].join('\n');
}

async function run(): Promise<void> {
	const [subcommand, ...args] = process.argv.slice(2);

	if (!subcommand || subcommand === '-h' || subcommand === '--help') {
		console.log(getUsage());
		process.exit(0);
	}

	if (subcommand === 'compile') {
		await runCompileCommand(args);
		return;
	}

	if (subcommand === 'run') {
		await runRunCommand(args);
		return;
	}

	if (subcommand === 'capture') {
		await runCaptureCommand(args);
		return;
	}

	if (subcommand === 'test') {
		await runTestCommand(args);
		return;
	}

	if (subcommand === 'format') {
		await runFormatCommand(args);
		return;
	}

	throw new Error(`Unknown subcommand: ${subcommand}\n${getUsage()}`);
}

run().catch(error => {
	const message =
		error instanceof Error
			? error.message
			: typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
				? error.message
				: String(error);
	console.error(message);
	process.exit(1);
});
