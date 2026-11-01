export interface Slider {
	/** Canonical owner of the backing declaration, including for exposed aliases. */
	moduleId: string;
	width: number;
	height: number;
	x: number;
	y: number;
	id: string;
	allocationUnitAddress: number;
	byteAddress: number;
	isInteger: boolean;
	isFloat64?: boolean;
	min: number;
	max: number;
	step?: number;
}
