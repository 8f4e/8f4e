import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { ConnectorWidgets, Output } from './types';

/** Receives the viewport-relative pixel endpoints for an input and its matching output. */
export type ConnectorConnectionVisitor = (
	inputX: number,
	inputY: number,
	outputX: number,
	outputY: number,
	selectedInput: boolean
) => void;

interface ConnectorGeometry {
	widgetsByBlock: WeakMap<CodeBlockGraphicData, ConnectorWidgets>;
	outputsByByteAddress: ReadonlyMap<number, Output>;
}

const geometryByState = new WeakMap<State, ConnectorGeometry>();

export function registerConnectorGeometry(state: State, geometry: ConnectorGeometry): () => void {
	geometryByState.set(state, geometry);
	return () => {
		if (geometryByState.get(state) === geometry) geometryByState.delete(state);
	};
}

/** Visit active connections from the installed connectors plugin, including offscreen endpoints. */
export function visitConnectorConnections(state: State, memory: Int32Array, visit: ConnectorConnectionVisitor): void {
	const geometry = geometryByState.get(state);
	if (!geometry) return;
	const { widgetsByBlock, outputsByByteAddress } = geometry;
	for (const codeBlock of state.codeBlockRendering.currentProject.blocks) {
		const isSelected = codeBlock === state.codeBlockRendering.selectedCodeBlock;

		if (!codeBlock.name) {
			continue;
		}

		for (const input of widgetsByBlock.get(codeBlock)?.inputs ?? []) {
			const outputAddress =
				input.source.kind === 'reference' ? input.source.byteAddress : memory[input.source.allocationUnitAddress];
			const output = outputsByByteAddress.get(outputAddress);

			if (!output) {
				continue;
			}

			visit(
				codeBlock.x + input.wireX - state.viewport.x,
				codeBlock.y + input.wireY - state.viewport.y,
				output.codeBlock.x + output.wireX - state.viewport.x,
				output.codeBlock.y + output.wireY - state.viewport.y,
				isSelected
			);
		}
	}
}
