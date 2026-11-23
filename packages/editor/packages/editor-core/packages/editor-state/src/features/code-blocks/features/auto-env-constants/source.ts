import type { State } from '@8f4e/editor-state-types';
import type { ProjectBlock, ProjectObjectModel } from '@8f4e/language-spec';
import { getProjectBlockType } from '@8f4e/project-preparser';
import getHighestProjectBlockId from '../../../../pureHelpers/projectSerialization/getHighestProjectBlockId';
import getCodeBlockNameFromSource from '../../utils/getCodeBlockNameFromSource';
import { parseBlockDirectives } from '../../utils/parseBlockDirectives';
import parsePos from '../directives/pos/data';

const ENV_BLOCK_NAME = 'env';
const GENERATED_ENV_HEADER = ['; Auto-generated environment constants', '; Changes will be overwritten'] as const;

function isEnvironmentSource(code: string[]): boolean {
	return getProjectBlockType(code) === 'constants' && getCodeBlockNameFromSource(code) === ENV_BLOCK_NAME;
}

/** Build the auto-managed root constants block from currently contributed source. */
export function generateEnvironmentSource(
	contributions: State['envConstantContributions'],
	position: { x: number; y: number }
): string[] {
	const lines = [`constants ${ENV_BLOCK_NAME}`, `; @pos ${position.x} ${position.y}`, ...GENERATED_ENV_HEADER, ''];
	const nonempty = Object.values(contributions).filter(lines => lines.length > 0);
	for (const [index, contribution] of nonempty.entries()) {
		if (index > 0) lines.push('');
		lines.push(...contribution);
	}
	lines.push('', 'constantsEnd');
	return lines;
}

/** Preserve the sole root env's valid position; otherwise replace all root envs with a fresh block. */
export function prepareProjectEnvironmentSource(
	project: ProjectObjectModel,
	contributions: State['envConstantContributions']
): { project: ProjectObjectModel; environmentId: number } {
	const candidates = project.constants.filter(block => isEnvironmentSource(block.code));
	if (candidates.length !== 1) {
		const generated: ProjectBlock = {
			id: getHighestProjectBlockId(project) + 1,
			code: generateEnvironmentSource(contributions, { x: 0, y: 0 }),
		};
		const constants = project.constants.filter(block => !isEnvironmentSource(block.code));
		return { project: { ...project, constants: [generated, ...constants] }, environmentId: generated.id };
	}
	const [envBlock] = candidates;
	const position = parsePos(parseBlockDirectives(envBlock.code)) ?? { x: 0, y: 0 };
	const code = generateEnvironmentSource(contributions, position);
	// This is new generated source, not the old block's source-derived metadata.
	const constants = project.constants.map(block => (block === envBlock ? { id: envBlock.id, code } : block));
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
