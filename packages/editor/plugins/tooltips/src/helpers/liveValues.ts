import { PALETTE_INDICES, type PaletteIndex } from '@8f4e/editor-palette';
import { BASE_TYPE_METADATA, type PlannedMemoryDeclaration, type ResolvedReferenceSlot } from '@8f4e/language-spec';
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
 * Returns true when memory tooltip content should include a dereferenced value.
 */
function isPointerMemory(memory: PlannedMemoryDeclaration): boolean {
	return memory.pointerDepth > 0;
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
	moduleId: string | undefined,
	memoryId: string | undefined,
	firstLineIndex: number
): LiveTooltipContent {
	if (!memory || !moduleId || !memoryId) {
		return { text: [], colors: [], liveValueTargets: [], maxLineLength: 0 };
	}

	const valueLabel = memory.numberOfElements > 1 ? 'value[0]: ' : 'value: ';
	const lines: LiveTooltipLine[] = [
		{
			label: 'address: ',
			maxLineLength: 'address: '.length + maxLiveMemoryAddressLength,
			source: { kind: 'memoryAddress', moduleId, memoryId },
		},
		{
			label: valueLabel,
			maxLineLength: valueLabel.length + maxLiveMemoryValueLength,
			source: { kind: 'memoryValue', moduleId, memoryId, elementIndex: 0 },
		},
	];

	if (isPointerMemory(memory)) {
		lines.push({
			label: 'deref: ',
			maxLineLength: 'deref: '.length + maxLiveMemoryValueLength,
			source: { kind: 'memoryDereference', moduleId, memoryId, format: getDereferencedMemoryFormat(memory) },
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
	const { byteAddress, allocationUnitAddress, elementWordSize, isInteger, isUnsigned } = reference.targetMemory;

	return getLiveLinesContent(
		[
			{
				label: 'value: ',
				maxLineLength: 'value: '.length + maxLiveMemoryAddressLength,
				source: { kind: 'referenceValue', text: String(byteAddress) },
			},
			{
				label: 'deref: ',
				maxLineLength: 'deref: '.length + maxLiveMemoryValueLength,
				source: {
					kind: 'referenceDereference',
					byteAddress,
					allocationUnitAddress,
					format: { elementWordSize, isInteger, isUnsigned },
				},
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
