import { createMockCodeBlock, createMockState } from '@8f4e/editor-state-testing';
import { describe, expect, it, vi } from 'vitest';

import { createLayoutRegistry } from '../../../layout/registry';
import registerInfoLayout from './layout';

function refreshInfo(graphicData: ReturnType<typeof createMockCodeBlock>, state: ReturnType<typeof createMockState>) {
	const layout = createLayoutRegistry(() => {});
	registerInfoLayout(layout);
	return () => {
		layout.publish({ codeBlock: graphicData, state });
		graphicData.minGridWidth = layout.getContribution(graphicData).minGridWidth;
	};
}

function createInfoBlock(overrides: Parameters<typeof createMockCodeBlock>[0] = {}) {
	const code = overrides.code ?? ['module foo', '; @info foo', 'moduleEnd'];

	return createMockCodeBlock({
		...overrides,
		code,
		parsedDirectives: [
			{
				prefix: '@',
				name: 'info',
				args: ['foo'],
				sourceLineIndex: 1,
				sourceLine: code[1],
				isTrailing: false,
			},
		],
	});
}

describe('info directive widget resolution', () => {
	it('adds an info panel sized from state.info entries', () => {
		const state = createMockState({
			info: {
				foo: {
					a: 1,
					bar: 'foo',
					foo: 'something longer',
					skipped: { nested: true },
				},
			},
		});
		const graphicData = createInfoBlock({
			code: ['module foo', '; @info foo', 'moduleEnd'],
			width: 240,
			lineNumberColumnWidth: 1,
			gaps: new Map([[1, { size: 3 }]]),
		});
		refreshInfo(graphicData, state)();

		expect(graphicData.widgets.infoPanels).toEqual([
			{
				width: 216,
				height: 48,
				x: 24,
				y: 32,
				id: 'foo',
				rowCount: 3,
				keyColumnWidth: 3,
			},
		]);
	});

	it('uses rounded float values when calculating panel width', () => {
		const state = createMockState({
			info: {
				foo: {
					value: 1.234567,
					skipped: { nested: true },
				},
			},
		});
		const graphicData = createInfoBlock({
			code: ['module foo', '; @info foo', 'moduleEnd'],
			lineNumberColumnWidth: 1,
			gaps: new Map([[1, { size: 1 }]]),
		});
		refreshInfo(graphicData, state)();

		expect(graphicData.minGridWidth).toBe(17);
	});

	it('updates the code block cache timestamp when the rendered info row count changes', () => {
		const state = createMockState({
			info: {
				foo: {
					a: 1,
				},
			},
		});
		const graphicData = createInfoBlock({
			code: ['module foo', '; @info foo', 'moduleEnd'],
			lastUpdated: 1000,
		});
		const dateNow = vi.spyOn(Date, 'now').mockReturnValue(2000);

		const refresh = refreshInfo(graphicData, state);
		refresh();
		expect(graphicData.lastUpdated).toBe(1000);

		state.info.foo = {
			a: 1,
			b: 2,
		};
		refresh();

		expect(graphicData.lastUpdated).toBe(2000);
		dateNow.mockRestore();
	});

	it('does not update the code block cache timestamp when the rendered info row count is unchanged', () => {
		const state = createMockState({
			info: {
				foo: {
					a: 1,
				},
			},
		});
		const graphicData = createInfoBlock({
			code: ['module foo', '; @info foo', 'moduleEnd'],
			lastUpdated: 1000,
		});
		const dateNow = vi.spyOn(Date, 'now').mockReturnValue(2000);

		const refresh = refreshInfo(graphicData, state);
		refresh();

		state.info.foo = {
			a: 2,
		};
		refresh();

		expect(graphicData.lastUpdated).toBe(1000);
		expect(dateNow).not.toHaveBeenCalled();
		dateNow.mockRestore();
	});
});
