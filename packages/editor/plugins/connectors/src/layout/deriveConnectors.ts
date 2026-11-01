import { getCodeBlockModuleId } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
import type { ConnectorWidgets } from '../types';
import {
	getConnectorMemoryDeclarations,
	getConnectorRow,
	isInputMemoryDeclaration,
	isOutputMemoryDeclaration,
} from './connectors/memoryDeclarations';
import { getProjectMemoryExposureConnectors } from './connectors/projectMemoryExposures';

/** Derive both connector lists from one ordered traversal of the block's memory declarations. */
export default function deriveConnectors(codeBlock: CodeBlockGraphicData, state: State): ConnectorWidgets {
	const widgets: ConnectorWidgets = { inputs: [], outputs: [] };
	if (!codeBlock.name) return widgets;

	const width = state.viewport.vGrid * 3;
	const height = state.viewport.hGrid;
	const isProjectGroup = codeBlock.childProject !== undefined;
	const addConnector = (memory: PlannedMemoryDeclaration, row: number) => {
		const y = row * height;
		const wireY = Math.round(y + height / 2);
		if (isInputMemoryDeclaration(memory)) {
			widgets.inputs.push({
				x: 0,
				y,
				wireX: Math.round(width / 2),
				wireY,
				allocationUnitAddress: memory.allocationUnitAddress,
			});
		} else if (isProjectGroup || isOutputMemoryDeclaration(memory)) {
			const x = codeBlock.width - width;
			widgets.outputs.push({
				codeBlock,
				x,
				y,
				wireX: Math.round(x + width / 2),
				wireY,
				calibratedMax: 0,
				calibratedMin: 0,
				memory,
			});
		}
	};

	if (isProjectGroup) {
		for (const { exposure, row } of getProjectMemoryExposureConnectors(codeBlock, state)) {
			addConnector(exposure.targetMemory, row);
		}
	} else {
		const moduleId = getCodeBlockModuleId(codeBlock);
		for (const declaration of getConnectorMemoryDeclarations(
			state.compiler.result.memoryPlan.modules[moduleId],
			state.compiler.result.memoryDefaultsByModuleId[moduleId]
		)) {
			addConnector(declaration.memory, getConnectorRow(declaration, codeBlock.gaps));
		}
	}
	return widgets;
}
