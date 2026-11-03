import { expect, it } from 'vitest';
import { mapSourceScope } from './mapSourceScope';
import { isBlock, readProjectSource, sourceLines } from './projectSource';

it('visits groups across reopened entries without crossing child scope boundaries or mutating the source', () => {
	const source =
		'entry main\ngroup a\nentry main\ngroup hidden\ngroupEnd\nentryEnd\ngroupEnd\nentryEnd\nentry other\nmodule tick\nmoduleEnd\nentryEnd\nentry main\ngroup b\ngroupEnd\nentryEnd';
	const nodes = readProjectSource(source);
	const visited: string[] = [];
	const changed = mapSourceScope(nodes, (node, context) => {
		if (isBlock(node)) {
			visited.push(`${context}:${node.start.text}`);
			if (node.opener === 'group') return [{ ...node, start: { ...node.start, text: node.start.text + '_changed' } }];
		}
		return [node];
	});
	expect(visited).toEqual(['entry:group a', 'entry:module tick', 'entry:group b']);
	expect(sourceLines(nodes).join('\n')).toBe(source);
	expect(sourceLines(changed).join('\n')).toContain('group hidden');
	expect(sourceLines(changed).join('\n')).toContain('group a_changed');
	expect(sourceLines(changed).join('\n')).toContain('group b_changed');
});
