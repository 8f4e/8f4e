import { getError } from '@8f4e/compiler-diagnostics';
import {
	ArgumentType,
	type Const,
	createProjectModuleId,
	ErrorCode,
	isScalarMemoryDeclarationLine,
	type ProjectMemoryInitializerScope,
} from '@8f4e/language-spec';
import type { MemoryReferenceResolutionContext } from './context';
import { resolveMemoryTarget } from './resolveMemoryTarget';
import { tryResolveValueArgument } from './tryResolveValueArgument';

/** Resolves group initializers to default values keyed by canonical backing declarations. */
export function resolveProjectMemoryInitializers(
	scopes: readonly ProjectMemoryInitializerScope[],
	context: MemoryReferenceResolutionContext
): Map<string, Map<number, Const>> {
	const defaults = new Map<string, Map<number, Const>>();
	for (const scope of scopes) {
		for (const line of scope.initializers) {
			if (scope.parentGroupPath === undefined) {
				throw getError(ErrorCode.GROUP_MEMORY_INITIALIZER_OUTSIDE_GROUP, line, {});
			}
			const [destination, source] = line.arguments;
			const name = destination.targetMemoryId;
			const resolved = resolveMemoryTarget(
				{ scope: 'intermodule', targetModuleId: scope.groupPath, targetMemoryId: name },
				context
			);
			const declaration = resolved?.targetModule.declarationSources[resolved.targetMemory.id];
			if (
				!context.memoryAliases.get(scope.groupPath)?.has(name) ||
				!resolved ||
				!isScalarMemoryDeclarationLine(declaration!.line)
			) {
				throw getError(ErrorCode.INVALID_GROUP_MEMORY_INITIALIZER_TARGET, line, {
					details: {
						identifier: name,
					},
				});
			}
			const { targetMemory, targetModule } = resolved;
			const targetModuleId = targetModule.id;
			const moduleDefaults = defaults.get(targetModuleId) ?? new Map<number, Const>();
			if (moduleDefaults.has(targetMemory.id)) {
				throw getError(ErrorCode.DUPLICATE_GROUP_MEMORY_INITIALIZER, line, { details: { identifier: name } });
			}
			let value: Const;
			if (source.type === ArgumentType.LITERAL) {
				value = source;
			} else {
				const qualifiedSource = {
					...source,
					targetModuleId: createProjectModuleId(scope.parentGroupPath, source.targetModuleId),
				};
				const resolvedValue = tryResolveValueArgument(context, qualifiedSource);
				if (!resolvedValue) {
					throw getError(ErrorCode.UNDECLARED_IDENTIFIER, line, {
						details: {
							identifier: `${qualifiedSource.targetModuleId}:${source.targetMemoryId}`,
						},
					});
				}
				value = resolvedValue;
			}
			moduleDefaults.set(targetMemory.id, value);
			defaults.set(targetModuleId, moduleDefaults);
		}
	}
	return defaults;
}
