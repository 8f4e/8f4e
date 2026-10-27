import { resolveMemoryTarget } from '@8f4e/editor-state/memory';
import type { State } from '@8f4e/editor-state-types';
import { IGNORED_ASSERTION_IMPORTS } from '@8f4e/test-runner';
import type { RgbaTextureLayer } from '../plugins/rgba-texture-layer';
import type { MemoryViews } from '../types';

type OverlayPosition = 'left' | 'center' | 'right';

export interface WasmOverlayTextureOptions {
	entry: string;
	target: string;
	width: number;
	height: number;
	magnification?: number;
	position?: OverlayPosition;
}

export interface WasmOverlayTextureDrawerOptions {
	state: State;
	memoryViews: MemoryViews;
	overlayTexture: WasmOverlayTextureOptions;
	getCodeBuffer: () => Uint8Array;
	getMemory: () => WebAssembly.Memory | null;
	getViewportSize: () => { width: number; height: number };
	instantiate?: (
		memory: WebAssembly.Memory,
		codeBuffer: Uint8Array
	) => Promise<WebAssembly.Exports> | WebAssembly.Exports;
}

async function instantiateWasmOverlayTexture(
	memory: WebAssembly.Memory,
	codeBuffer: Uint8Array
): Promise<WebAssembly.Exports> {
	const { instance } = (await WebAssembly.instantiate(codeBuffer, {
		host: {
			memory,
			...IGNORED_ASSERTION_IMPORTS,
		},
	})) as unknown as WebAssembly.WebAssemblyInstantiatedSource;

	return instance.exports;
}

function normalizePositiveInteger(value: number): number {
	return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

function normalizeMagnification(value: number | undefined): number {
	return value !== undefined && Number.isFinite(value) ? Math.max(1, value) : 1;
}

function getOverlayBufferByteAddress(state: State, target: string): number | undefined {
	return resolveMemoryTarget(state, { kind: 'project', groupPath: '' }, target)?.memory.byteAddress;
}

export function getOverlayDrawRect(
	sourceWidth: number,
	sourceHeight: number,
	viewportWidth: number,
	viewportHeight: number,
	magnification = 1,
	position: OverlayPosition = 'center'
): { x: number; y: number; width: number; height: number } {
	const width = sourceWidth * magnification;
	const height = sourceHeight * magnification;
	const horizontalCenter = {
		left: viewportWidth / 4,
		center: viewportWidth / 2,
		right: (viewportWidth * 3) / 4,
	}[position];
	return {
		x: horizontalCenter - width / 2,
		y: (viewportHeight - height) / 2,
		width,
		height,
	};
}

export function createWasmOverlayTextureDrawer({
	state,
	memoryViews,
	overlayTexture,
	getCodeBuffer,
	getMemory,
	getViewportSize,
	instantiate = instantiateWasmOverlayTexture,
}: WasmOverlayTextureDrawerOptions): (layer: RgbaTextureLayer) => void {
	const sourceWidth = normalizePositiveInteger(overlayTexture.width);
	const sourceHeight = normalizePositiveInteger(overlayTexture.height);
	const byteLength = sourceWidth * sourceHeight * 4;
	const magnification = normalizeMagnification(overlayTexture.magnification);
	const position = overlayTexture.position ?? 'center';
	let cachedMemory: WebAssembly.Memory | null = null;
	let cachedCodeBuffer: Uint8Array | undefined;
	let cachedExports: WebAssembly.Exports | undefined;
	let pendingMemory: WebAssembly.Memory | null = null;
	let pendingCodeBuffer: Uint8Array | undefined;
	let pendingExports: Promise<WebAssembly.Exports | undefined> | undefined;
	let generation = 0;

	function clearWasmInstance(): void {
		cachedMemory = null;
		cachedCodeBuffer = undefined;
		cachedExports = undefined;
		pendingMemory = null;
		pendingCodeBuffer = undefined;
		pendingExports = undefined;
		generation++;
	}

	function syncWasmInstance(): WebAssembly.Exports | undefined {
		const memory = getMemory();
		const codeBuffer = getCodeBuffer();

		if (!memory || codeBuffer.length === 0) {
			clearWasmInstance();
			return undefined;
		}

		if (cachedExports && cachedMemory === memory && cachedCodeBuffer === codeBuffer) {
			return cachedExports;
		}

		if (pendingExports && pendingMemory === memory && pendingCodeBuffer === codeBuffer) {
			return undefined;
		}

		const instantiateGeneration = generation;
		pendingMemory = memory;
		pendingCodeBuffer = codeBuffer;
		const instantiatePromise = Promise.resolve(instantiate(memory, codeBuffer))
			.then(exports => {
				if (generation !== instantiateGeneration || pendingExports !== instantiatePromise) {
					return undefined;
				}

				cachedMemory = memory;
				cachedCodeBuffer = codeBuffer;
				cachedExports = exports;
				pendingMemory = null;
				pendingCodeBuffer = undefined;
				pendingExports = undefined;

				return exports;
			})
			.catch(error => {
				if (pendingExports === instantiatePromise) {
					pendingMemory = null;
					pendingCodeBuffer = undefined;
					pendingExports = undefined;
				}

				console.error('Failed to instantiate overlay texture WebAssembly module:', error);
				return undefined;
			});
		pendingExports = instantiatePromise;

		return undefined;
	}

	return layer => {
		const exports = syncWasmInstance();
		if (!exports) {
			return;
		}

		const entry = exports[overlayTexture.entry];
		if (typeof entry !== 'function') {
			return;
		}

		entry();

		const byteAddress = getOverlayBufferByteAddress(state, overlayTexture.target);
		if (byteAddress === undefined || byteAddress + byteLength > memoryViews.uint8.byteLength) {
			return;
		}

		const data = memoryViews.uint8.subarray(byteAddress, byteAddress + byteLength);
		layer.uploadRgba8Texture(data, sourceWidth, sourceHeight);
		const viewport = getViewportSize();
		const drawRect = getOverlayDrawRect(
			sourceWidth,
			sourceHeight,
			viewport.width,
			viewport.height,
			magnification,
			position
		);
		layer.drawTexture(drawRect.x, drawRect.y, drawRect.width, drawRect.height);
	};
}
