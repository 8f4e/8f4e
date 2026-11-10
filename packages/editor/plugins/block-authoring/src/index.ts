import type { CodeBlockGraphicData, EditorPlugin } from '@8f4e/editor-core';
import { deleteCodeBlocks } from '@8f4e/editor-state';
import { documentBlockInstructionByType } from '@8f4e/language-spec';

const newBlocks = [
	{ type: 'module', title: 'New Module' },
	{ type: 'function', title: 'New Function' },
	{ type: 'prototype', title: 'New Prototype' },
	{ type: 'note', title: 'New Note' },
] as const;

type NewBlockType = (typeof newBlocks)[number]['type'];

const nameList = [
	'quark',
	'electron',
	'positron',
	'muon',
	'tau',
	'neutrino',
	'photon',
	'gluon',
	'boson',
	'lepton',
	'axion',
	'curvaton',
	'dilaton',
	'graviton',
	'inflaton',
	'majoron',
	'preon',
	'tachyon',
	'pion',
	'baryon',
	'proton',
	'neutron',
	'nucleon',
	'kaon',
	'meson',
	'hadron',
	'dropleton',
	'anyon',
	'exciton',
	'fracton',
	'magnon',
	'plasmon',
	'polariton',
	'polaron',
	'roton',
	'trion',
];

function getRandomCodeBlockName() {
	return nameList[Math.floor(Math.random() * nameList.length)];
}

export const blockAuthoringPlugin: EditorPlugin = {
	id: 'block-authoring',
	setup: ({ store, events, menus }) => {
		const onCreate = ({ x, y, blockType }: { x: number; y: number; blockType: NewBlockType }) => {
			if (store.getState().editorMode !== 'edit') return;
			const block = documentBlockInstructionByType[blockType];
			const name = blockType === 'note' ? '' : ` ${getRandomCodeBlockName()}`;
			events.dispatch('insertCodeBlock', { x, y, code: [block.start + name, '', '', block.end] });
		};
		const onDelete = ({ codeBlock }: { codeBlock: CodeBlockGraphicData }) => {
			if (store.getState().editorMode !== 'edit') return;
			deleteCodeBlocks(store, [codeBlock]);
		};
		const removeNewItems = newBlocks.map(({ type, title }) =>
			menus.registerItem('mainMenu', ({ state }) => {
				if (state.editorMode !== 'edit') return;
				return { title, action: 'createCodeBlock', payload: { blockType: type }, close: true };
			})
		);
		const removeDeleteItem = menus.registerItem('moduleMenu', ({ state, codeBlock }) => {
			if (state.editorMode !== 'edit') return;
			const label = codeBlock.childProject
				? 'group'
				: codeBlock.blockType === 'function'
					? 'function'
					: codeBlock.blockType === 'note'
						? 'note'
						: 'module';
			return { title: `Delete ${label}`, action: 'deleteCodeBlock', payload: { codeBlock }, close: true };
		});
		events.on('createCodeBlock', onCreate);
		events.on('deleteCodeBlock', onDelete);
		return () => {
			for (const remove of removeNewItems) remove();
			removeDeleteItem();
			events.off('createCodeBlock', onCreate);
			events.off('deleteCodeBlock', onDelete);
		};
	},
};
