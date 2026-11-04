import { walkProjectBlocks } from '@8f4e/editor-state';
import type { CodeError, State } from '@8f4e/editor-state-types';

export default function assertionErrors(state: State): CodeError[] {
	const disabledBlocks = new Set(
		[...walkProjectBlocks(state.codeBlockRendering.rootProject)]
			.filter(block => block.disabled)
			.map(block => block.creationIndex)
	);
	const failedSites = new Set<number>();
	return state.assertionResults.flatMap(({ site, passed, message }) => {
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
				codeBlockType: site.codeBlockType,
				lineNumber: site.lineNumber,
				message: message ?? 'Assertion failed',
			},
		];
	});
}
