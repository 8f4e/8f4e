/** Quote one POSIX shell argument without expanding spaces, quotes or substitutions. */
export function shellCommand(args) {
	return args.map(value => `'${String(value).replaceAll("'", "'\"'\"'")}'`).join(' ');
}

function resolveBuffer(info, reference) {
	const separator = reference.lastIndexOf(':');
	const moduleId = reference.slice(0, separator);
	const name = reference.slice(separator + 1);
	const memory = separator > 0 ? info.memoryPlan.modules[moduleId]?.memory[name] : undefined;
	if (!memory) throw new Error(`Unknown memory buffer: ${reference}`);
	if (memory.type !== 'float' || memory.pointerDepth !== 0) {
		throw new Error(`Audio buffer must contain float32 samples: ${reference}`);
	}
	return memory;
}

/** Translate compiler-owned memory metadata into numeric Linux runtime arguments. */
export function createRuntimeArguments(
	info,
	{ wasmPath, runtimePath = '8f4e-runtime', left = 'audioout:buffer', right = left },
	runtimeArgs = []
) {
	const leftBuffer = resolveBuffer(info, left);
	const rightBuffer = resolveBuffer(info, right);
	if (leftBuffer.numberOfElements === 0 || leftBuffer.numberOfElements !== rightBuffer.numberOfElements) {
		throw new Error('Left and right audio buffers must have the same nonzero sample count');
	}
	return [
		runtimePath,
		wasmPath,
		'--left',
		String(leftBuffer.byteAddress),
		'--right',
		String(rightBuffer.byteAddress),
		'--buffer-size',
		String(leftBuffer.numberOfElements),
		...runtimeArgs,
	];
}
