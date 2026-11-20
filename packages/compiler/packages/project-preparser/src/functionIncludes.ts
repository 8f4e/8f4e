import { includeErrorAt, syntaxErrorAt, withAsyncCompilerStage } from '@8f4e/compiler-diagnostics';
import type {
	DiagnosticLocation,
	DiagnosticSource,
	ExportLine,
	IncludedFunctionBindings,
	ProjectBlock,
	ProjectIncludeResolver,
	SourceMetadata,
} from '@8f4e/language-spec';
import { IncludeErrorCode } from '@8f4e/language-spec';
import { isProjectGapLine, parseLine } from '@8f4e/tokenizer';
import { INCLUDES_BLOCK_DELIMITER } from './delimiters';
import { isBlock, readProjectSource, sourceLines } from './projectSource';

type ResolvedFunctionSource = {
	code: string[];
	bindings: IncludedFunctionBindings;
	source: SourceMetadata;
};

type ProjectResolvedFunctionSource = ResolvedFunctionSource & { projectBlockId: number; includeLineNumber: number };
type IncludeFileSource = Extract<DiagnosticSource, { kind: 'include-file' }>;
type IncludeSite = NonNullable<IncludeFileSource['includeSite']>;

type FunctionIncludeBlock = {
	code: string[];
	/** Zero-based row in the included file. */
	startLineNumber: number;
};

type IncludeDeclaration = {
	includeId: string;
	exportedName?: string;
	localName?: string;
	/** Zero-based row in the owning includes block. */
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
	export?: IncludeExport;
};
type BoundIncludeFunction = IncludeFunction & { finalName: string };
type LoadedInclude = {
	source: IncludeFileSource;
	site: IncludeSite;
	functions: IncludeFunction[];
	publicNames: ReadonlySet<string>;
	imports: IncludeBindings;
	privatePrefix: string;
};

function getFunctionName(line: string): string {
	return line.trim().split(/\s+/)[1] ?? '';
}

function getIncludeFunctionPrefix(includeId: string): string {
	return `__8f4e_${includeId.replace(/[^a-zA-Z0-9]+/g, '_')}__`;
}

function getPrivateIncludePrefix(includeId: string): string {
	// Source identifiers are ASCII. Separators that cannot appear in them make these symbols truly private.
	return `§${includeId.replaceAll('§', '§§')}§`;
}

function privateExportName(prefix: string, publicName: string): string {
	return `${prefix}unselected__${publicName}`;
}

function startsWithInstruction(line: string, instruction: string): boolean {
	const trimmed = line.trim();
	const nextCharacter = trimmed[instruction.length];
	return (
		trimmed === instruction || (trimmed.startsWith(instruction) && (nextCharacter === ' ' || nextCharacter === '\t'))
	);
}

function getIncludeExport(source: IncludeFileSource, block: FunctionIncludeBlock): IncludeExport | undefined {
	const { includeId } = source;
	let includeExport: IncludeExport | undefined;

	for (const [lineIndex, line] of block.code.entries()) {
		if (!startsWithInstruction(line, '#export')) {
			continue;
		}

		if (includeExport) {
			throw includeErrorAt(
				IncludeErrorCode.DUPLICATE_EXPORT,
				`include "${includeId}" function can only declare one #export`,
				{ ...source, lineNumber: block.startLineNumber + lineIndex }
			);
		}

		const result = parseLine(line, block.startLineNumber + lineIndex);
		if (!result.ok)
			throw syntaxErrorAt(result.issue.code, result.issue.message, source, {
				lineNumber: block.startLineNumber + lineIndex,
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

function createIncludeFunctions(source: IncludeFileSource, blocks: FunctionIncludeBlock[]): IncludeFunction[] {
	const { includeId } = source;
	const functions = blocks.map(block => {
		const originalName = getFunctionName(block.code[0] ?? '');
		const includeExport = getIncludeExport(source, block);

		return {
			...block,
			originalName,
			...(includeExport ? { export: includeExport } : {}),
		};
	});

	if (functions.every(func => !func.export)) {
		throw includeErrorAt(IncludeErrorCode.MISSING_EXPORT, `include "${includeId}" must export at least one function`, {
			...source,
			lineNumber: 0,
		});
	}

	return functions;
}

function createCallTargetBindings(
	functions: BoundIncludeFunction[],
	imports: ReadonlyMap<string, string>
): ReadonlyMap<string, string | null> {
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

	const callTargets = new Map<string, string | null>(imports);
	for (const [originalName, finalNames] of finalNamesByOriginalName) {
		callTargets.set(originalName, finalNames.size === 1 ? [...finalNames][0]! : null);
	}
	return callTargets;
}

function expandIncludeFunctions(
	source: IncludeFileSource,
	functions: IncludeFunction[],
	bindings: ReadonlyMap<string, string>,
	imports: ReadonlyMap<string, string>,
	prefix = getIncludeFunctionPrefix(source.includeId)
): ResolvedFunctionSource[] {
	const { includeId } = source;
	const renamedFunctions = functions.map(func => ({
		...func,
		finalName: func.export
			? (bindings.get(func.export.publicName) ?? privateExportName(prefix, func.export.publicName))
			: `${prefix}nonexported__${func.originalName}`,
	}));
	const callTargets = createCallTargetBindings(renamedFunctions, imports);
	return renamedFunctions.map(func => ({
		code: func.code.map((line, index) => (index === func.export?.lineIndex ? '' : line)),
		bindings: {
			functionName: func.finalName,
			callTargets,
			fileLocation: { ...source, lineNumber: func.startLineNumber },
		},
		source: { kind: 'include' as const, includeId, symbolName: func.finalName },
	}));
}

function collectIncludeDeclarations(
	lines: readonly string[],
	locate: (lineNumber: number) => DiagnosticLocation
): IncludeDeclaration[] {
	const includeIds: IncludeDeclaration[] = [];

	for (const [lineNumber, line] of lines.entries()) {
		const trimmed = line.split(';', 1)[0].trim();
		if (
			trimmed === INCLUDES_BLOCK_DELIMITER.opener ||
			trimmed === INCLUDES_BLOCK_DELIMITER.closer ||
			isProjectGapLine(trimmed)
		) {
			continue;
		}

		const [instruction, includeId, exportedName, localName, ...extraArgs] = trimmed.split(/\s+/);
		const location = locate(lineNumber);
		if (instruction !== 'include' || !includeId || extraArgs.length > 0) {
			throw includeErrorAt(
				IncludeErrorCode.INVALID_DECLARATION,
				'include expects <path> [exportedName [localName]]',
				location
			);
		}
		for (const name of [exportedName, localName]) {
			if (name !== undefined) {
				const result = parseLine(`function ${name}`, lineNumber);
				if (!result.ok)
					throw syntaxErrorAt(result.issue.code, result.issue.message, location, {
						lineNumber: location.lineNumber,
						instruction: 'include',
					});
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

function parseIncludeSource(source: IncludeFileSource, text: string) {
	const blocks = readProjectSource(text.replace(/\r\n?/g, '\n'), [], source).filter(isBlock);
	const functions = createIncludeFunctions(
		source,
		blocks
			.filter(block => block.opener === 'function')
			.map(block => ({ code: sourceLines([block]), startLineNumber: block.start.lineNumber - 1 }))
	);
	const dependencies = blocks
		.filter(block => block.opener === INCLUDES_BLOCK_DELIMITER.opener)
		.flatMap(block => {
			const start = block.start.lineNumber;
			return collectIncludeDeclarations(sourceLines(block.children), lineNumber => ({
				...source,
				lineNumber: start + lineNumber,
			})).map(declaration => ({ ...declaration, lineNumber: start + declaration.lineNumber }));
		});
	return { functions, dependencies };
}

function getPublicNames(functions: IncludeFunction[]): Set<string> {
	return new Set(functions.flatMap(func => (func.export ? [func.export.publicName] : [])));
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
		const blockDeclarations = collectIncludeDeclarations(block.code, lineNumber => ({
			kind: 'block',
			projectBlockId: block.id,
			projectGroupPath,
			lineNumber,
		}));
		for (const declaration of blockDeclarations) {
			const declarations = declarationsByIncludeId.get(declaration.includeId) ?? [];
			declarations.push({ ...declaration, projectBlockId: block.id });
			declarationsByIncludeId.set(declaration.includeId, declarations);
		}
	}
	return declarationsByIncludeId;
}

function bindIncludeSelection(
	{ publicNames }: LoadedInclude,
	{ includeId, exportedName, localName }: IncludeDeclaration,
	bindings: IncludeBindings,
	location: DiagnosticLocation
) {
	if (exportedName !== undefined && !publicNames.has(exportedName)) {
		throw includeErrorAt(
			IncludeErrorCode.UNKNOWN_EXPORT,
			`include "${includeId}" does not export "${exportedName}"`,
			location
		);
	}
	for (const publicName of exportedName === undefined ? publicNames : [exportedName]) {
		const name = localName ?? publicName;
		const previousName = bindings.get(publicName);
		if (previousName !== undefined && previousName !== name) {
			throw includeErrorAt(
				IncludeErrorCode.CONFLICTING_BINDING,
				`include "${includeId}" export "${publicName}" is already included as "${previousName}"`,
				location
			);
		}
		bindings.set(publicName, name);
	}
}

export async function resolveProjectIncludesAsync(
	includeBlocks: readonly Pick<ProjectBlock, 'code' | 'id' | 'disabled'>[],
	resolveInclude: ProjectIncludeResolver,
	projectGroupPath = ''
): Promise<ProjectResolvedFunctionSource[]> {
	const loaded = new Map<string, LoadedInclude>();
	const privateIncludes = new Set<LoadedInclude>();

	async function load(
		includeId: string,
		site: IncludeSite,
		location: DiagnosticLocation,
		ancestors: readonly string[]
	): Promise<LoadedInclude> {
		const chain = [...ancestors, includeId];
		if (ancestors.includes(includeId)) {
			throw includeErrorAt(IncludeErrorCode.DEPENDENCY_CYCLE, `include cycle: ${chain.join(' -> ')}`, location);
		}
		const existing = loaded.get(includeId);
		if (existing) return existing;

		const text = await withAsyncCompilerStage('include loading', async () => resolveInclude(includeId), location);
		if (text === undefined) {
			const via = ancestors.length ? ` (from ${ancestors.join(' -> ')})` : '';
			throw includeErrorAt(IncludeErrorCode.UNRESOLVED_INCLUDE, `unresolved include "${includeId}"${via}`, location);
		}

		const source: IncludeFileSource = { kind: 'include-file', includeId, includeSite: site };
		const { functions, dependencies } = parseIncludeSource(source, text);
		const imports: IncludeBindings = new Map();
		const selections = new Map<string, IncludeBindings>();
		for (const declaration of dependencies) {
			const dependencyLocation = { ...source, lineNumber: declaration.lineNumber };
			const dependency = await load(declaration.includeId, site, dependencyLocation, chain);
			privateIncludes.add(dependency);
			const dependencyBindings = selections.get(declaration.includeId) ?? new Map();
			bindIncludeSelection(dependency, declaration, dependencyBindings, dependencyLocation);
			selections.set(declaration.includeId, dependencyBindings);
			for (const [publicName, localName] of dependencyBindings) {
				const target = privateExportName(dependency.privatePrefix, publicName);
				const previousTarget = imports.get(localName);
				if (previousTarget !== undefined && previousTarget !== target) {
					throw includeErrorAt(
						IncludeErrorCode.CONFLICTING_BINDING,
						`dependency name "${localName}" is already bound in include "${includeId}"`,
						dependencyLocation
					);
				}
				imports.set(localName, target);
			}
		}

		const file: LoadedInclude = {
			source,
			site,
			functions,
			publicNames: getPublicNames(functions),
			imports,
			privatePrefix: getPrivateIncludePrefix(includeId),
		};
		loaded.set(includeId, file);
		return file;
	}

	const blocks: ProjectResolvedFunctionSource[] = [];
	function append(file: LoadedInclude, site: IncludeSite, bindings: IncludeBindings, prefix?: string) {
		const source = { ...file.source, includeSite: site };
		for (const func of expandIncludeFunctions(source, file.functions, bindings, file.imports, prefix)) {
			blocks.push({ ...func, projectBlockId: site.projectBlockId, includeLineNumber: site.lineNumber });
		}
	}

	for (const [includeId, declarations] of collectProjectIncludeDeclarations(includeBlocks, projectGroupPath)) {
		const { projectBlockId, lineNumber } = declarations[0]!;
		const site = { projectBlockId, projectGroupPath, lineNumber };
		const file = await load(includeId, site, { kind: 'block', ...site }, []);
		const bindings: IncludeBindings = new Map();
		for (const declaration of declarations) {
			bindIncludeSelection(file, declaration, bindings, {
				kind: 'block',
				projectBlockId: declaration.projectBlockId,
				projectGroupPath,
				lineNumber: declaration.lineNumber,
			});
		}
		append(file, site, bindings);
	}

	// Direct exports may be renamed or overridden by the project. Library calls use a separate,
	// shared private instance so they always reach the dependency declared by the library.
	for (const file of privateIncludes) {
		append(file, file.site, new Map(), file.privatePrefix);
	}
	return blocks;
}
