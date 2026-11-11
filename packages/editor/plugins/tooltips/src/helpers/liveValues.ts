import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import { BASE_TYPE_METADATA, type PlannedMemoryDeclaration, type ResolvedReferenceSlot } from '@8f4e/language-spec';
import type { TooltipLiveValueSource, TooltipLiveValueTarget, TooltipMemoryReadSource } from '../types';
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
 * Prepares the storage address and format shared by allocated values and fixed-reference targets.
 */
function prepareMemoryRead(memory: PlannedMemoryDeclaration): TooltipMemoryReadSource {
	const { byteAddress, allocationUnitAddress, elementWordSize, isInteger, isUnsigned } = memory;
	return {
		kind: 'memoryRead',
		byteAddress,
		allocationUnitAddress,
		format: { elementWordSize, isInteger, isUnsigned },
	};
}

/**
 * Describes how the drawer should read a pointer's dereferenced live value.
 */
function getDereferencedMemoryFormat(memory: PlannedMemoryDeclaration) {
	const pointeeType = memory.pointerDepth > 1 ? 'pointer' : memory.pointeeBaseType!;
	const metadata = BASE_TYPE_METADATA[pointeeType];

	return {
		elementWordSize: metadata.wordSize,
		isInteger: metadata.isInteger,
		isUnsigned: pointeeType === 'int8u' || pointeeType === 'int16u',
	};
}

/**
 * Builds tooltip rows and live-value targets for selected memory declarations.
 */
export function getLiveTooltipContent(
	memory: PlannedMemoryDeclaration | undefined,
	firstLineIndex: number
): LiveTooltipContent {
	if (!memory) {
		return { text: [], colors: [], liveValueTargets: [], maxLineLength: 0 };
	}

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
			source: prepareMemoryRead(memory),
		},
	];

	if (memory.pointerDepth > 0) {
		lines.push({
			label: 'deref: ',
			maxLineLength: 'deref: '.length + maxLiveMemoryValueLength,
			source: {
				kind: 'pointerRead',
				allocationUnitAddress: memory.allocationUnitAddress,
				format: getDereferencedMemoryFormat(memory),
			},
		});
	}

	return getLiveLinesContent(lines, firstLineIndex);
}

/** Fixed references have a value and a dereferenced value, but no storage address of their own. */
export function getLiveReferenceTooltipContent(
	reference: ResolvedReferenceSlot | undefined,
	firstLineIndex: number
): LiveTooltipContent {
	if (!reference) {
		return { text: [], colors: [], liveValueTargets: [], maxLineLength: 0 };
	}
	const memory = reference.targetMemory;

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
				source: prepareMemoryRead(memory),
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
