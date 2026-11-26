/**
 * WebAssembly instruction set.
 */

/**
 * Trap immediately when executed.
 * Type signature: (param) (result)
 */
export const WASM_UNREACHABLE = 0x00;

/**
 * No-op instruction.
 * Type signature: (param) (result)
 */
export const WASM_NOP = 0x01;

/**
 * Begin a block.
 * Type signature: (param t1* ...) (result t2* ...), determined by block type.
 */
export const WASM_BLOCK = 0x02;

/**
 * Begin a loop block with a backward branch target.
 * Type signature: (param t1* ...) (result t2* ...), determined by block type.
 */
export const WASM_LOOP = 0x03;

/**
 * Begin a conditional block.
 * Type signature: (param i32 t1* ...) (result t2* ...), determined by block type.
 */
export const WASM_IF = 0x04;

/**
 * Alternate branch for the current if block.
 * Type signature: (param t* ...) (result t* ...)
 */
export const WASM_ELSE = 0x05;

/**
 * End the current structured control-flow block.
 * Type signature: (param t* ...) (result t* ...)
 */
export const WASM_END = 0x0b;

/**
 * Unconditional branch to a relative label.
 * Type signature: (param t* ...) (result)
 */
export const WASM_BR = 0x0c;

/**
 * Conditional branch to a relative label.
 * Type signature: (param i32 t* ...) (result t* ...)
 */
export const WASM_BR_IF = 0x0d;

/**
 * Branch to one label from a table by index.
 * Type signature: (param i32 t* ...) (result)
 */
export const WASM_BR_TABLE = 0x0e;

/**
 * Return from the current function.
 * Type signature: (param t* ...) (result)
 */
export const WASM_RETURN = 0x0f;

/**
 * Call a function by index.
 * Type signature: (param t1* ...) (result t2* ...), as defined by the callee type.
 */
export const WASM_CALL = 0x10;

/**
 * Pop and discard the top stack value.
 * Type signature: (param t) (result)
 */
export const WASM_DROP = 0x1a;

/**
 * Select one of two values based on a condition.
 * Type signature: (param t t i32) (result t)
 */
export const WASM_SELECT = 0x1b;

/**
 * Read a local variable.
 * Type signature: (param) (result t), where t is the local type.
 */
export const WASM_LOCAL_GET = 0x20;

/**
 * Read a mutable global variable.
 * Type signature: (param) (result t), where t is the global type.
 */
export const WASM_GLOBAL_GET = 0x23;

/**
 * Write a local variable.
 * Type signature: (param t) (result), where t is the local type.
 */
export const WASM_LOCAL_SET = 0x21;

/**
 * Write a local variable and leave the value on the stack.
 * Type signature: (param t) (result t), where t is the local type.
 */
export const WASM_LOCAL_TEE = 0x22;

/**
 * Load a 32-bit integer from memory.
 * Type signature: (param i32) (result i32)
 */
export const WASM_I32_LOAD = 0x28;

/**
 * Load a 32-bit float from memory.
 * Type signature: (param i32) (result f32)
 */
export const WASM_F32_LOAD = 0x2a;

/**
 * Load a 64-bit float from memory.
 * Type signature: (param i32) (result f64)
 */
export const WASM_F64_LOAD = 0x2b;

/**
 * Load a signed 8-bit integer from memory and extend to i32.
 * Type signature: (param i32) (result i32)
 */
export const WASM_I32_LOAD_8_S = 0x2c;

/**
 * Load an unsigned 8-bit integer from memory and extend to i32.
 * Type signature: (param i32) (result i32)
 */
export const WASM_I32_LOAD_8_U = 0x2d;

/**
 * Load a signed 16-bit integer from memory and extend to i32.
 * Type signature: (param i32) (result i32)
 */
export const WASM_I32_LOAD_16_S = 0x2e;

/**
 * Load an unsigned 16-bit integer from memory and extend to i32.
 * Type signature: (param i32) (result i32)
 */
export const WASM_I32_LOAD_16_U = 0x2f;

/**
 * Store a 32-bit integer to memory.
 * Type signature: (param i32 i32) (result)
 */
export const WASM_I32_STORE = 0x36;

/**
 * Store the low 8 bits of an i32 to memory.
 * Type signature: (param i32 i32) (result)
 */
export const WASM_I32_STORE8 = 0x3a;

/**
 * Store the low 16 bits of an i32 to memory.
 * Type signature: (param i32 i32) (result)
 */
export const WASM_I32_STORE16 = 0x3b;

/**
 * Return the current memory size in WebAssembly pages.
 * The following memory index immediate is currently always 0.
 * Type signature: (param) (result i32)
 */
export const WASM_MEMORY_SIZE = 0x3f;

/**
 * Store a 32-bit float to memory.
 * Type signature: (param i32 f32) (result)
 */
export const WASM_F32_STORE = 0x38;

/**
 * Store a 64-bit float to memory.
 * Type signature: (param i32 f64) (result)
 */
export const WASM_F64_STORE = 0x39;

/**
 * Push a 32-bit integer constant.
 * Type signature: (param) (result i32)
 */
export const WASM_I32_CONST = 0x41;

/**
 * Push a 64-bit integer constant.
 * Type signature: (param) (result i64)
 */
export const WASM_I64_CONTS = 0x42;

/**
 * Push a 32-bit floating-point constant.
 * Type signature: (param) (result f32)
 */
export const WASM_F32_CONST = 0x43;

/**
 * Push a 64-bit floating-point constant.
 * Type signature: (param) (result f64)
 */
export const WASM_F64_CONST = 0x44;

/**
 * Equal with zero.
 * The eqz instruction returns true if the operand is equal to zero, or
 * false otherwise.
 * Type signature: (param i32) (result i32)
 */
export const WASM_I32_EQZ = 0x45;

/**
 * Equality.
 * Tests whether the operands are equal.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_EQ = 0x46;

/**
 * Inequality.
 * Tests whether the operands are not equal.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_NE = 0x47;

/**
 * Less than (signed).
 * Tests whether the first operand is less than the second operand.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_LT_S = 0x48;

/**
 * Less than (unsigned).
 * Tests whether the first operand is less than the second operand.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_LT_U = 0x49;

/**
 * Greater than (signed).
 * Tests whether the first operand is greater than the second operand.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_GT_S = 0x4a;

/**
 * Greater than (unsigned).
 * Tests whether the first operand is greater than the second operand.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_GT_U = 0x4b;

/**
 * Less than or equal to (signed).
 * Tests whether the first operand is less than or equal to the second operand.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_LE_S = 0x4c;

/**
 * Less than or equal to (unsigned).
 * Tests whether the first operand is less than or equal to the second operand.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_LE_U = 0x4d;

/**
 * Greater than or equal to (signed).
 * Tests whether the first operand is greater than or equal to the second operand.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_GE_S = 0x4e;

/**
 * Greater than or equal to (unsigned).
 * Tests whether the first operand is greater than or equal to the second operand.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_GE_U = 0x4f;

/**
 * Floating-Point Equality
 * Type signature: (param f32, f32) (result i32)
 */
export const WASM_F32_EQ = 0x5b;

/**
 * Floating-Point Inequality
 * Type signature: (param f32, f32) (result i32)
 */
export const WASM_F32_NE = 0x5c;

/**
 * Floating-Point Less Than
 * Type signature: (param f32, f32) (result i32)
 */
export const WASM_F32_LT = 0x5d;

/**
 * Floating-Point Greater Than
 * Type signature: (param f32, f32) (result i32)
 */
export const WASM_F32_GT = 0x5e;

/**
 * Floating-Point Less Than Or Equal To
 * Type signature (param f32, f32) (result i32)
 */
export const WASM_F32_LE = 0x5f;

/**
 * Floating-Point Greater Than Or Equal To
 * Type signature: (param f32, f32) (result i32)
 */
export const WASM_F32_GE = 0x60;

/**
 * Floating-Point Equality (f64)
 * Type signature: (param f64, f64) (result i32)
 */
export const WASM_F64_EQ = 0x61;

/**
 * Floating-Point Inequality (f64)
 * Type signature: (param f64, f64) (result i32)
 */
export const WASM_F64_NE = 0x62;

/**
 * Floating-Point Less Than (f64)
 * Type signature: (param f64, f64) (result i32)
 */
export const WASM_F64_LT = 0x63;

/**
 * Floating-Point Greater Than (f64)
 * Type signature: (param f64, f64) (result i32)
 */
export const WASM_F64_GT = 0x64;

/**
 * Floating-Point Less Than Or Equal To (f64)
 * Type signature: (param f64, f64) (result i32)
 */
export const WASM_F64_LE = 0x65;

/**
 * Floating-Point Greater Than Or Equal To (f64)
 * Type signature: (param f64, f64) (result i32)
 */
export const WASM_F64_GE = 0x66;

/**
 * Aadd.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_ADD = 0x6a;

/**
 * Substract.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_SUB = 0x6b;

/**
 * Multiply.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_MUL = 0x6c;

/**
 * Divide (signed).
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_DIV_S = 0x6d;

/**
 * Divide (unsigned).
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_DIV_U = 0x6e;

/**
 * Remainder.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_REM_S = 0x6f;

/**
 * Bitwise and.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_AND = 0x71;

/**
 * Bitwise or.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_OR = 0x72;

/**
 * Exclusive or.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_XOR = 0x73;

/**
 * Shift left.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_SHL = 0x74;

/**
 * Shift right (signed).
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_SHR_S = 0x75;

/**
 * Shift right (unsigned).
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_SHR_U = 0x76;

/**
 * Rotate left.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_ROTL = 0x77;

/**
 * Rotate right.
 * Type signature: (param i32 i32) (result i32)
 */
export const WASM_I32_ROTR = 0x78;

/**
 * Count leading zeros.
 * It returns the number of leading zeros in its operand.
 * Type signature: (param i32) (result i32)
 */
export const WASM_I32_CLZ = 0x67;

/**
 * Count trailing zeros.
 * It returns the number of trailing zeros in its operand.
 * Type signature: (param i32) (result i32)
 */
export const WASM_I32_CTZ = 0x68;

/**
 * Population count.
 * It returns the number of 1-bits in its operand.
 * Type signature: (param i32) (result i32)
 */
export const WASM_I32_POPCNT = 0x69;

/**
 * Absolute value.
 * Type signature: (param f32) (result f32)
 */
export const WASM_F32_ABS = 0x8b;

/**
 * Absolute value.
 * Type signature: (param f64) (result f64)
 */
export const WASM_F64_ABS = 0x99;

/**
 * Floating-point addition.
 * Type signature: (param f32 f32) (result f32)
 */
export const WASM_F32_ADD = 0x92;

/**
 * Floating-point subtraction.
 * Type signature: (param f32 f32) (result f32)
 */
export const WASM_F32_SUB = 0x93;

/**
 * Floating-point multiplication.
 * Type signature: (param f32 f32) (result f32)
 */
export const WASM_F32_MUL = 0x94;

/**
 * Floating-point division.
 * Type signature: (param f32 f32) (result f32)
 */
export const WASM_F32_DIV = 0x95;

/**
 * Floating-point minimum.
 * Type signature: (param f32 f32) (result f32)
 */
export const WASM_F32_MIN = 0x96;

/**
 * Floating-point maximum.
 * Type signature: (param f32 f32) (result f32)
 */
export const WASM_F32_MAX = 0x97;

/**
 * Floating-point addition.
 * Type signature: (param f64 f64) (result f64)
 */
export const WASM_F64_ADD = 0xa0;

/**
 * Floating-point subtraction.
 * Type signature: (param f64 f64) (result f64)
 */
export const WASM_F64_SUB = 0xa1;

/**
 * Floating-point multiplication.
 * Type signature: (param f64 f64) (result f64)
 */
export const WASM_F64_MUL = 0xa2;

/**
 * Floating-point division.
 * Type signature: (param f64 f64) (result f64)
 */
export const WASM_F64_DIV = 0xa3;

/**
 * Floating-point minimum.
 * Type signature: (param f64 f64) (result f64)
 */
export const WASM_F64_MIN = 0xa4;

/**
 * Floating-point maximum.
 * Type signature: (param f64 f64) (result f64)
 */
export const WASM_F64_MAX = 0xa5;

/**
 * Round to nearest integer value, ties to even.
 * Type signature: (param f32) (result f32)
 */
export const WASM_F32_NEAREST = 0x90;

/**
 * Round to nearest integer value, ties to even.
 * Type signature: (param f64) (result f64)
 */
export const WASM_F64_NEAREST = 0x9e;

/**
 * Square root.
 * Type signature: (param f32) (result f32)
 */
export const WASM_F32_SQRT = 0x91;

/**
 * Square root (f64).
 * Type signature: (param f64) (result f64)
 */
export const WASM_F64_SQRT = 0x9f;

/**
 * Truncate Floating-Point to Integer, Signed
 * Type signature: (param f32) (result i32)
 */
export const WASM_I32_TUNC_F32_S = 0xa8;

/**
 * Convert Integer To Floating-Point, Signed
 * Type signature: (param i32) (result f32)
 */
export const WASM_F32_CONVERT_I32_S = 0xb2;

/**
 * Convert Integer To Floating-Point, Signed
 * Type signature: (param i32) (result f64)
 */
export const WASM_F64_CONVERT_I32_S = 0xb7;

/**
 * Promote 32-bit float to 64-bit float
 * Type signature: (param f32) (result f64)
 */
export const WASM_F64_PROMOTE_F32 = 0xbb;

/**
 * Miscellaneous instruction prefix.
 * The next unsigned LEB128 value selects a WASMMiscInstruction sub-opcode.
 */
export const WASM_MISC = 0xfc;

/**
 * Numeric opcode for a core WebAssembly instruction supported by this package.
 */
export type WASMInstructionCode =
	| typeof WASM_UNREACHABLE
	| typeof WASM_NOP
	| typeof WASM_BLOCK
	| typeof WASM_LOOP
	| typeof WASM_IF
	| typeof WASM_ELSE
	| typeof WASM_END
	| typeof WASM_BR
	| typeof WASM_BR_IF
	| typeof WASM_BR_TABLE
	| typeof WASM_RETURN
	| typeof WASM_CALL
	| typeof WASM_DROP
	| typeof WASM_SELECT
	| typeof WASM_LOCAL_GET
	| typeof WASM_GLOBAL_GET
	| typeof WASM_LOCAL_SET
	| typeof WASM_LOCAL_TEE
	| typeof WASM_I32_LOAD
	| typeof WASM_F32_LOAD
	| typeof WASM_F64_LOAD
	| typeof WASM_I32_LOAD_8_S
	| typeof WASM_I32_LOAD_8_U
	| typeof WASM_I32_LOAD_16_S
	| typeof WASM_I32_LOAD_16_U
	| typeof WASM_I32_STORE
	| typeof WASM_I32_STORE8
	| typeof WASM_I32_STORE16
	| typeof WASM_MEMORY_SIZE
	| typeof WASM_F32_STORE
	| typeof WASM_F64_STORE
	| typeof WASM_I32_CONST
	| typeof WASM_I64_CONTS
	| typeof WASM_F32_CONST
	| typeof WASM_F64_CONST
	| typeof WASM_I32_EQZ
	| typeof WASM_I32_EQ
	| typeof WASM_I32_NE
	| typeof WASM_I32_LT_S
	| typeof WASM_I32_LT_U
	| typeof WASM_I32_GT_S
	| typeof WASM_I32_GT_U
	| typeof WASM_I32_LE_S
	| typeof WASM_I32_LE_U
	| typeof WASM_I32_GE_S
	| typeof WASM_I32_GE_U
	| typeof WASM_F32_EQ
	| typeof WASM_F32_NE
	| typeof WASM_F32_LT
	| typeof WASM_F32_GT
	| typeof WASM_F32_LE
	| typeof WASM_F32_GE
	| typeof WASM_F64_EQ
	| typeof WASM_F64_NE
	| typeof WASM_F64_LT
	| typeof WASM_F64_GT
	| typeof WASM_F64_LE
	| typeof WASM_F64_GE
	| typeof WASM_I32_ADD
	| typeof WASM_I32_SUB
	| typeof WASM_I32_MUL
	| typeof WASM_I32_DIV_S
	| typeof WASM_I32_DIV_U
	| typeof WASM_I32_REM_S
	| typeof WASM_I32_AND
	| typeof WASM_I32_OR
	| typeof WASM_I32_XOR
	| typeof WASM_I32_SHL
	| typeof WASM_I32_SHR_S
	| typeof WASM_I32_SHR_U
	| typeof WASM_I32_ROTL
	| typeof WASM_I32_ROTR
	| typeof WASM_I32_CLZ
	| typeof WASM_I32_CTZ
	| typeof WASM_I32_POPCNT
	| typeof WASM_F32_ABS
	| typeof WASM_F64_ABS
	| typeof WASM_F32_ADD
	| typeof WASM_F32_SUB
	| typeof WASM_F32_MUL
	| typeof WASM_F32_DIV
	| typeof WASM_F32_MIN
	| typeof WASM_F32_MAX
	| typeof WASM_F64_ADD
	| typeof WASM_F64_SUB
	| typeof WASM_F64_MUL
	| typeof WASM_F64_DIV
	| typeof WASM_F64_MIN
	| typeof WASM_F64_MAX
	| typeof WASM_F32_NEAREST
	| typeof WASM_F64_NEAREST
	| typeof WASM_F32_SQRT
	| typeof WASM_F64_SQRT
	| typeof WASM_I32_TUNC_F32_S
	| typeof WASM_F32_CONVERT_I32_S
	| typeof WASM_F64_CONVERT_I32_S
	| typeof WASM_F64_PROMOTE_F32
	| typeof WASM_MISC;
