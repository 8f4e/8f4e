import type {
	CodegenPushLine,
	InstructionCompiler,
	ResolvedLocalPointerPushLine,
	ResolvedLocalPushLine,
	ResolvedMemoryPointerPushLine,
	ResolvedMemoryPushLine,
	ResolvedPushLine,
	ResolvedReferencePushLine,
} from '@8f4e/language-spec';
import { ArgumentType } from '@8f4e/language-spec';
import pushLiteral from './push/handlers/pushLiteral';
import pushLocal from './push/handlers/pushLocal';
import pushLocalPointer from './push/handlers/pushLocalPointer';
import pushMemoryIdentifier from './push/handlers/pushMemoryIdentifier';
import pushMemoryPointer from './push/handlers/pushMemoryPointer';
import pushReference from './push/handlers/pushReference';
import pushStringLiteral from './push/handlers/pushStringLiteral';

function isResolvedMemoryPushLine(line: ResolvedPushLine): line is ResolvedMemoryPushLine {
	return line.resolvedTarget.kind === 'memory';
}

function isResolvedMemoryPointerPushLine(line: ResolvedPushLine): line is ResolvedMemoryPointerPushLine {
	return line.resolvedTarget.kind === 'memory-pointer';
}

function isResolvedLocalPointerPushLine(line: ResolvedPushLine): line is ResolvedLocalPointerPushLine {
	return line.resolvedTarget.kind === 'local-pointer';
}

function isResolvedLocalPushLine(line: ResolvedPushLine): line is ResolvedLocalPushLine {
	return line.resolvedTarget.kind === 'local';
}

function isResolvedReferencePushLine(line: ResolvedPushLine): line is ResolvedReferencePushLine {
	return line.resolvedTarget.kind === 'reference';
}

/**
 * Instruction compiler for `push`.
 * @see [Instruction docs](../../docs/instructions/stack.md)
 */
const push: InstructionCompiler<CodegenPushLine> = (line: CodegenPushLine, context) => {
	if (!('resolvedTarget' in line)) {
		const argument = line.arguments[0];
		return argument.type === ArgumentType.STRING_LITERAL
			? pushStringLiteral(argument, context)
			: pushLiteral(argument, context);
	}

	if (isResolvedMemoryPushLine(line)) {
		return pushMemoryIdentifier(line, context);
	}
	if (isResolvedReferencePushLine(line)) {
		return pushReference(line, context);
	}
	if (isResolvedMemoryPointerPushLine(line)) {
		return pushMemoryPointer(line, context);
	}
	if (isResolvedLocalPointerPushLine(line)) {
		return pushLocalPointer(line, context);
	}
	if (isResolvedLocalPushLine(line)) {
		return pushLocal(line, context);
	}

	const unhandledLine: never = line;
	return unhandledLine;
};

export default push;
