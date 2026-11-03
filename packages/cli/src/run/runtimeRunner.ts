import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
import { createMemoryLookup } from './memoryLookup';
import type { CreateRuntimeRunnerOptions, MemoryLookup, RuntimeRunner } from './types';

type WebAssemblyMemoryLike = {
	buffer: ArrayBufferLike;
};

type WebAssemblyInstanceLike = {
	exports: Record<string, unknown>;
};

type WebAssemblyApiLike = {
	Memory: new (descriptor: { initial: number; maximum: number; shared: boolean }) => WebAssemblyMemoryLike;
	instantiate: (
		bytes: Buffer,
		imports: { host: { memory: WebAssemblyMemoryLike } }
	) => Promise<{ instance: WebAssemblyInstanceLike }>;
};

function getWebAssemblyApi(): WebAssemblyApiLike {
	return (globalThis as unknown as { WebAssembly: WebAssemblyApiLike }).WebAssembly;
}

function readScalar(view: DataView, data: PlannedMemoryDeclaration): number {
	if (data.isInteger) {
		if (data.elementWordSize === 1) {
			return data.isUnsigned ? view.getUint8(data.byteAddress) : view.getInt8(data.byteAddress);
		}
		if (data.elementWordSize === 2) {
			return data.isUnsigned ? view.getUint16(data.byteAddress, true) : view.getInt16(data.byteAddress, true);
		}
		if (data.elementWordSize === 4) {
			return view.getInt32(data.byteAddress, true);
		}
		throw new Error(`Unsupported integer element size for ${data.id}: ${data.elementWordSize}`);
	}

	if (data.elementWordSize === 8 || data.isFloat64) {
		return view.getFloat64(data.byteAddress, true);
	}

	return view.getFloat32(data.byteAddress, true);
}

function writeScalar(view: DataView, data: PlannedMemoryDeclaration, value: number): void {
	if (data.isInteger) {
		if (!Number.isInteger(value)) {
			throw new Error(`Expected integer value for ${data.id}, got ${value}`);
		}

		if (data.elementWordSize === 1) {
			view.setInt8(data.byteAddress, value);
			return;
		}
		if (data.elementWordSize === 2) {
			view.setInt16(data.byteAddress, value, true);
			return;
		}
		if (data.elementWordSize === 4) {
			view.setInt32(data.byteAddress, value, true);
			return;
		}
		throw new Error(`Unsupported integer element size for ${data.id}: ${data.elementWordSize}`);
	}

	if (data.elementWordSize === 8 || data.isFloat64) {
		view.setFloat64(data.byteAddress, value, true);
		return;
	}

	view.setFloat32(data.byteAddress, value, true);
}

function readValue(view: DataView, data: PlannedMemoryDeclaration): number | number[] {
	if (data.numberOfElements === 1) {
		return readScalar(view, data);
	}

	const values: number[] = [];
	for (let i = 0; i < data.numberOfElements; i += 1) {
		const elementData = { ...data, numberOfElements: 1, byteAddress: data.byteAddress + i * data.elementWordSize };
		values.push(readScalar(view, elementData));
	}

	return values;
}

function writeValue(view: DataView, data: PlannedMemoryDeclaration, value: number | number[]): void {
	if (data.numberOfElements === 1) {
		if (typeof value !== 'number') {
			throw new Error(`Expected scalar value for ${data.id}`);
		}
		writeScalar(view, data, value);
		return;
	}

	if (!Array.isArray(value)) {
		throw new Error(`Expected array value for ${data.id}`);
	}

	if (value.length !== data.numberOfElements) {
		throw new Error(`Expected ${data.numberOfElements} values for ${data.id}, got ${value.length}`);
	}

	for (let i = 0; i < value.length; i += 1) {
		const elementData = { ...data, numberOfElements: 1, byteAddress: data.byteAddress + i * data.elementWordSize };
		writeScalar(view, elementData, value[i]);
	}
}

function writeBytes(view: DataView, data: PlannedMemoryDeclaration, bytes: Uint8Array): void {
	const capacityBytes = data.numberOfElements * data.elementWordSize;
	if (bytes.byteLength > capacityBytes) {
		throw new Error(`Binary payload for ${data.id} is too large: ${bytes.byteLength} > ${capacityBytes} bytes`);
	}

	const target = new Uint8Array(view.buffer, data.byteAddress, capacityBytes);
	target.fill(0);
	target.set(bytes);
}

function readBytes(view: DataView, data: PlannedMemoryDeclaration): Uint8Array {
	const lengthBytes = data.numberOfElements * data.elementWordSize;
	const source = new Uint8Array(view.buffer, data.byteAddress, lengthBytes);
	return Uint8Array.from(source);
}

function createWebAssemblyMemory(requiredMemoryBytes: number): WebAssemblyMemoryLike {
	const memorySizePages = Math.max(1, Math.ceil(requiredMemoryBytes / 65536));
	return new (getWebAssemblyApi().Memory)({
		initial: memorySizePages,
		maximum: memorySizePages,
		shared: false,
	});
}

export async function createRuntimeRunner(options: CreateRuntimeRunnerOptions): Promise<RuntimeRunner> {
	const lookup: MemoryLookup = createMemoryLookup(options.memoryPlan);
	const memory = createWebAssemblyMemory(options.requiredMemoryBytes);
	const program = Buffer.from(options.compiledWasmBase64, 'base64');
	const { instance } = await getWebAssemblyApi().instantiate(program, {
		host: { memory },
	});
	const view = new DataView(memory.buffer);

	const initDefaults = instance.exports.initDefaults as () => void;
	const main = instance.exports.main as () => void;

	return {
		initialize(): void {
			initDefaults();
		},
		runCycles(count: number): void {
			for (let i = 0; i < count; i += 1) {
				main();
			}
		},
		read(id: string): number | number[] {
			const resolved = lookup.resolve(id);
			return readValue(view, resolved.data);
		},
		readBytes(id: string): Uint8Array {
			const resolved = lookup.resolve(id);
			return readBytes(view, resolved.data);
		},
		write(id: string, value: number | number[]): void {
			const resolved = lookup.resolve(id);
			writeValue(view, resolved.data, value);
		},
		writeBytes(id: string, bytes: Uint8Array): void {
			const resolved = lookup.resolve(id);
			writeBytes(view, resolved.data, bytes);
		},
	};
}
