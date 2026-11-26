import { displayRowToGridRow, getCompiledModuleForCodeBlock } from '@8f4e/editor-state';
import { getProjectGroupMemoryExposures } from '@8f4e/editor-state/memory';
import type { EditorCodeBlock, State } from '@8f4e/editor-state-types';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
import type { ConnectorWidgets } from '../types';
import { isInputMemoryDeclaration, isOutputMemoryDeclaration } from './connectors/memoryDeclarations';

/** Derive both connector lists from one ordered traversal of the block's memory declarations. */
export default function deriveConnectors(codeBlock: EditorCodeBlock, state: State): ConnectorWidgets {
	const widgets: ConnectorWidgets = { inputs: [], outputs: [] };
	if (!codeBlock.name) return widgets;

	const width = state.viewport.vGrid * 3;
	const height = state.viewport.hGrid;
	const isProjectGroup = codeBlock.childLevel !== undefined;
	const addConnector = (memory: PlannedMemoryDeclaration, row: number) => {
		if (memory.pointerDepth > 0 && memory.numberOfElements === 0) return;
		const y = row * height;
		if (isInputMemoryDeclaration(memory)) {
			widgets.inputs.push({ x: 0, y });
		}
		if (isProjectGroup || isOutputMemoryDeclaration(memory)) {
			widgets.outputs.push({
				x: codeBlock.width - width,
				y,
				calibratedMax: 0,
				calibratedMin: 0,
				memory,
			});
		}
	};

	if (isProjectGroup) {
		for (const { targetMemory, lineNumber } of getProjectGroupMemoryExposures(codeBlock, state)) {
			addConnector(targetMemory, displayRowToGridRow(lineNumber, codeBlock.gaps));
		}
	} else {
		const compiledModule = getCompiledModuleForCodeBlock(codeBlock, state);
		if (!compiledModule) return widgets;
		const plannedModule = state.compiler.result.memoryPlan.modules[compiledModule.id];
		if (!plannedModule) return widgets;
		for (const memory of plannedModule.declarations) {
			addConnector(memory, displayRowToGridRow(memory.lineNumber, codeBlock.gaps));
		}
		for (const slot of Object.values(compiledModule.referenceSlots)) {
			widgets.inputs.push({
				x: 0,
				y: displayRowToGridRow(slot.lineNumber, codeBlock.gaps) * height,
			});
		}
		widgets.inputs.sort((left, right) => left.y - right.y);
	}
	return widgets;
}
