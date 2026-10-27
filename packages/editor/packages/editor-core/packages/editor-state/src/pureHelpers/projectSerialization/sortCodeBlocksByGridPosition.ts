import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';

type PositionedCodeBlock = Pick<CodeBlockGraphicData, 'gridX' | 'gridY' | 'creationIndex'>;

function compareCodeBlocksByGridPosition(a: PositionedCodeBlock, b: PositionedCodeBlock): number {
	return a.gridX - b.gridX || a.gridY - b.gridY || a.creationIndex - b.creationIndex;
}

export default function sortCodeBlocksByGridPosition<TBlock extends PositionedCodeBlock>(blocks: TBlock[]): TBlock[] {
	return [...blocks].sort(compareCodeBlocksByGridPosition);
}
