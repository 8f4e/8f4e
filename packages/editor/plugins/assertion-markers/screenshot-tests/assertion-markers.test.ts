import { compileProject, parseProjectSource } from '@8f4e/compiler';
import initEditor, { type Editor, type EditorPluginContext } from '@8f4e/editor-core';
import { serializeToProject } from '@8f4e/editor-state';
import { formatAssertionExpectation, runTests } from '@8f4e/test-runner';
import { afterEach, expect, test, vi } from 'vitest';
import { assertionMarkersPlugin } from '../src/index';

const cleanups: Array<() => void> = [];
afterEach(() => {
	while (cleanups.length) cleanups.pop()!();
});

async function setup(source: string) {
	const canvas = document.createElement('canvas');
	canvas.width = 992;
	canvas.height = 480;
	canvas.style.width = '992px';
	canvas.style.height = '480px';
	document.body.appendChild(canvas);
	let store!: EditorPluginContext['store'];
	const editor: Editor = await initEditor(canvas, {
		runtimeRegistry: {},
		initialProject: parseProjectSource(source),
		plugins: [
			assertionMarkersPlugin,
			{
				id: 'test-state',
				setup: context => {
					store = context.store;
					return () => {};
				},
			},
		],
	});
	cleanups.push(() => {
		editor.dispose();
		canvas.remove();
	});
	await vi.waitFor(() =>
		expect(editor.state.codeBlockRendering.codeBlocks.some(block => block.name === 'checks')).toBe(true)
	);
	editor.pauseRendering();
	const compiled = await compileProject(serializeToProject(editor.state), {
		enableAssertions: true,
		disableSharedMemory: true,
	});
	const result = await runTests(compiled);
	store.set(
		'assertionResults',
		result.assertions.map(assertion => ({
			site: assertion.site,
			passed: assertion.passed,
			...(!assertion.passed ? { message: `Assertion failed: ${formatAssertionExpectation(assertion)}` } : {}),
		}))
	);
	editor.state.viewport.x = 0;
	editor.state.viewport.y = 0;
	editor.renderFrame();
	return { editor, canvas, store };
}

test('covers one- and two-digit line numbers while leaving instructions visible', async () => {
	const { canvas } = await setup(`8f4e/v1
constants env
; @pos 4 60
constantsEnd
entry test
module checks
; @pos 2 1
; single digit assertion sites
push 1
assert
push 2
assertEqual 2
moduleEnd
module doubleDigits
; @pos 54 1
; double digit assertion sites
int value 1
push value
push 1
add
drop
push 1
assert
push 2
assertEqual 2
moduleEnd
entryEnd`);
	await expect(canvas).toMatchScreenshot('assertion-line-numbers');
});

test('renders markers beside inline assertion failure messages and clears them during compilation', async () => {
	const { editor, canvas, store } = await setup(`8f4e/v1
constants env
; @pos 4 60
constantsEnd
entry test
module checks
; @pos 2 1
; assertions report expected and received values
push 1
assert
push 10
assertEqual 9
push 0
assert
moduleEnd
entryEnd`);
	await expect(canvas).toMatchScreenshot('assertion-failure-messages');
	store.set('compiler.isCompiling', true);
	editor.renderFrame();
	await expect(canvas).toMatchScreenshot('assertion-recompiling');
});
