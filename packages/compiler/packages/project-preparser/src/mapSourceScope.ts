import { isBlock, type SourceNode } from './projectSource';

/** Entries share their owning scope. Child groups are visited without descending into their private scopes. */
export function mapSourceScope(
	nodes: SourceNode[],
	visit: (node: SourceNode, context: 'scope' | 'entry') => SourceNode[]
): SourceNode[] {
	return nodes.flatMap(node =>
		isBlock(node) && node.opener === 'entry'
			? [{ ...node, children: node.children.flatMap(child => visit(child, 'entry')) }]
			: visit(node, 'scope')
	);
}
