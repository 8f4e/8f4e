import type { ArgumentIdentifier, ArgumentLiteral } from './arguments';
import type { PlannedMemoryDeclaration } from './memory';

/** Project-level source instructions consumed before individual code blocks are tokenized. */
export const projectInstructions = {
	entry: { opener: 'entry', closer: 'entryEnd' },
	group: { opener: 'group', closer: 'groupEnd' },
	expose: 'expose',
	init: 'init',
	pass: 'pass',
} as const;

export const projectInstructionNames = [
	projectInstructions.entry.opener,
	projectInstructions.entry.closer,
	projectInstructions.group.opener,
	projectInstructions.group.closer,
	projectInstructions.expose,
	projectInstructions.init,
	projectInstructions.pass,
] as const;

export type ProjectInstructionName = (typeof projectInstructionNames)[number];

/** Stable identity shared by project actors and compiler diagnostics. */
export type ProjectBlockId = number;

/** Name of an entry local to one project scope. */
export type ProjectEntryName = string;

/** Resolved dispatcher input. Code generation consumes these identities and steps without resolving scope again. */
export interface ComposedEntry {
	id: string;
	exportName?: string;
	steps: Array<{ type: 'module' | 'entry'; id: string }>;
}

/** Human-readable name of one project group within its parent project. */
export type ProjectGroupName = string;

/** Canonical encoded path of a project group. The root project uses the empty path. */
export type ProjectGroupPath = string;

/** Canonical module identity shared by compiler results and project actors. */
export type ProjectModuleId = string;

/** Explicit same-name namespace forwarding from an immediate parent project scope. */
export interface ProjectConstantNamespacePassLine {
	lineNumber: number;
	instruction: 'pass';
	arguments: [ArgumentIdentifier];
}

/** Ordered namespace passes and their canonical parent relationship. */
export interface ProjectConstantNamespaceScope {
	groupPath: ProjectGroupPath;
	parentGroupPath?: ProjectGroupPath;
	passes: ProjectConstantNamespacePassLine[];
}

/** A default for group-local exposed scalar memory, using a number or immediate-parent memory address. */
export interface ProjectMemoryInitializerLine {
	lineNumber: number;
	instruction: 'init';
	arguments: [
		Extract<ArgumentIdentifier, { referenceKind: 'memory-reference' }>,
		ArgumentLiteral | Extract<ArgumentIdentifier, { referenceKind: 'intermodular-reference' }>,
	];
}

/** Initializers and the project scopes used to resolve their destinations and address sources. */
export interface ProjectMemoryInitializerScope {
	groupPath: ProjectGroupPath;
	parentGroupPath?: ProjectGroupPath;
	initializers: ProjectMemoryInitializerLine[];
}

/** Canonical path of the root project. */
export const ROOT_PROJECT_GROUP_PATH: ProjectGroupPath = '';

function encodeProjectPathSegment(segment: string): string {
	return encodeURIComponent(segment);
}

/** Returns the canonical path of a named child group. */
export function createChildProjectGroupPath(
	parentPath: ProjectGroupPath,
	groupName: ProjectGroupName
): ProjectGroupPath {
	const segment = encodeProjectPathSegment(groupName);
	return parentPath ? `${parentPath}/${segment}` : segment;
}

/** Returns the canonical identity of a module owned by the given group path. */
export function createProjectModuleId(groupPath: ProjectGroupPath, moduleName: string): ProjectModuleId {
	return groupPath ? `${groupPath}/${moduleName}` : moduleName;
}

/** Returns the canonical owning group path encoded in a module id. */
export function getProjectGroupPathFromModuleId(moduleId: ProjectModuleId): ProjectGroupPath {
	const separatorIndex = moduleId.lastIndexOf('/');
	return separatorIndex === -1 ? ROOT_PROJECT_GROUP_PATH : moduleId.slice(0, separatorIndex);
}

/** Source block fields shared by the canonical project collections. */
export interface ProjectBlock {
	id: ProjectBlockId;
	code: string[];
	disabled?: boolean;
}

/** Ordered executable block with required entry membership. */
export interface ProjectModuleBlock extends ProjectBlock {
	type: 'module';
	entry: ProjectEntryName;
}

/** Executable declarations in their shared order within one project scope. */
export type ProjectExecutableBlock = ProjectModuleBlock | ProjectGroupObjectModel;

/** Canonical in-memory representation shared by all 8f4e project actors. */
export interface ProjectObjectModel {
	/** Entry definitions local to this scope, including empty entries. */
	entries: ProjectEntryName[];
	/** Source lines owned directly by this project scope, excluding recursively owned document and group blocks. */
	code: string[];
	/** Ordered modules and groups. A group expands recursively at its position in this sequence. */
	execution: ProjectExecutableBlock[];
	/** Hoisted function blocks. */
	functions: ProjectBlock[];
	/** Hoisted constants blocks. */
	constants: ProjectBlock[];
	/** Hoisted prototype blocks. */
	prototypes: ProjectBlock[];
	/** Ordered include declarations expanded privately by the compiler. */
	includes: ProjectBlock[];
	/** Non-compiling project note blocks. */
	notes: ProjectBlock[];
	/** Incomplete or unclassified blocks retained by live editors. */
	unknown: ProjectBlock[];
}

/** A group-owned public memory name backed by a memory item in one of the group's direct modules. */
export interface ProjectMemoryExposure {
	/** Public name used by the enclosing project. */
	name: string;
	/** Source-level name of the direct child module that owns the target memory item. */
	targetModuleName: string;
	/** Source-level memory item name in the target module. */
	targetMemoryName: string;
}

/** Canonical direct-module target of one public group memory alias. */
export interface ProjectMemoryAliasTarget {
	targetModuleId: ProjectModuleId;
	targetMemoryId: string;
}

/**
 * Compiler-internal lookup of public group memory names to canonical direct-module targets.
 * The outer key is the public group path used as an intermodule id; the inner key is the exposed memory name.
 */
export type ProjectMemoryAliasLookup = ReadonlyMap<ProjectGroupPath, ReadonlyMap<string, ProjectMemoryAliasTarget>>;

/** Resolves a structured intermodule reference through the group alias lookup when one exists. */
export function resolveProjectMemoryAlias(
	aliases: ProjectMemoryAliasLookup,
	targetModuleId: ProjectModuleId,
	targetMemoryId: string
): ProjectMemoryAliasTarget {
	return aliases.get(targetModuleId)?.get(targetMemoryId) ?? { targetModuleId, targetMemoryId };
}

/** Named child project owned by another project object model. */
export interface ProjectGroupObjectModel extends ProjectObjectModel {
	type: 'group';
	id: ProjectBlockId;
	name: ProjectGroupName;
	/** Entry in the parent scope that invokes this project's main entry. */
	entry: ProjectEntryName;
	/** Ordered public memory aliases exposed to the enclosing project. */
	exposures: ProjectMemoryExposure[];
}

/** Creates an empty root or child project scope without introducing editor or compiler-stage policy. */
export function createProjectObjectModel(): ProjectObjectModel {
	return {
		entries: [],
		code: [],
		execution: [],
		functions: [],
		constants: [],
		prototypes: [],
		includes: [],
		notes: [],
		unknown: [],
	};
}

/** Selects direct modules without changing their execution order. */
export function getProjectModules(project: ProjectObjectModel): ProjectModuleBlock[] {
	return project.execution.filter(block => block.type === 'module');
}

/** Selects direct child groups without changing their execution order. */
export function getProjectGroups(project: ProjectObjectModel): ProjectGroupObjectModel[] {
	return project.execution.filter(block => block.type === 'group');
}

/** Compiler-resolved group exposure backed directly by the target's planned memory declaration. */
export interface ResolvedProjectMemoryExposure extends ProjectMemoryExposure {
	groupPath: ProjectGroupPath;
	targetModuleId: ProjectModuleId;
	targetMemory: PlannedMemoryDeclaration;
}

/** Resolved exposures indexed by the canonical path of the group that owns them. */
export type ProjectMemoryExposuresByGroupPath = Record<ProjectGroupPath, ResolvedProjectMemoryExposure[]>;

/** Host callback used to load a function include referenced by a project. */
export type ProjectIncludeResolver = (includeId: string) => string | Promise<string | undefined> | undefined;
