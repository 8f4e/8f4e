import { mountExampleGallery } from '../example-gallery';
import { projectCategories } from './projects';

const dispose = mountExampleGallery('Unlisted examples', projectCategories);

import.meta.hot?.dispose(dispose);
