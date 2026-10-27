import type { ProjectGroupObjectModel, ProjectModuleBlock, ProjectObjectModel } from '@8f4e/language-spec';
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

	if (lastNonEmptyIndex < 0) {
		throw new Error(`Block ${blockIndex}: missing closer`);
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
		...project.modules,
		...project.groups.flatMap(group => [group, ...getAllBlocks(group)]),
	];
}

function serializeGroup(group: ProjectGroupObjectModel): string[] {
	let closerIndex = group.code.length - 1;
	while (closerIndex >= 0 && group.code[closerIndex].trim() === '') closerIndex -= 1;

	return [
		...group.code.slice(0, closerIndex),
		...getDocumentBlocks(group).flatMap(block => block.code),
		...group.modules.flatMap(module => module.code),
		...group.groups.flatMap(serializeGroup),
		...group.code.slice(closerIndex),
	];
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
	const emittedEntries = new Set<string>();
	const modulesByEntry = new Map<string, ProjectModuleBlock[]>();
	const groupsByEntry = new Map<string, ProjectGroupObjectModel[]>();

	for (const module of project.modules) {
		const entryModules = modulesByEntry.get(module.entry) ?? [];
		entryModules.push(module);
		modulesByEntry.set(module.entry, entryModules);
	}
	for (const group of project.groups) {
		const entryGroups = groupsByEntry.get(group.entry) ?? [];
		entryGroups.push(group);
		groupsByEntry.set(group.entry, entryGroups);
	}

	for (const entry of [...project.modules.map(module => module.entry), ...project.groups.map(group => group.entry)]) {
		if (emittedEntries.has(entry)) continue;
		emittedEntries.add(entry);
		const entryModules = modulesByEntry.get(entry) ?? [];
		const entryGroups = groupsByEntry.get(entry) ?? [];
		blockStrings.push(
			[
				`entry ${entry}`,
				...entryModules.flatMap(moduleBlock => moduleBlock.code),
				...entryGroups.flatMap(serializeGroup),
				'entryEnd',
			].join('\n')
		);
	}

	return FORMAT_HEADER + '\n\n' + blockStrings.join('\n\n');
}
