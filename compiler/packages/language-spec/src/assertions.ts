import type { FunctionTypeSignature, SourceMetadata } from './compiled';
import type { FunctionImportMetadata } from './functionTypes';
import type { ProjectGroupPath } from './project';

/** Native assertion instructions; ordinary `call assert` remains a user function call. */
export type AssertionInstruction = 'assert' | 'assertEqual';

/** Static source identity for one native assertion in one compiled program. */
export interface AssertionSite {
	siteId: number;
	instruction: AssertionInstruction;
	projectBlockId?: number;
	projectGroupPath: ProjectGroupPath;
	codeBlockType: 'module' | 'function';
	codeBlockId: string;
	/** Qualified signature-derived identity for function sites, including overloaded included functions. */
	functionId?: string;
	/** Zero-based physical source line within the original block. */
	lineNumber: number;
	source?: SourceMetadata;
}

/** Host callback field names for native assertions. Equality callbacks preserve the operand's Wasm type. */
export const ASSERTION_IMPORT_NAMES = {
	assert: 'assertCondition',
	assertEqual: { int: 'assertEqualI32', float: 'assertEqualF32', float64: 'assertEqualF64' },
} as const;

export type AssertionImportName =
	| typeof ASSERTION_IMPORT_NAMES.assert
	| (typeof ASSERTION_IMPORT_NAMES.assertEqual)[keyof typeof ASSERTION_IMPORT_NAMES.assertEqual];

/** Typed callback request; WebAssembly indices are assigned by function layout planning. */
export interface AssertionImport extends FunctionImportMetadata {
	fieldName: AssertionImportName;
	signature: FunctionTypeSignature;
}

export interface AssertionCodegenSite {
	siteId: number;
	fieldName: AssertionImportName;
}

/** Internal assertion calls keyed by operation index within one resolved body. */
export type AssertionCodegenSites = ReadonlyMap<number, AssertionCodegenSite>;
