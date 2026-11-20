import { projectInstructions } from '@8f4e/language-spec';
import instructionParser from './instructionParser';

/** Blank lines and comments are preserved without being interpreted in project scopes. */
export function isProjectGapLine(line: string): boolean {
	const trimmed = line.trim();
	return trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith(';') || trimmed.startsWith('//');
}

type ProjectScopeDeclaration =
	| typeof projectInstructions.expose
	| typeof projectInstructions.init
	| typeof projectInstructions.pass;

type ProjectScopeLine =
	| { kind: 'gap' }
	| { kind: 'declaration'; instruction: ProjectScopeDeclaration }
	| { kind: 'group-delimiter'; instruction: 'group' | 'groupEnd' }
	| { kind: 'unsupported'; instruction: string };

/** Classifies a project-owned source line without interpreting its operands or resolving symbols. */
export function classifyProjectScopeLine(line: string): ProjectScopeLine {
	if (isProjectGapLine(line)) return { kind: 'gap' };
	const instruction = line.match(instructionParser)?.[1] ?? line.trim();
	switch (instruction) {
		case projectInstructions.expose:
		case projectInstructions.init:
		case projectInstructions.pass:
			return { kind: 'declaration', instruction };
		case projectInstructions.group.opener:
		case projectInstructions.group.closer:
			return { kind: 'group-delimiter', instruction };
		default:
			return { kind: 'unsupported', instruction };
	}
}
