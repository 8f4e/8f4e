import { isMemoryId, parseInteger } from '@8f4e/editor-state';

export type TextureFormat = '1bit' | 'mono' | 'rgb' | 'rgba';

export interface TextureDirective {
	framebuffer: string;
	format: TextureFormat;
	width: number;
	height: number;
	magnification: number;
	byteLength: number;
}

export function parseTextureDirective(args: string[]): TextureDirective | undefined {
	if (args.length !== 5 || !isMemoryId(args[0])) return;
	const [framebuffer, format] = args;
	if (format !== '1bit' && format !== 'mono' && format !== 'rgb' && format !== 'rgba') return;
	const width = parseInteger(args[2]);
	const height = parseInteger(args[3]);
	const magnification = parseInteger(args[4]);
	if (!width || width < 1 || !height || height < 1 || !magnification || magnification < 1) return;
	const rowBytes =
		format === '1bit' ? Math.ceil(width / 8) : width * (format === 'rgba' ? 4 : format === 'rgb' ? 3 : 1);
	const byteLength = rowBytes * height;
	if (
		!Number.isSafeInteger(byteLength) ||
		!Number.isSafeInteger(width * magnification) ||
		!Number.isSafeInteger(height * magnification)
	)
		return;
	return { framebuffer, format, width, height, magnification, byteLength };
}
