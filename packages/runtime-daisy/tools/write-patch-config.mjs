import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { resolveAudioBuffers } from '../../../tools/runtime-command/src/create-command.mjs';

async function main() {
	const { positionals, values } = parseArgs({
		allowPositionals: true,
		options: { left: { type: 'string' }, right: { type: 'string' }, help: { type: 'boolean' } },
	});
	const usage =
		'Usage: node tools/write-patch-config.mjs <memory.json> <PATCH.TXT> [--left <symbol>] [--right <symbol>]';
	if (values.help) {
		console.log(usage);
		return;
	}
	if (positionals.length !== 2) throw new Error(usage);
	const [metadataPath, outputPath] = positionals;
	const metadata = await readFile(metadataPath, 'utf8');

	const { leftBuffer, rightBuffer } = resolveAudioBuffers(JSON.parse(metadata), values);
	const frames = leftBuffer.numberOfElements;
	if (!Number.isInteger(frames) || frames < 1 || frames > 256) {
		throw new Error('Daisy needs an audio block of 1 to 256 samples');
	}
	const offsets = [leftBuffer.byteAddress, rightBuffer.byteAddress];
	for (const offset of offsets) {
		if (!Number.isInteger(offset) || offset < 0 || offset % 4 !== 0 || offset > 0xffffffff) {
			throw new Error('Daisy audio buffer offsets must be aligned 32-bit byte addresses');
		}
	}

	await writeFile(outputPath, `left=${offsets[0]}\nright=${offsets[1]}\nframes=${frames}\n`);
}

main().catch(error => {
	console.error(error.message);
	process.exitCode = 1;
});
