import { createDirectiveDefinition } from '../utils';

export default createDirectiveDefinition('alwaysOnTop', (_directive, draft) => {
	draft.blockState.alwaysOnTop = true;
});
