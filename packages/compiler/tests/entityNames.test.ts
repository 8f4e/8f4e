import { SyntaxErrorCode } from '@8f4e/tokenizer';
import { describe, expect, it } from 'vitest';
import { compileProject, parseProjectSource } from '../src';
import { getExportedFunction } from './testUtils';

describe.each(['café', 'value🚀'])('compiler rejects non-ASCII entity name %s', name => {
	it.each([
		{ code: `function ${name}\n#export\npush 7\nfunctionEnd int`, instruction: 'function', lineNumber: 0 },
		{ code: `function example\n#export ${name}\npush 7\nfunctionEnd int`, instruction: '#export', lineNumber: 1 },
		{ code: `function example\nlocal int ${name}\nfunctionEnd`, instruction: 'local', lineNumber: 1 },
		{ code: `entry main\nmodule example\nint ${name} 7\nmoduleEnd\nentryEnd`, instruction: 'int', lineNumber: 1 },
	])('fails at $instruction before emitting WebAssembly', async ({ code, instruction, lineNumber }) => {
		await expect(compileProject(parseProjectSource(`8f4e/v1\n${code}`))).rejects.toMatchObject({
			name: 'SyntaxRulesError',
			code: SyntaxErrorCode.INVALID_IDENTIFIER,
			line: expect.objectContaining({ lineNumber, instruction }),
		});
	});
});

describe('compiler ASCII entity names', () => {
	it('compiles punctuation, constants, prototypes, and references into executable WebAssembly', async () => {
		const project = parseProjectSource(`8f4e/v1
constants config!$
const VALUE!$_0 7
constantsEnd
prototype state!$
int field!$ 3
prototypeEnd
function compute!$
#export result!$
use config!$
param int input!$
local int saved!$
push input!$
localSet saved!$
push saved!$
push VALUE!$_0
add
functionEnd int
entry main
module _example_1
shape state!$
int output!$
push &output!$
call compute!$ field!$
store
moduleEnd
entryEnd`);
		const result = await compileProject(project, { disableSharedMemory: true });
		const bytes = new Uint8Array(result.codeBuffer);
		expect(WebAssembly.validate(bytes)).toBe(true);
		const memory = new WebAssembly.Memory({ initial: 1, maximum: 1 });
		const { instance } = await WebAssembly.instantiate(bytes, { host: { memory } });
		getExportedFunction(instance.exports, 'initDefaults')();
		getExportedFunction(instance.exports, 'main')();
		expect(getExportedFunction(instance.exports, 'result!$')(5)).toBe(12);
		const output = result.memoryPlan.modules._example_1.memory['output!$'].byteAddress;
		expect(new DataView(memory.buffer).getInt32(output, true)).toBe(10);
	});
});
