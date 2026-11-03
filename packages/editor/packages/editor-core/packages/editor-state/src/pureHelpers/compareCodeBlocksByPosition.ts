import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';

type SpatialOrder = Pick<CodeBlockGraphicData, 'gridX' | 'gridY' | 'creationIndex'>;

/** Canonical project order: left to right, then top to bottom, then creation order. */
export default function compareCodeBlocksByPosition(a: SpatialOrder, b: SpatialOrder): number {
	return a.gridX - b.gridX || a.gridY - b.gridY || a.creationIndex - b.creationIndex;
}
