import type { PlannedMemoryDeclaration } from '@8f4e/language-spec';

/** Geometry and value calibration owned by one connectors plugin instance. */
export interface Input {
	x: number;
	y: number;
}

export interface Output {
	x: number;
	y: number;
	calibratedMax: number;
	calibratedMin: number;
	memory: PlannedMemoryDeclaration;
}

export interface ConnectorWidgets {
	inputs: Input[];
	outputs: Output[];
}
