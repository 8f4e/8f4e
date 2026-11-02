import type { EditorPlugin } from '@8f4e/editor-core';
import type { ProjectIncludeResolver } from '@8f4e/language-spec';
import installCompilation, { type CompilerDiagnostics } from './compilation';
import { createCompilerService } from './compiler-service';

export type { CompilerDiagnostics } from './compilation';

/** Construct once per editor; handles are stable before installation and across compilations. */
export function createCompilerPlugin({
	resolveInclude,
	createWorker,
}: {
	resolveInclude?: ProjectIncludeResolver;
	createWorker?: () => Worker;
} = {}) {
	const service = createCompilerService({ resolveInclude, createWorker });
	let installed = false;
	let getDiagnostics = (): CompilerDiagnostics | null => null;
	const plugin: EditorPlugin = {
		id: 'compiler',
		setup: context => {
			if (installed) throw new Error('Create a compiler plugin for each editor instance');
			installed = true;
			const compilation = installCompilation(context, service.compileCode);
			getDiagnostics = compilation.getDiagnostics;
			return () => {
				try {
					compilation.dispose();
				} finally {
					service.dispose();
				}
			};
		},
	};
	return {
		plugin,
		getMemory: service.getMemory,
		writeMemory: service.writeMemory,
		getCodeBuffer: service.getCodeBuffer,
		getAssertionSites: service.getAssertionSites,
		getDiagnostics: () => getDiagnostics(),
	};
}
