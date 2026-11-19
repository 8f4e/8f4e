import type {
	CodeBlockGraphicData,
	CodeBlockLayoutsChangedEvent,
	EventDispatcher,
	State,
} from '@8f4e/editor-state-types';
import deriveConnectors from './layout/deriveConnectors';
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

/** Track settled connection geometry for one renderer, independently of connector presentation. */
export function createConnectorConnections(state: State, events: EventDispatcher) {
	const widgetsByBlock = new WeakMap<CodeBlockGraphicData, ConnectorWidgets>();
	const outputsByByteAddress = new Map<number, Output>();
	const geometry = { widgetsByBlock, outputsByByteAddress };
	const refresh = ({ project, codeBlocks }: CodeBlockLayoutsChangedEvent) => {
		if (project !== state.codeBlockRendering.currentProject) return;
		for (const block of codeBlocks) widgetsByBlock.set(block, deriveConnectors(block, state));
		outputsByByteAddress.clear();
		for (const block of project.blocks) {
			for (const output of widgetsByBlock.get(block)?.outputs ?? []) {
				outputsByByteAddress.set(output.memory.byteAddress, output);
			}
		}
	};
	const project = state.codeBlockRendering.currentProject;
	refresh({ project, codeBlocks: project.blocks });
	events.on('codeBlockLayoutsChanged', refresh);
	return {
		/** Visit active connections, including offscreen endpoints, using current pointer values. */
		visit: (memory: Int32Array, visitor: ConnectorConnectionVisitor) =>
			visitConnections(state, memory, geometry, visitor),
		dispose: () => {
			events.off('codeBlockLayoutsChanged', refresh);
			outputsByByteAddress.clear();
		},
	};
}

export function visitConnections(
	state: State,
	memory: Int32Array,
	{ widgetsByBlock, outputsByByteAddress }: ConnectorGeometry,
	visit: ConnectorConnectionVisitor
): void {
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
