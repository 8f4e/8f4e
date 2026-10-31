import type {
	AddressMetadata,
	CodegenPushLine,
	CompilationContext,
	LiteralPushLine,
	LocalValueMetadata,
	PointeeBaseType,
	PointeeMetadata,
	ResolvedMemoryDeclaration,
	ResolvedPushLine,
	Stack,
} from '@8f4e/language-spec';
import { ArgumentType, getDereferencedValueKindFromMetadata, getPointerDepthFromMetadata } from '@8f4e/language-spec';
import { getResolvedMemoryDeclaration } from '@8f4e/semantic-utils';
import { kindToStackItem, resolveArgumentValueKind, resolveMemoryValueKind } from '../utils/pushValueKind';
import { createStackValue, produce } from './stack';

function getAddressMemoryItem(context: CompilationContext, address: AddressMetadata) {
	const range = address.safeRange ?? address.clampRange;
	const memoryId = range?.memoryId;
	if (!memoryId) {
		return undefined;
	}

	return getResolvedMemoryDeclaration(context, memoryId, range.moduleId);
}

function getAddressPointeeMetadata(context: CompilationContext, address: AddressMetadata) {
	const memoryItem = getAddressMemoryItem(context, address);
	if (!memoryItem) {
		return undefined;
	}

	const pointerDepth = memoryItem.pointerDepth + 1;
	if (pointerDepth > 2) {
		return undefined;
	}

	const baseType = (memoryItem.pointeeBaseType ?? memoryItem.type.replace(/\*+$/, '')) as PointeeBaseType;

	return {
		baseType,
		pointerDepth,
	} satisfies PointeeMetadata;
}

function pushLiteralStackItems(line: LiteralPushLine, context: CompilationContext): Stack {
	const argument = line.arguments[0];

	if (argument.type === ArgumentType.STRING_LITERAL) {
		return Array.from(argument.value, ch => createStackValue('int', { isNonZero: (ch.charCodeAt(0) & 0xff) !== 0 }));
	}

	const kind = resolveArgumentValueKind(argument);
	const knownValue = kind === 'float32' ? Math.fround(argument.value) : argument.value;
	const address = argument.address
		? {
				...argument.address,
				clampRange: argument.address.clampRange ?? argument.address.safeRange,
			}
		: undefined;

	return [
		kindToStackItem(kind, {
			isNonZero: knownValue !== 0,
			knownValue,
			...(address ? { address, pointsTo: getAddressPointeeMetadata(context, address) } : {}),
		}),
	];
}

function getPointeeMetadata(
	pointerMetadata: ResolvedMemoryDeclaration | LocalValueMetadata
): PointeeMetadata | undefined {
	return pointerMetadata.pointeeBaseType
		? {
				baseType: pointerMetadata.pointeeBaseType,
				pointerDepth: getPointerDepthFromMetadata(pointerMetadata),
			}
		: undefined;
}

function pushDereferencedPointerStackItems(
	line: Extract<ResolvedPushLine, { resolvedTarget: { kind: 'memory-pointer' | 'local-pointer' } }>,
	context: CompilationContext
): Stack {
	const pointerMetadata =
		line.resolvedTarget.kind === 'memory-pointer'
			? line.resolvedTarget.memoryItem
			: line.resolvedTarget.kind === 'local-pointer'
				? context.locals[line.resolvedTarget.binding.id]!
				: undefined;
	if (!pointerMetadata) {
		return [];
	}
	if (!pointerMetadata.pointeeBaseType) {
		return [];
	}

	const dereferenceDepth = line.arguments[0].dereferenceDepth;
	const remainingPointerDepth = getPointerDepthFromMetadata(pointerMetadata) - dereferenceDepth;
	if (remainingPointerDepth > 0) {
		return [
			kindToStackItem('int32', {
				isNonZero: false,
				address: {},
				pointsTo: {
					baseType: pointerMetadata.pointeeBaseType,
					pointerDepth: remainingPointerDepth,
				},
			}),
		];
	}

	const kind = getDereferencedValueKindFromMetadata(pointerMetadata, dereferenceDepth);
	return [kindToStackItem(kind, { isNonZero: false })];
}

function pushResolvedTargetStackItems(line: ResolvedPushLine, context: CompilationContext): Stack {
	switch (line.resolvedTarget.kind) {
		case 'memory': {
			const { memoryItem } = line.resolvedTarget;
			const kind = resolveMemoryValueKind(memoryItem);
			const pointsTo = getPointeeMetadata(memoryItem);

			return [
				kindToStackItem(kind, {
					isNonZero: false,
					...(pointsTo ? { pointsTo } : {}),
					...(pointsTo ? { address: {} } : {}),
				}),
			];
		}
		case 'memory-pointer': {
			return pushDereferencedPointerStackItems(
				line as Extract<ResolvedPushLine, { resolvedTarget: { kind: 'memory-pointer' } }>,
				context
			);
		}
		case 'local-pointer': {
			return pushDereferencedPointerStackItems(
				line as Extract<ResolvedPushLine, { resolvedTarget: { kind: 'local-pointer' } }>,
				context
			);
		}
		case 'local':
		default: {
			const local = context.locals[line.resolvedTarget.binding.id]!;
			const pointsTo = getPointeeMetadata(local);

			return [
				local.pointeeBaseType
					? kindToStackItem('int32', {
							isNonZero: false,
							address: {},
							...(pointsTo ? { pointsTo } : {}),
						})
					: {
							...createStackValue(local.isInteger ? 'int' : local.isFloat64 ? 'float64' : 'float'),
							isNonZero: false,
						},
			];
		}
	}
}

/**
 * Produces stack items for a semantic-reference push line and appends them to the current stack.
 *
 * @param line - AST line being processed.
 * @param context - Compilation context used by the operation.
 * @returns The relevant stack items for the analysis step.
 */
export function analyzePush(line: CodegenPushLine, context: CompilationContext): Stack {
	const produced =
		'resolvedTarget' in line ? pushResolvedTargetStackItems(line, context) : pushLiteralStackItems(line, context);
	produce(context, produced);
	return produced;
}
