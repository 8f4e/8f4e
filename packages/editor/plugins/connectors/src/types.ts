import type { CodeBlockGraphicData } from '@8f4e/editor-state-types';
import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';

/** Geometry and value calibration owned by one connectors plugin instance. */
export interface Input {
	x: number;
	y: number;
	wireX: number;
	wireY: number;
	allocationUnitAddress: number;
}

export interface Output {
	codeBlock: CodeBlockGraphicData;
	x: number;
	y: number;
	wireX: number;
	wireY: number;
	calibratedMax: number;
	calibratedMin: number;
	memory: PlannedMemoryDeclaration;
}

export interface ConnectorWidgets {
	inputs: Input[];
	outputs: Output[];
}
