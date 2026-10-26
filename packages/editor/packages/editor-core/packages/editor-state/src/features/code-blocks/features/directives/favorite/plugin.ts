import { createDirectiveDefinition } from '../utils';

export default createDirectiveDefinition('favorite', (_, draft) => {
	draft.blockState.isFavorite = true;
});
