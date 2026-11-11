import type { SourceMetadata } from './compiled';
import type { CompilerSourceBlockType } from './instructions';
import type { ProjectGroupPath } from './project';

/** Source ownership is explicit even before a document has been divided into blocks. */
export type DiagnosticSource =
	| { readonly kind: 'document' }
	| { readonly kind: 'block'; readonly projectBlockId: number; readonly projectGroupPath: ProjectGroupPath }
	| { readonly kind: 'scope'; readonly projectGroupPath: ProjectGroupPath }
	| {
			readonly kind: 'include';
			readonly includeId: string;
			readonly symbolName: string;
			readonly projectGroupPath: ProjectGroupPath;
			readonly includeSite: { readonly projectBlockId: number; readonly lineNumber: number };
	  };

/** Zero-based line in the identified source, or a named declaration in a project scope. */
export type DiagnosticLocation =
	| (DiagnosticSource & { readonly lineNumber: number })
	| { readonly kind: 'exposure'; readonly projectGroupPath: ProjectGroupPath; readonly name: string };

/** Source block context attached to a serialized compiler diagnostic. */
export interface CompilerDiagnosticContext {
	codeBlockId?: string;
	codeBlockType?: CompilerSourceBlockType;
	projectBlockId?: number;
	source?: SourceMetadata;
}

/** Source line supplied to diagnostic construction after syntax has identified its position. */
export interface CompilerDiagnosticLine {
	readonly diagnosticSource: DiagnosticSource;
	lineNumber: number;
	instruction?: string;
	arguments?: unknown[];
}

/** Serializable compiler diagnostic shared across syntax and semantic stages. */
export interface SourceDiagnostic {
	kind: 'source';
	domain: 'syntax' | 'semantic' | 'include';
	/** Numeric ErrorCode for compiler errors; numeric SyntaxErrorCode for syntax errors. */
	code: number;
	message: string;
	location: DiagnosticLocation;
	instruction?: string;
	symbol?: string;
}

/** Unexpected failures retain debugging context without inventing a source position. */
export interface InternalCompilerDiagnostic {
	kind: 'internal';
	message: string;
	stage: string;
	stack?: string;
	location?: DiagnosticLocation;
}

/** Complete, serializable diagnostic shared by compiler hosts and worker transports. */
export type CompilerDiagnostic = SourceDiagnostic | InternalCompilerDiagnostic;
