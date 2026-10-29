import {
	getUniqueName,
	parseBlockDirectives,
	type TransformPastedCodeBlocksEvent,
	updateDirectiveArgs,
} from '@8f4e/editor-state';
import type { State } from '@8f4e/editor-state-types';
import { getGroup } from './groups';

export function renamePastedGroups(incoming: TransformPastedCodeBlocksEvent, state: State): void {
	const existingNames = new Set(
		state.codeBlockRendering.codeBlocks.flatMap(block => {
			const group = getGroup(block.parsedDirectives);
			return group ? [group.name] : [];
		})
	);
	const names = new Map<string, string>();
	incoming.blocks = incoming.blocks.map(block => {
		const name = getGroup(parseBlockDirectives(block.code))?.name;
		if (!name) return block;
		if (!names.has(name)) {
			const uniqueName = getUniqueName(name, existingNames);
			names.set(name, uniqueName);
			existingNames.add(uniqueName);
		}
		const uniqueName = names.get(name)!;
		return {
			...block,
			code: updateDirectiveArgs(block.code, 'group', args =>
				args[0] === name ? [uniqueName, ...args.slice(1)] : args
			),
		};
	});
}
