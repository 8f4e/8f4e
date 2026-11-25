import { displayRowToGridRow, getCompiledModuleForCodeBlock } from '@8f4e/editor-state';
import { getProjectGroupMemoryExposures } from '@8f4e/editor-state/memory';
import type { EditorCodeBlock, State } from '@8f4e/editor-state-types';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';

export interface WireInput {
	x: number;
	y: number;
	source: { kind: 'pointer'; allocationUnitAddress: number } | { kind: 'reference'; byteAddress: number };
}

export interface WireOutput {
	codeBlock: EditorCodeBlock;
	x: number;
	y: number;
	byteAddress: number;
}

export interface WireEndpoints {
	inputs: WireInput[];
	outputs: WireOutput[];
}

/** Prepare block-local endpoints from the compiler's memory metadata and settled layout. */
export function deriveEndpoints(codeBlock: EditorCodeBlock, state: State): WireEndpoints {
	const endpoints: WireEndpoints = { inputs: [], outputs: [] };
	if (!codeBlock.name) return endpoints;

	const width = state.viewport.vGrid * 3;
	const height = state.viewport.hGrid;
	const inputX = Math.round(width / 2);
	const outputX = Math.round(codeBlock.width - width + width / 2);
	const lineY = (lineNumber: number) =>
		Math.round(displayRowToGridRow(lineNumber, codeBlock.gaps) * height + height / 2);
	const isProjectGroup = codeBlock.childLevel !== undefined;
	const addMemory = (memory: PlannedMemoryDeclaration, lineNumber: number) => {
		const isPointer = memory.pointerDepth > 0;
		if (isPointer && memory.numberOfElements === 0) return;
		const y = lineY(lineNumber);
		if (isPointer) {
			endpoints.inputs.push({
				x: inputX,
				y,
				source: { kind: 'pointer', allocationUnitAddress: memory.allocationUnitAddress },
			});
		}
		if (isProjectGroup || isPointer || !memory.name?.startsWith('_')) {
			endpoints.outputs.push({ codeBlock, x: outputX, y, byteAddress: memory.byteAddress });
		}
	};

	if (isProjectGroup) {
		for (const { targetMemory, lineNumber } of getProjectGroupMemoryExposures(codeBlock, state)) {
			addMemory(targetMemory, lineNumber);
		}
		return endpoints;
	}

	const compiledModule = getCompiledModuleForCodeBlock(codeBlock, state);
	if (!compiledModule) return endpoints;
	const plannedModule = state.compiler.result.memoryPlan.modules[compiledModule.id];
	if (!plannedModule) return endpoints;
	for (const memory of plannedModule.declarations) {
		addMemory(memory, memory.lineNumber);
	}
	for (const slot of Object.values(compiledModule.referenceSlots)) {
		endpoints.inputs.push({
			x: inputX,
			y: lineY(slot.lineNumber),
			source: { kind: 'reference', byteAddress: slot.targetMemory.byteAddress },
		});
	}
	endpoints.inputs.sort((left, right) => left.y - right.y);
	return endpoints;
}
