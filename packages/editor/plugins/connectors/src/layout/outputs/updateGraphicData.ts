import { getCodeBlockModuleId } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { ConnectorWidgets, Output } from '../../types';
import {
	getConnectorMemoryDeclarations,
	getConnectorRow,
	isInputMemoryDeclaration,
	isOutputMemoryDeclaration,
} from '../connectors/memoryDeclarations';
import { getProjectMemoryExposureConnectors } from '../connectors/projectMemoryExposures';

const CONNECTOR_WIDTH_GRID_CELLS = 3;

export default function updateOutputsGraphicData(
	graphicData: CodeBlockGraphicData,
	state: State,
	widgets: ConnectorWidgets
) {
	widgets.outputs = [];
	if (!graphicData.name) {
		return;
	}
	if (graphicData.nestedProjectCodeBlocks !== undefined) {
		getProjectMemoryExposureConnectors(graphicData, state).forEach(({ exposure, row }) => {
			if (isInputMemoryDeclaration(exposure.targetMemory)) return;

			const width = state.viewport.vGrid * CONNECTOR_WIDTH_GRID_CELLS;
			const height = state.viewport.hGrid;
			const x = graphicData.width - 3 * state.viewport.vGrid;
			const y = row * state.viewport.hGrid;
			const out: Output = {
				width,
				height,
				x,
				y,
				wireX: Math.round(x + width / 2),
				wireY: Math.round(y + height / 2),
				id: exposure.name,
				codeBlock: graphicData,
				calibratedMax: 0,
				calibratedMin: 0,
				memory: { ...exposure.targetMemory, id: exposure.name, lineNumber: row },
			};

			widgets.outputs.push(out);
		});
		return;
	}

	const moduleId = getCodeBlockModuleId(graphicData);
	const plannedModule = state.compiler.memoryPlan.modules[moduleId];
	const memoryDefaults = state.compiler.memoryDefaultsByModuleId[moduleId];
	getConnectorMemoryDeclarations(plannedModule, memoryDefaults).forEach(declaration => {
		const { memory } = declaration;
		if (!isOutputMemoryDeclaration(memory)) return;

		const width = state.viewport.vGrid * CONNECTOR_WIDTH_GRID_CELLS;
		const height = state.viewport.hGrid;
		const x = graphicData.width - 3 * state.viewport.vGrid;
		const y = getConnectorRow(declaration, graphicData.gaps) * state.viewport.hGrid;

		const out: Output = {
			width,
			height,
			x,
			y,
			wireX: Math.round(x + width / 2),
			wireY: Math.round(y + height / 2),
			id: memory.id,
			codeBlock: graphicData,
			calibratedMax: 0,
			calibratedMin: 0,
			memory,
		};

		widgets.outputs.push(out);
	});
}
