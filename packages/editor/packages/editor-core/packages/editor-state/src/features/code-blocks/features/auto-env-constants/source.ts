import type { State } from '@8f4e/editor-state-types';
import { getProjectBlockType } from '@8f4e/project-preparser';
import getCodeBlockNameFromSource from '../../utils/getCodeBlockNameFromSource';

const ENV_BLOCK_NAME = 'env';
const GENERATED_ENV_HEADER = ['; Auto-generated environment constants', '; Changes will be overwritten'] as const;

export function isEnvironmentSource(code: string[]): boolean {
	return getProjectBlockType(code) === 'constants' && getCodeBlockNameFromSource(code) === ENV_BLOCK_NAME;
}

/** Build the auto-managed root constants block at the origin from current contributions. */
export function generateEnvironmentSource(contributions: State['envConstantContributions']): string[] {
	const lines = [`constants ${ENV_BLOCK_NAME}`, '; @pos 0 0', ...GENERATED_ENV_HEADER, ''];
	const nonempty = Object.values(contributions).filter(lines => lines.length > 0);
	for (const [index, contribution] of nonempty.entries()) {
		if (index > 0) lines.push('');
		lines.push(...contribution);
	}
	lines.push('', 'constantsEnd');
	return lines;
}
