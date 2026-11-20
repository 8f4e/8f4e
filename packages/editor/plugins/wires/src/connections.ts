import type {
	CodeBlockGraphicData,
	CodeBlockLayoutsChangedEvent,
	EventDispatcher,
	State,
} from '@8f4e/editor-state-types';
import { deriveEndpoints, type WireEndpoints, type WireOutput } from './deriveEndpoints';

/** Receives the viewport-relative pixel endpoints for an input and its matching output. */
export type WireConnectionVisitor = (
	inputX: number,
	inputY: number,
	outputX: number,
	outputY: number,
	selectedInput: boolean
) => void;

interface WireGeometry {
	endpointsByBlock: WeakMap<CodeBlockGraphicData, WireEndpoints>;
	outputsByByteAddress: ReadonlyMap<number, WireOutput>;
}

/** Track settled connection geometry for one renderer, independently of connector presentation. */
export function createWireConnections(state: State, events: EventDispatcher) {
	const endpointsByBlock = new WeakMap<CodeBlockGraphicData, WireEndpoints>();
	const outputsByByteAddress = new Map<number, WireOutput>();
	const geometry = { endpointsByBlock, outputsByByteAddress };
	const refresh = ({ project, codeBlocks }: CodeBlockLayoutsChangedEvent) => {
		if (project !== state.codeBlockRendering.currentProject) return;
		for (const block of codeBlocks) endpointsByBlock.set(block, deriveEndpoints(block, state));
		outputsByByteAddress.clear();
		for (const block of project.blocks) {
			for (const output of endpointsByBlock.get(block)?.outputs ?? []) {
				outputsByByteAddress.set(output.byteAddress, output);
			}
		}
	};
	const project = state.codeBlockRendering.currentProject;
	refresh({ project, codeBlocks: project.blocks });
	events.on('codeBlockLayoutsChanged', refresh);
	return {
		/** Visit active connections, including offscreen endpoints, using current pointer values. */
		visit: (memory: Int32Array, visitor: WireConnectionVisitor) => visitConnections(state, memory, geometry, visitor),
		dispose: () => {
			events.off('codeBlockLayoutsChanged', refresh);
			outputsByByteAddress.clear();
		},
	};
}

export function visitConnections(
	state: State,
	memory: Int32Array,
	{ endpointsByBlock, outputsByByteAddress }: WireGeometry,
	visit: WireConnectionVisitor
): void {
	for (const codeBlock of state.codeBlockRendering.currentProject.blocks) {
		const isSelected = codeBlock === state.codeBlockRendering.selectedCodeBlock;

		if (!codeBlock.name) {
			continue;
		}

		for (const input of endpointsByBlock.get(codeBlock)?.inputs ?? []) {
			const outputAddress =
				input.source.kind === 'reference' ? input.source.byteAddress : memory[input.source.allocationUnitAddress];
			const output = outputsByByteAddress.get(outputAddress);

			if (!output) {
				continue;
			}

			visit(
				codeBlock.x + input.x - state.viewport.x,
				codeBlock.y + input.y - state.viewport.y,
				output.codeBlock.x + output.x - state.viewport.x,
				output.codeBlock.y + output.y - state.viewport.y,
				isSelected
			);
		}
	}
}
