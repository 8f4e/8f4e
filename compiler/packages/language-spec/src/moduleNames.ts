/** Characters accepted by source-level module declarations. */
export const MODULE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/** Returns whether a source-level module name is safe to use as one segment of a canonical module id. */
export function isValidModuleName(moduleName: string): boolean {
	return MODULE_NAME_PATTERN.test(moduleName);
}
