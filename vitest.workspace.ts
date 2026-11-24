import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
	'packages/editor/packages/editor-default/vitest.config.ts',
	'packages/compiler/vitest.config.ts',
	'packages/compiler/packages/project-preparser/vitest.config.ts',
	'packages/compiler/packages/sub-program/vitest.config.ts',
	'packages/compiler/packages/sub-program/packages/tokenizer/vitest.config.ts',
	'packages/editor/packages/compiler-worker/vitest.config.ts',
	'packages/editor/packages/editor-core/vitest.config.ts',
	'packages/editor/packages/editor-core/packages/editor-state/vitest.config.ts',
	'packages/editor/plugins/audio-runtime/packages/runtime-audio-worklet/vitest.config.ts',
	'packages/editor/plugins/worker-runtime/packages/runtime-web-worker/vitest.config.ts',
	'packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/vitest.config.ts',
	'packages/editor/packages/editor-core/packages/state-manager/vitest.config.ts',
	'packages/editor/packages/editor-core/packages/web-ui/vitest.config.ts',
]);
