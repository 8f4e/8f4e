import { ArgumentType } from '@8f4e/language-spec';
import { describe, expect, it } from 'vitest';
import { parseProjectConstantNamespacePassLine } from './parseProjectConstantNamespacePassLine';
import { SyntaxErrorCode } from './syntax/syntaxError';

describe('parseProjectConstantNamespacePassLine', () => {
	it('parses one same-named namespace and ignores inline comments', () => {
		expect(parseProjectConstantNamespacePassLine('pass env ; required by child', 7)).toEqual({
			diagnosticSource: { kind: 'document' },
			instruction: 'pass',
			lineNumber: 7,
			arguments: [
				{
					type: ArgumentType.IDENTIFIER,
					value: 'env',
					referenceKind: 'plain',
					scope: 'local',
				},
			],
		});
	});

	it.each(['pass', 'pass env renamedEnv', 'pass invalid/name', 'pass 1env'])(
		'rejects invalid pass declaration %s',
		line => {
			expect(() => parseProjectConstantNamespacePassLine(line, 9)).toThrow(
				expect.objectContaining({ line: expect.objectContaining({ lineNumber: 9, instruction: 'pass' }) })
			);
		}
	);

	it('rejects instructions outside the project namespace grammar', () => {
		expect(() => parseProjectConstantNamespacePassLine('const SAMPLE_RATE 48000', 2)).toThrow(
			expect.objectContaining({ code: SyntaxErrorCode.UNRECOGNISED_INSTRUCTION })
		);
	});
});
