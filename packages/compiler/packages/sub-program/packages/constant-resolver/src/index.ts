import type {
	Argument,
	ArgumentLiteral,
	CompilerASTLine,
	CompileTimeOperand,
	Const,
	ConstantResolutionBlockFacts,
	ConstantResolutionLineFacts,
	ConstLine,
	ProjectConstantNamespacePassLine,
	ProjectConstantNamespaceScope,
	ValidatedConstantsAST,
	ValidatedFunctionAST,
	ValidatedModuleAST,
	ValidatedPrototypeAST,
} from '@8f4e/language-spec';
import { ArgumentType, createProjectModuleId, isBinaryCompileTimeExpression } from '@8f4e/language-spec';
import { resolveCompileTimeExpression } from '@8f4e/semantic-utils';

type ConstantResolvableAST = ValidatedModuleAST | ValidatedConstantsAST | ValidatedFunctionAST | ValidatedPrototypeAST;
export type ConstantEnvironment = Readonly<Record<string, Const>>;
export type ConstantNamespaceMap = Readonly<Record<string, ConstantEnvironment>>;

export interface ResolveConstantsSubProgramAST<
	TPrototype extends ValidatedPrototypeAST = ValidatedPrototypeAST,
	TModule extends ValidatedModuleAST = ValidatedModuleAST,
	TConstants extends ValidatedConstantsAST = ValidatedConstantsAST,
	TFunction extends ValidatedFunctionAST = ValidatedFunctionAST,
> {
	prototypes: readonly TPrototype[];
	modules: readonly TModule[];
	constants: readonly TConstants[];
	functions: readonly TFunction[];
}

export interface ResolveConstantsInput<
	TPrototype extends ValidatedPrototypeAST = ValidatedPrototypeAST,
	TModule extends ValidatedModuleAST = ValidatedModuleAST,
	TConstants extends ValidatedConstantsAST = ValidatedConstantsAST,
	TFunction extends ValidatedFunctionAST = ValidatedFunctionAST,
> {
	ast: ResolveConstantsSubProgramAST<TPrototype, TModule, TConstants, TFunction>;
	projectConstantNamespaceScopes?: readonly ProjectConstantNamespaceScope[];
}

export interface ConstantResolutionReport {
	prototypes: ConstantResolutionBlockFacts[];
	modules: ConstantResolutionBlockFacts[];
	constants: ConstantResolutionBlockFacts[];
	functions: ConstantResolutionBlockFacts[];
}

export interface ResolveConstantsResult {
	namespaces: ConstantNamespaceMap;
	references: ConstantResolutionReport;
}

export const ConstantResolverErrorCode = {
	DUPLICATE_NAMESPACE: 'DUPLICATE_NAMESPACE',
	UNRESOLVED_PASSED_NAMESPACE: 'UNRESOLVED_PASSED_NAMESPACE',
	UNRESOLVED_CONSTANT_VALUE: 'UNRESOLVED_CONSTANT_VALUE',
	UNRESOLVED_NAMESPACE: 'UNRESOLVED_NAMESPACE',
} as const;

export type ConstantResolverErrorCodeValue = (typeof ConstantResolverErrorCode)[keyof typeof ConstantResolverErrorCode];

export class ConstantResolverError extends Error {
	readonly code: ConstantResolverErrorCodeValue;
	readonly detail: string;
	readonly line?: CompilerASTLine | ProjectConstantNamespacePassLine;

	constructor(
		code: ConstantResolverErrorCodeValue,
		message: string,
		line?: CompilerASTLine | ProjectConstantNamespacePassLine
	) {
		super(`${message} (${code})`);
		this.name = 'ConstantResolverError';
		this.code = code;
		this.detail = message;
		this.line = line;
	}
}

export interface ResolveConstantsOptions {
	readonly namespaces?: ConstantNamespaceMap;
}

function literalToConst(argument: ArgumentLiteral): Const {
	return {
		value: argument.value,
		isInteger: argument.isInteger,
		...(argument.isFloat64 ? { isFloat64: true } : {}),
	};
}

function constToLiteral(resolved: Const): ArgumentLiteral {
	return {
		type: ArgumentType.LITERAL,
		value: resolved.value,
		isInteger: resolved.isInteger,
		...(resolved.isFloat64 ? { isFloat64: true } : {}),
	};
}

function resolveConstantOperand(operand: CompileTimeOperand, constants: ConstantEnvironment): Const | undefined {
	if (operand.type === ArgumentType.LITERAL) {
		return literalToConst(operand);
	}

	return operand.referenceKind === 'constant' ? constants[operand.value] : undefined;
}

function resolveConstantArgument(argument: Argument, constants: ConstantEnvironment): Const | undefined {
	if (argument.type === ArgumentType.LITERAL) {
		return literalToConst(argument);
	}

	if (argument.type === ArgumentType.IDENTIFIER) {
		return resolveConstantOperand(argument, constants);
	}

	if (argument.type !== ArgumentType.COMPILE_TIME_EXPRESSION) {
		return undefined;
	}

	return resolveCompileTimeExpression(argument, operand => resolveConstantOperand(operand, constants));
}

function resolveConstantArgumentReference(argument: Argument, constants: ConstantEnvironment): Argument {
	if (argument.type === ArgumentType.IDENTIFIER) {
		const resolved = resolveConstantOperand(argument, constants);
		return resolved ? constToLiteral(resolved) : argument;
	}

	if (argument.type !== ArgumentType.COMPILE_TIME_EXPRESSION) {
		return argument;
	}
	const resolved = resolveCompileTimeExpression(argument, operand => resolveConstantOperand(operand, constants));
	if (resolved) {
		return constToLiteral(resolved);
	}

	const left = resolveConstantOperandReference(argument.left, constants);
	if (!isBinaryCompileTimeExpression(argument)) {
		return left === argument.left ? argument : { ...argument, left };
	}

	const right = resolveConstantOperandReference(argument.right, constants);
	if (left === argument.left && right === argument.right) {
		return argument;
	}

	return {
		...argument,
		left,
		right,
	};
}

function resolveConstantOperandReference(
	operand: CompileTimeOperand,
	constants: ConstantEnvironment
): CompileTimeOperand {
	const resolved = operand.type === ArgumentType.IDENTIFIER ? resolveConstantOperand(operand, constants) : undefined;
	return resolved ? constToLiteral(resolved) : operand;
}

function resolveConstLine(line: ConstLine, constants: Record<string, Const>): Const {
	const resolved = resolveConstantArgument(line.arguments[1], constants);
	if (!resolved) {
		throw new ConstantResolverError(
			ConstantResolverErrorCode.UNRESOLVED_CONSTANT_VALUE,
			`Unable to resolve constant ${line.arguments[0].value}`,
			line
		);
	}

	constants[line.arguments[0].value] = resolved;
	return resolved;
}

function importConstants(
	line: CompilerASTLine,
	constants: Record<string, Const>,
	namespaces: ConstantNamespaceMap,
	namespaceAliases: ConstantNamespaceAliases
): boolean {
	if (line.instruction !== 'use') {
		return true;
	}

	const namespaceId = line.arguments[0].value;
	const namespace = resolveNamespace(namespaceId, namespaces, namespaceAliases);
	if (!namespace) {
		return false;
	}

	Object.assign(constants, namespace);
	return true;
}

function tryCollectConstants(
	ast: ValidatedModuleAST | ValidatedConstantsAST,
	namespaces: ConstantNamespaceMap,
	namespaceAliases: ConstantNamespaceAliases
) {
	const constants: Record<string, Const> = {};

	for (const line of ast.lines) {
		if (!importConstants(line, constants, namespaces, namespaceAliases)) {
			return undefined;
		}
		if (line.instruction === 'const') {
			resolveConstLine(line, constants);
		}
	}

	return constants;
}

function findUnresolvedUseLine(
	asts: readonly (ValidatedModuleAST | ValidatedConstantsAST)[],
	namespaces: ConstantNamespaceMap,
	namespaceAliases: ConstantNamespaceAliases
): CompilerASTLine | undefined {
	for (const ast of asts) {
		for (const line of ast.lines) {
			if (line.instruction === 'use' && !resolveNamespace(line.arguments[0].value, namespaces, namespaceAliases)) {
				return line;
			}
		}
	}

	return undefined;
}

function flattenSubProgramAST(input: ResolveConstantsSubProgramAST): ConstantResolvableAST[] {
	return [...input.prototypes, ...input.modules, ...input.constants, ...input.functions];
}

function collectConstantNamespacesFromAsts(
	asts: readonly ConstantResolvableAST[],
	projectConstantNamespaceScopes: readonly ProjectConstantNamespaceScope[] = [],
	options: ResolveConstantsOptions = {}
): ConstantNamespaceMap {
	const namespaces: Record<string, ConstantEnvironment> = { ...(options.namespaces ?? {}) };
	const pending = asts.filter((ast): ast is ValidatedModuleAST | ValidatedConstantsAST => {
		return ast.type === 'module' || ast.type === 'constants';
	});
	const namespaceAliases = buildProjectNamespaceAliases(projectConstantNamespaceScopes, pending, namespaces);

	while (pending.length > 0) {
		let madeProgress = false;

		for (let index = pending.length - 1; index >= 0; index--) {
			const ast = pending[index];
			if (Object.hasOwn(namespaces, ast.id)) {
				throw new ConstantResolverError(
					ConstantResolverErrorCode.DUPLICATE_NAMESPACE,
					`Duplicate constant namespace ${ast.id}`,
					ast.lines[0]
				);
			}

			const constants = tryCollectConstants(ast, namespaces, namespaceAliases);
			if (!constants) {
				continue;
			}

			namespaces[ast.id] = constants;
			pending.splice(index, 1);
			madeProgress = true;
		}

		if (!madeProgress) {
			throw new ConstantResolverError(
				ConstantResolverErrorCode.UNRESOLVED_NAMESPACE,
				'Unable to resolve constant namespace dependencies',
				findUnresolvedUseLine(pending, namespaces, namespaceAliases) ?? pending[0].lines[0]
			);
		}
	}

	for (const [alias, target] of namespaceAliases) {
		const namespace = resolveNamespace(target, namespaces, namespaceAliases);
		if (!namespace) {
			throw new Error(`Resolved project namespace alias ${alias} has no target namespace`);
		}
		namespaces[alias] = namespace;
	}

	return namespaces;
}

function collectConstantNamespaces(
	input: ResolveConstantsInput,
	options: ResolveConstantsOptions = {}
): ConstantNamespaceMap {
	return collectConstantNamespacesFromAsts(
		flattenSubProgramAST(input.ast),
		input.projectConstantNamespaceScopes,
		options
	);
}

type ConstantNamespaceAliases = ReadonlyMap<string, string>;
const EMPTY_CONSTANT_NAMESPACE_ALIASES: ConstantNamespaceAliases = new Map();

function resolveNamespace(
	namespaceId: string,
	namespaces: ConstantNamespaceMap,
	namespaceAliases: ConstantNamespaceAliases
): ConstantEnvironment | undefined {
	let resolvedId = namespaceId;
	while (namespaceAliases.has(resolvedId)) {
		resolvedId = namespaceAliases.get(resolvedId)!;
	}
	return namespaces[resolvedId];
}

function buildProjectNamespaceAliases(
	scopes: readonly ProjectConstantNamespaceScope[],
	asts: readonly (ValidatedModuleAST | ValidatedConstantsAST)[],
	externalNamespaces: ConstantNamespaceMap
): ConstantNamespaceAliases {
	const aliases = new Map<string, string>();
	const passLinesByAlias = new Map<string, ProjectConstantNamespacePassLine>();
	const astNamespaceIds = new Set(asts.map(ast => ast.id));
	const constantNamespaceIds = new Set(asts.filter(ast => ast.type === 'constants').map(ast => ast.id));

	for (const scope of scopes) {
		for (const line of scope.passes) {
			const name = line.arguments[0].value;
			const alias = createProjectModuleId(scope.groupPath, name);
			if (aliases.has(alias) || astNamespaceIds.has(alias) || Object.hasOwn(externalNamespaces, alias)) {
				throw new ConstantResolverError(
					ConstantResolverErrorCode.DUPLICATE_NAMESPACE,
					`Duplicate constant namespace ${alias}`,
					line
				);
			}

			if (scope.parentGroupPath === undefined) {
				throw new ConstantResolverError(
					ConstantResolverErrorCode.UNRESOLVED_PASSED_NAMESPACE,
					`Passed name ${name} is undefined in the parent project scope`,
					line
				);
			}

			const target = createProjectModuleId(scope.parentGroupPath, name);
			aliases.set(alias, target);
			passLinesByAlias.set(alias, line);
		}
	}

	const availableTargets = new Set([...constantNamespaceIds, ...Object.keys(externalNamespaces), ...aliases.keys()]);
	for (const [alias, target] of aliases) {
		if (!availableTargets.has(target)) {
			const line = passLinesByAlias.get(alias)!;
			throw new ConstantResolverError(
				ConstantResolverErrorCode.UNRESOLVED_PASSED_NAMESPACE,
				`Passed name ${line.arguments[0].value} is undefined in the parent project scope`,
				line
			);
		}
	}

	return aliases;
}

function haveSameArguments(left: CompilerASTLine['arguments'], right: CompilerASTLine['arguments']): boolean {
	return left.length === right.length && left.every((argument, index) => argument === right[index]);
}

function collectLineFacts(
	sourceLine: CompilerASTLine,
	resolvedArguments: CompilerASTLine['arguments'] | undefined
): ConstantResolutionLineFacts | undefined {
	if (!resolvedArguments || haveSameArguments(sourceLine.arguments, resolvedArguments)) {
		return undefined;
	}

	return { arguments: resolvedArguments };
}

function resolveConstantsInASTWithNamespaces(
	ast: ConstantResolvableAST,
	namespaces: ConstantNamespaceMap
): ConstantResolutionBlockFacts {
	const constants: Record<string, Const> = {};
	const lineFacts = ast.lines.map(line => {
		if (!importConstants(line, constants, namespaces, EMPTY_CONSTANT_NAMESPACE_ALIASES)) {
			throw new ConstantResolverError(
				ConstantResolverErrorCode.UNRESOLVED_NAMESPACE,
				'Unable to resolve constant namespace',
				line
			);
		}

		if (line.instruction === 'const') {
			const resolvedValue = constToLiteral(resolveConstLine(line, constants));
			return collectLineFacts(line, [line.arguments[0], resolvedValue] as CompilerASTLine['arguments']);
		}

		if (line.instruction === 'use') {
			return undefined;
		}

		const resolvedArguments = line.arguments.map(argument => resolveConstantArgumentReference(argument, constants));
		return collectLineFacts(line, resolvedArguments);
	});

	return { lineFacts };
}

export function resolveConstants<
	TPrototype extends ValidatedPrototypeAST,
	TModule extends ValidatedModuleAST,
	TConstants extends ValidatedConstantsAST,
	TFunction extends ValidatedFunctionAST,
>(
	input: ResolveConstantsInput<TPrototype, TModule, TConstants, TFunction>,
	options: ResolveConstantsOptions = {}
): ResolveConstantsResult {
	const namespaces = collectConstantNamespaces(input, options);
	return {
		namespaces,
		references: {
			prototypes: input.ast.prototypes.map(ast => resolveConstantsInASTWithNamespaces(ast, namespaces)),
			modules: input.ast.modules.map(ast => resolveConstantsInASTWithNamespaces(ast, namespaces)),
			constants: input.ast.constants.map(ast => resolveConstantsInASTWithNamespaces(ast, namespaces)),
			functions: input.ast.functions.map(ast => resolveConstantsInASTWithNamespaces(ast, namespaces)),
		},
	};
}

export type { ConstantResolvableAST };
