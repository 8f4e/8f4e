import { resolvePalette } from '@8f4e/editor-palette';
import { createMockCodeBlock } from '@8f4e/editor-state-testing';
import init from '@8f4e/web-ui';
import { deriveCodeBlockCodeCells, type WebUiRenderDataSource } from '@8f4e/web-ui-render-projection';
import { expect, test } from 'vitest';
import createCanvas from './utils/createCanvas';
import createMockMemoryViews from './utils/createMockMemoryViews';
import createMockSpriteData from './utils/createMockSpriteData';
import createMockStateWithColors from './utils/createMockStateWithColors';

test('assertions cover line numbers without covering instructions', async () => {
	const canvas = createCanvas();
	canvas.width = 592;
	canvas.height = 240;
	const state = createMockStateWithColors();
	state.editorConfig.font = 'ibmvga8x16';
	state.viewport.width = canvas.width;
	state.viewport.height = canvas.height;
	const singleDigits = createMockCodeBlock({
		creationIndex: 0,
		blockType: 'module',
		x: 16,
		y: 16,
		width: 240,
		height: 96,
		lineNumberColumnWidth: 1,
		code: ['module singleDigits', 'push 1', 'assert', 'push 2', 'assertEqual 3', 'moduleEnd'],
	});
	const doubleDigits = createMockCodeBlock({
		creationIndex: 1,
		blockType: 'module',
		x: 280,
		y: 16,
		width: 288,
		height: 208,
		lineNumberColumnWidth: 2,
		code: [
			'module doubleDigits',
			'int value 1',
			'',
			'push value',
			'push 1',
			'add',
			'drop',
			'',
			'push 1',
			'assert',
			'push 2',
			'assertEqual 3',
			'moduleEnd',
		],
	});
	singleDigits.widgets.assertions = [
		{ lineNumber: 2, passed: true, x: 8, y: 32, width: 8, height: 16 },
		{ lineNumber: 4, passed: false, x: 8, y: 64, width: 8, height: 16 },
	];
	doubleDigits.widgets.assertions = [
		{ lineNumber: 9, passed: true, x: 8, y: 144, width: 16, height: 16 },
		{ lineNumber: 11, passed: false, x: 8, y: 176, width: 16, height: 16 },
	];
	state.codeBlockRendering.codeBlocks = [singleDigits, doubleDigits];
	const renderData: WebUiRenderDataSource = {
		getSnapshot: () => ({
			codeBlocks: new Map(
				state.codeBlockRendering.codeBlocks.map(block => [
					block.creationIndex,
					{ codeCells: deriveCodeBlockCodeCells(block, state.spriteLookups!) },
				])
			),
		}),
	};
	const renderer = await init(
		state,
		renderData,
		canvas,
		createMockMemoryViews(),
		await createMockSpriteData(state),
		resolvePalette(state.editorConfig.color)
	);
	try {
		renderer.pauseRendering();
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		renderer.destroy();
	}
});

test('assertion failures show expected and received values', async () => {
	const canvas = createCanvas();
	canvas.width = 480;
	canvas.height = 240;
	const state = createMockStateWithColors();
	state.editorConfig.font = 'ibmvga8x16';
	state.viewport.width = canvas.width;
	state.viewport.height = canvas.height;
	const block = createMockCodeBlock({
		creationIndex: 0,
		blockType: 'module',
		x: 16,
		y: 16,
		width: 432,
		minGridWidth: 54,
		height: 192,
		code: ['module checks', 'push 1', 'assert', 'push 10', 'assertEqual 9', 'push 0', 'assert', 'moduleEnd'],
	});
	block.gaps = new Map([
		[4, { size: 2 }],
		[6, { size: 2 }],
	]);
	block.widgets.assertions = [
		{ lineNumber: 2, passed: true, x: 8, y: 32, width: 8, height: 16 },
		{ lineNumber: 4, passed: false, x: 8, y: 64, width: 8, height: 16 },
		{ lineNumber: 6, passed: false, x: 8, y: 128, width: 8, height: 16 },
	];
	block.widgets.errorMessages = [
		{ x: 0, y: 80, lineNumber: 4, message: [' Error:', ' Assertion failed: expected 9, received 10'] },
		{ x: 0, y: 144, lineNumber: 6, message: [' Error:', ' Assertion failed: expected nonzero, received 0'] },
	];
	state.codeBlockRendering.codeBlocks = [block];
	const renderData: WebUiRenderDataSource = {
		getSnapshot: () => ({
			codeBlocks: new Map([
				[block.creationIndex, { codeCells: deriveCodeBlockCodeCells(block, state.spriteLookups!) }],
			]),
		}),
	};
	const renderer = await init(
		state,
		renderData,
		canvas,
		createMockMemoryViews(),
		await createMockSpriteData(state),
		resolvePalette(state.editorConfig.color)
	);
	try {
		renderer.pauseRendering();
		renderer.renderFrame();
		await expect(canvas).toMatchScreenshot();
	} finally {
		renderer.destroy();
	}
});
