import type { ProjectGroupObjectModel, ProjectObjectModel } from '@8f4e/language-spec';
import { extractProjectTemplates, FORMAT_HEADER, validateProjectCodeBlock } from '@8f4e/project-preparser';

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
		validateProjectCodeBlock(allBlocks[i].code, i);
	}

	const blockStrings = [
		...(project.code.length > 0 ? [project.code.join('\n')] : []),
		...documentBlocks.map(block => block.code.join('\n')),
	];
	const execution = serializeExecution(project);
	if (execution.length) blockStrings.push(execution.join('\n'));

	return extractProjectTemplates(FORMAT_HEADER + '\n\n' + blockStrings.join('\n\n'));
}
