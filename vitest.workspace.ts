import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
	'packages/editor/compositions/editor-default/vitest.config.ts',
	'packages/compiler/vitest.config.ts',
	'packages/compiler/packages/project-preparser/vitest.config.ts',
	'packages/compiler/packages/sub-program/vitest.config.ts',
	'packages/compiler/packages/sub-program/packages/tokenizer/vitest.config.ts',
	'packages/editor/plugins/compiler/packages/compiler-worker/vitest.config.ts',
	'packages/editor/core/editor-core/vitest.config.ts',
	'packages/editor/core/editor-state/vitest.config.ts',
	'packages/editor/plugins/audio-runtime/packages/runtime-audio-worklet/vitest.config.ts',
	'packages/editor/plugins/worker-runtime/packages/runtime-web-worker/vitest.config.ts',
	'packages/editor/core/sprite-generator/vitest.config.ts',
	'packages/editor/core/state-manager/vitest.config.ts',
	'packages/editor/core/web-ui/vitest.config.ts',
]);
