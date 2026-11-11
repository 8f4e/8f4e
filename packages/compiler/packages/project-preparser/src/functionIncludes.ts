import { CompilerError, syntaxErrorAt, withAsyncCompilerStage, withCompilerStage } from '@8f4e/compiler-diagnostics';
import type {
	DiagnosticSource,
	ExportLine,
	IncludedFunctionBindings,
	ProjectBlock,
	ProjectIncludeResolver,
	SourceMetadata,
} from '@8f4e/language-spec';
import { parseLine } from '@8f4e/tokenizer';
import { INCLUDES_BLOCK_DELIMITER } from './delimiters';
import { isProjectGapLine } from './projectLines';

type SyncProjectIncludeResolver = (includeId: string) => string | undefined;

export type ResolvedFunctionSource = {
	code: string[];
	bindings: IncludedFunctionBindings;
	source: SourceMetadata;
};

type ProjectResolvedFunctionSource = ResolvedFunctionSource & { projectBlockId: number; includeLineNumber: number };
type IncludeFileSource = Extract<DiagnosticSource, { kind: 'include-file' }>;

function includeError(message: string, lineNumber: number, source: DiagnosticSource) {
	return new CompilerError({
		kind: 'source',
		domain: 'include',
		code: -1,
		message: `Parse error at line ${lineNumber}: ${message}`,
		location: { ...source, lineNumber: lineNumber - 1 },
	});
}

type FunctionIncludeBlock = {
	code: string[];
	startLineNumber: number;
};

type IncludeDeclaration = {
	includeId: string;
	exportedName?: string;
	localName?: string;
	lineNumber: number;
};

type ProjectIncludeDeclaration = IncludeDeclaration & { projectBlockId: number };

type IncludeBindings = Map<string, string>;

type IncludeExport = {
	lineIndex: number;
	publicName: string;
};

type IncludeFunction = {
	code: string[];
	startLineNumber: number;
	originalName: string;
	finalName: string;
	export?: IncludeExport;
};

function getFunctionName(line: string): string {
	return line.trim().split(/\s+/)[1] ?? '';
}

function getIncludeFunctionPrefix(includeId: string): string {
	return `__8f4e_${includeId.replace(/[^a-zA-Z0-9]+/g, '_')}__`;
}

function startsWithInstruction(line: string, instruction: string): boolean {
	const trimmed = line.trim();
	const nextCharacter = trimmed[instruction.length];
	return (
		trimmed === instruction || (trimmed.startsWith(instruction) && (nextCharacter === ' ' || nextCharacter === '\t'))
	);
}

function normalizeSourceLines(source: string): string[] {
	const lines = source.replace(/\r\n?/g, '\n').split('\n');
	return lines[lines.length - 1] === '' ? lines.slice(0, -1) : lines;
}

function splitFunctionBlocks(lines: string[]): FunctionIncludeBlock[] {
	const blocks: FunctionIncludeBlock[] = [];
	let currentBlock: FunctionIncludeBlock | undefined;

	for (const [index, line] of lines.entries()) {
		if (startsWithInstruction(line, 'function')) {
			currentBlock = { code: [line], startLineNumber: index + 1 };
			continue;
		}

		currentBlock?.code.push(line);

		if (startsWithInstruction(line, 'functionEnd')) {
			blocks.push(currentBlock ?? { code: [line], startLineNumber: index + 1 });
			currentBlock = undefined;
		}
	}

	return blocks;
}

function getIncludeExport(source: IncludeFileSource, block: FunctionIncludeBlock): IncludeExport | undefined {
	const { includeId } = source;
	let includeExport: IncludeExport | undefined;

	for (const [lineIndex, line] of block.code.entries()) {
		if (!startsWithInstruction(line, '#export')) {
			continue;
		}

		if (includeExport) {
			throw includeError(
				`include "${includeId}" function can only declare one #export`,
				block.startLineNumber + lineIndex,
				source
			);
		}

		const result = parseLine(line, block.startLineNumber + lineIndex - 1);
		if (!result.ok)
			throw syntaxErrorAt(result.issue.code, result.issue.message, source, {
				lineNumber: block.startLineNumber + lineIndex - 1,
				instruction: '#export',
			});
		const exportLine = result.value as ExportLine;
		const publicName = exportLine.arguments[0]?.value;

		includeExport = {
			lineIndex,
			publicName: publicName ?? getFunctionName(block.code[0] ?? ''),
		};
	}

	return includeExport;
}

function getLineFirstArgument(line: string): string {
	return line.trim().split(/\s+/)[1] ?? '';
}

function createIncludeFunctions(source: IncludeFileSource, blocks: FunctionIncludeBlock[]): IncludeFunction[] {
	const { includeId } = source;
	const prefix = getIncludeFunctionPrefix(includeId);
	const functions = blocks.map(block => {
		const originalName = getFunctionName(block.code[0] ?? '');
		const includeExport = getIncludeExport(source, block);

		return {
			...block,
			originalName,
			finalName: includeExport
				? `${prefix}unselected__${includeExport.publicName}`
				: `${prefix}nonexported__${originalName}`,
			...(includeExport ? { export: includeExport } : {}),
		};
	});

	if (functions.every(func => !func.export)) {
		throw includeError(`include "${includeId}" must export at least one function`, 1, source);
	}

	return functions;
}

function createCallTargetRewriteMap(source: IncludeFileSource, functions: IncludeFunction[]): Map<string, string> {
	const { includeId } = source;
	const finalNamesByOriginalName = new Map<string, Set<string>>();

	for (const func of functions) {
		const names = finalNamesByOriginalName.get(func.originalName) ?? new Set<string>();
		names.add(func.finalName);
		finalNamesByOriginalName.set(func.originalName, names);
	}

	// Source declarations take precedence when an export alias matches another function's source name.
	const originalNames = new Set(finalNamesByOriginalName.keys());
	for (const func of functions) {
		if (func.export && !originalNames.has(func.export.publicName)) {
			const names = finalNamesByOriginalName.get(func.export.publicName) ?? new Set<string>();
			names.add(func.finalName);
			finalNamesByOriginalName.set(func.export.publicName, names);
		}
	}

	const rewriteMap = new Map<string, string>();
	const ambiguousNames = new Set<string>();

	for (const [originalName, finalNames] of finalNamesByOriginalName) {
		if (finalNames.size === 1) {
			rewriteMap.set(originalName, [...finalNames][0]!);
		} else {
			ambiguousNames.add(originalName);
		}
	}

	for (const func of functions) {
		for (const [lineIndex, line] of func.code.entries()) {
			if (!startsWithInstruction(line, 'call')) {
				continue;
			}
			const targetName = getLineFirstArgument(line);
			if (ambiguousNames.has(targetName)) {
				throw includeError(
					`include "${includeId}" call target "${targetName}" is ambiguous because that function name expands to multiple public/internal include names`,
					func.startLineNumber + lineIndex,
					source
				);
			}
		}
	}

	return rewriteMap;
}

function expandIncludeFunctions(
	source: IncludeFileSource,
	functions: IncludeFunction[],
	bindings: IncludeBindings
): ResolvedFunctionSource[] {
	const { includeId } = source;
	const renamedFunctions = functions.map(func => ({
		...func,
		finalName: func.export ? (bindings.get(func.export.publicName) ?? func.finalName) : func.finalName,
	}));
	const callTargetRewriteMap = createCallTargetRewriteMap(source, renamedFunctions);
	return renamedFunctions.map(func => ({
		code: func.code.map((line, index) => (index === func.export?.lineIndex ? '' : line)),
		bindings: {
			functionName: func.finalName,
			callTargets: callTargetRewriteMap,
		},
		source: { kind: 'include' as const, includeId, symbolName: func.finalName },
	}));
}

/**
 * Converts all public exports and their private dependencies into function source blocks.
 */
export function resolveFunctionIncludeSource(includeId: string, source: string): ResolvedFunctionSource[] {
	const diagnosticSource: IncludeFileSource = { kind: 'include-file', includeId };
	const functions = createIncludeFunctions(diagnosticSource, splitFunctionBlocks(normalizeSourceLines(source)));
	const bindings: IncludeBindings = new Map();
	for (const func of functions) {
		if (func.export) {
			bindings.set(func.export.publicName, func.export.publicName);
		}
	}
	return expandIncludeFunctions(diagnosticSource, functions, bindings);
}

export function collectProjectIncludeIdsFromBlock(block: Pick<ProjectBlock, 'code' | 'id'>, projectGroupPath = '') {
	const includeIds: IncludeDeclaration[] = [];

	for (const [index, line] of block.code.entries()) {
		const lineNumber = index + 1;
		const trimmed = line.trim();
		if (
			trimmed === INCLUDES_BLOCK_DELIMITER.opener ||
			trimmed === INCLUDES_BLOCK_DELIMITER.closer ||
			isProjectGapLine(trimmed)
		) {
			continue;
		}

		const [instruction, includeId, exportedName, localName, ...extraArgs] = trimmed.split(/\s+/);
		if (instruction !== 'include' || !includeId || extraArgs.length > 0) {
			throw includeError('include expects <path> [exportedName [localName]]', lineNumber, {
				kind: 'block',
				projectBlockId: block.id,
				projectGroupPath,
			});
		}
		for (const name of [exportedName, localName]) {
			if (name !== undefined) {
				const result = parseLine(`function ${name}`, index);
				if (!result.ok)
					throw syntaxErrorAt(
						result.issue.code,
						result.issue.message,
						{ kind: 'block', projectBlockId: block.id, projectGroupPath },
						{ lineNumber: index, instruction: 'include' }
					);
			}
		}
		includeIds.push({
			includeId,
			lineNumber,
			...(exportedName ? { exportedName } : {}),
			...(localName ? { localName } : {}),
		});
	}

	return includeIds;
}

export function collectProjectIncludeIdsFromText(text: string): string[] {
	const includeIds: string[] = [];
	const lines = text.split('\n');

	for (let i = 1; i < lines.length; i += 1) {
		const trimmed = lines[i].trim();
		if (trimmed !== INCLUDES_BLOCK_DELIMITER.opener) {
			continue;
		}

		const blockLines = [lines[i]];
		const blockStartLineNumber = i + 1;
		for (i += 1; i < lines.length; i += 1) {
			blockLines.push(lines[i]);
			if (lines[i].trim() === INCLUDES_BLOCK_DELIMITER.closer) {
				break;
			}
		}

		includeIds.push(
			...collectProjectIncludeIdsFromBlock({ id: blockStartLineNumber, code: blockLines }).map(
				({ includeId }) => includeId
			)
		);
	}

	return includeIds;
}

function collectProjectIncludeDeclarations(
	includeBlocks: readonly Pick<ProjectBlock, 'code' | 'id' | 'disabled'>[],
	projectGroupPath: string
): Map<string, ProjectIncludeDeclaration[]> {
	const declarationsByIncludeId = new Map<string, ProjectIncludeDeclaration[]>();
	for (const block of includeBlocks) {
		if (block.disabled) {
			continue;
		}
		for (const declaration of collectProjectIncludeIdsFromBlock(block, projectGroupPath)) {
			const declarations = declarationsByIncludeId.get(declaration.includeId) ?? [];
			declarations.push({ ...declaration, projectBlockId: block.id });
			declarationsByIncludeId.set(declaration.includeId, declarations);
		}
	}
	return declarationsByIncludeId;
}

function resolveProjectIncludeDeclarations(
	declarationsByIncludeId: Map<string, ProjectIncludeDeclaration[]>,
	resolveInclude: SyncProjectIncludeResolver,
	projectGroupPath: string
): ProjectResolvedFunctionSource[] {
	const includedFunctionBlocks: ProjectResolvedFunctionSource[] = [];

	for (const [includeId, declarations] of declarationsByIncludeId) {
		const declaration = declarations[0]!;
		const diagnosticSource: IncludeFileSource = {
			kind: 'include-file',
			includeId,
			includeSite: {
				projectBlockId: declaration.projectBlockId,
				projectGroupPath,
				lineNumber: declaration.lineNumber - 1,
			},
		};
		const source = withCompilerStage('include loading', () => resolveInclude(includeId), {
			kind: 'block',
			projectBlockId: declaration.projectBlockId,
			projectGroupPath,
			lineNumber: declaration.lineNumber - 1,
		});
		if (source === undefined) {
			const { lineNumber, projectBlockId } = declarations[0]!;
			throw includeError(`unresolved include "${includeId}"`, lineNumber, {
				kind: 'block',
				projectBlockId,
				projectGroupPath,
			});
		}
		const functions = createIncludeFunctions(diagnosticSource, splitFunctionBlocks(normalizeSourceLines(source)));
		const publicNames = new Set(functions.flatMap(func => (func.export ? [func.export.publicName] : [])));
		const bindings: IncludeBindings = new Map();
		for (const { exportedName, localName, lineNumber, projectBlockId } of declarations) {
			if (exportedName !== undefined && !publicNames.has(exportedName)) {
				throw includeError(`include "${includeId}" does not export "${exportedName}"`, lineNumber, {
					kind: 'block',
					projectBlockId,
					projectGroupPath,
				});
			}
			for (const publicName of exportedName === undefined ? publicNames : [exportedName]) {
				const name = localName ?? publicName;
				const previousName = bindings.get(publicName);
				if (previousName !== undefined && previousName !== name) {
					throw includeError(
						`include "${includeId}" export "${publicName}" is already included as "${previousName}"`,
						lineNumber,
						{ kind: 'block', projectBlockId, projectGroupPath }
					);
				}
				bindings.set(publicName, name);
			}
		}
		includedFunctionBlocks.push(
			...expandIncludeFunctions(diagnosticSource, functions, bindings).map(func => ({
				...func,
				projectBlockId: declarations[0]!.projectBlockId,
				includeLineNumber: declarations[0]!.lineNumber - 1,
			}))
		);
	}

	return includedFunctionBlocks;
}

export function resolveProjectIncludes(
	includeBlocks: readonly Pick<ProjectBlock, 'code' | 'id' | 'disabled'>[],
	resolveInclude: SyncProjectIncludeResolver,
	projectGroupPath = ''
): ProjectResolvedFunctionSource[] {
	return resolveProjectIncludeDeclarations(
		collectProjectIncludeDeclarations(includeBlocks, projectGroupPath),
		resolveInclude,
		projectGroupPath
	);
}

export async function resolveProjectIncludesAsync(
	includeBlocks: readonly Pick<ProjectBlock, 'code' | 'id' | 'disabled'>[],
	resolveInclude: ProjectIncludeResolver,
	projectGroupPath = ''
): Promise<ProjectResolvedFunctionSource[]> {
	const declarations = collectProjectIncludeDeclarations(includeBlocks, projectGroupPath);
	const includeSources = new Map<string, string | undefined>();
	for (const includeId of declarations.keys()) {
		const declaration = declarations.get(includeId)![0]!;
		includeSources.set(
			includeId,
			await withAsyncCompilerStage('include loading', async () => resolveInclude(includeId), {
				kind: 'block',
				projectBlockId: declaration.projectBlockId,
				projectGroupPath,
				lineNumber: declaration.lineNumber - 1,
			})
		);
	}
	return resolveProjectIncludeDeclarations(declarations, includeId => includeSources.get(includeId), projectGroupPath);
}
