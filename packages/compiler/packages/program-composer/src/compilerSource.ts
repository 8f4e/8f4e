import type {
	CompilerCache,
	DiagnosticSource,
	ProjectBlock,
	ProjectGroupPath,
	SourceMetadata,
	ValidatedAST,
} from '@8f4e/language-spec';
import { compileToAST } from '@8f4e/tokenizer';
import type { CompilerDerivedSource } from './types';

type CompilerSource = {
	code: string[];
	cacheKey: string;
	diagnosticSource: DiagnosticSource;
	projectBlockId: number;
	source?: SourceMetadata;
};

function attachSourceMetadataToAst<TAst extends ValidatedAST>(ast: TAst, source: CompilerSource): TAst {
	return {
		...ast,
		projectBlockId: source.projectBlockId,
		...(source.source !== undefined ? { source: source.source } : {}),
	} as TAst;
}

/** Parses one compiler source block and attaches its project diagnostic metadata. */
export function compileSourceToAST<TAst extends ValidatedAST>(source: CompilerSource, cache: CompilerCache): TAst {
	const ast = compileToAST(source.code, source.diagnosticSource, cache.ast, source.cacheKey) as TAst;
	return attachSourceMetadataToAst(ast, source);
}

/** Creates a source block with a cache key scoped to its owning canonical project-group path. */
export function createCompilerSource(
	source: CompilerDerivedSource | ProjectBlock,
	projectPath: ProjectGroupPath,
	blockKey: string
): CompilerSource {
	return {
		code: source.code,
		diagnosticSource:
			'source' in source
				? {
						...source.source,
						projectGroupPath: projectPath,
						includeSite: { projectBlockId: source.projectBlockId, lineNumber: source.includeLineNumber },
					}
				: {
						kind: 'block',
						projectBlockId: source.id,
						projectGroupPath: projectPath,
					},
		cacheKey: `${projectPath || 'root'}:${blockKey}`,
		...('id' in source ? { projectBlockId: source.id } : { projectBlockId: source.projectBlockId }),
		...('source' in source ? { source: source.source } : {}),
	};
}
