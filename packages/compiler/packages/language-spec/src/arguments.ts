export const ArgumentType = {
	LITERAL: 'literal',
	IDENTIFIER: 'identifier',
	STRING_LITERAL: 'string_literal',
	COMPILE_TIME_EXPRESSION: 'compile_time_expression',
} as const;

/**
 * The syntactic class of an identifier-shaped argument.
 * Computed from token shape alone by the tokenizer; no semantic resolution is needed.
 */
export type ReferenceKind =
	| 'plain'
	| 'constant'
	| 'memory-pointer'
	| 'memory-reference'
	| 'element-count'
	| 'element-word-size'
	| 'element-max'
	| 'element-min'
	| 'pointee-element-count'
	| 'pointee-element-word-size'
	| 'pointee-element-max'
	| 'pointee-element-min'
	| 'intermodular-reference'
	| 'intermodular-module-reference'
	| 'intermodular-module-nth-reference'
	| 'intermodular-element-count'
	| 'intermodular-element-word-size'
	| 'intermodular-element-max'
	| 'intermodular-element-min';

export type ArgumentLiteral = {
	type: typeof ArgumentType.LITERAL;
	value: number;
	isInteger: boolean;
	isFloat64?: boolean;
	isHex?: boolean;
};

type IdentifierBase<K extends ReferenceKind, S extends 'local' | 'intermodule'> = {
	type: typeof ArgumentType.IDENTIFIER;
	value: string;
	referenceKind: K;
	scope: S;
};

type PlainIdentifier = IdentifierBase<'plain', 'local'>;
type ConstantIdentifier = IdentifierBase<'constant', 'local'>;
export type MemoryPointerIdentifier = IdentifierBase<'memory-pointer', 'local'> & {
	targetMemoryId: string;
	dereferenceDepth: number;
};
type MemoryReferenceIdentifier = IdentifierBase<'memory-reference', 'local'> & {
	targetMemoryId: string;
	isEndAddress: boolean;
};
type ElementCountIdentifier = IdentifierBase<'element-count', 'local'> & {
	targetMemoryId: string;
};
type ElementWordSizeIdentifier = IdentifierBase<'element-word-size', 'local'> & { targetMemoryId: string };
type ElementMaxIdentifier = IdentifierBase<'element-max', 'local'> & {
	targetMemoryId: string;
};
type ElementMinIdentifier = IdentifierBase<'element-min', 'local'> & {
	targetMemoryId: string;
};
type PointeeElementCountIdentifier = IdentifierBase<'pointee-element-count', 'local'> & {
	targetMemoryId: string;
	isPointee: true;
};
type PointeeElementWordSizeIdentifier = IdentifierBase<'pointee-element-word-size', 'local'> & {
	targetMemoryId: string;
	isPointee: true;
};
type PointeeElementMaxIdentifier = IdentifierBase<'pointee-element-max', 'local'> & {
	targetMemoryId: string;
	isPointee: true;
};
type PointeeElementMinIdentifier = IdentifierBase<'pointee-element-min', 'local'> & {
	targetMemoryId: string;
	isPointee: true;
};
type IntermodularReferenceIdentifier = IdentifierBase<'intermodular-reference', 'intermodule'> & {
	targetModuleId: string;
	targetMemoryId: string;
	isEndAddress: boolean;
};
type IntermodularModuleReferenceIdentifier = IdentifierBase<'intermodular-module-reference', 'intermodule'> & {
	targetModuleId: string;
	isEndAddress: boolean;
};
type IntermodularModuleNthReferenceIdentifier = IdentifierBase<'intermodular-module-nth-reference', 'intermodule'> & {
	targetModuleId: string;
	targetMemoryIndex: number;
};
type IntermodularElementCountIdentifier = IdentifierBase<'intermodular-element-count', 'intermodule'> & {
	targetModuleId: string;
	targetMemoryId: string;
};
type IntermodularElementWordSizeIdentifier = IdentifierBase<'intermodular-element-word-size', 'intermodule'> & {
	targetModuleId: string;
	targetMemoryId: string;
};
type IntermodularElementMaxIdentifier = IdentifierBase<'intermodular-element-max', 'intermodule'> & {
	targetModuleId: string;
	targetMemoryId: string;
};
type IntermodularElementMinIdentifier = IdentifierBase<'intermodular-element-min', 'intermodule'> & {
	targetModuleId: string;
	targetMemoryId: string;
};

export type ArgumentIdentifier =
	| PlainIdentifier
	| ConstantIdentifier
	| MemoryPointerIdentifier
	| MemoryReferenceIdentifier
	| ElementCountIdentifier
	| ElementWordSizeIdentifier
	| ElementMaxIdentifier
	| ElementMinIdentifier
	| PointeeElementCountIdentifier
	| PointeeElementWordSizeIdentifier
	| PointeeElementMaxIdentifier
	| PointeeElementMinIdentifier
	| IntermodularReferenceIdentifier
	| IntermodularModuleReferenceIdentifier
	| IntermodularModuleNthReferenceIdentifier
	| IntermodularElementCountIdentifier
	| IntermodularElementWordSizeIdentifier
	| IntermodularElementMaxIdentifier
	| IntermodularElementMinIdentifier;

export type ArgumentStringLiteral = {
	type: typeof ArgumentType.STRING_LITERAL;
	value: string;
};

/**
 * A fully parsed compile-time expression operand.
 * Operands are either numeric literals or classified identifier nodes;
 * they are never nested expressions because the grammar only allows a single operator.
 */
export type CompileTimeOperand = ArgumentLiteral | ArgumentIdentifier;

export type CompileTimeOperator = '+' | '-' | '*' | '/' | '^';

export const CompileTimeRounding = {
	ROUND: 'round',
	FLOOR: 'floor',
	CEIL: 'ceil',
} as const;

export type CompileTimeRoundingValue = (typeof CompileTimeRounding)[keyof typeof CompileTimeRounding];

export type ArgumentCompileTimeBinaryExpression = {
	type: typeof ArgumentType.COMPILE_TIME_EXPRESSION;
	left: CompileTimeOperand;
	operator: CompileTimeOperator;
	right: CompileTimeOperand;
	rounding?: CompileTimeRoundingValue;
};

export type ArgumentCompileTimeRoundedOperand = {
	type: typeof ArgumentType.COMPILE_TIME_EXPRESSION;
	left: CompileTimeOperand;
	operator?: never;
	right?: never;
	rounding: CompileTimeRoundingValue;
};

export type ArgumentCompileTimeExpression = ArgumentCompileTimeBinaryExpression | ArgumentCompileTimeRoundedOperand;

export function isBinaryCompileTimeExpression(
	expression: ArgumentCompileTimeExpression
): expression is ArgumentCompileTimeBinaryExpression {
	return expression.operator !== undefined;
}

export type Argument = ArgumentLiteral | ArgumentIdentifier | ArgumentStringLiteral | ArgumentCompileTimeExpression;
