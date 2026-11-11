import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import { prepareNumericRead, type ResolvedMemoryTarget } from '@8f4e/editor-state/memory';
import type { TooltipLiveValueSource, TooltipLiveValueTarget } from '../types';
import { getTooltipLineColors } from './colors';
import { maxLiveMemoryAddressLength, maxLiveMemoryValueLength } from './constants';

interface LiveTooltipLine {
	label: string;
	maxLineLength: number;
	source: TooltipLiveValueSource;
}

export interface LiveTooltipContent {
	text: string[];
	colors: Array<Array<PaletteIndex | undefined>>;
	liveValueTargets: TooltipLiveValueTarget[];
	maxLineLength: number;
}

/**
 * Builds tooltip rows and live-value targets for selected memory declarations.
 */
export function getLiveTooltipContent(
	target: ResolvedMemoryTarget | undefined,
	firstLineIndex: number
): LiveTooltipContent {
	if (!target) {
		return { text: [], colors: [], liveValueTargets: [], maxLineLength: 0 };
	}
	const { memory } = target;

	const valueLabel = memory.numberOfElements > 1 ? 'value[0]: ' : 'value: ';
	const lines: LiveTooltipLine[] = [
		{
			label: 'address: ',
			maxLineLength: 'address: '.length + maxLiveMemoryAddressLength,
			source: { kind: 'staticText', text: String(memory.byteAddress) },
		},
		{
			label: valueLabel,
			maxLineLength: valueLabel.length + maxLiveMemoryValueLength,
			source: { kind: 'numericRead', read: prepareNumericRead({ target, options: {} })! },
		},
	];

	if (memory.pointerDepth > 0) {
		lines.push({
			label: 'deref: ',
			maxLineLength: 'deref: '.length + maxLiveMemoryValueLength,
			source: {
				kind: 'numericRead',
				read: prepareNumericRead({ target, options: { dereference: true } })!,
			},
		});
	}

	return getLiveLinesContent(lines, firstLineIndex);
}

/** Fixed references have a value and a dereferenced value, but no storage address of their own. */
export function getLiveReferenceTooltipContent(
	target: ResolvedMemoryTarget | undefined,
	firstLineIndex: number
): LiveTooltipContent {
	if (!target?.reference) {
		return { text: [], colors: [], liveValueTargets: [], maxLineLength: 0 };
	}
	const memory = target.memory;

	return getLiveLinesContent(
		[
			{
				label: 'value: ',
				maxLineLength: 'value: '.length + maxLiveMemoryAddressLength,
				source: { kind: 'staticText', text: String(memory.byteAddress) },
			},
			{
				label: 'deref: ',
				maxLineLength: 'deref: '.length + maxLiveMemoryValueLength,
				source: { kind: 'numericRead', read: prepareNumericRead({ target, options: { dereference: true } })! },
			},
		],
		firstLineIndex
	);
}

function getLiveLinesContent(lines: LiveTooltipLine[], firstLineIndex: number): LiveTooltipContent {
	return {
		text: lines.map(liveLine => liveLine.label),
		colors: lines.map(liveLine => getTooltipLineColors(liveLine.label)),
		liveValueTargets: lines.map((liveLine, index) => ({
			lineIndex: firstLineIndex + index,
			column: liveLine.label.length,
			source: liveLine.source,
			color: PALETTE_INDICES.inverseAccent,
		})),
		maxLineLength: Math.max(...lines.map(line => line.maxLineLength)),
	};
}
