import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const coverageComponents = [
	{ id: 'compiler', label: 'compiler core', packageName: '@8f4e/compiler' },
	{ id: 'tokenizer', label: 'tokenizer', packageName: '@8f4e/tokenizer' },
	{ id: 'constantResolver', label: 'constant resolver', packageName: '@8f4e/constant-resolver' },
	{ id: 'memoryPlanner', label: 'memory planner', packageName: '@8f4e/memory-planner' },
	{ id: 'memoryReferenceResolver', label: 'memory reference resolver', packageName: '@8f4e/memory-reference-resolver' },
	{ id: 'memoryDefaultResolver', label: 'memory default resolver', packageName: '@8f4e/memory-default-resolver' },
	{
		id: 'semanticReferenceResolver',
		label: 'semantic reference resolver',
		packageName: '@8f4e/semantic-reference-resolver',
	},
	{ id: 'semanticUtils', label: 'semantic utils', packageName: '@8f4e/semantic-utils' },
	{ id: 'stackAnalyzer', label: 'stack analyzer', packageName: '@8f4e/stack-analyzer' },
	{ id: 'wasmCodegen', label: 'wasm codegen', packageName: '@8f4e/wasm-codegen' },
	{ id: 'compilerWasmUtils', label: 'compiler wasm utils', packageName: '@8f4e/compiler-wasm-utils' },
	{ id: 'languageSpec', label: 'language spec', packageName: '@8f4e/language-spec' },
];

/** Match inspector script URLs to the directory of each package's exported JS entry, including its chunks. */
export function createCoverageComponentMatcher(components = coverageComponents, resolve = import.meta.resolve) {
	const roots = components
		.map(component => ({ component, root: path.dirname(fileURLToPath(resolve(component.packageName))) }))
		.sort((left, right) => right.root.length - left.root.length);

	return url => {
		if (!url.startsWith('file:')) return null;
		const scriptPath = fileURLToPath(url);
		for (const { component, root } of roots) {
			const relative = path.relative(root, scriptPath);
			if (relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
				return component;
			}
		}
		return null;
	};
}
