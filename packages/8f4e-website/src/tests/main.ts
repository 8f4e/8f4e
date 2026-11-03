import { mountGallery } from '../gallery';
import { projectCategories } from './projects';

const dispose = mountGallery({
	title: 'Compiler tests',
	categories: projectCategories,
	featureFlags: { modeToggling: false },
});

import.meta.hot?.dispose(dispose);
