import type { State } from '@8f4e/editor-state-types';

export default function getExportBaseName(state: State): string {
	const exportFileName = state.editorConfig.export?.fileName;
	if (!exportFileName) {
		return 'project';
	}
	return exportFileName.replace(/\.(wasm|8f4e)$/, '');
}
