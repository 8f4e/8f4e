import type { CodeBlockGraphicData, State } from '@8f4e/editor-state-types';
import { createChildProjectGroupPath } from '@8f4e/language-spec';
import isAssertionForCodeBlock from './features/assertions/isAssertionForCodeBlock';
import getCodeBlockGridWidth from './getCodeBlockGridWidth';
import wrapText from './utils/wrapText';

/** Combines source diagnostics and the first failed invocation of each assertion site. */
export default function deriveErrorMessages(
	codeBlock: CodeBlockGraphicData,
	state: State
): CodeBlockGraphicData['widgets']['errorMessages'] {
	const projectScopePath = codeBlock.isProjectScope
		? codeBlock.projectPath
		: codeBlock.childProject !== undefined
			? createChildProjectGroupPath(codeBlock.projectPath, codeBlock.name)
			: undefined;
	const errors: Array<{ lineNumber: number; message: string }> = [
		...state.codeErrors.compilationErrors,
		...state.codeErrors.editorDirectiveErrors,
	].filter(
		error =>
			codeBlock.creationIndex === error.codeBlockId ||
			(projectScopePath !== undefined && projectScopePath === error.projectGroupPath)
	);

	if (!state.compiler.isCompiling && !codeBlock.disabled) {
		const failedSites = new Set<number>();
		for (const assertion of state.assertionResults) {
			if (assertion.passed || !isAssertionForCodeBlock(assertion.site, codeBlock)) continue;
			if (failedSites.has(assertion.site.siteId)) continue;
			failedSites.add(assertion.site.siteId);
			errors.push({ lineNumber: assertion.site.lineNumber, message: assertion.message ?? 'Assertion failed' });
		}
	}

	const wrapWidth = getCodeBlockGridWidth(codeBlock.code, codeBlock.minGridWidth) - 1;
	return errors.map(error => ({
		x: 0,
		y: 0,
		message: [' Error:', ...wrapText(error.message, wrapWidth).map(line => ' ' + line)],
		lineNumber: error.lineNumber,
	}));
}
