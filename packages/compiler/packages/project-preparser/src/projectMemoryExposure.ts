import { syntaxErrorAt } from '@8f4e/compiler-diagnostics';
import { isValidModuleName, type ProjectMemoryExposure, projectInstructions } from '@8f4e/language-spec';
import { SyntaxErrorCode } from '@8f4e/tokenizer';
import { startsWithInstruction } from './projectKeywords';

const EXPOSURE_INSTRUCTION = projectInstructions.expose;

function isValidNamedMemoryReference(value: string): boolean {
	return value.length > 0 && !/[&:.\s]/.test(value) && !/^\d+$/.test(value);
}

/** Parses one group-level `expose` declaration. */
export function parseProjectMemoryExposureLine(line: string, lineNumber: number): ProjectMemoryExposure {
	const [instruction, name, target, ...extra] = line.trim().split(/\s+/);
	if (
		instruction !== EXPOSURE_INSTRUCTION ||
		!isValidNamedMemoryReference(name ?? '') ||
		!target?.startsWith('&') ||
		extra.length > 0
	) {
		throw syntaxErrorAt(
			SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
			`Parse error at line ${lineNumber}: expected "expose <name> &<module>:<memory>"`,
			{ kind: 'document' },
			{ lineNumber: lineNumber - 1 }
		);
	}

	const targetParts = target.slice(1).split(':');
	const [targetModuleName, targetMemoryName] = targetParts;
	if (
		targetParts.length !== 2 ||
		!isValidModuleName(targetModuleName ?? '') ||
		!isValidNamedMemoryReference(targetMemoryName ?? '')
	) {
		throw syntaxErrorAt(
			SyntaxErrorCode.INVALID_BLOCK_STRUCTURE,
			`Parse error at line ${lineNumber}: expected "expose <name> &<module>:<memory>"`,
			{ kind: 'document' },
			{ lineNumber: lineNumber - 1 }
		);
	}

	return {
		name,
		targetModuleName,
		targetMemoryName,
	};
}

/** Parses an exposure line when valid, returning undefined for other or incomplete live-editor lines. */
export function tryParseProjectMemoryExposureLine(line: string): ProjectMemoryExposure | undefined {
	if (!startsWithInstruction(line.trim(), EXPOSURE_INSTRUCTION)) {
		return undefined;
	}

	try {
		return parseProjectMemoryExposureLine(line, 1);
	} catch {
		return undefined;
	}
}

/** Serializes one canonical project memory exposure. */
export function serializeProjectMemoryExposure(exposure: ProjectMemoryExposure): string {
	return `expose ${exposure.name} &${exposure.targetModuleName}:${exposure.targetMemoryName}`;
}
