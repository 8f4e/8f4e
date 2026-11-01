import {
	type CallLine,
	type ComposedFunctionAST,
	type ComposedModuleAST,
	createProjectModuleId,
	ErrorCode,
	getError,
} from '@8f4e/language-spec';
import type { ComposedProgram } from './types';

function rewriteCalls<TAst extends ComposedFunctionAST | ComposedModuleAST>(
	ast: TAst,
	aliases: ReadonlyMap<string, string>
): TAst {
	return {
		...ast,
		lines: ast.lines.map(line => {
			if (line.instruction !== 'call') return line;
			const target = aliases.get(line.arguments[0].value);
			if (!target) return line;
			return {
				...line,
				arguments: [{ ...line.arguments[0], value: target }, ...line.arguments.slice(1)],
			} as CallLine;
		}),
	};
}

/** Binds explicit parent-function passes after every scope's declarations have been collected. */
export function resolveFunctionPasses(program: ComposedProgram): void {
	const functions = new Set(program.ast.functions.map(ast => ast.name));
	const entries = new Set(program.entries.map(entry => entry.id));
	const namespaces = new Set(program.ast.constants.map(ast => ast.id));
	const aliases = new Map<string, string>();
	// Composition records scopes before their children, so forwarded names can be passed again.
	const namespaceScopes = program.projectConstantNamespaceScopes.flatMap(scope => {
		const passes = scope.passes.filter(line => {
			if (scope.parentGroupPath === undefined) return true;
			const name = line.arguments[0].value;
			const local = createProjectModuleId(scope.groupPath, name);
			const parent = createProjectModuleId(scope.parentGroupPath, name);
			const target = aliases.get(parent) ?? (functions.has(parent) ? parent : undefined);
			const isNamespace = namespaces.has(parent);
			if (isNamespace) namespaces.add(local);
			if (!target) return true;
			if (functions.has(local) || entries.has(local) || aliases.has(local)) {
				throw getError(
					ErrorCode.DUPLICATE_IDENTIFIER,
					line,
					{ projectGroupPath: scope.groupPath },
					{ identifier: name }
				);
			}
			aliases.set(local, target);
			// One name can identify both a function and a constant namespace; forward both.
			return isNamespace;
		});
		return passes.length > 0 ? [{ ...scope, passes }] : [];
	});
	if (aliases.size === 0) return;
	program.projectConstantNamespaceScopes = namespaceScopes;
	program.ast.modules = program.ast.modules.map(ast => rewriteCalls(ast, aliases));
	program.ast.functions = program.ast.functions.map(ast => rewriteCalls(ast, aliases));
}
