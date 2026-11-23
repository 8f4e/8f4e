import type { CodeBlockGraphicData, ProjectLevel, State } from '@8f4e/editor-state-types';
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

function isGeneratedHeaderAt(code: string[], index: number): boolean {
	return code[index] === GENERATED_ENV_HEADER[0] && code[index + 1] === GENERATED_ENV_HEADER[1];
}

/** The generated header persists ownership through text serialization, independently of block order and IDs. */
function selectEnvironmentBlock<T extends { code: string[] }>(blocks: readonly T[]): T | undefined {
	const candidates = blocks.filter(block => isEnvironmentSource(block.code));
	const generated = candidates.filter(block => block.code.some((_, index) => isGeneratedHeaderAt(block.code, index)));
	if (generated.length === 1) return generated[0];
	// A single unmarked env may declare the generated block's initial position. Never adopt arbitrary
	// authored source if there are multiple candidates or conflicting ownership headers.
	if (generated.length === 0 && candidates.length === 1) return candidates[0];
}

/** Copies and edits of other root env blocks cannot claim the managed block's persisted identity. */
export function clearEnvironmentOwnership(code: string[]): string[] {
	if (!code.some((_, index) => isGeneratedHeaderAt(code, index)) || !isEnvironmentSource(code)) return code;
	return code.filter((_, index) => !isGeneratedHeaderAt(code, index) && !isGeneratedHeaderAt(code, index - 1));
}

export function findEnvironmentBlock(root: ProjectLevel): CodeBlockGraphicData | undefined {
	return selectEnvironmentBlock(root.blocks);
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

/** Normalize the root env block before installing a project, preserving its identity and valid position. */
export function prepareProjectEnvironmentSource(
	project: ProjectObjectModel,
	contributions: State['envConstantContributions'],
	previousEnvironment?: CodeBlockGraphicData
): { project: ProjectObjectModel; environmentId: number } {
	const envBlock = selectEnvironmentBlock(project.constants);
	const constants = project.constants.map(block => {
		if (block === envBlock) return block;
		const code = clearEnvironmentOwnership(block.code);
		return code === block.code ? block : { ...block, code };
	});
	if (!envBlock) {
		const generated: ProjectBlock = {
			id: getHighestProjectBlockId(project) + 1,
			code: generateEnvironmentSource(contributions, { x: 0, y: 0 }),
		};
		return { project: { ...project, constants: [generated, ...constants] }, environmentId: generated.id };
	}
	const fallback =
		previousEnvironment?.creationIndex === envBlock.id
			? { x: previousEnvironment.gridX, y: previousEnvironment.gridY }
			: { x: 0, y: 0 };
	const position = parsePos(parseBlockDirectives(envBlock.code)) ?? fallback;
	const code = generateEnvironmentSource(contributions, position);
	// This is new generated source, not the old block's source-derived metadata.
	constants[constants.indexOf(envBlock)] = { id: envBlock.id, code };
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
