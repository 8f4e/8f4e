import type { ProjectGroupObjectModel, ProjectObjectModel } from '@8f4e/language-spec';
import {
	FORMAT_HEADER,
	getExpectedProjectCloserPrefix,
	getProjectCloserKeyword,
	getProjectOpenerKeyword,
} from '@8f4e/project-preparser';

function validateCodeBlock(code: string[], blockIndex: number): void {
	// Find first non-empty line (must be opener)
	const firstNonEmptyLine = code.find(line => line.trim() !== '');
	if (!firstNonEmptyLine) {
		throw new Error(`Block ${blockIndex}: block has no content`);
	}

	const opener = getProjectOpenerKeyword(firstNonEmptyLine.trim());
	if (!opener) {
		throw new Error(`Block ${blockIndex}: unknown or missing opener "${firstNonEmptyLine.trim()}"`);
	}

	const expectedCloserPrefix = getExpectedProjectCloserPrefix(opener);
	const firstLineIndex = code.indexOf(firstNonEmptyLine);

	// Find last non-empty line (must be matching closer)
	let lastNonEmptyIndex = code.length - 1;
	while (lastNonEmptyIndex >= 0 && code[lastNonEmptyIndex].trim() === '') {
		lastNonEmptyIndex--;
	}

	const closerLine = code[lastNonEmptyIndex].trim();
	const closer = getProjectCloserKeyword(closerLine);
	if (!closer) {
		throw new Error(`Block ${blockIndex}: unknown or missing closer "${closerLine}"`);
	}

	if (!closer.startsWith(expectedCloserPrefix)) {
		throw new Error(`Block ${blockIndex}: opener/closer mismatch (opener "${opener}", closer "${closer}")`);
	}

	// Scan inside block for mixed markers or early closer
	for (let i = firstLineIndex + 1; i < lastNonEmptyIndex; i++) {
		const lineTrimmed = code[i].trim();
		if (lineTrimmed === '') continue;

		const innerOpener = getProjectOpenerKeyword(lineTrimmed);
		if (innerOpener) {
			throw new Error(
				`Block ${blockIndex}: mixed block type markers (found opener "${lineTrimmed}" inside "${opener}" block)`
			);
		}

		const innerCloser = getProjectCloserKeyword(lineTrimmed);
		if (innerCloser) {
			throw new Error(`Block ${blockIndex}: closer "${lineTrimmed}" is not at the end of the block`);
		}
	}
}

function getDocumentBlocks(project: ProjectObjectModel) {
	return [
		...project.includes,
		...project.functions,
		...project.constants,
		...project.prototypes,
		...project.notes,
		...project.unknown,
	];
}

function getAllBlocks(project: ProjectObjectModel): Array<{ code: string[] }> {
	return [
		...getDocumentBlocks(project),
		...project.execution.flatMap(block => (block.type === 'group' ? [block, ...getAllBlocks(block)] : [block])),
	];
}

function serializeGroup(group: ProjectGroupObjectModel): string[] {
	let closerIndex = group.code.length - 1;
	while (closerIndex >= 0 && group.code[closerIndex].trim() === '') closerIndex -= 1;

	return [
		...group.code.slice(0, closerIndex),
		...getDocumentBlocks(group).flatMap(block => block.code),
		...serializeExecution(group),
		...group.code.slice(closerIndex),
	];
}

/** Entry sections can reopen, so group placement stays shared across all participating entries. */
function serializeExecution(project: ProjectObjectModel): string[] {
	const result: string[] = [];
	const emitted = new Set<string>();
	let current: string | undefined;
	const close = () => {
		if (current !== undefined) result.push('entryEnd');
		current = undefined;
	};
	for (const block of project.execution) {
		if (current !== block.entry) {
			close();
			current = block.entry;
			result.push(`entry ${current}`);
			emitted.add(current);
		}
		if (block.type === 'group') result.push(...serializeGroup(block));
		else result.push(...block.code);
	}
	close();
	for (const entry of project.entries) if (!emitted.has(entry)) result.push(`entry ${entry}`, 'entryEnd');
	return result;
}

/**
 * Serializes a ProjectObjectModel to .8f4e text format.
 * Throws if any code block fails export-gate validation.
 */
export function serializeProjectTo8f4e(project: ProjectObjectModel): string {
	const documentBlocks = getDocumentBlocks(project);
	const allBlocks = getAllBlocks(project);

	for (let i = 0; i < allBlocks.length; i++) {
		validateCodeBlock(allBlocks[i].code, i);
	}

	const blockStrings = [
		...(project.code.length > 0 ? [project.code.join('\n')] : []),
		...documentBlocks.map(block => block.code.join('\n')),
	];
	const execution = serializeExecution(project);
	if (execution.length) blockStrings.push(execution.join('\n'));

	return FORMAT_HEADER + '\n\n' + blockStrings.join('\n\n');
}
