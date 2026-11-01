import { serializeDiagnostic } from '@8f4e/compiler';
import type { ResolveIncludeRequestMessage, ResolveIncludeResultMessage } from '@8f4e/compiler-worker';
import CompilerWorker from '@8f4e/compiler-worker?worker';
import type {
	AssertionSite,
	CompileAndUpdateMemoryResult,
	CompileOptions,
	CompilerDiagnostic,
	ProjectIncludeResolver,
	ProjectObjectModel,
} from '@8f4e/language-spec';

export interface CompilerService {
	compileCode: (
		project: ProjectObjectModel,
		compilerOptions: CompileOptions,
		isCurrent: () => boolean
	) => Promise<CompileAndUpdateMemoryResult>;
	getMemory: () => WebAssembly.Memory | null;
	writeMemory: (allocationUnitAddress: number, value: number, isInteger: boolean) => void;
	getCodeBuffer: () => Uint8Array;
	getAssertionSites: () => AssertionSite[] | undefined;
	dispose: () => void;
}

export function createCompilerService({
	resolveInclude,
	createWorker = () => new CompilerWorker(),
}: {
	resolveInclude?: ProjectIncludeResolver;
	createWorker?: () => Worker;
} = {}): CompilerService {
	let compilerWorker: Worker | null = null;
	let memoryRef: WebAssembly.Memory | null = null;
	let writeViews:
		| {
				buffer: ArrayBufferLike;
				int32: Int32Array;
				float32: Float32Array;
		  }
		| undefined;
	let codeBuffer: Uint8Array = new Uint8Array();
	let assertionSites: AssertionSite[] | undefined;
	let nextCompilationId = 0;
	let disposed = false;
	let pendingCompilation:
		| {
				handleMessage: (event: MessageEvent) => void;
				reject: (error: Error) => void;
		  }
		| undefined;

	async function handleIncludeRequest({ data }: MessageEvent): Promise<void> {
		if (data.type !== 'resolveInclude') return;
		const request = data as ResolveIncludeRequestMessage;
		let response: ResolveIncludeResultMessage;
		try {
			response = {
				type: 'resolveIncludeResult',
				payload: {
					requestId: request.payload.requestId,
					source: await resolveInclude?.(request.payload.includeId),
				},
			};
		} catch (error) {
			response = {
				type: 'resolveIncludeResult',
				payload: {
					requestId: request.payload.requestId,
					error: serializeDiagnostic(error),
				},
			};
		}
		compilerWorker?.postMessage(response);
	}

	function getCompilerWorker(): Worker {
		if (disposed) {
			throw new Error('Compiler service has been disposed');
		}

		if (!compilerWorker) {
			compilerWorker = createWorker();
			compilerWorker.addEventListener('message', handleIncludeRequest);
		}

		return compilerWorker;
	}

	return {
		// The scheduling effect owns serialization and permits one outstanding request.
		async compileCode(project, compilerOptions, isCurrent) {
			assertionSites = undefined;
			const worker = getCompilerWorker();
			const compilationId = nextCompilationId++;

			return new Promise((resolve, reject) => {
				const handleMessage = ({ data }: MessageEvent) => {
					if (data.compilationId !== compilationId) return;
					switch (data.type) {
						case 'success':
							worker.removeEventListener('message', handleMessage);
							pendingCompilation = undefined;
							if (isCurrent()) {
								memoryRef = data.payload.memoryRef;
								codeBuffer = data.payload.codeBuffer;
								assertionSites = data.payload.assertionSites;
							}

							resolve(data.payload);
							break;
						case 'compilationError':
							worker.removeEventListener('message', handleMessage);
							pendingCompilation = undefined;
							reject(data.payload as CompilerDiagnostic);
							break;
					}
				};

				pendingCompilation = { handleMessage, reject };
				worker.addEventListener('message', handleMessage);

				worker.postMessage({
					type: 'compile',
					compilationId,
					payload: {
						project,
						compilerOptions,
					},
				});
			});
		},
		getMemory: () => memoryRef,
		writeMemory: (address, value, isInteger) => {
			if (!memoryRef) return;
			const buffer = memoryRef.buffer;
			if (!writeViews || writeViews.buffer !== buffer) {
				writeViews = { buffer, int32: new Int32Array(buffer), float32: new Float32Array(buffer) };
			}
			if (isInteger) writeViews.int32[address] = value;
			else writeViews.float32[address] = value;
		},
		getCodeBuffer: () => codeBuffer,
		getAssertionSites: () => assertionSites,
		dispose: () => {
			if (disposed) {
				return;
			}

			disposed = true;
			assertionSites = undefined;
			writeViews = undefined;
			const disposalError = new Error('Compiler service has been disposed');
			if (pendingCompilation) {
				const { handleMessage, reject } = pendingCompilation;
				compilerWorker?.removeEventListener('message', handleMessage);
				reject(disposalError);
			}
			pendingCompilation = undefined;
			compilerWorker?.removeEventListener('message', handleIncludeRequest);
			compilerWorker?.terminate();
			compilerWorker = null;
		},
	};
}
