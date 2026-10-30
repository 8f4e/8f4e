import { parseProjectSource } from '@8f4e/compiler';
import { parseBlockDirectives, removeDirective } from '@8f4e/editor-state';

export default function extractPublicBlockFromModuleSource(source: string): string[] {
	const project = parseProjectSource(source);
	const publicBlock = [
		...project.modules.filter(block => block.entry !== 'test'),
		...project.functions,
		...project.constants,
		...project.prototypes,
		...project.notes,
	].find(block => parseBlockDirectives(block.code).some(directive => directive.name === 'public'))!;
	return removeDirective(publicBlock.code, 'public');
}
