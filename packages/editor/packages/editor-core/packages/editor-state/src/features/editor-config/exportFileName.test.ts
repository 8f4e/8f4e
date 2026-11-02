import { describe, expect, it } from 'vitest';

import { EXPORT_FILE_NAME_CONFIG_PATH, exportFileNameEditorConfigValidator } from './exportFileName';

describe('export file name editor config', () => {
	it('validates export file name config path', () => {
		expect(
			exportFileNameEditorConfigValidator.validate({
				path: EXPORT_FILE_NAME_CONFIG_PATH,
				value: 'samplePlayer',
				sourceLineIndex: 1,
				codeBlockId: 0,
			})
		).toBeUndefined();
	});

	it('rejects empty export file names', () => {
		expect(
			exportFileNameEditorConfigValidator.validate({
				path: EXPORT_FILE_NAME_CONFIG_PATH,
				value: '',
				sourceLineIndex: 1,
				codeBlockId: 0,
			})
		).toBe('@config export.fileName: file name must be non-empty');
	});
});
