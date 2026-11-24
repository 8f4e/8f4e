import { createDirectiveDefinition } from '../directiveRecords';

export default createDirectiveDefinition('alwaysOnTop', (_directive, draft) => {
	draft.blockState.alwaysOnTop = true;
});
