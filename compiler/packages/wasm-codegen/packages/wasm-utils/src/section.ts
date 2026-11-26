/**
 * WebAssembly section identifiers used in module section headers.
 */
export const Section = {
	CUSTOM: 0x00,
	TYPE: 0x01,
	IMPORT: 0x02,
	FUNCTION: 0x03,
	MEMORY: 0x05,
	EXPORT: 0x07,
	CODE: 0x0a,
	DATA: 0x0b,
	DATA_COUNT: 0x0c,
} as const;

/**
 * Numeric WebAssembly section identifier.
 */
export type SectionValue = (typeof Section)[keyof typeof Section];

/**
 * Custom name-section subsection identifiers.
 */
export const NameSection = {
	FUNCTION_NAME: 0x01,
	LOCAL_NAME: 0x02,
} as const;

/**
 * Numeric custom name-section subsection identifier.
 */
export type NameSectionValue = (typeof NameSection)[keyof typeof NameSection];

/**
 * WebAssembly import descriptor tags supported by this package.
 */
export const ImportDesc = {
	FUNC: 0x00,
	MEMORY: 0x02,
} as const;

/**
 * Numeric WebAssembly import descriptor tag.
 */
export type ImportDescValue = (typeof ImportDesc)[keyof typeof ImportDesc];

/**
 * WebAssembly export descriptor tags supported by this package.
 */
export const ExportDesc = {
	FUNC: 0x00,
} as const;

/**
 * Numeric WebAssembly export descriptor tag.
 */
export type ExportDescValue = (typeof ExportDesc)[keyof typeof ExportDesc];

/**
 * Encoded local declaration entry for a function body.
 */
export type LocalDeclaration = number[];

/**
 * Encoded WebAssembly function body.
 */
export type FunctionBody = number[];

/**
 * Encoded function export entry.
 */
export type FunctionExport = number[];

/**
 * Encoded WebAssembly function type entry.
 */
export type FunctionType = number[];

/**
 * Encoded function-name entry for the custom name section.
 */
export type FunctionName = number[];

/**
 * Encoded local-name entry for the custom name section.
 */
export type LocalName = number[];

/**
 * Encoded WebAssembly import entry.
 */
export type Import = number[];

/**
 * Encoded WebAssembly data segment.
 */
export type DataSegment = number[];

export default Section;
