import { walkProjectBlocks } from '@8f4e/editor-state';
import type { CodeError, ProjectLevel } from '@8f4e/editor-state-types';
import { formatAssertionExpectation, type TestAssertionResult } from '@8f4e/test-runner';

export default function assertionErrors(assertions: TestAssertionResult[], rootProject: ProjectLevel): CodeError[] {
	const disabledBlocks = new Set(
		[...walkProjectBlocks(rootProject)].filter(block => block.disabled).map(block => block.creationIndex)
	);
	const failedSites = new Set<number>();
	return assertions.flatMap(assertion => {
		const { site, passed } = assertion;
		if (
			passed ||
			site.source ||
			site.projectBlockId === undefined ||
			disabledBlocks.has(site.projectBlockId) ||
			failedSites.has(site.siteId)
		)
			return [];
		failedSites.add(site.siteId);
		return [
			{
				codeBlockId: site.projectBlockId,
				lineNumber: site.lineNumber,
				message: `Assertion failed: ${formatAssertionExpectation(assertion)}`,
			},
		];
	});
}
