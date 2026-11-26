import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseProjectSource } from '@8f4e/project-preparser';
import { compileToAST } from '@8f4e/tokenizer';
import { describe, expect, it } from 'vitest';

const stdlibRoot = fileURLToPath(new URL('../std/', import.meta.url));
const files = readdirSync(stdlibRoot, { recursive: true, encoding: 'utf8' })
	.filter(file => file.endsWith('.8f4e'))
	.sort();

describe('standard-library documentation', () => {
	it('ships function source files', () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it.each(files)('documents every declaration in %s', file => {
		const source = readFileSync(join(stdlibRoot, file), 'utf8');
		const { functions } = parseProjectSource(`8f4e/v1\n${source}`);
		expect(functions.length).toBeGreaterThan(0);
		for (const { code } of functions) {
			const ast = compileToAST(code, { kind: 'document' });
			if (ast.type !== 'function') throw new Error(`Expected a function in ${file}`);
			const { name, signature, documentation } = ast;
			const label = `${name}(${signature.parameters.map(parameter => parameter.type).join(', ')})`;
			expect(documentation?.description, label).toBeTruthy();
			for (const { name } of signature.parameters) {
				expect(documentation?.parameters && Object.hasOwn(documentation.parameters, name), `${label}: ${name}`).toBe(
					true
				);
				expect(documentation?.parameters?.[name], `${label}: ${name}`).toBeTruthy();
			}
			if (signature.returns.length > 0) expect(documentation?.returns, `${label}: return values`).toBeTruthy();
		}
	});
});
