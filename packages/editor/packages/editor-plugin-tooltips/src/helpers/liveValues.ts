import { BASE_TYPE_METADATA, type PlannedMemoryDeclaration } from '@8f4e/language-spec';
import type { SpriteFont } from '@8f4e/sprite-generator';
import type { SpriteLookups, TooltipLiveValueSource, TooltipLiveValueTarget } from '../types';
import { getTooltipLineColors } from './colors';
import { maxLiveMemoryAddressLength, maxLiveMemoryValueLength } from './constants';

interface LiveTooltipLine {
	label: string;
	maxLineLength: number;
	source: TooltipLiveValueSource;
}

export interface LiveTooltipContent {
	text: string[];
	colors: Array<Array<SpriteFont | undefined>>;
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
	firstLineIndex: number,
	spriteLookups: SpriteLookups | undefined
): LiveTooltipContent {
	if (!memory || !moduleId || !memoryId) {
		return { text: [], colors: [], liveValueTargets: [], maxLineLength: 0 };
	}

	const valueColor = spriteLookups?.fontInverseAccent;
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

	return {
		text: lines.map(liveLine => liveLine.label),
		colors: lines.map(liveLine => getTooltipLineColors(liveLine.label, spriteLookups)),
		liveValueTargets: lines.map((liveLine, index) => ({
			lineIndex: firstLineIndex + index,
			column: liveLine.label.length,
			source: liveLine.source,
			color: valueColor,
		})),
		maxLineLength: Math.max(...lines.map(line => line.maxLineLength)),
	};
}
