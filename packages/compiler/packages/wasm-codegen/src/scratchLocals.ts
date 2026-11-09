import type {
	CodegenPushLine,
	ExecutableInstructionLine,
	ResolvedMemoryCopyLine,
	StackAnalysisLineFacts,
} from '@8f4e/language-spec';
import type { ResolvedOperation } from '@8f4e/semantic-reference-resolver';

/** Maximum number of parameter and local slots supported by V8. */
export const MAX_WASM_LOCAL_SLOTS = 50_000;

function countPushScratchSlots(line: CodegenPushLine): number {
	return 'resolvedTarget' in line && line.resolvedTarget.kind === 'local-pointer' ? 1 : 0;
}

function countOperationScratchSlots(
	line: ExecutableInstructionLine,
	facts: StackAnalysisLineFacts,
	enableAssertions: boolean
): number {
	switch (line.instruction) {
		case 'abs':
			return facts.stackAnalysis.consumedOperands[0].valueType === 'int' ? 1 : 0;
		case 'min':
		case 'max':
			return facts.numericOperandKind === 'int32' ? 2 : 0;
		case 'push':
			return countPushScratchSlots(line);
		case 'pushShape':
			return line.shapeExpansions.reduce((count, { pushLine }) => count + countPushScratchSlots(pushLine), 0);
		case 'assertEqual':
			return enableAssertions ? countPushScratchSlots(line.expectedPush) : 0;
		case 'memoryCopy':
			return (line as ResolvedMemoryCopyLine).arguments[0].value === 0 ? 0 : 2;
		case 'mapEnd':
		case 'store':
		case 'storeBytes':
			return 2;
		case 'clampAddress':
		case 'clampGlobalAddress':
		case 'clampModuleAddress':
		case 'ensureNonZero':
		case 'load':
		case 'load8u':
		case 'load16u':
		case 'load8s':
		case 'load16s':
		case 'loadFloat':
		case 'loop':
			return 1;
		default:
			return 0;
	}
}

/**
 * Reserves an upper bound on scratch slots for a resolved body. Memory guards reserve their
 * maximum so the count still holds after stack facts are refreshed.
 */
export function reserveWasmScratchSlots(
	body: readonly ResolvedOperation[],
	facts: readonly StackAnalysisLineFacts[],
	enableAssertions = false
): number {
	return body.reduce(
		(count, { line }, index) => count + countOperationScratchSlots(line, facts[index], enableAssertions),
		0
	);
}
