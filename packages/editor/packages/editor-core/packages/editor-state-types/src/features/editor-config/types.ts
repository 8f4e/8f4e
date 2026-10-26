export interface JSONSchemaLike {
	type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
	format?: string;
	properties?: Record<string, JSONSchemaLike>;
	required?: readonly string[];
	items?: JSONSchemaLike;
	additionalProperties?: boolean | JSONSchemaLike;
	enum?: readonly unknown[];
	oneOf?: readonly JSONSchemaLike[];
	anyOf?: readonly JSONSchemaLike[];
	minimum?: number;
	pattern?: string;
}

export type EditorConfigPrimitiveValue = string | number | boolean;
export type EditorConfigValue = EditorConfigPrimitiveValue | EditorConfigObject | EditorConfigValue[];

export interface EditorConfigObject {
	[key: string]: EditorConfigValue | undefined;
}

export interface EditorConfig extends EditorConfigObject {
	font?: string;
	runtime?: string;
	recompileDebounceDelay?: number;
	color?: EditorConfigObject;
	export?: EditorConfigObject & {
		fileName?: string;
	};
}

export interface EditorConfigSchemaContribution {
	root: string;
	defaults?: Record<string, unknown>;
	schema: JSONSchemaLike;
}

export interface EditorConfigSchemaContributionRegistry {
	[contributionId: string]: EditorConfigSchemaContribution | undefined;
}

export interface EditorConfigEntry {
	path: string;
	value: string;
	sourceLineIndex: number;
	codeBlockId: number;
	moduleId?: string;
}

export type EditorConfigValidator = {
	knownPaths: string[];
	matches: (path: string) => boolean;
	validate: (entry: EditorConfigEntry) => string | undefined;
	parse?: (entry: EditorConfigEntry) => EditorConfigValue;
};

export interface EditorConfigValidatorRegistry {
	[featureId: string]: EditorConfigValidator | undefined;
}
