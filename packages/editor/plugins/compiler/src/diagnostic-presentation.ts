import { createCodeErrorBlockLookup } from '@8f4e/editor-state';
import type { CodeError, State } from '@8f4e/editor-state-types';
import type { CompilerDiagnostic } from '@8f4e/language-spec';

/** Projects a complete diagnostic into generic editor errors without inventing a source target. */
export function diagnosticToCodeError(diagnostic: CompilerDiagnostic, state: State): CodeError {
	const message =
		diagnostic.kind === 'internal'
			? `Internal compiler error (${diagnostic.stage}): ${diagnostic.message}`
			: diagnostic.message;
	const location = diagnostic.location;
	if (!location || location.kind === 'document') return { message };
	if (location.kind === 'block')
		return { message, codeBlockId: location.projectBlockId, lineNumber: location.lineNumber };
	if (location.kind === 'include')
		return {
			message: `${location.includeId} (${location.symbolName}): ${message}`,
			codeBlockId: location.includeSite.projectBlockId,
			lineNumber: location.includeSite.lineNumber,
		};
	if (location.kind === 'scope')
		return { message, projectGroupPath: location.projectGroupPath, lineNumber: location.lineNumber };
	const target = createCodeErrorBlockLookup(state.codeBlockRendering.rootProject)({
		message,
		projectGroupPath: location.projectGroupPath,
	});
	const lineNumber = target?.code.findIndex(line => {
		const [instruction, name] = line.trim().split(/\s+/);
		return instruction === 'expose' && name === location.name;
	});
	return lineNumber !== undefined && lineNumber >= 0
		? { message, projectGroupPath: location.projectGroupPath, lineNumber }
		: { message };
}
