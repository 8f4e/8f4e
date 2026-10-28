export interface DocumentationMatch {
	topic: string;
	title: string;
	summary: string;
}

export interface DocumentationEntry extends DocumentationMatch {
	terms: string;
	ranges: Array<[number, number]>;
	load(): Promise<string>;
}

export type ExampleKind = 'block' | 'project';

export interface ExampleMatch {
	kind: ExampleKind;
	path: string;
	title: string;
	category: string;
	summary: string;
	/** Paths of reusable example blocks referenced by this block. */
	dependencies: string[];
}

export interface ExampleEntry extends ExampleMatch {
	load(): Promise<string>;
}
