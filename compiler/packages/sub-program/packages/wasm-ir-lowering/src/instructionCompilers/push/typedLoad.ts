import type { PointeeBaseType, WasmIRInstruction } from '@8f4e/language-spec';
import { f32load, f64load, i32load, i32load8s, i32load8u, i32load16s, i32load16u } from '../../operations';
import type { PushValueKind } from '../../pushValueKind';

const typedLoadOpcodes: Record<PointeeBaseType, WasmIRInstruction[]> = {
	int: i32load(2, 0),
	int8: i32load8s(0, 0),
	int8u: i32load8u(0, 0),
	int16: i32load16s(1, 0),
	int16u: i32load16u(1, 0),
	float: f32load(2, 0),
	float64: f64load(3, 0),
};

/** Emits one load with the element's width, signedness, and floating-point precision. */
export function typedLoad(baseType: PointeeBaseType): WasmIRInstruction[] {
	return typedLoadOpcodes[baseType];
}

/** Full-width scalar loads keyed by the resolved stack value kind. */
export const loadOpcode: Record<PushValueKind, WasmIRInstruction[]> = {
	int32: typedLoad('int'),
	float32: typedLoad('float'),
	float64: typedLoad('float64'),
};
