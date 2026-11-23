import type { CodeBlockGraphicData, ProjectLevel, State } from '@8f4e/editor-state-types';
import type { ProjectBlock, ProjectObjectModel } from '@8f4e/language-spec';
import { getProjectBlockType } from '@8f4e/project-preparser';
import getHighestProjectBlockId from '../../../../pureHelpers/projectSerialization/getHighestProjectBlockId';
import getCodeBlockNameFromSource from '../../utils/getCodeBlockNameFromSource';
import { parseBlockDirectives } from '../../utils/parseBlockDirectives';
import parsePos from '../directives/pos/data';

const ENV_BLOCK_NAME = 'env';

function isEnvironmentSource(code: string[]): boolean {
	return getProjectBlockType(code) === 'constants' && getCodeBlockNameFromSource(code) === ENV_BLOCK_NAME;
}

export function findEnvironmentBlock(root: ProjectLevel): CodeBlockGraphicData | undefined {
	return root.blocks.find(block => block.blockType === 'constants' && block.name === ENV_BLOCK_NAME);
}

/** Build the auto-managed root constants block from currently contributed source. */
export function generateEnvironmentSource(
	contributions: State['envConstantContributions'],
	position: { x: number; y: number }
): string[] {
	const lines = [
		`constants ${ENV_BLOCK_NAME}`,
		`; @pos ${position.x} ${position.y}`,
		'; Auto-generated environment constants',
		'; Changes will be overwritten',
		'',
	];
	const nonempty = Object.values(contributions).filter(lines => lines.length > 0);
	for (const [index, contribution] of nonempty.entries()) {
		if (index > 0) lines.push('');
		lines.push(...contribution);
	}
	lines.push('', 'constantsEnd');
	return lines;
}

function sameSource(first: string[], second: string[]): boolean {
	return first.length === second.length && first.every((line, index) => line === second[index]);
}

/** Normalize the root env block before installing a project, preserving its identity and valid position. */
export function prepareProjectEnvironmentSource(
	project: ProjectObjectModel,
	contributions: State['envConstantContributions'],
	previousRoot?: ProjectLevel
): ProjectObjectModel {
	const envIndex = project.constants.findIndex(block => isEnvironmentSource(block.code));
	if (envIndex === -1) {
		const envBlock: ProjectBlock = {
			id: getHighestProjectBlockId(project) + 1,
			code: generateEnvironmentSource(contributions, { x: 0, y: 0 }),
		};
		return { ...project, constants: [envBlock, ...project.constants] };
	}
	const envBlock = project.constants[envIndex];
	const previous = previousRoot && findEnvironmentBlock(previousRoot);
	const fallback = previous?.creationIndex === envBlock.id ? { x: previous.gridX, y: previous.gridY } : { x: 0, y: 0 };
	const position = parsePos(parseBlockDirectives(envBlock.code)) ?? fallback;
	const code = generateEnvironmentSource(contributions, position);
	const constants = [...project.constants];
	// This is new generated source, not the old block's source-derived metadata.
	constants[envIndex] = { id: envBlock.id, code };
	return { ...project, constants };
}

/** Normalize a changed root env block inside its existing batch, before deriving source facts. */
export function normalizeEnvironmentBlockSources(state: State, blocks: readonly CodeBlockGraphicData[]): void {
	const root = state.codeBlockRendering.rootProject;
	const environment = blocks.find(block => root.blocks.includes(block) && isEnvironmentSource(block.code));
	if (!environment) return;
	const position = parsePos(parseBlockDirectives(environment.code)) ?? { x: environment.gridX, y: environment.gridY };
	const code = generateEnvironmentSource(state.envConstantContributions, position);
	if (!sameSource(environment.code, code)) environment.code = code;
}
