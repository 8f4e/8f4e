import type { CodeError } from '@8f4e/editor-state-types';
import type { CompilerDiagnostic } from '@8f4e/language-spec';

/** Projects a complete diagnostic into generic editor errors without inventing a source target. */
export function diagnosticToCodeError(diagnostic: CompilerDiagnostic): CodeError {
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
	if (location.kind === 'include-file') {
		const fileMessage = `${location.includeId}:${location.lineNumber + 1}: ${message}`;
		return location.includeSite
			? {
					message: fileMessage,
					codeBlockId: location.includeSite.projectBlockId,
					lineNumber: location.includeSite.lineNumber,
				}
			: { message: fileMessage };
	}
	return { message, projectGroupPath: location.projectGroupPath, lineNumber: location.lineNumber };
}
