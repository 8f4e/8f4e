import { mountGallery } from '../gallery';
import { projectCategories } from './projects';

const dispose = mountGallery({
	title: 'Compiler tests',
	categories: projectCategories,
	includeKeyboardModeSwitching: false,
});

import.meta.hot?.dispose(dispose);
