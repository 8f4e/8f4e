#!/usr/bin/env node
import path from 'node:path';

import {
	DEFAULT_PREVIEW_CAPTURE_INTERVAL_MS,
	DEFAULT_PREVIEW_FRAME_COUNT,
	DEFAULT_PREVIEW_FRAMES_PER_SECOND,
	DEFAULT_PREVIEW_POSITION,
	DEFAULT_PREVIEW_SIZE,
	generateProjectPreview,
	type ProjectPreviewFormat,
} from './index';

const USAGE = `Usage: 8f4e-preview icon <project.8f4e> [--out <preview.gif>] [--size <pixels>] [--offset-x <pixels>] [--offset-y <pixels>] [--start-at <milliseconds>] [--capture-interval <milliseconds>] [--frames <count>] [--fps <rate>]

Formats:
  icon    Capture a square GIF from the @home block, or the first root block

Options:
  --size <pixels>                   Output width and height in pixels (default: 64)
  --offset-x <pixels>               Horizontal distance from the image's left edge (default: 0)
  --offset-y <pixels>               Vertical distance from the image's top edge (default: 0)
  --start-at <milliseconds>         Start audio and wait before capturing the first frame (default: 0)
  --capture-interval <milliseconds> Time between captured frames (default: 1000 ms)
  --frames <count>                  Number of frames to capture (default: 1)
  --fps <rate>                      Animated GIF playback rate, independent of capture timing (default: 1)
  --run-for <milliseconds>          Deprecated alias for --start-at

GIF output uses an optimized palette with dithering disabled.`;

interface ParsedArguments {
	captureIntervalMs: number;
	format: ProjectPreviewFormat;
	frameCount: number;
	framesPerSecond: number;
	inputPath: string;
	outputPath: string;
	position: {
		x: number;
		y: number;
	};
	size: number;
	startAtMs?: number;
}

function getDefaultOutputPath(inputPath: string): string {
	const extension = path.extname(inputPath);
	return path.join(path.dirname(inputPath), `${path.basename(inputPath, extension)}.icon.gif`);
}

function parseIntegerOption(option: string, value: string | undefined, allowNegative: boolean): number {
	const pattern = allowNegative ? /^-?\d+$/ : /^[1-9]\d*$/;
	if (!value || !pattern.test(value)) {
		throw new Error(`Invalid value for ${option}: ${value ?? '(missing)'}\n${USAGE}`);
	}

	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed)) {
		throw new Error(`Invalid value for ${option}: ${value}\n${USAGE}`);
	}
	return parsed;
}

function parsePositiveNumberOption(option: string, value: string | undefined): number {
	if (!value || !/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) {
		throw new Error(`Invalid value for ${option}: ${value ?? '(missing)'}\n${USAGE}`);
	}

	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new Error(`Invalid value for ${option}: ${value}\n${USAGE}`);
	}
	return parsed;
}

function parseNonNegativeIntegerOption(option: string, value: string | undefined): number {
	if (!value || !/^\d+$/.test(value)) {
		throw new Error(`Invalid value for ${option}: ${value ?? '(missing)'}\n${USAGE}`);
	}

	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed)) {
		throw new Error(`Invalid value for ${option}: ${value}\n${USAGE}`);
	}
	return parsed;
}

export function parseArguments(args: string[]): ParsedArguments | undefined {
	if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
		return undefined;
	}

	const [format, inputPath, ...options] = args;
	if (format !== 'icon') {
		throw new Error(`Unknown preview format: ${format}\n${USAGE}`);
	}
	if (!inputPath || inputPath.startsWith('-')) {
		throw new Error(`Missing project input path\n${USAGE}`);
	}

	let captureIntervalMs = DEFAULT_PREVIEW_CAPTURE_INTERVAL_MS;
	let frameCount = DEFAULT_PREVIEW_FRAME_COUNT;
	let framesPerSecond = DEFAULT_PREVIEW_FRAMES_PER_SECOND;
	let outputPath = getDefaultOutputPath(inputPath);
	let size = DEFAULT_PREVIEW_SIZE;
	let startAtMs: number | undefined;
	let startAtOption: '--run-for' | '--start-at' | undefined;
	const position: { x: number; y: number } = { ...DEFAULT_PREVIEW_POSITION };
	for (let index = 0; index < options.length; index++) {
		const option = options[index];
		if (option === '--out') {
			const value = options[++index];
			if (!value || value.startsWith('-')) {
				throw new Error(`Missing value for --out\n${USAGE}`);
			}
			outputPath = value;
			continue;
		}
		if (option === '--size') {
			size = parseIntegerOption(option, options[++index], false);
			continue;
		}
		if (option === '--offset-x') {
			position.x = parseIntegerOption(option, options[++index], true);
			continue;
		}
		if (option === '--offset-y') {
			position.y = parseIntegerOption(option, options[++index], true);
			continue;
		}
		if (option === '--start-at' || option === '--run-for') {
			if (startAtOption) {
				throw new Error(`Use either ${startAtOption} or ${option}, not both\n${USAGE}`);
			}
			startAtOption = option;
			startAtMs = parseNonNegativeIntegerOption(option, options[++index]);
			continue;
		}
		if (option === '--capture-interval') {
			captureIntervalMs = parseIntegerOption(option, options[++index], false);
			continue;
		}
		if (option === '--frames') {
			frameCount = parseIntegerOption(option, options[++index], false);
			continue;
		}
		if (option === '--fps') {
			framesPerSecond = parsePositiveNumberOption(option, options[++index]);
			continue;
		}

		throw new Error(`Unknown option: ${option}\n${USAGE}`);
	}

	return { captureIntervalMs, format, frameCount, framesPerSecond, inputPath, outputPath, position, size, startAtMs };
}

async function run(): Promise<void> {
	const options = parseArguments(process.argv.slice(2));
	if (!options) {
		console.log(USAGE);
		return;
	}

	await generateProjectPreview(options);
	console.log(`Created ${path.resolve(options.outputPath)}`);
}

run().catch(error => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
