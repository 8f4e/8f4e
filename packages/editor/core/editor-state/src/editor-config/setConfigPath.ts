import type { EditorConfig, EditorConfigValue } from '@8f4e/editor-state-types';

export function setPathValue(target: Record<string, unknown>, path: string, value: EditorConfigValue): void {
	const segments = path.split('.');
	const leafSegment = segments[segments.length - 1];
	let current = target;

	for (let i = 0; i < segments.length - 1; i++) {
		const segment = segments[i];
		const existing = current[segment];

		if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
			const next: Record<string, unknown> = {};
			current[segment] = next;
			current = next;
			continue;
		}

		current = existing as Record<string, unknown>;
	}

	current[leafSegment] = value;
}

export function setEditorConfigPath(config: EditorConfig, path: string, value: EditorConfigValue): void {
	setPathValue(config, path, value);
}
