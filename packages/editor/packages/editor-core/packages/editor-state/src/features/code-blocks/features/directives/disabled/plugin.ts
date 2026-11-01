import { createDirectiveDefinition } from '../utils';

export default createDirectiveDefinition('disabled', (_, draft) => {
	draft.blockState.disabled = true;
});
