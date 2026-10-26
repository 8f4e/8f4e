import type { CompiledStackAnalysisLine, PlannedMemoryDeclaration } from '@8f4e/language-spec';
import { getSelectedLineTooltipColors } from './colors';
import { TOOLTIP_WRAP_WIDTH } from './constants';
import { getLiveTooltipContent } from './liveValues';
import {
	getInstructionSpecFromSourceLine,
	getMemoryDeclarationIdFromSourceLine,
	getStackSignatureFromSourceLine,
} from './sourceLine';
import { getStackAnalysisTooltipContent } from './stackAnalysisTooltip';
import { getMaxLineLength, getTooltipTextCharacters, wrapTooltipText } from './text';
import type { SelectedLineTooltipContent, SpriteLookups } from './types';

interface SelectedLineTooltipTextContent {
	text: string[];
	highlightTargets: SelectedLineTooltipContent['highlightTargets'];
}

/**
 * Builds wrapped tooltip text for instruction docs and stack analysis.
 */
export function getSelectedLineTooltipTextContent(
	line: string | undefined,
	maxLength = TOOLTIP_WRAP_WIDTH,
	stackAnalysisLine?: CompiledStackAnalysisLine,
	moduleExecutionOrder?: number
): SelectedLineTooltipTextContent {
	if (!line) {
		return { text: [], highlightTargets: [] };
	}

	const spec = getInstructionSpecFromSourceLine(line);
	const stackSignature = getStackSignatureFromSourceLine(line);
	const shortDescription = spec?.docs?.shortDescription;
	const tooltipText: string[] = [];
	const highlightTargets: SelectedLineTooltipContent['highlightTargets'] = [];

	if (stackSignature) {
		tooltipText.push(stackSignature);
	}

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
		return { text: [], highlightTargets: [] };
	}

	return { text: tooltipText, highlightTargets };
}

/**
 * Builds wrapped tooltip text for instruction docs and stack analysis.
 */
export function getSelectedLineTooltipText(
	line: string | undefined,
	maxLength = TOOLTIP_WRAP_WIDTH,
	stackAnalysisLine?: CompiledStackAnalysisLine,
	moduleExecutionOrder?: number
): string[] {
	return getSelectedLineTooltipTextContent(line, maxLength, stackAnalysisLine, moduleExecutionOrder).text;
}

/**
 * Assembles the complete selected-line tooltip payload consumed by the drawer.
 */
export function getSelectedLineTooltipContent(
	line: string | undefined,
	maxLength = TOOLTIP_WRAP_WIDTH,
	stackAnalysisLine?: CompiledStackAnalysisLine,
	spriteLookups?: SpriteLookups,
	moduleId?: string,
	memory?: PlannedMemoryDeclaration,
	moduleExecutionOrder?: number
): SelectedLineTooltipContent {
	const textContent = getSelectedLineTooltipTextContent(line, maxLength, stackAnalysisLine, moduleExecutionOrder);
	const text = textContent.text;
	const memoryId = getMemoryDeclarationIdFromSourceLine(line);
	const colors = getSelectedLineTooltipColors(line, text, spriteLookups);
	const liveTooltipContent = getLiveTooltipContent(memory, moduleId, memoryId, text.length, spriteLookups);

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
