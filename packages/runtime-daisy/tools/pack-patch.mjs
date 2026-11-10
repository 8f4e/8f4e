import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { resolveAudioBuffers } from '../../../tools/runtime-command/src/create-command.mjs';

async function main() {
	const { positionals, values } = parseArgs({
		allowPositionals: true,
		options: { left: { type: 'string' }, right: { type: 'string' }, help: { type: 'boolean' } },
	});
	const usage =
		'Usage: node tools/pack-patch.mjs <instrument.aot> <memory.json> <PATCH.8FA> [--left <symbol>] [--right <symbol>]';
	if (values.help) {
		console.log(usage);
		return;
	}
	if (positionals.length !== 3) throw new Error(usage);
	const [aotPath, metadataPath, outputPath] = positionals;
	const [aot, metadata] = await Promise.all([readFile(aotPath), readFile(metadataPath, 'utf8')]);
	if (
		aot.length < 64 ||
		aot.readUInt32LE(0) !== 0x746f6100 ||
		aot.readUInt32LE(4) !== 5 ||
		aot.toString('ascii', 48, 57) !== 'thumbv7em'
	) {
		throw new Error('Expected a Cortex-M7 AOT file from WAMR 2.4.5');
	}
	if (aot.length > 128 * 1024) throw new Error('Daisy patch payload exceeds 128 KiB');

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

	const header = Buffer.alloc(24);
	header.write('8FA1');
	header.writeUInt32LE(48000, 4);
	header.writeUInt32LE(frames, 8);
	header.writeUInt32LE(offsets[0], 12);
	header.writeUInt32LE(offsets[1], 16);
	header.writeUInt32LE(aot.length, 20);
	await writeFile(outputPath, Buffer.concat([header, aot]));
}

main().catch(error => {
	console.error(error.message);
	process.exitCode = 1;
});
