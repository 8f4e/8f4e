import type {
	ArgumentIdentifier,
	CompileTimeOperand,
	Const,
	PlannedMemoryDeclaration,
	PointerMetadata,
} from '@8f4e/language-spec';
import {
	ArgumentType,
	getDereferencedValueKindFromMetadata,
	getElementCount,
	getElementMaxValue,
	getElementMinValue,
	getElementWordSize,
	getPointeeElementIsIntegerFromMetadata,
	getPointeeElementMaxValueFromMetadata,
	getPointeeElementMinValueFromMetadata,
	getPointeeElementWordSizeFromMetadata,
} from '@8f4e/language-spec';

export type MetadataQueryKind = 'count' | 'sizeof' | 'max' | 'min';

const metadataQueryKinds = {
	'element-count': 'count',
	'intermodular-element-count': 'count',
	'pointee-element-count': 'count',
	'element-word-size': 'sizeof',
	'intermodular-element-word-size': 'sizeof',
	'pointee-element-word-size': 'sizeof',
	'element-max': 'max',
	'intermodular-element-max': 'max',
	'pointee-element-max': 'max',
	'element-min': 'min',
	'intermodular-element-min': 'min',
	'pointee-element-min': 'min',
} as const satisfies Partial<Record<ArgumentIdentifier['referenceKind'], MetadataQueryKind>>;

type MetadataQueryOperand = Extract<ArgumentIdentifier, { referenceKind: keyof typeof metadataQueryKinds }>;

export type MetadataTargetRequest =
	| { scope: 'local'; targetMemoryId: string; dereferenceDepth: 0 | 1 }
	| { scope: 'intermodule'; targetModuleId: string; targetMemoryId: string; dereferenceDepth: 0 };

export type MetadataQuery = MetadataTargetRequest & { query: MetadataQueryKind };

export type ResolvedMetadataTarget =
	| { kind: 'memory'; memory: PlannedMemoryDeclaration }
	| { kind: 'pointer'; pointers: readonly [PointerMetadata, ...PointerMetadata[]] };

function isMetadataQueryOperand(operand: ArgumentIdentifier): operand is MetadataQueryOperand {
	return Object.hasOwn(metadataQueryKinds, operand.referenceKind);
}

/** Adapts the current AST variants; requested depth is distinct from declared pointer depth. */
export function getMetadataQuery(operand: CompileTimeOperand): MetadataQuery | undefined {
	if (operand.type === ArgumentType.LITERAL || !isMetadataQueryOperand(operand)) {
		return undefined;
	}

	const query = metadataQueryKinds[operand.referenceKind];
	if (operand.scope === 'intermodule') {
		return {
			query,
			scope: operand.scope,
			targetModuleId: operand.targetModuleId,
			targetMemoryId: operand.targetMemoryId,
			dereferenceDepth: 0,
		};
	}

	return {
		query,
		scope: operand.scope,
		targetMemoryId: operand.targetMemoryId,
		dereferenceDepth: 'isPointee' in operand ? 1 : 0,
	};
}

function isFloat64Target(target: ResolvedMetadataTarget): boolean {
	return target.kind === 'memory'
		? target.memory.elementWordSize === 8 && !target.memory.isInteger
		: getDereferencedValueKindFromMetadata(target.pointers[0], 1) === 'float64';
}

/** Evaluates metadata only; target lookup and source-specific pointer facts belong to resolution. */
export function evaluateMetadataQuery(query: MetadataQueryKind, target: ResolvedMetadataTarget): Const | undefined {
	switch (query) {
		case 'count': {
			if (target.kind === 'memory') {
				return { value: getElementCount(target.memory), isInteger: true };
			}
			// A memory pointer with an unknown count may still have a known local fallback.
			const count = target.pointers.find(
				pointer => pointer.pointeeBaseType && pointer.pointeeElementCount !== undefined
			)?.pointeeElementCount;
			return count === undefined ? undefined : { value: count, isInteger: true };
		}
		case 'sizeof':
			return {
				value:
					target.kind === 'memory'
						? getElementWordSize(target.memory)
						: getPointeeElementWordSizeFromMetadata(target.pointers[0]),
				isInteger: true,
			};
		case 'max':
			return {
				value:
					target.kind === 'memory'
						? getElementMaxValue(target.memory)
						: getPointeeElementMaxValueFromMetadata(target.pointers[0]),
				isInteger:
					target.kind === 'memory'
						? !!target.memory.isInteger
						: getPointeeElementIsIntegerFromMetadata(target.pointers[0]),
				...(isFloat64Target(target) ? { isFloat64: true } : {}),
			};
		case 'min':
			return {
				value:
					target.kind === 'memory'
						? getElementMinValue(target.memory)
						: getPointeeElementMinValueFromMetadata(target.pointers[0]),
				isInteger:
					target.kind === 'memory'
						? !!target.memory.isInteger
						: getPointeeElementIsIntegerFromMetadata(target.pointers[0]),
				...(isFloat64Target(target) ? { isFloat64: true } : {}),
			};
	}
}
