import type { EditorPlugin } from '@8f4e/editor-core';
import { resolveMemoryTarget } from '@8f4e/editor-state/memory';
import { getKeyboardMemoryConfig, keyboardEditorConfigSchemaContribution } from './config';
import eventCodeToUsbHidUsageId from './eventCodeToUsbHidUsageId';

export function createKeyboardMemoryPlugin({
	inputTarget,
	writeMemory,
}: {
	inputTarget: HTMLElement;
	writeMemory: (address: number, value: number, isInteger: boolean) => void;
}): EditorPlugin {
	return {
		id: 'keyboard-memory',
		setup: ({ store }) => {
			const pressOrder: number[] = [];
			let lastConfig = { ...getKeyboardMemoryConfig(store.getState()) };

			function write(memoryId: string | undefined, value: number): void {
				const state = store.getState();
				const memory = resolveMemoryTarget(state, { kind: 'project', groupPath: '' }, memoryId)?.memory;
				if (memory) writeMemory(memory.allocationUnitAddress, value, true);
			}

			function publish(): void {
				const config = getKeyboardMemoryConfig(store.getState());
				if (!config) return;
				const latest = pressOrder.at(-1);
				if (latest !== undefined) write(config.keyCodeMemory, latest);
				write(config.keyPressedMemory, latest === undefined ? 0 : 1);
			}

			function onKeydown(event: KeyboardEvent): void {
				if (!getKeyboardMemoryConfig(store.getState())) return;
				const code = eventCodeToUsbHidUsageId(event.code) ?? 0;
				const index = pressOrder.indexOf(code);
				if (index !== -1) pressOrder.splice(index, 1);
				pressOrder.push(code);
				publish();
			}

			function onKeyup(event: KeyboardEvent): void {
				const code = eventCodeToUsbHidUsageId(event.code) ?? 0;
				const index = pressOrder.indexOf(code);
				if (index !== -1) pressOrder.splice(index, 1);
				publish();
			}

			function clearPressedKeys(): void {
				pressOrder.length = 0;
				publish();
			}

			function syncConfig(): void {
				const config = getKeyboardMemoryConfig(store.getState());
				if (
					config?.keyCodeMemory === lastConfig?.keyCodeMemory &&
					config?.keyPressedMemory === lastConfig?.keyPressedMemory
				)
					return;
				lastConfig = { ...config };
				clearPressedKeys();
			}

			inputTarget.addEventListener('keydown', onKeydown);
			inputTarget.addEventListener('keyup', onKeyup);
			inputTarget.addEventListener('blur', clearPressedKeys);
			store.subscribe('editorConfig.keyboard', syncConfig);
			store.set('editorConfigSchemaContributions.keyboard', keyboardEditorConfigSchemaContribution);

			return () => {
				clearPressedKeys();
				inputTarget.removeEventListener('keydown', onKeydown);
				inputTarget.removeEventListener('keyup', onKeyup);
				inputTarget.removeEventListener('blur', clearPressedKeys);
				store.unsubscribe('editorConfig.keyboard', syncConfig);
				const schemas = { ...store.getState().editorConfigSchemaContributions };
				delete schemas.keyboard;
				store.set('editorConfigSchemaContributions', schemas);
			};
		},
	};
}
