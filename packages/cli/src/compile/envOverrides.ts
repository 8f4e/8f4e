import type { ProjectObjectModel } from '@8f4e/language-spec';

// Arguments can be separated by whitespace or a source continuation.
const argumentGap = String.raw`(?:[ \t]+|(?:[ \t]*(?:;[^\r\n]*)?\r?\n)+[ \t]*-[ \t]+)`;
const envHeader = new RegExp(String.raw`^[ \t]*constants${argumentGap}env(?=\s|;|$)`);
const declaration = new RegExp(String.raw`^([ \t]*const${argumentGap})([^\s;]+)(${argumentGap})[^\s;]+`, 'gm');

/** Replaces the source value of each requested root env constant. */
export function applyEnvOverrides(project: ProjectObjectModel, overrides: ReadonlyMap<string, string>): void {
	const remaining = new Set(overrides.keys());
	for (const block of project.constants) {
		if (block.disabled) continue;
		const source = block.code.join('\n');
		if (!envHeader.test(source)) continue;

		block.code = source
			.replace(declaration, (match, prefix, name, gap) => {
				const value = overrides.get(name);
				if (value === undefined) return match;
				remaining.delete(name);
				return `${prefix}${name}${gap}${value}`;
			})
			.split('\n');
	}
	if (remaining.size > 0) {
		throw new Error(`Unknown root env constant: ${[...remaining].join(', ')}`);
	}
}
