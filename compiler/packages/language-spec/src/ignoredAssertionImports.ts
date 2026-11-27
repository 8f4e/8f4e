import { ASSERTION_IMPORT_NAMES } from './assertions';

const ignoreAssertion = () => {};

/** Wasm host callbacks for instances that do not collect assertion results. */
export const IGNORED_ASSERTION_IMPORTS = {
	[ASSERTION_IMPORT_NAMES.assert]: ignoreAssertion,
	[ASSERTION_IMPORT_NAMES.assertEqual.int]: ignoreAssertion,
	[ASSERTION_IMPORT_NAMES.assertEqual.float]: ignoreAssertion,
	[ASSERTION_IMPORT_NAMES.assertEqual.float64]: ignoreAssertion,
};
