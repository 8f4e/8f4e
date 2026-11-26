import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
	'editor/compositions/editor-default/vitest.config.ts',
	'compiler/vitest.config.ts',
	'compiler/packages/project-preparser/vitest.config.ts',
	'compiler/packages/sub-program/vitest.config.ts',
	'compiler/packages/sub-program/packages/tokenizer/vitest.config.ts',
	'editor/plugins/compiler/packages/compiler-worker/vitest.config.ts',
	'editor/core/editor-core/vitest.config.ts',
	'editor/core/editor-state/vitest.config.ts',
	'editor/plugins/audio-runtime/packages/runtime-audio-worklet/vitest.config.ts',
	'editor/plugins/worker-runtime/packages/runtime-web-worker/vitest.config.ts',
	'editor/core/sprite-generator/vitest.config.ts',
	'editor/core/state-manager/vitest.config.ts',
	'editor/core/web-ui/vitest.config.ts',
]);
