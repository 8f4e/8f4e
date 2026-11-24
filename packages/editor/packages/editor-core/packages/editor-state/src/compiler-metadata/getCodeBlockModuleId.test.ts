import { describe, expect, it } from 'vitest';
import { createMockCodeBlock } from '../__tests__/helpers/mockEditorState';
import getCodeBlockModuleId from './getCodeBlockModuleId';

describe('getCodeBlockModuleId', () => {
	it('derives module identity from the project path and block name', () => {
		const codeBlock = createMockCodeBlock({ name: 'voice', projectPath: 'audio' });

		expect(getCodeBlockModuleId(codeBlock)).toBe('audio/voice');
	});
});
