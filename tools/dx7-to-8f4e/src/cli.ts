import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { parseArgs } from 'node:util';
import { getUnsupportedSettings, toConstantsBlock } from './convert.ts';
import { decodeDx7 } from './decode.ts';

const usage = `Usage: node tools/dx7-to-8f4e/src/cli.ts <patches.syx> [options]

  --name <name>       Select an exact patch name; repeat to select several
  --algorithm <1-32>  Select patches using this DX7 algorithm
  --out <file>       Write blocks to a file (default: stdout)
  --source <label>   Source credit (default: input filename)
  --x <n>            First block's grid X (default: 0)
  --y <n>            First block's grid Y (default: 0)
  --step-x <n>       Horizontal spacing between blocks (default: 60)
  --step-y <n>       Vertical spacing between blocks (default: 0)
  --help             Show this help

Reads single-voice and 32-voice DX7 SysEx dumps, including concatenated dumps.
Output uses the preset namespace. The rightmost block takes precedence.
`;

async function main() {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			name: { type: 'string', multiple: true },
			algorithm: { type: 'string' },
			out: { type: 'string' },
			source: { type: 'string' },
			x: { type: 'string', default: '0' },
			y: { type: 'string', default: '0' },
			'step-x': { type: 'string', default: '60' },
			'step-y': { type: 'string', default: '0' },
			help: { type: 'boolean', short: 'h' },
		},
	});
	if (values.help) {
		process.stdout.write(usage);
		return;
	}
	if (positionals.length !== 1) throw new Error(usage);
	const integer = (name: 'x' | 'y' | 'step-x' | 'step-y' | 'algorithm') => {
		const value = values[name];
		if (value === undefined || !/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
			throw new Error(`--${name} requires an integer.`);
		}
		return Number(value);
	};
	const x = integer('x');
	const y = integer('y');
	const stepX = integer('step-x');
	const stepY = integer('step-y');
	const algorithm = values.algorithm === undefined ? undefined : integer('algorithm');
	if (algorithm !== undefined && (algorithm < 1 || algorithm > 32)) throw new Error('--algorithm must be 1..32.');
	const patches = decodeDx7(await readFile(positionals[0]));
	const names = values.name?.map(name => name.trim().toLowerCase());
	for (const name of names ?? []) {
		if (!patches.some(patch => patch.name.toLowerCase() === name)) throw new Error(`Patch not found: ${name}`);
	}
	const selected = patches.filter(
		patch =>
			(!names || names.includes(patch.name.toLowerCase())) && (algorithm === undefined || patch.algorithm === algorithm)
	);
	if (!selected.length) throw new Error('No patches matched the selection.');
	const output = selected
		.map((patch, index) =>
			toConstantsBlock(patch, {
				x: x + index * stepX,
				y: y + index * stepY,
				source: `${values.source ?? basename(positionals[0])}, voice ${patches.indexOf(patch) + 1}`,
			})
		)
		.join('\n');
	if (values.out) await writeFile(values.out, output);
	else process.stdout.write(output);
	for (const patch of selected) {
		const unsupported = getUnsupportedSettings(patch);
		if (unsupported.length) console.error(`${patch.name}: dx7Algorithm5 does not apply ${unsupported.join(', ')}.`);
	}
}

main().catch(error => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
