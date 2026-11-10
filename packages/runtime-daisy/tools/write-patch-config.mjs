import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

function resolveAudioBuffer(modules, reference) {
	const separator = reference.lastIndexOf(':');
	const moduleId = reference.slice(0, separator);
	const name = reference.slice(separator + 1);
	const buffer = separator > 0 ? modules[moduleId]?.memory?.[name] : undefined;
	if (!buffer) throw new Error(`Unknown audio buffer: ${reference}`);
	if (buffer.type !== 'float' || buffer.pointerDepth !== 0) {
		throw new Error(`Audio buffer must contain float32 samples: ${reference}`);
	}
	return buffer;
}

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
	const { memoryPlan, envConstants } = JSON.parse(await readFile(metadataPath, 'utf8'));
	const sampleRate = envConstants?.SAMPLE_RATE ?? 48000;
	if (sampleRate !== 32000 && sampleRate !== 48000) {
		throw new Error('Daisy supports SAMPLE_RATE values of 32000 or 48000 Hz');
	}
	const left = values.left ?? 'audioout:buffer';
	const right = values.right ?? left;
	const leftBuffer = resolveAudioBuffer(memoryPlan.modules, left);
	const rightBuffer = resolveAudioBuffer(memoryPlan.modules, right);

	const frames = leftBuffer.numberOfElements;
	if (frames !== rightBuffer.numberOfElements) {
		throw new Error('Daisy left and right buffers must have the same sample count');
	}
	if (!Number.isInteger(frames) || frames < 1 || frames > 256) {
		throw new Error('Daisy needs an audio block of 1 to 256 samples');
	}
	const offsets = [leftBuffer.byteAddress, rightBuffer.byteAddress];
	for (const offset of offsets) {
		if (!Number.isInteger(offset) || offset < 0 || offset % 4 !== 0 || offset > 0xffffffff) {
			throw new Error('Daisy audio buffer offsets must be aligned 32-bit byte addresses');
		}
	}

	const rateLine = sampleRate === 48000 ? '' : `sample_rate=${sampleRate}\n`;
	await writeFile(outputPath, `left=${offsets[0]}\nright=${offsets[1]}\nframes=${frames}\n${rateLine}`);
}

main().catch(error => {
	console.error(error.message);
	process.exitCode = 1;
});
