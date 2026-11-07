/** Finds nodes in strongly connected components without using the JavaScript call stack. */
export function findRecursiveNodes(edges: ReadonlyMap<string, readonly string[]>): Set<string> {
	const reverse = new Map<string, string[]>([...edges.keys()].map(id => [id, []]));
	for (const [caller, targets] of edges) {
		for (const target of targets) reverse.get(target)!.push(caller);
	}

	const visited = new Set<string>();
	const finished: string[] = [];
	for (const root of edges.keys()) {
		if (visited.has(root)) continue;
		visited.add(root);
		const stack = [{ id: root, nextTarget: 0 }];
		while (stack.length) {
			const frame = stack[stack.length - 1];
			const targets = edges.get(frame.id)!;
			if (frame.nextTarget === targets.length) {
				finished.push(frame.id);
				stack.pop();
				continue;
			}
			const target = targets[frame.nextTarget++];
			if (visited.has(target)) continue;
			visited.add(target);
			stack.push({ id: target, nextTarget: 0 });
		}
	}

	const assigned = new Set<string>();
	const recursive = new Set<string>();
	for (const root of finished.reverse()) {
		if (assigned.has(root)) continue;
		assigned.add(root);
		const component: string[] = [];
		const stack = [root];
		while (stack.length) {
			const id = stack.pop()!;
			component.push(id);
			for (const caller of reverse.get(id)!) {
				if (assigned.has(caller)) continue;
				assigned.add(caller);
				stack.push(caller);
			}
		}
		if (component.length > 1 || edges.get(root)!.includes(root)) {
			for (const id of component) recursive.add(id);
		}
	}
	return recursive;
}
