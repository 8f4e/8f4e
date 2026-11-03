import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(testDirectory, '..');
const fixturePath = path.join(testDirectory, 'fixtures', 'home.8f4e');
const noHomeFixturePath = path.join(testDirectory, 'fixtures', 'no-home.8f4e');
const audioFixturePath = path.resolve(packageRoot, '../../packages/examples/src/projects/audio/audioBuffer.8f4e');
const temporaryDirectory = path.join(testDirectory, '.tmp');
const gifOutputPath = path.join(temporaryDirectory, 'home-icon.gif');
const largeBaselineGifOutputPath = path.join(temporaryDirectory, 'home-large-baseline.gif');
const largeGifOutputPath = path.join(temporaryDirectory, 'home-large.gif');
const audioGifOutputPath = path.join(temporaryDirectory, 'audio-running.gif');
const animatedAudioGifOutputPath = path.join(temporaryDirectory, 'audio-animated.gif');

afterEach(async () => {
	await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

function runCli(args: string[]) {
	return execFileAsync(process.execPath, [path.join(packageRoot, 'bin', '8f4e-preview.js'), ...args], {
		cwd: packageRoot,
	});
}

describe('8f4e-preview', () => {
	it('documents the icon format', async () => {
		const { stdout } = await runCli(['--help']);

		expect(stdout).toContain('8f4e-preview icon <project.8f4e>');
		expect(stdout).toContain('preview.gif');
		expect(stdout).toContain('--size <pixels>');
		expect(stdout).toContain('--offset-x <pixels>');
		expect(stdout).toContain('--offset-y <pixels>');
		expect(stdout).toContain('--start-at <milliseconds>');
		expect(stdout).toContain('--capture-interval <milliseconds>');
		expect(stdout).toContain('--frames <count>');
		expect(stdout).toContain('--fps <rate>');
		expect(stdout).toContain('--run-for <milliseconds>');
		expect(stdout).toContain('optimized palette with dithering disabled');
	});

	it('captures a 64x64 GIF with an optimized palette and no dithering', async () => {
		await runCli(['icon', fixturePath, '--out', gifOutputPath]);

		const gif = await fs.readFile(gifOutputPath);
		expect(gif.subarray(0, 6).toString('ascii')).toBe('GIF89a');
		expect(gif.readUInt16LE(6)).toBe(64);
		expect(gif.readUInt16LE(8)).toBe(64);
		expect(gif[10] & 0x80).toBe(0x80);
		expect(gif.length).toBeGreaterThan(100);
		const stats = await sharp(gif).stats();
		expect(stats.channels.some(channel => channel.stdev > 0)).toBe(true);
	}, 30_000);

	it('captures a 256x256 GIF with an independent position offset', async () => {
		await runCli(['icon', fixturePath, '--out', largeBaselineGifOutputPath, '--size', '256']);
		await runCli([
			'icon',
			fixturePath,
			'--out',
			largeGifOutputPath,
			'--size',
			'256',
			'--offset-x',
			'24',
			'--offset-y',
			'32',
		]);

		const gif = await fs.readFile(largeGifOutputPath);
		expect(gif.subarray(0, 6).toString('ascii')).toBe('GIF89a');
		expect(gif.readUInt16LE(6)).toBe(256);
		expect(gif.readUInt16LE(8)).toBe(256);
		expect((await sharp(gif).stats()).channels.some(channel => channel.stdev > 0)).toBe(true);

		const baselinePixels = await sharp(largeBaselineGifOutputPath).ensureAlpha().raw().toBuffer();
		const offsetPixels = await sharp(largeGifOutputPath).ensureAlpha().raw().toBuffer();
		const imageSize = 256;
		const channelCount = 4;
		const offsetX = 24;
		const offsetY = 32;
		let alignedDifference = 0;
		let unshiftedDifference = 0;
		let comparedChannels = 0;
		for (let y = 0; y < imageSize - offsetY; y++) {
			for (let x = 0; x < imageSize - offsetX; x++) {
				for (let channel = 0; channel < channelCount; channel++) {
					const baselineIndex = (y * imageSize + x) * channelCount + channel;
					const alignedOffsetIndex = ((y + offsetY) * imageSize + x + offsetX) * channelCount + channel;
					const unshiftedOffsetIndex = (y * imageSize + x) * channelCount + channel;
					alignedDifference += Math.abs(baselinePixels[baselineIndex] - offsetPixels[alignedOffsetIndex]);
					unshiftedDifference += Math.abs(baselinePixels[baselineIndex] - offsetPixels[unshiftedOffsetIndex]);
					comparedChannels++;
				}
			}
		}

		expect(alignedDifference / comparedChannels).toBeLessThan(2);
		expect(unshiftedDifference / comparedChannels).toBeGreaterThan(5);
	}, 30_000);

	it('rejects invalid sizes and position offsets', async () => {
		await expect(runCli(['icon', fixturePath, '--size', '0'])).rejects.toMatchObject({
			stderr: expect.stringContaining('Invalid value for --size: 0'),
		});
		await expect(runCli(['icon', fixturePath, '--offset-x', '1.5'])).rejects.toMatchObject({
			stderr: expect.stringContaining('Invalid value for --offset-x: 1.5'),
		});
		await expect(runCli(['icon', fixturePath, '--run-for', '-1'])).rejects.toMatchObject({
			stderr: expect.stringContaining('Invalid value for --run-for: -1'),
		});
		await expect(runCli(['icon', fixturePath, '--capture-interval', '0'])).rejects.toMatchObject({
			stderr: expect.stringContaining('Invalid value for --capture-interval: 0'),
		});
		await expect(runCli(['icon', fixturePath, '--frames', '0'])).rejects.toMatchObject({
			stderr: expect.stringContaining('Invalid value for --frames: 0'),
		});
		await expect(runCli(['icon', fixturePath, '--fps', '0'])).rejects.toMatchObject({
			stderr: expect.stringContaining('Invalid value for --fps: 0'),
		});
	});

	it('starts an audio project and waits before capture', async () => {
		await runCli(['icon', audioFixturePath, '--out', audioGifOutputPath, '--size', '256', '--start-at', '250']);

		const gif = await fs.readFile(audioGifOutputPath);
		expect(gif.subarray(0, 6).toString('ascii')).toBe('GIF89a');
		expect(gif.readUInt16LE(6)).toBe(256);
		expect(gif.readUInt16LE(8)).toBe(256);
	}, 30_000);

	it('captures frames on one schedule and plays them at an independent rate', async () => {
		await runCli([
			'icon',
			audioFixturePath,
			'--out',
			animatedAudioGifOutputPath,
			'--size',
			'256',
			'--start-at',
			'250',
			'--capture-interval',
			'100',
			'--frames',
			'3',
			'--fps',
			'5',
		]);

		const metadata = await sharp(animatedAudioGifOutputPath, { animated: true }).metadata();
		expect(metadata.width).toBe(256);
		expect(metadata.pageHeight).toBe(256);
		expect(metadata.pages).toBe(3);
		expect(metadata.loop).toBe(0);
		expect(metadata.delay).toEqual([200, 200, 200]);
	}, 30_000);

	it('rejects PNG output paths', async () => {
		const pngOutputPath = path.join(temporaryDirectory, 'home-icon.png');

		await expect(runCli(['icon', fixturePath, '--out', pngOutputPath])).rejects.toMatchObject({
			stderr: expect.stringContaining('Preview output must be a .gif file'),
		});
	});

	it('falls back to the first root block when no home block exists', async () => {
		await runCli(['icon', noHomeFixturePath, '--out', gifOutputPath]);

		const gif = await fs.readFile(gifOutputPath);
		expect(gif.subarray(0, 6).toString('ascii')).toBe('GIF89a');
		expect(gif.readUInt16LE(6)).toBe(64);
		expect(gif.readUInt16LE(8)).toBe(64);
	}, 30_000);
});
