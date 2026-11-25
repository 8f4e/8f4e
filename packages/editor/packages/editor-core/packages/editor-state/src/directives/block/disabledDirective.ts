import { createDirectiveDefinition } from '../directiveRecords';

export default createDirectiveDefinition('disabled', (_, draft) => {
	draft.blockState.disabled = true;
});
