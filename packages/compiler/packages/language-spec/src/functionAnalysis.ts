/** Structural facts about one concrete function, independent of optimization policy. */
export interface FunctionAnalysis {
	/** The function is supplied by a host import and has no compiled source body. */
	isImported: boolean;
	/** The executable body contains an explicit `return`, including a final return. */
	hasExplicitReturn: boolean;
	/** A `return` occurs before the end of the executable body, including inside a nested block. */
	hasEarlyReturn: boolean;
	/** The function participates in a call cycle, directly or through functions, entries, or modules. */
	isRecursive: boolean;
}
