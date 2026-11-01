import { isPointerSource, parseInteger } from '@8f4e/editor-state';

export type TextureFormat = '1bit' | 'mono' | 'rgb' | 'rgba';

export interface TextureUploadDirective {
	address: string;
	format: TextureFormat;
	width: number;
	height: number;
	byteLength: number;
}

export interface TextureCrop {
	x: number;
	y: number;
	width: number;
	height: number;
}
export interface TextureDirective {
	address: string;
	magnification: number;
	crop: TextureCrop;
}

export function parseTextureUploadDirective(args: string[]): TextureUploadDirective | undefined {
	if (args.length !== 4 || !isPointerSource(args[0])) return;
	const [address, format] = args;
	if (format !== '1bit' && format !== 'mono' && format !== 'rgb' && format !== 'rgba') return;
	const width = parseInteger(args[2]);
	const height = parseInteger(args[3]);
	if (!width || width < 1 || !height || height < 1) return;
	const rowBytes =
		format === '1bit' ? Math.ceil(width / 8) : width * (format === 'rgba' ? 4 : format === 'rgb' ? 3 : 1);
	const byteLength = rowBytes * height;
	if (!Number.isSafeInteger(byteLength)) return;
	return { address, format, width, height, byteLength };
}

export function parseTextureDirective(args: string[]): TextureDirective | undefined {
	if ((args.length !== 4 && args.length !== 6) || !isPointerSource(args[0])) return;
	const magnification = parseInteger(args[1]);
	const width = parseInteger(args[2]);
	const height = parseInteger(args[3]);
	const x = args.length === 6 ? parseInteger(args[4]) : 0;
	const y = args.length === 6 ? parseInteger(args[5]) : 0;
	if (
		!magnification ||
		magnification < 1 ||
		x === undefined ||
		x < 0 ||
		y === undefined ||
		y < 0 ||
		!width ||
		width < 1 ||
		!height ||
		height < 1 ||
		!Number.isSafeInteger(width * magnification) ||
		!Number.isSafeInteger(height * magnification)
	)
		return;
	return { address: args[0], magnification, crop: { x, y, width, height } };
}
