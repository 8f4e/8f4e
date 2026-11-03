import { describe, expect, it } from 'vitest';
import { setup } from './__tests__/setup';

describe('code-block copy and paste', () => {
	it('copies ordinary block source in view mode', async () => {
		const test = setup();
		const block = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'same')!;
		test.store.set('editorMode', 'view');
		await test.events.dispatchAsync('copyCodeBlock', { codeBlock: block });
		expect(test.writeClipboardText).toHaveBeenCalledExactlyOnceWith(block.code.join('\n'));
	});
	it('pastes plain source at the requested position without changing names, groups or references', async () => {
		const test = setup();
		const source = ['module same', '; @pos 2 3', '; @group audio', 'push &same:value', 'moduleEnd'];
		await test.paste(source.join('\r\n'));
		const blocks = test.state.codeBlockRendering.currentProject.blocks.filter(block => block.blockType === 'module');
		expect(blocks.map(block => block.name)).toEqual(['same', 'same']);
		expect(blocks[1].code).toEqual(['module same', '; @pos 10 4', '; @group audio', 'push &same:value', 'moduleEnd']);
		expect(blocks[1].creationIndex).not.toBe(blocks[0].creationIndex);
	});
	it('pastes a batch with duplicate names, preserves metadata and relative positions, and publishes once', async () => {
		const test = setup();
		const before = test.state.projectChange.revision;
		const compiler = test.state.compilerInputRevision;
		await test.paste(
			JSON.stringify([
				{
					code: ['module same', '; @group audio', 'push &same:value', 'moduleEnd'],
					entry: 'audio',
					gridCoordinates: { x: 0, y: 0 },
				},
				{
					code: ['module same', '; @group audio', 'push &same:value', 'moduleEnd'],
					entry: 'audio',
					gridCoordinates: { x: 5, y: -1 },
				},
			])
		);
		const blocks = test.state.codeBlockRendering.currentProject.blocks
			.filter(block => block.blockType === 'module')
			.slice(1);
		expect(blocks.map(block => [block.name, block.gridX, block.gridY, block.entry])).toEqual([
			['same', 10, 4, 'audio'],
			['same', 15, 3, 'audio'],
		]);
		for (const block of blocks) {
			expect(block.code).toContain('; @group audio');
			expect(block.code).toContain('push &same:value');
		}
		expect(test.state.projectChange.revision).toBe(before + 1);
		expect(test.state.compilerInputRevision).toBe(compiler + 1);
	});
	it('round-trips a complete project-group tree without renaming any group', async () => {
		const test = setup();
		const sources = [
			{
				code: ['group voices', '; @pos 1 2', 'groupEnd'],
				gridCoordinates: { x: 0, y: 0 },
				childProject: {
					entries: ['unused', 'audio'],
					blocks: [
						{ code: ['module same', '; @pos 4 5', 'moduleEnd'], entry: 'audio', gridCoordinates: { x: 4, y: 5 } },
						{
							code: ['group inner', '; @pos 8 9', 'groupEnd'],
							gridCoordinates: { x: 8, y: 9 },
							childProject: { entries: ['quiet'], blocks: [] },
						},
					],
				},
			},
		];
		await test.paste(JSON.stringify(sources));
		const owner = test.state.codeBlockRendering.currentProject.blocks.filter(block => block.childProject)[0];
		await test.events.dispatchAsync('copyCodeBlock', { codeBlock: owner });
		const copied = test.writeClipboardText.mock.calls[0][0];
		await test.paste(copied, 160, 128);
		const again = test.state.codeBlockRendering.currentProject.blocks.filter(block => block.childProject)[1];
		expect(again.name).toBe('voices');
		expect(again.childProject?.entries).toEqual(['unused', 'audio']);
		expect(again.childProject?.blocks[0]).toMatchObject({
			name: 'same',
			entry: 'audio',
			projectPath: 'voices',
			gridX: 4,
			gridY: 5,
		});
		expect(again.childProject?.blocks[1].childProject).toMatchObject({
			path: 'voices/inner',
			entries: ['quiet'],
			blocks: [],
		});
		expect(again.code).toEqual(['group voices', '; @pos 20 8', 'groupEnd']);
	});
	it('handles a structured single ordinary block as a block payload', async () => {
		const test = setup();
		await test.paste(
			JSON.stringify([{ code: ['module same', 'moduleEnd'], entry: 'audio', gridCoordinates: { x: 0, y: 0 } }])
		);
		expect(
			test.state.codeBlockRendering.currentProject.blocks.filter(block => block.blockType === 'module')[1]
		).toMatchObject({ name: 'same', entry: 'audio' });
	});
	it('contributes its own menus and removes menus/actions on disposal', async () => {
		const test = setup();
		const block = test.state.codeBlockRendering.currentProject.blocks.find(block => block.name === 'same')!;
		expect((await test.openMenu()).map(item => item.action)).toContain('pasteCodeBlocks');
		expect((await test.openMenu(block)).map(item => item.action)).toContain('copyCodeBlock');
		test.store.set('editorMode', 'view');
		expect((await test.openMenu()).some(item => item.action === 'pasteCodeBlocks')).toBe(false);
		await test.paste('module ignored\nmoduleEnd');
		expect(test.readClipboardText).not.toHaveBeenCalled();
		test.dispose();
		test.store.set('editorMode', 'edit');
		expect((await test.openMenu()).some(item => item.action === 'pasteCodeBlocks')).toBe(false);
		expect((await test.openMenu(block)).some(item => item.action === 'copyCodeBlock')).toBe(false);
		await test.paste('module ignored\nmoduleEnd');
		await test.events.dispatchAsync('copyCodeBlock', { codeBlock: block });
		expect(test.readClipboardText).not.toHaveBeenCalled();
		expect(test.writeClipboardText).not.toHaveBeenCalled();
	});
});
