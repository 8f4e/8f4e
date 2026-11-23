import type { EventDispatcher, State } from '@8f4e/editor-state-types';
import type { StateManager } from '@8f4e/state-manager';
import { applyCodeBlockSourceEdits } from '../../sourceEdits';
import { findEnvironmentBlock, generateEnvironmentSource } from './source';

/** Refresh the root environment source when its runtime contributions change, regardless of the visible level. */
export default function autoEnvConstants(store: StateManager<State>, events: EventDispatcher): void {
	store.subscribe('envConstantContributions', () => {
		const state = store.getState();
		const environment = findEnvironmentBlock(state.codeBlockRendering.rootProject);
		if (!environment) return;
		const code = generateEnvironmentSource(state.envConstantContributions, {
			x: environment.gridX,
			y: environment.gridY,
		});
		applyCodeBlockSourceEdits({ store, events }, [{ codeBlock: environment, code }]);
	});
}
