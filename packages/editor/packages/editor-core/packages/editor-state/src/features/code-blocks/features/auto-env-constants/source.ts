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
	return root.blocks.find(block => isEnvironmentSource(block.code));
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

/** Normalize the root env block before installing a project, preserving its identity and valid position. */
export function prepareProjectEnvironmentSource(
	project: ProjectObjectModel,
	contributions: State['envConstantContributions'],
	previousEnvironment?: CodeBlockGraphicData
): { project: ProjectObjectModel; environmentId: number } {
	const previousIndex = previousEnvironment
		? project.constants.findIndex(
				block => block.id === previousEnvironment.creationIndex && isEnvironmentSource(block.code)
			)
		: -1;
	const envIndex =
		previousIndex === -1 ? project.constants.findIndex(block => isEnvironmentSource(block.code)) : previousIndex;
	if (envIndex === -1) {
		const envBlock: ProjectBlock = {
			id: getHighestProjectBlockId(project) + 1,
			code: generateEnvironmentSource(contributions, { x: 0, y: 0 }),
		};
		return { project: { ...project, constants: [envBlock, ...project.constants] }, environmentId: envBlock.id };
	}
	const envBlock = project.constants[envIndex];
	const fallback =
		previousEnvironment?.creationIndex === envBlock.id
			? { x: previousEnvironment.gridX, y: previousEnvironment.gridY }
			: { x: 0, y: 0 };
	const position = parsePos(parseBlockDirectives(envBlock.code)) ?? fallback;
	const code = generateEnvironmentSource(contributions, position);
	const constants = [...project.constants];
	// This is new generated source, not the old block's source-derived metadata.
	constants[envIndex] = { id: envBlock.id, code };
	return { project: { ...project, constants }, environmentId: envBlock.id };
}

/** A managed env block accepts only its authored position; its opener and body remain generated. */
export function normalizeEnvironmentSource(
	code: string[],
	contributions: State['envConstantContributions'],
	fallback: { x: number; y: number }
): string[] {
	const position = parsePos(parseBlockDirectives(code)) ?? fallback;
	return generateEnvironmentSource(contributions, position);
}
