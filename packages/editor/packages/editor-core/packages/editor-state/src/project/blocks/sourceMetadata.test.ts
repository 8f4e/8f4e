import { describe, expect, it } from 'vitest';
import { createMockCodeBlock } from '~/__tests__/helpers/mockEditorState';
import { directiveDefinitions } from '../../directives/blockDirectiveRegistry';
import { refreshBlockSourceMetadata } from './refreshSourceMetadata';

describe('source metadata project scope', () => {
	it('recognizes a newly written root namespace pass', () => {
		const block = createMockCodeBlock({
			code: ['; project contract', 'pass env'],
			projectPath: '',
			blockType: 'unknown',
		});
		refreshBlockSourceMetadata(block, directiveDefinitions);
		expect(block.isProjectScope).toBe(true);
	});

	it('keeps an existing project-scope block while it is temporarily empty', () => {
		const block = createMockCodeBlock({ code: [''], projectPath: '', isProjectScope: true, blockType: 'unknown' });
		refreshBlockSourceMetadata(block, directiveDefinitions);
		expect(block.isProjectScope).toBe(true);
	});

	it('stops treating the block as project scope when it becomes a document block', () => {
		const block = createMockCodeBlock({
			code: ['module main', 'moduleEnd'],
			projectPath: '',
			isProjectScope: true,
			blockType: 'unknown',
		});
		refreshBlockSourceMetadata(block, directiveDefinitions);
		expect(block.isProjectScope).toBe(false);
		expect(block.blockType).toBe('module');
	});
});
