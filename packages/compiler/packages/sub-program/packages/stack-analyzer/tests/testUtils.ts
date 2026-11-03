import type { CompilationContext } from '@8f4e/language-spec';
import { BlockType } from '@8f4e/language-spec';
import { createCompilationContext } from '@8f4e/semantic-utils';

export default function createStackAnalyzerTestContext(
	overrides: Partial<CompilationContext> = {}
): CompilationContext {
	return createCompilationContext({
		...overrides,
		namespace: { moduleName: 'test', ...overrides.namespace },
		blockStack: overrides.blockStack ?? [{ blockType: BlockType.MODULE, expectedResultTypes: [] }],
		codeBlockId: overrides.codeBlockId ?? 'test',
		codeBlockType: overrides.codeBlockType ?? 'module',
	});
}
