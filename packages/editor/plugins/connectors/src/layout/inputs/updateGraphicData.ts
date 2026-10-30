import { getCodeBlockModuleId } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { ConnectorWidgets } from '../../types';
import {
	getConnectorMemoryDeclarations,
	getConnectorRow,
	isInputMemoryDeclaration,
} from '../connectors/memoryDeclarations';
import { getProjectMemoryExposureConnectors } from '../connectors/projectMemoryExposures';

const CONNECTOR_WIDTH_GRID_CELLS = 3;

export default function updateInputsGraphicData(
	graphicData: CodeBlockGraphicData,
	state: State,
	widgets: ConnectorWidgets
) {
	widgets.inputs = [];
	if (!graphicData.name) {
		return;
	}
	if (graphicData.nestedProjectCodeBlocks !== undefined) {
		getProjectMemoryExposureConnectors(graphicData, state).forEach(({ exposure, row }) => {
			if (!isInputMemoryDeclaration(exposure.targetMemory)) return;

			const width = state.viewport.vGrid * CONNECTOR_WIDTH_GRID_CELLS;
			const height = state.viewport.hGrid;
			const x = 0;
			const y = row * state.viewport.hGrid;

			widgets.inputs.push({
				width,
				height,
				x,
				y,
				wireX: Math.round(x + width / 2),
				wireY: Math.round(y + height / 2),
				id: exposure.name,
				allocationUnitAddress: exposure.targetMemory.allocationUnitAddress,
				codeBlock: graphicData,
			});
		});
		return;
	}

	const moduleId = getCodeBlockModuleId(graphicData);
	const plannedModule = state.compiler.memoryPlan.modules[moduleId];
	const memoryDefaults = state.compiler.memoryDefaultsByModuleId[moduleId];
	getConnectorMemoryDeclarations(plannedModule, memoryDefaults).forEach(declaration => {
		const { memory } = declaration;
		if (!isInputMemoryDeclaration(memory)) return;

		const width = state.viewport.vGrid * CONNECTOR_WIDTH_GRID_CELLS;
		const height = state.viewport.hGrid;
		const x = 0;
		const y = getConnectorRow(declaration, graphicData.gaps) * state.viewport.hGrid;

		widgets.inputs.push({
			width,
			height,
			x,
			y,
			wireX: Math.round(x + width / 2),
			wireY: Math.round(y + height / 2),
			id: memory.id,
			allocationUnitAddress: memory.allocationUnitAddress,
			codeBlock: graphicData,
		});
	});
}
