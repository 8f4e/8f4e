import { parseProjectSource } from '@8f4e/compiler';
import type { ProjectBlock } from '@8f4e/language-spec';
import { FORMAT_HEADER } from '@8f4e/project-preparser';
import { parseBlockDirectives } from '../../utils/parseBlockDirectives';
import removeDirective from '../../utils/removeDirective';

const PUBLIC_BLOCK_DIRECTIVE = 'public';

function hasPublicDirective(block: ProjectBlock): boolean {
	return parseBlockDirectives(block.code).some(
		directive => directive.prefix === '@' && directive.name === PUBLIC_BLOCK_DIRECTIVE
	);
}

export default function extractPublicBlockFromModuleSource(source: string): string[] {
	const lines = source.split('\n');
	if (lines[0]?.trim() !== FORMAT_HEADER) {
		return lines;
	}

	const project = parseProjectSource(source);
	const [publicBlock] = [
		...project.modules.filter(block => block.entry !== 'test'),
		...project.functions,
		...project.constants,
		...project.prototypes,
	].filter(hasPublicDirective);

	return publicBlock ? removeDirective(publicBlock.code, PUBLIC_BLOCK_DIRECTIVE) : [];
}
