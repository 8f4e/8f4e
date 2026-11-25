import type { CompiledStackAnalysisLine } from '@8f4e/language-spec';

export type UnattributedStackAnalysisLine = Omit<CompiledStackAnalysisLine, 'consumedOperandProducerLines'>;

/** Attributes stack values after grouping lowered operations into their original source instructions. */
export function recordStackProducers(lines: readonly UnattributedStackAnalysisLine[]): CompiledStackAnalysisLine[] {
	const producers: number[] = [];
	return lines.map(line => {
		const { stackBefore, stackAfter, consumedOperands, producedStackItems } = line.stackAnalysis;
		const consumedOperandProducerLines = producers.slice(stackBefore.length - consumedOperands.length);
		// Only a suffix is replaced. Conditional exits can report dropped values while preserving the fallthrough stack.
		producers.length = stackAfter.length - producedStackItems.length;
		for (let index = 0; index < producedStackItems.length; index++) producers.push(line.lineNumber);
		return { ...line, consumedOperandProducerLines };
	});
}
