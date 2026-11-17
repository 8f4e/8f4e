import { gapCalculator, getModuleCompilationForCodeBlock } from '@8f4e/editor-state';
import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';
import type { ConnectorWidgets } from '../types';
import { isInputMemoryDeclaration, isOutputMemoryDeclaration } from './connectors/memoryDeclarations';
import { getProjectMemoryExposureConnectors } from './connectors/projectMemoryExposures';
import { getMemoryDeclarationRows } from './getMemoryDeclarationRows';

const pointerSlotAddresses = new WeakMap<State['compiler']['result']['compiledModules'], ReadonlySet<number>>();

function getReferencedPointerSlots(
	compiledModules: State['compiler']['result']['compiledModules']
): ReadonlySet<number> {
	let addresses = pointerSlotAddresses.get(compiledModules);
	if (!addresses) {
		const slots = new Set<number>();
		for (const module of Object.values(compiledModules)) {
			for (const { targetMemory } of Object.values(module.referenceSlots)) {
				if (targetMemory.pointerDepth > 0) slots.add(targetMemory.byteAddress);
			}
		}
		pointerSlotAddresses.set(compiledModules, slots);
		addresses = slots;
	}
	return addresses;
}

/** Derive both connector lists from one ordered traversal of the block's memory declarations. */
export default function deriveConnectors(codeBlock: CodeBlockGraphicData, state: State): ConnectorWidgets {
	const widgets: ConnectorWidgets = { inputs: [], outputs: [] };
	if (!codeBlock.name) return widgets;

	const width = state.viewport.vGrid * 3;
	const height = state.viewport.hGrid;
	const isProjectGroup = codeBlock.childProject !== undefined;
	const referencedPointerSlots = getReferencedPointerSlots(state.compiler.result.compiledModules);
	const addConnector = (memory: PlannedMemoryDeclaration, row: number) => {
		const y = row * height;
		const wireY = Math.round(y + height / 2);
		if (isInputMemoryDeclaration(memory)) {
			widgets.inputs.push({
				x: 0,
				y,
				wireX: Math.round(width / 2),
				wireY,
				source: { kind: 'pointer', allocationUnitAddress: memory.allocationUnitAddress },
			});
		}
		if (
			memory.pointerDepth > 0
				? referencedPointerSlots.has(memory.byteAddress)
				: isProjectGroup || isOutputMemoryDeclaration(memory)
		) {
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
		const compilation = getModuleCompilationForCodeBlock(codeBlock, state);
		if (!compilation) return widgets;
		for (const { memory, rowOffset } of getMemoryDeclarationRows(
			compilation.plannedModule,
			compilation.memoryDefaults
		)) {
			addConnector(memory, gapCalculator(memory.lineNumber, codeBlock.gaps) + rowOffset);
		}
		for (const slot of Object.values(compilation.compiledModule.referenceSlots)) {
			const y = gapCalculator(slot.lineNumber, codeBlock.gaps) * height;
			widgets.inputs.push({
				x: 0,
				y,
				wireX: Math.round(width / 2),
				wireY: Math.round(y + height / 2),
				source: { kind: 'reference', byteAddress: slot.targetMemory.byteAddress },
			});
		}
		widgets.inputs.sort((left, right) => left.y - right.y);
	}
	return widgets;
}
