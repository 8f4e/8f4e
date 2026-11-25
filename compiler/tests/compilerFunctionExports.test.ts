import { describe, expect, it } from 'vitest';
import { getExportedFunction, instantiateFixtureProgramSource } from './testUtils';

describe('function names matching object properties', () => {
	it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
		'exports %s under an ordinary alias',
		async name => {
			const fixture = await instantiateFixtureProgramSource(`8f4e/v1
function ${name}
#export answer
push 7
functionEnd int`);
			expect(getExportedFunction(fixture.instance.exports, 'answer')()).toBe(7);
		}
	);

	it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
		'resolves valid %s overloads through exported callers',
		async name => {
			const fixture = await instantiateFixtureProgramSource(`8f4e/v1
function ${name}
param int value
push value
functionEnd int
function ${name}
param float value
push value
functionEnd float
function integerAnswer
#export
push 7
call ${name}
functionEnd int
function floatAnswer
#export
push 1.25
call ${name}
functionEnd float`);
			expect(getExportedFunction(fixture.instance.exports, 'integerAnswer')()).toBe(7);
			expect(getExportedFunction(fixture.instance.exports, 'floatAnswer')()).toBe(1.25);
		}
	);
});
