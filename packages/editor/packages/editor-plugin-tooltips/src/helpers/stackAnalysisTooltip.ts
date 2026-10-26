import { formatKnownStackValue } from '@8f4e/editor-state';
import type { CompiledStackAnalysisLine, Stack, StackItem } from '@8f4e/language-spec';
import type { TooltipHighlightRange, TooltipHighlightTarget } from '../types';
import { maxInlineStackItemCount } from './constants';

const stackBeforeInlineLabel = 'before ';
const stackBeforeBlockLabel = 'before: ';
const stackAfterLabel = 'after: ';
const consumedStackItemHighlight = 'tooltipConsumedHighlight';
const producedStackItemHighlight = 'tooltipAddedHighlight';

type StackItemMarker = 'consumed' | 'added';

interface StackAnalysisTooltipContent {
	text: string[];
	highlightTargets: TooltipHighlightTarget[];
}

interface FormattedStackItem {
	label: string;
	highlightColor?: TooltipHighlightTarget['fillColor'];
}

/**
 * Returns the part of a stack tooltip line that should use the highlight color.
 */
export function getStackValueHighlightRange(line: string): TooltipHighlightRange | undefined {
	if (line.startsWith(stackBeforeInlineLabel)) {
		return { start: stackBeforeInlineLabel.length, end: line.length };
	}

	if (line.startsWith(stackBeforeBlockLabel)) {
		return { start: stackBeforeBlockLabel.length, end: line.length };
	}

	if (line.startsWith(stackAfterLabel)) {
		return { start: stackAfterLabel.length, end: line.length };
	}

	if (line.startsWith('  ')) {
		return { start: 2, end: line.length };
	}

	if (line === ']') {
		return { start: 0, end: line.length };
	}

	return undefined;
}

/**
 * Formats one stack item, marking consumed values as `-item` and produced values as `+item`.
 */
function getStackItemLabel(item: StackItem, marker?: StackItemMarker): string {
	let label: string;

	if (item.kind === 'address') {
		label = 'ptr';
	} else {
		label = item.valueType;
	}

	const knownValue = formatKnownStackValue(item);
	const valueLabel = knownValue === undefined ? label : `${label}=${knownValue}`;

	if (marker === 'consumed') {
		return `-${valueLabel}`;
	}

	if (marker === 'added') {
		return `+${valueLabel}`;
	}

	return valueLabel;
}

/**
 * Stack analysis lists the top of the stack at the end, so markers apply from the tail.
 */
function isMarkedStackItem(index: number, stack: Stack, markedItemCount: number): boolean {
	return index >= stack.length - markedItemCount;
}

function getStackItemHighlightColor(marker: StackItemMarker): TooltipHighlightTarget['fillColor'] {
	return marker === 'consumed' ? consumedStackItemHighlight : producedStackItemHighlight;
}

function formatStackItems(stack: Stack, markedItemCount: number, marker: StackItemMarker): FormattedStackItem[] {
	return stack.map((item, index) => {
		const isMarked = isMarkedStackItem(index, stack, markedItemCount);

		return {
			label: getStackItemLabel(item, isMarked ? marker : undefined),
			highlightColor: isMarked ? getStackItemHighlightColor(marker) : undefined,
		};
	});
}

/**
 * Formats a compact inline stack display.
 */
function formatStack(items: FormattedStackItem[]): string {
	return `[${items.map(item => item.label).join(', ')}]`;
}

function getInlineHighlightTargets(
	lineIndex: number,
	labelLength: number,
	items: FormattedStackItem[]
): TooltipHighlightTarget[] {
	const highlightTargets: TooltipHighlightTarget[] = [];
	let column = labelLength + 1;

	for (const item of items) {
		if (item.highlightColor) {
			highlightTargets.push({
				lineIndex,
				column,
				widthChars: item.label.length,
				fillColor: item.highlightColor,
			});
		}

		column += item.label.length + 2;
	}

	return highlightTargets;
}

function getBlockHighlightTarget(lineIndex: number, item: FormattedStackItem): TooltipHighlightTarget | undefined {
	if (!item.highlightColor) {
		return undefined;
	}

	return {
		lineIndex,
		column: 2,
		widthChars: item.label.length,
		fillColor: item.highlightColor,
	};
}

/**
 * Formats stack tooltip text inline for short stacks and as a block for longer stacks.
 */
function formatStackTooltipLines(
	inlineLabel: string,
	blockLabel: string,
	stack: Stack,
	markedItemCount: number,
	marker: StackItemMarker,
	firstLineIndex: number
): StackAnalysisTooltipContent {
	const items = formatStackItems(stack, markedItemCount, marker);

	if (stack.length <= maxInlineStackItemCount) {
		return {
			text: [`${inlineLabel}${formatStack(items)}`],
			highlightTargets: getInlineHighlightTargets(firstLineIndex, inlineLabel.length, items),
		};
	}

	const stackItemLines = items.map((item, index) => {
		const suffix = index === stack.length - 1 ? '' : ',';
		return `  ${item.label}${suffix}`;
	});
	const highlightTargets = items
		.map((item, index) => getBlockHighlightTarget(firstLineIndex + index + 1, item))
		.filter(target => target !== undefined);

	return {
		text: [`${blockLabel}[`, ...stackItemLines, ']'],
		highlightTargets,
	};
}

/**
 * Builds before/after stack tooltip text and highlight rectangles from compiler stack analysis.
 */
export function getStackAnalysisTooltipContent(
	stackAnalysisLine: CompiledStackAnalysisLine | undefined
): StackAnalysisTooltipContent {
	if (!stackAnalysisLine) {
		return { text: [], highlightTargets: [] };
	}

	const { consumedOperands, producedStackItems, stackBefore, stackAfter } = stackAnalysisLine.stackAnalysis;
	const beforeContent = formatStackTooltipLines(
		stackBeforeInlineLabel,
		stackBeforeBlockLabel,
		stackBefore,
		consumedOperands.length,
		'consumed',
		0
	);
	const afterContent = formatStackTooltipLines(
		stackAfterLabel,
		stackAfterLabel,
		stackAfter,
		producedStackItems.length,
		'added',
		beforeContent.text.length
	);

	return {
		text: [...beforeContent.text, ...afterContent.text],
		highlightTargets: [...beforeContent.highlightTargets, ...afterContent.highlightTargets],
	};
}

/**
 * Builds before/after stack tooltip lines from compiler stack analysis.
 */
export function getStackAnalysisTooltipText(stackAnalysisLine: CompiledStackAnalysisLine | undefined): string[] {
	return getStackAnalysisTooltipContent(stackAnalysisLine).text;
}
