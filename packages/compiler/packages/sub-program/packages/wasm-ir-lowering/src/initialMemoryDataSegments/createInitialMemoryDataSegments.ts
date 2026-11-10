import type { MemoryDefaults, MemoryLayoutPlan } from '@8f4e/language-spec';
import createMemoryDataSegmentCandidate from './createMemoryDataSegmentCandidate';
import mergeAdjacentInitialMemoryDataSegments from './mergeAdjacentInitialMemoryDataSegments';
import type { InitialMemoryDataSegment } from './types';

/**
 * Creates passive data segments for non-zero and explicitly initialized compiled module memory.
 *
 * @param memoryPlan - Completed memory layout plan for the sub-program.
 * @param memoryDefaultsByModuleId - Resolved defaults keyed by module id.
 * @returns The materialized initial memory data segment data.
 */
export default function createInitialMemoryDataSegments(
	memoryPlan: MemoryLayoutPlan,
	memoryDefaultsByModuleId: Record<string, MemoryDefaults>
): InitialMemoryDataSegment[] {
	const segmentCandidates = memoryPlan.moduleList.flatMap(module => {
		const memoryDefaults = memoryDefaultsByModuleId[module.id]!;
		return module.declarations.flatMap(declaration =>
			createMemoryDataSegmentCandidate(declaration, memoryDefaults[declaration.id]!)
		);
	});

	return mergeAdjacentInitialMemoryDataSegments(segmentCandidates);
}
