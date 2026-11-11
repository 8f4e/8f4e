import type {
	CompiledStackAnalysisLine,
	CompilerASTLine,
	PlannedMemoryDeclaration,
	ResolvedReferenceSlot,
} from '@8f4e/language-spec';
import type { SelectedLineTooltipContent } from '../types';
import { getSelectedLineTooltipColors } from './colors';
import { TOOLTIP_WRAP_WIDTH } from './constants';
import { getLiveReferenceTooltipContent, getLiveTooltipContent } from './liveValues';
import type { SourceLineDescription } from './sourceLine';
import { getStackAnalysisTooltipContent } from './stackAnalysisTooltip';
import { formatStackSignature, formatStackSignatureLines, resolveStackSignature } from './stackSignature';
import { getMaxLineLength, getTooltipTextCharacters, wrapTooltipText } from './text';

interface SelectedLineTooltipTextContent {
	text: string[];
	signatureLineCount: number;
	highlightTargets: SelectedLineTooltipContent['highlightTargets'];
}

interface SelectedLineTooltipTextOptions {
	source: SourceLineDescription;
	maxLength?: number;
	stackAnalysisLine?: CompiledStackAnalysisLine;
	parsedLine?: CompilerASTLine;
	moduleExecutionOrder?: number;
}

interface SelectedLineTooltipOptions extends SelectedLineTooltipTextOptions {
	memory?: PlannedMemoryDeclaration;
	reference?: ResolvedReferenceSlot;
}

/**
 * Builds wrapped tooltip text for instruction docs and stack analysis.
 */
export function getSelectedLineTooltipTextContent({
	source,
	maxLength = TOOLTIP_WRAP_WIDTH,
	stackAnalysisLine,
	parsedLine,
	moduleExecutionOrder,
}: SelectedLineTooltipTextOptions): SelectedLineTooltipTextContent {
	if (!source.text) {
		return { text: [], signatureLineCount: 0, highlightTargets: [] };
	}

	const { sourceInstruction } = source;
	const signature = resolveStackSignature({ sourceInstruction, stackAnalysisLine, parsedLine });
	const signatureLines = signature
		? signature.kind === 'call'
			? formatStackSignatureLines({ signature, maxLength })
			: [formatStackSignature(signature)]
		: [];
	const shortDescription = sourceInstruction?.spec.docs?.shortDescription;
	const tooltipText: string[] = [];
	const highlightTargets: SelectedLineTooltipContent['highlightTargets'] = [];

	tooltipText.push(...signatureLines);

	if (shortDescription) {
		tooltipText.push(...wrapTooltipText(shortDescription, maxLength));
	}

	if (moduleExecutionOrder !== undefined) {
		tooltipText.push(`execution order: ${moduleExecutionOrder}`);
	}

	const stackAnalysisContent = getStackAnalysisTooltipContent(stackAnalysisLine);
	highlightTargets.push(
		...stackAnalysisContent.highlightTargets.map(target => ({
			...target,
			lineIndex: target.lineIndex + tooltipText.length,
		}))
	);
	tooltipText.push(...stackAnalysisContent.text);

	if (tooltipText.length === 0) {
		return { text: [], signatureLineCount: 0, highlightTargets: [] };
	}

	return { text: tooltipText, signatureLineCount: signatureLines.length, highlightTargets };
}

/**
 * Builds wrapped tooltip text for instruction docs and stack analysis.
 */
export function getSelectedLineTooltipText(options: SelectedLineTooltipTextOptions): string[] {
	return getSelectedLineTooltipTextContent(options).text;
}

/**
 * Assembles the complete selected-line tooltip payload consumed by the drawer.
 */
export function getSelectedLineTooltipContent(options: SelectedLineTooltipOptions): SelectedLineTooltipContent {
	const textContent = getSelectedLineTooltipTextContent(options);
	const text = textContent.text;
	const { declaration } = options.source;
	const colors = getSelectedLineTooltipColors(text, textContent.signatureLineCount);
	const liveTooltipContent =
		declaration?.kind === 'reference'
			? getLiveReferenceTooltipContent(options.reference, text.length)
			: getLiveTooltipContent(declaration ? options.memory : undefined, text.length);

	text.push(...liveTooltipContent.text);
	colors.push(...liveTooltipContent.colors);

	return {
		text,
		characters: getTooltipTextCharacters(text),
		colors,
		lineCount: text.length,
		widthChars: Math.max(getMaxLineLength(text), liveTooltipContent.maxLineLength),
		highlightTargets: textContent.highlightTargets,
		liveValueTargets: liveTooltipContent.liveValueTargets,
	};
}
