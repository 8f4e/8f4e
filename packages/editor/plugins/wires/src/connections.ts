import type { EditorPluginContext } from '@8f4e/editor-core';
import type {
	CodeBlockGraphicData,
	CodeBlockLayoutsChangedEvent,
	EventDispatcher,
	State,
} from '@8f4e/editor-state-types';
import type { RenderGeometry } from '@8f4e/web-ui';
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
export function createWireConnections(store: EditorPluginContext['store'], events: EventDispatcher) {
	const state = store.getState();
	const endpointsByBlock = new WeakMap<CodeBlockGraphicData, WireEndpoints>();
	const outputsByByteAddress = new Map<number, WireOutput>();
	const geometry = { endpointsByBlock, outputsByByteAddress };
	const refresh = ({ project, codeBlocks }: CodeBlockLayoutsChangedEvent) => {
		if (project !== state.codeBlockRendering.currentProject) return;
		if (state.viewport.vGrid <= 0 || state.viewport.hGrid <= 0) return;
		for (const block of codeBlocks) endpointsByBlock.set(block, deriveEndpoints(block, state));
		outputsByByteAddress.clear();
		for (const block of project.blocks) {
			for (const output of endpointsByBlock.get(block)?.outputs ?? []) {
				outputsByByteAddress.set(output.byteAddress, output);
			}
		}
	};
	const refreshCurrentProject = () => {
		const project = state.codeBlockRendering.currentProject;
		refresh({ project, codeBlocks: project.blocks });
	};
	refreshCurrentProject();
	events.on('codeBlockLayoutsChanged', refresh);
	store.subscribe('compiler.result', refreshCurrentProject);
	return {
		/** Visit active connections, including offscreen endpoints, using current pointer values. */
		visit: (renderGeometry: RenderGeometry, memory: Int32Array, visitor: WireConnectionVisitor) =>
			visitConnections(state, renderGeometry, memory, geometry, visitor),
		dispose: () => {
			events.off('codeBlockLayoutsChanged', refresh);
			store.unsubscribe('compiler.result', refreshCurrentProject);
			outputsByByteAddress.clear();
		},
	};
}

export function visitConnections(
	state: State,
	renderGeometry: RenderGeometry,
	memory: Int32Array,
	{ endpointsByBlock, outputsByByteAddress }: WireGeometry,
	visit: WireConnectionVisitor
): void {
	for (const { codeBlock, x, y } of renderGeometry.blocks) {
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
			const renderedOutput = renderGeometry.blocksByCodeBlock.get(output.codeBlock);
			if (!renderedOutput) continue;

			visit(x + input.x, y + input.y, renderedOutput.x + output.x, renderedOutput.y + output.y, isSelected);
		}
	}
}
